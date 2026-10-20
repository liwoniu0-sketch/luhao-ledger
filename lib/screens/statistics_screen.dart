import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/ledger_provider.dart';
import '../models/ledger_models.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({super.key});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LedgerProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('财务统计与分析', style: TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.indigo,
          labelColor: Colors.indigo,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(icon: Icon(Icons.calendar_view_month), text: '当月统计汇总'),
            Tab(icon: Icon(Icons.all_inclusive), text: '全部记录汇总'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMonthlyView(context, provider),
          _buildAllTimeView(context, provider),
        ],
      ),
    );
  }

  Widget _buildMonthlyView(BuildContext context, LedgerProvider provider) {
    final stats = provider.monthlyStats;
    if (stats == null) {
      return const Center(child: Text('暂无当月数据'));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 月份选择与标题
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${provider.selectedMonth} 月度财务报表',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              if (provider.availableMonths.isNotEmpty)
                DropdownButton<String>(
                  value: provider.selectedMonth,
                  items: provider.availableMonths.map((m) {
                    return DropdownMenuItem(value: m, child: Text(m));
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      provider.setSelectedMonth(val);
                    }
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),

          // 核心三大指标卡片
          _buildSummaryCards(
            totalIncome: stats.totalIncome,
            totalExpense: stats.totalExpense,
            netProfit: stats.netProfit,
            days: stats.recordCount,
          ),
          const SizedBox(height: 20),

          // 成员支出排行榜
          _buildPersonExpenseRanking(stats.personExpenses, stats.totalExpense),
          const SizedBox(height: 20),

          // 成员支出饼图
          if (stats.personExpenses.isNotEmpty && stats.totalExpense > 0)
            _buildPieChartCard('当月成员支出占比', stats.personExpenses, stats.totalExpense),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildAllTimeView(BuildContext context, LedgerProvider provider) {
    final stats = provider.allTimeStats;
    if (stats == null) {
      return const Center(child: Text('暂无历史数据'));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '全部历史累计财务报表',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '跨度 ${stats.totalMonths} 个月 / ${stats.totalDays} 天',
                  style: TextStyle(color: Colors.indigo.shade800, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 全部总三大指标
          _buildSummaryCards(
            totalIncome: stats.totalIncome,
            totalExpense: stats.totalExpense,
            netProfit: stats.netProfit,
            days: stats.totalDays,
          ),
          const SizedBox(height: 20),

          // 全部成员累计支出排行榜
          _buildPersonExpenseRanking(stats.personExpenses, stats.totalExpense),
          const SizedBox(height: 20),

          // 全部成员支出占比饼图
          if (stats.personExpenses.isNotEmpty && stats.totalExpense > 0)
            _buildPieChartCard('累计成员支出占比', stats.personExpenses, stats.totalExpense),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildSummaryCards({
    required double totalIncome,
    required double totalExpense,
    required double netProfit,
    required int days,
  }) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildMetricTile(
                title: '总收入',
                value: '¥${totalIncome.toStringAsFixed(2)}',
                color: Colors.green,
                icon: Icons.trending_up,
                bgGradient: [Colors.green.shade700, Colors.teal.shade600],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricTile(
                title: '总支出',
                value: '¥${totalExpense.toStringAsFixed(2)}',
                color: Colors.deepOrange,
                icon: Icons.trending_down,
                bgGradient: [Colors.deepOrange.shade600, Colors.red.shade600],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildMetricTile(
                title: '净结余 (利润)',
                value: '¥${netProfit.toStringAsFixed(2)}',
                color: Colors.blue,
                icon: Icons.account_balance,
                bgGradient: [Colors.indigo.shade700, Colors.blue.shade700],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricTile(
                title: '总记账天数',
                value: '$days 天',
                color: Colors.purple,
                icon: Icons.event_note,
                bgGradient: [Colors.purple.shade600, Colors.deepPurple.shade600],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
    required List<Color> bgGradient,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: bgGradient, begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: bgGradient.first.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
              Icon(icon, color: Colors.white70, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildPersonExpenseRanking(Map<String, double> personExpenses, double totalExpense) {
    final sortedEntries = personExpenses.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.leaderboard, color: Colors.indigo),
                    SizedBox(width: 8),
                    Text('各成员支出排行榜', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
                Text(
                  '共 ${sortedEntries.length} 位成员',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
            const Divider(height: 20),

            if (sortedEntries.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(12), child: Text('暂无成员支出明细')))
            else
              ...sortedEntries.map((entry) {
                final ratio = totalExpense > 0 ? (entry.value / totalExpense) : 0.0;
                final percentage = (ratio * 100).toStringAsFixed(1);
                final color = _getPersonColor(entry.key);

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                entry.key,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ],
                          ),
                          Text(
                            '¥${entry.value.toStringAsFixed(2)} ($percentage%)',
                            style: TextStyle(
                              color: Colors.grey.shade800,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: ratio.clamp(0.0, 1.0),
                          backgroundColor: Colors.grey.shade200,
                          valueColor: AlwaysStoppedAnimation<Color>(color),
                          minHeight: 8,
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildPieChartCard(String title, Map<String, double> personExpenses, double totalExpense) {
    final entries = personExpenses.entries.toList();

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.pie_chart, color: Colors.indigo),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sectionsSpace: 2,
                  centerSpaceRadius: 40,
                  sections: entries.map((e) {
                    final color = _getPersonColor(e.key);
                    final ratio = totalExpense > 0 ? (e.value / totalExpense * 100) : 0;
                    return PieChartSectionData(
                      color: color,
                      value: e.value,
                      title: '${e.key}\n${ratio.toStringAsFixed(0)}%',
                      radius: 50,
                      titleStyle: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getPersonColor(String name) {
    switch (name) {
      case '红章':
        return Colors.red.shade600;
      case '坤如':
      case '坤茹':
        return Colors.indigo.shade600;
      case '姨':
        return Colors.teal.shade600;
      case '烨文':
        return Colors.cyan.shade600;
      case '坤艳':
        return Colors.purple.shade600;
      default:
        final hash = name.hashCode;
        final colors = [Colors.blue, Colors.orange, Colors.cyan, Colors.pink, Colors.amber, Colors.green];
        return colors[hash.abs() % colors.length];
    }
  }
}
