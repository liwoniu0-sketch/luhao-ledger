class AppSettings {
  String aiProvider; // 'gemini' | 'deepseek' | 'openai' | 'offline_rules' | 'custom'
  String apiEndpoint;
  String apiKey;
  String modelName;
  String customPrompt; // 自定义 AI 提示词
  bool autoAiAfterOcr; // OCR 完成后自动执行 AI 整理
  bool enableAutoAlias;
  bool autoRecognizeNames;
  String customBackupPath; // 自定义备份与下载保存路径
  String cloudflareWorkerUrl; // Cloudflare Worker 财务系统地址
  String cloudflareAuthToken; // Cloudflare 认证 Token (默认 auth_lz_mode)
  bool autoSyncCloudflare; // 是否自动同步 Cloudflare

  static const String defaultSystemPrompt = '''你是一个智能财务记账助手。请从用户输入的记账文本或微信聊天记录中提取结构化财务数据，并严格输出纯 JSON 格式。
【核心硬性规则】：
1. 别名与人名映射：{alias_rules}。红章（爸）、坤如（妈/我）。除了红章与坤如外，所有其他人（如烨文、坤艳、姑、舅等）全部统一归为 "姨"。
2. 严禁只输出总收入和总支出！必须为【每一个成员】分别输出独立的支出对象到 "expenses" 数组中（如红章支出 333.5元，我支出 6.5元，烨文支出22元，坤艳支出6元，则 expenses 包含红章、坤如、姨）。当有多位其他人消费时，姨的备注中注明具体消费人员明细。
3. 提取单日总收入（如 "收入 473.5元"），严禁将总支出汇总混入单人支出。
4. 提取日期（格式 YYYY-MM-DD，若只有月日则按指定年份 {target_year} 拼接）。
5. 类别固定为 "日常支出"。

【输出 JSON Schema 示例】：
{
  "date": "2023-09-19",
  "totalIncome": 473.5,
  "specialNote": "烨文22元，坤艳6元",
  "expenses": [
    {"personName": "红章", "amount": 333.5, "category": "日常支出", "note": ""},
    {"personName": "坤如", "amount": 6.5, "category": "日常支出", "note": ""},
    {"personName": "姨", "amount": 28.0, "category": "日常支出", "note": "烨文22元，坤艳6元"}
  ]
}
只输出纯 JSON，不要包含任何 markdown 标签或多余解释。''';

  AppSettings({
    this.aiProvider = 'gemini',
    this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    this.apiKey = '',
    this.modelName = 'gemini-3.7-flash',
    String? customPrompt,
    this.autoAiAfterOcr = true,
    this.enableAutoAlias = true,
    this.autoRecognizeNames = true,
    this.customBackupPath = '',
    this.cloudflareWorkerUrl = '',
    this.cloudflareAuthToken = 'auth_lz_mode',
    this.autoSyncCloudflare = false,
  }) : customPrompt = customPrompt ?? defaultSystemPrompt;

  Map<String, dynamic> toJson() => {
    'aiProvider': aiProvider,
    'apiEndpoint': apiEndpoint,
    'apiKey': apiKey,
    'modelName': modelName,
    'customPrompt': customPrompt,
    'autoAiAfterOcr': autoAiAfterOcr,
    'enableAutoAlias': enableAutoAlias,
    'autoRecognizeNames': autoRecognizeNames,
    'customBackupPath': customBackupPath,
    'cloudflareWorkerUrl': cloudflareWorkerUrl,
    'cloudflareAuthToken': cloudflareAuthToken,
    'autoSyncCloudflare': autoSyncCloudflare,
  };

  factory AppSettings.fromJson(Map<String, dynamic> json) => AppSettings(
    aiProvider: json['aiProvider'] ?? 'gemini',
    apiEndpoint: json['apiEndpoint'] ?? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: json['apiKey'] ?? '',
    modelName: json['modelName'] ?? 'gemini-3.7-flash',
    customPrompt: json['customPrompt'] ?? defaultSystemPrompt,
    autoAiAfterOcr: json['autoAiAfterOcr'] == 1 || json['autoAiAfterOcr'] == true,
    enableAutoAlias: json['enableAutoAlias'] == 1 || json['enableAutoAlias'] == true,
    autoRecognizeNames: json['autoRecognizeNames'] == 1 || json['autoRecognizeNames'] == true,
    customBackupPath: json['customBackupPath'] ?? '',
    cloudflareWorkerUrl: json['cloudflareWorkerUrl'] ?? '',
    cloudflareAuthToken: json['cloudflareAuthToken'] ?? 'auth_lz_mode',
    autoSyncCloudflare: json['autoSyncCloudflare'] == 1 || json['autoSyncCloudflare'] == true,
  );

  AppSettings copyWith({
    String? aiProvider,
    String? apiEndpoint,
    String? apiKey,
    String? modelName,
    String? customPrompt,
    bool? autoAiAfterOcr,
    bool? enableAutoAlias,
    bool? autoRecognizeNames,
    String? customBackupPath,
    String? cloudflareWorkerUrl,
    String? cloudflareAuthToken,
    bool? autoSyncCloudflare,
  }) {
    return AppSettings(
      aiProvider: aiProvider ?? this.aiProvider,
      apiEndpoint: apiEndpoint ?? this.apiEndpoint,
      apiKey: apiKey ?? this.apiKey,
      modelName: modelName ?? this.modelName,
      customPrompt: customPrompt ?? this.customPrompt,
      autoAiAfterOcr: autoAiAfterOcr ?? this.autoAiAfterOcr,
      enableAutoAlias: enableAutoAlias ?? this.enableAutoAlias,
      autoRecognizeNames: autoRecognizeNames ?? this.autoRecognizeNames,
      customBackupPath: customBackupPath ?? this.customBackupPath,
      cloudflareWorkerUrl: cloudflareWorkerUrl ?? this.cloudflareWorkerUrl,
      cloudflareAuthToken: cloudflareAuthToken ?? this.cloudflareAuthToken,
      autoSyncCloudflare: autoSyncCloudflare ?? this.autoSyncCloudflare,
    );
  }
}
