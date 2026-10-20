# 智能记账 (Smart Ledger) 📱

[![Build & Release Android APK](https://github.com/liwoniu0-sketch/luhao-ledger/actions/workflows/build-release.yml/badge.svg)](https://github.com/liwoniu0-sketch/luhao-ledger/actions/workflows/build-release.yml)

一款专为经营流水与多人日常记账打造的智能记账 Android 手机应用。支持微信群聊记录/手写小票/转账截图 OCR 识别提取、多模态 AI (默认 Google Gemini `gemini-3.7-flash`，可自定义) 智能人名与别名理解、单日总收入与各成员支出自动核算、月度分类报表、累计总览看板、每日特殊情况备注以及全量信息自定义路径备份下载。

---

## 🌟 核心特性

1. **📸 智能识图与免费 OCR 提取**：
   - 支持拍照、从相册选择或直接粘贴微信聊天文本；
   - 内置免费 OCR 图像文字提取通道与 Vision 多模态模型通道。
2. **🤖 AI 智能理解与称谓别名映射**：
   - 默认搭载 Google Gemini `gemini-3.7-flash`（支持在设置中自由切换 DeepSeek / OpenAI / 本地免费规则引擎，可随时修改自定义 API Endpoint 与 API Key）；
   - 自动识别“红章”、“烨文”、“坤艳”等多位成员姓名；
   - 自动将称谓“我”、“妈”映射为真实姓名“坤茹”，支持在设置中自定义扩展别名字典；
   - 智能区分收入、各成员独立支出项与总计汇总行，杜绝金额重复统计。
3. **📊 月度分类与全记录汇总看板**：
   - 按月份自动归类，一键切换不同月份查看当月总收入、总支出与净利润；
   - 累计历史总账本，全周期收支统计与记账天数统计；
   - 各成员支出排行榜与百分比进度条，支出占比饼图直观展示。
4. **📝 每日特殊情况备注**：
   - 每日支持独立记录特殊事件（如“向爸转账已被接收”、“雨天备货”、“调料采购”等）。
5. **💾 全量信息备份与自定义下载路径**：
   - 一键将所有账目、成员明细、特殊备注、别名映射与配置打包导出；
   - 支持自定义选择下载保存的目录文件夹，随时导入还原。
6. **🔒 永久固化签名与软件内无缝升级**：
   - 固化 Android Release 签名密钥，每次构建公钥指纹 100% 恒定，支持在 App 设置中一键检测新版本并直接覆盖安装。

---

## 🛠️ 技术架构

- **跨平台框架**：Flutter 3.22 (Material Design 3)
- **状态管理**：Provider
- **本地持久化**：SQLite (sqflite)
- **图表展示**：fl_chart
- **网络与多模态**：Dio + HTTP
- **CI/CD 构建**：GitHub Actions + Temurin Java 17
