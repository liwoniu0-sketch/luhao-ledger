import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../models/ledger_models.dart';
import '../models/app_settings.dart';
import 'database_service.dart';

class CloudflareSyncResult {
  final bool success;
  final String message;
  final int syncedCount;

  CloudflareSyncResult({
    required this.success,
    required this.message,
    this.syncedCount = 0,
  });
}

class CloudflareSyncService {
  static final CloudflareSyncService instance = CloudflareSyncService._internal();
  CloudflareSyncService._internal();

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 25),
  ));

  /// 计算像 "20+15" 或 "=333.5" 的算式字符串
  double _solveFormula(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    try {
      String cleanStr = val.toString().replaceAll(RegExp(r'\s+'), '').replaceFirst('=', '');
      if (cleanStr.isEmpty) return 0.0;
      final parts = cleanStr.split('+');
      double sum = 0.0;
      for (var p in parts) {
        final n = double.tryParse(p);
        if (n != null) sum += n;
      }
      return double.parse(sum.toStringAsFixed(4));
    } catch (_) {
      return 0.0;
    }
  }

  /// 1. 从 Cloudflare Worker 拉取数据并同步导入本地 SQLite
  Future<CloudflareSyncResult> pullFromCloudflare(AppSettings settings) async {
    final baseUrl = settings.cloudflareWorkerUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (baseUrl.isEmpty) {
      return CloudflareSyncResult(success: false, message: '请先在规则设置中配置 Cloudflare Worker 地址');
    }

    try {
      final endpoint = '$baseUrl/api/get-data';
      final response = await _dio.get(
        endpoint,
        options: Options(headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }),
      );

      if (response.statusCode != 200 || response.data == null) {
        return CloudflareSyncResult(success: false, message: '服务器响应异常 (${response.statusCode})');
      }

      dynamic rawData = response.data;
      if (rawData is String) {
        rawData = jsonDecode(rawData);
      }

      if (rawData is! List) {
        return CloudflareSyncResult(success: false, message: '返回数据格式不正确 (非列表)');
      }

      final db = DatabaseService.instance;
      int importedCount = 0;

      for (var monthBlock in rawData) {
        String monthName = monthBlock['monthName'] ?? ''; // 例如 "2023年9月"
        int year = DateTime.now().year;
        int month = DateTime.now().month;

        // 解析年份与月份
        final ymMatch = RegExp(r'(\d{4})年(\d{1,2})月').firstMatch(monthName);
        if (ymMatch != null) {
          year = int.parse(ymMatch.group(1)!);
          month = int.parse(ymMatch.group(2)!);
        } else {
          final ymMatch2 = RegExp(r'(\d{4})[\-\/](\d{1,2})').firstMatch(monthName);
          if (ymMatch2 != null) {
            year = int.parse(ymMatch2.group(1)!);
            month = int.parse(ymMatch2.group(2)!);
          }
        }

        List<String> memberNames = ['红章', '坤如', '姨'];
        if (monthBlock['memberNames'] is List) {
          final mList = (monthBlock['memberNames'] as List).map((e) => e.toString().trim()).toList();
          if (mList.isNotEmpty) {
            memberNames = mList;
            if (memberNames.length >= 2 && memberNames[1] == '坤茹') memberNames[1] = '坤如';
            if (memberNames.length >= 3 && ['烨文', '坤艳'].contains(memberNames[2])) memberNames[2] = '姨';
            while (memberNames.length < 3) {
              memberNames.add(memberNames.length == 0 ? '红章' : (memberNames.length == 1 ? '坤如' : '姨'));
            }
          }
        }

        final rows = monthBlock['rows'] as List?;
        if (rows != null) {
          for (var row in rows) {
            String dateStr = row['date'] ?? ''; // 例如 "9/19" 或 "2023-09-19"
            String fullDate = '';

            if (dateStr.contains('-') && dateStr.length >= 8) {
              fullDate = dateStr;
            } else if (dateStr.contains('/')) {
              final dp = dateStr.split('/');
              if (dp.length >= 2) {
                int m = int.tryParse(dp[0]) ?? month;
                int d = int.tryParse(dp[1]) ?? 1;
                fullDate = DateFormat('yyyy-MM-dd').format(DateTime(year, m, d));
              }
            } else {
              int d = int.tryParse(dateStr) ?? 1;
              fullDate = DateFormat('yyyy-MM-dd').format(DateTime(year, month, d));
            }

            // 收入
            double i1 = _solveFormula(row['i1']);
            double i2 = _solveFormula(row['i2']);
            double i3 = _solveFormula(row['i3']);
            double totalIncome = i1 + i2 + i3;

            // 各成员支出
            List<ExpenseItem> expenses = [];

            double fAm = _solveFormula(row['f_am']);
            if (fAm > 0) {
              expenses.add(ExpenseItem(
                personName: memberNames[0],
                amount: fAm,
                category: (row['f_it'] != null && row['f_it'].toString().trim().isNotEmpty) ? row['f_it'].toString().trim() : '日常支出',
                note: '',
              ));
            }

            double mAm = _solveFormula(row['m_am']);
            if (mAm > 0) {
              expenses.add(ExpenseItem(
                personName: memberNames.length > 1 ? memberNames[1] : '坤如',
                amount: mAm,
                category: (row['m_it'] != null && row['m_it'].toString().trim().isNotEmpty) ? row['m_it'].toString().trim() : '日常支出',
                note: '',
              ));
            }

            double aAm = _solveFormula(row['a_am']);
            if (aAm > 0) {
              expenses.add(ExpenseItem(
                personName: memberNames.length > 2 ? memberNames[2] : '姨',
                amount: aAm,
                category: (row['a_it'] != null && row['a_it'].toString().trim().isNotEmpty) ? row['a_it'].toString().trim() : '日常支出',
                note: '',
              ));
            }

            String note = row['note'] ?? '';

            final ledger = DailyLedger(
              date: fullDate,
              totalIncome: totalIncome,
              expenses: expenses,
              specialNote: note,
            );

            await db.saveDailyRecord(ledger);
            importedCount++;
          }
        }
      }

      return CloudflareSyncResult(
        success: true,
        message: '成功从 Cloudflare 同步 $importedCount 条账目记录！',
        syncedCount: importedCount,
      );
    } catch (e) {
      return CloudflareSyncResult(success: false, message: '同步拉取失败: $e');
    }
  }

  /// 2. 将本地 SQLite 账目打包推送覆盖至 Cloudflare Worker KV
  Future<CloudflareSyncResult> pushToCloudflare(AppSettings settings) async {
    final baseUrl = settings.cloudflareWorkerUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (baseUrl.isEmpty) {
      return CloudflareSyncResult(success: false, message: '请先在规则设置中配置 Cloudflare Worker 地址');
    }

    try {
      final db = DatabaseService.instance;
      final allMonths = await db.getAvailableMonths(); // ['2023-09', ...]

      List<Map<String, dynamic>> monthBlocks = [];

      for (var monthKey in allMonths) {
        final records = await db.getRecordsByMonth(monthKey);
        if (records.isEmpty) continue;

        final parts = monthKey.split('-');
        int year = int.tryParse(parts[0]) ?? DateTime.now().year;
        int month = int.tryParse(parts[1]) ?? DateTime.now().month;
        String monthName = '${year}年${month}月';

        // 统一固定核心成员：红章、坤如、姨
        List<String> memberNames = ['红章', '坤如', '姨'];

        List<Map<String, dynamic>> rows = [];
        for (var r in records) {
          // date 简写为 M/D
          String shortDate = r.date;
          if (r.date.length >= 10) {
            final dp = r.date.split('-');
            if (dp.length == 3) {
              shortDate = '${int.tryParse(dp[1]) ?? dp[1]}/${int.tryParse(dp[2]) ?? dp[2]}';
            }
          }

          double fAm = 0.0;
          String fIt = '';
          double mAm = 0.0;
          String mIt = '';
          double aAm = 0.0;
          String aIt = '';

          for (var exp in r.expenses) {
            if (['红章', '爸', '父', '老爸'].contains(exp.personName)) {
              fAm += exp.amount;
              fIt = exp.category;
            } else if (['坤如', '坤茹', '妈', '母', '老妈', '我'].contains(exp.personName)) {
              mAm += exp.amount;
              mIt = exp.category;
            } else {
              // 其他所有人均归入 姨
              aAm += exp.amount;
              aIt = exp.category;
            }
          }

          rows.add({
            'id': DateTime.tryParse(r.date)?.millisecondsSinceEpoch ?? DateTime.now().millisecondsSinceEpoch,
            'date': shortDate,
            'f_it': fIt,
            'f_am': fAm > 0 ? fAm.toString() : '0',
            'f_ck': fAm > 0,
            'm_it': mIt,
            'm_am': mAm > 0 ? mAm.toString() : '0',
            'm_ck': mAm > 0,
            'a_it': aIt,
            'a_am': aAm > 0 ? aAm.toString() : '0',
            'a_ck': aAm > 0,
            'i1': r.totalIncome > 0 ? r.totalIncome.toString() : '0',
            'i2': '0',
            'i3': '0',
            'note': r.specialNote,
          });
        }

        monthBlocks.add({
          'id': DateTime(year, month, 1).millisecondsSinceEpoch,
          'monthName': monthName,
          'memberNames': memberNames,
          'rows': rows,
          'isHidden': false,
        });
      }

      final endpoint = '$baseUrl/api/save';
      final auth = settings.cloudflareAuthToken.isNotEmpty ? settings.cloudflareAuthToken : 'auth_lz_mode';

      final response = await _dio.post(
        endpoint,
        options: Options(headers: {
          'Authorization': auth,
          'Content-Type': 'text/plain;charset=UTF-8',
        }),
        data: jsonEncode(monthBlocks),
      );

      if (response.statusCode == 200) {
        return CloudflareSyncResult(
          success: true,
          message: '成功将本地账目推送到 Cloudflare (${monthBlocks.length} 个月份)！',
          syncedCount: monthBlocks.length,
        );
      } else {
        return CloudflareSyncResult(
          success: false,
          message: '推送失败: HTTP ${response.statusCode}',
        );
      }
    } catch (e) {
      return CloudflareSyncResult(success: false, message: '推送到 Cloudflare 失败: $e');
    }
  }
}
