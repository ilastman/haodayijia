# AGENTS.md

呼伦贝尔旅游小程序 + PC 超管后台 + 员工销售工作台。微信小程序（原生）+ 微信云开发（云函数 + 云数据库 + 云存储）。

## 环境

- 小程序 AppID：`wx01bb5f6cfc904f92`
- 云开发环境 ID：`cloudbase-d3gptvn88e6a4d78a`（地域 `ap-shanghai`，个人版）
- PC 后台公网地址（默认托管域，根 = `admin/`）：`https://cloudbase-d3gptvn88e6a4d78a-1376001235.tcloudbaseapp.com/`
- 统一云函数网关：`https://cloudbase-d3gptvn88e6a4d78a.service.tcloudbase.com/httpGateway`
- 后台账号：`admin` / `admin123`
- Shell：Windows PowerShell 5.1。**不能用** `&&`、`.ps1`、`tail`/`grep`/`sed`；用 `;`、`Select-Object`、`Select-String`。tcb 命令用 `& "$env:APPDATA\npm\tcb.cmd" ...`。

## 目录

- 小程序页面/逻辑：`pages/`、`utils/`（`utils/workbench.js` 为员工端数据层）
- PC 后台（Vue3 CDN）：`admin/`（`admin/js/views/*.js` 为各视图，`admin/js/config.js` 配置数据源）
- 云函数：`cloudfunctions/<name>/index.js`（每个独立，含 `auth.js` 时用盐 `songtsam-cms-2026`）
- 数据库定义/规则：`db/schema/*.json`、`db/rules.json`（安全规则需在控制台或按下方 API 应用）
- 工具：`tools/`（`deploy-fn.js` 为云函数部署工具）

## 常用命令

```powershell
# 语法校验（无构建/测试框架，改 JS 后用 node --check）
node --check pages\workbench\workbench.js
node --check tools\deploy-fn.js

# 部署云函数（★ 必须用本工具，见下方说明）
node tools\deploy-fn.js staffCRUD
node tools\deploy-fn.js workOrderPdf --timeout 30 --memory 512
node tools\deploy-fn.js --all

# 部署 PC 后台到托管
& "$env:APPDATA\npm\tcb.cmd" hosting deploy ./admin -e cloudbase-d3gptvn88e6a4d78a --entry index.html --verify

# 调用云函数（调试）
& "$env:APPDATA\npm\tcb.cmd" fn invoke workbenchInit --params '{}' -e cloudbase-d3gptvn88e6a4d78a --json
```

## 关键须知：云函数部署

**本机环境下 `tcb fn deploy` / `tcb fn code update` 会「报告成功但实际未更新代码」**（下载/调用验证仍为旧代码）。原因疑似 CLI 走内网端点或更新接口静默失败。

**改用 `node tools/deploy-fn.js <函数名>`**：直连公网 SCF API（`scf.tencentcloudapi.com`）以 `ZipFile` 方式调用 `UpdateFunctionCode`，并指定 `Namespace=<envId>`（不是 default）。

注意事项：
- 工具读取 `~/.config/.cloudbase/auth.json` 的临时凭证；**登录态过期会报 `TokenFailure`**，先执行任意 tcb 命令刷新（如 `tcb fn list -e <env>`）再部署。
- 若 shell 中设置了环境变量 `USE_INTERNAL_ENDPOINT`（即使是空值），tcb CLI 会改用不可达的 `*.internal.tencentcloudapi.com`，需先 `Remove-Item Env:USE_INTERNAL_ENDPOINT`。
- 新建函数：`tcb fn copy <已有函数> <新函数>` 可创建（`fn deploy` 新建会超时）。
- 集合安全规则：文档型集合 ACL 为 `ADMINONLY`（客户端直连全关闭，读写一律走云函数）。新增集合后在控制台设为「仅管理员可读写」。

## 架构约定

- 所有数据库读写都经云函数（服务端管理员身份，绕过安全规则）；客户端直连一律关闭。
- 员工身份：`staff` 表按 `openid`（来自 `cloud.getWXContext()`，绝不信任客户端传入的 staffId）解析；员工无删除能力（仅归档）。
- 管理员：`adminUser.extend.token` 校验；仅超管可硬删除。
- 网关白名单：`cloudfunctions/httpGateway/index.js` 的 `ALLOWED`（`reminderScheduler` 刻意不加入，避免公网触发群发）。
- 存储桶/文件：PDF 由 `workOrderPdf` 生成。函数内置 `fonts/NotoSansSC-Regular.otf`（Noto Sans SC），不配字体也能显示中文。`globalConfig.alert.pdfFontFileID` / `pdfFontUrl` 只用于替换字体，失败会回退内置字体。

## 待办（上线前）

1. 部署 `workOrderPdf` 后行程单中文走内置 Noto Sans SC。只有要替换字体时，才在后台「预警设置」填写 `pdfFontFileID`。
2. 订阅消息：在 `globalConfig.alert.msgTemplates` 配置模板 ID，并确认 `reminderScheduler` 具备 `subscribeMessage.send` 权限。
3. 小程序端在微信开发者工具中回归（工作台绑定/建单/归档/PDF 等）。
