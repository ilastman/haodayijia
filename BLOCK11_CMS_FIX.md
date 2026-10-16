# Block 11 完成：修复文件编码损坏 + 打通CMS浏览器调用

## 一、修复严重问题：早期用 PowerShell here-string 写入的文件被破坏
PowerShell 双引号 here-string 会吞掉反引号、保留 `\"`，导致以下文件语法错误/不可用，已全部重写：
- `cms/index.html`（模板反引号被吞、`\"` 残留）
- `cms/js/views/login.js`
- `cms/js/views/home-module.js`
- `cms/js/views/banner.js`
- `cms/js/views/private-group.js`
- `cms/js/views/inspiration-audit.js`
- `cms/js/views/settings.js`
- `db/schema/homeModule.json`（`\"` 转义损坏）

> 注：`tools/preview-data.js`、`tools/preview-runtime.js` 为项目原有文件，未改动。

## 二、打通CMS在PC浏览器直开
1. `cms/js/api.js`：
   - 支持 `wx.cloud`（微信环境）与 `httpGateway`（浏览器 fetch 网关）两种通道
   - `uploadImage` 支持浏览器 `File` → base64 上传
2. `cloudfunctions/fileUpload/index.js`：新增 `fileBase64` + `ext` 入参，浏览器端可上传。
3. 各视图图片上传统一改为传 `File` 对象 + 扩展名。

## 三、校验
- 全部 JS（30个：cloudfunctions + cms）`node --check` 通过
- 全部 db JSON（5个）`ConvertFrom-Json` 通过
- 全仓库扫描确认无其余 `\"` 损坏文件

## 使用提示
- 浏览器直开 CMS：先为云函数开启 HTTP 触发，并把地址填入 `API.httpGateway`（形如 `.../cms/{name}`）。
- 或直接在微信开发者工具内打开，走 `wx.cloud`。
