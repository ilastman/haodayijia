# 旅行社小程序 · 云开发后端 + PC CMS

松赞式简约高端风格旅行社微信小程序的云开发后端与内容管理后台。
本仓库包括云开发代码、CMS，以及小程序前端的数据对接层——仅新增数据加载逻辑，未改动原有页面 UI 与样式。

## 技术栈
- 后端：微信云开发（云数据库 + 云存储 + 云函数），云函数 `nodejs16`
- 前端（CMS）：Vue 3 + Element Plus（CDN，纯静态，无需构建）
- 数据库：8 个集合，所有集合预留 `extend:{}`，便于后续迁移自建 Node 后端

## 目录结构
```
cloudfunctions/     云函数（13个）
  httpGateway       HTTP 访问网关（浏览器 CMS 统一转发，仅此函数需开 HTTP 触发）
  login             管理员登录（sha256 密码校验 + token 落库）
  adminInit         初始化管理员（首次部署）
  fileUpload        图片上传云存储（支持 filePath / base64）
  homeModuleCRUD    首页板块（增删改查 + 拖拽排序）
  bannerCRUD        轮播（增删改查 + 拖拽排序）
  scenicCRUD        景区
  hotelCRUD         酒店
  privateGroupCRUD  私家团（dayList：dayNum/dayTitle/scenicId/hotelId/dayContent）
  userTripCRUD      用户行程（list / 我的行程 myTrips / 保存 save）
  inspirationPostCRUD 灵感广场（查询/审核/删除/评论）
  dataSeed          写入演示数据（仅空集合）
  dataExport        导出全部数据 JSON（迁移用）
  每个目录含 auth.js（密码加密 + token 校验公共模块）
db/
  schema/           集合字段定义（homeModule / core / products / ugc_admin）
  rules.json        数据库权限规则说明
cms/
  index.html        CMS 单页入口
  css/style.css     极简样式
  js/api.js         云函数调用封装（wx.cloud / HTTP 网关）
  js/router.js      路由定义
  js/views/*.js     8个管理页面
utils/cloud.js      小程序端云调用预备工具
project.config.json 已配置 cloudfunctionRoot
```

## 八个集合
`homeModule`、`banner`、`scenic`、`hotel`、`privateGroup`、`userTrip`、`inspirationPost`、`adminUser`
字段详见 `db/schema/`。

## 权限要点
- 修改 / 新增 / 删除：**必须管理员登录 token**
- 灵感广场：用户发布默认 `auditStatus=0`（待审核），小程序仅展示 `auditStatus=1`（审核通过）
- `adminUser`：仅管理员可访问

## 快速开始
详见 **`云开发部署指南.md`**。核心步骤：
1. 开通云开发，获得 envId
2. 创建 8 个集合，按 `db/schema/` 建字段与索引
3. 按 `db/rules.json` 配置权限
4. 上传部署云函数（右键「上传并部署：云端安装依赖」）
5. 调用 `adminInit` 创建管理员（密码自动加密）
6. 打开 `cms/index.html` 登录管理
7. （可选）调用 `dataSeed` 写入演示数据

## CMS 页面
登录、首页板块（拖拽排序）、Banner（拖拽排序）、景区、酒店、私家团（多日行程下拉选景区/酒店）、灵感广场审核、系统设置（含数据工具）。

## 小程序对接（已完成）
- `app.js`：`onLaunch` 中 `wx.cloud.init`（未开通/占位appid时静默跳过）
- `utils/api.js`：数据服务层，调用云函数并将结果映射为页面原有数据结构；**云端不可用时自动回退本地静态数据**，保证 UI 不空白
- 已对接页面：
  - 首页 `index`——`banner`（轮播）+ `homeModule`（板块导航）
  - 线路 `routes` + `route-detail`——`privateGroup`（私家团，列表按上架状态并入，详情由 dayList 生成）
  - 景区 `scenic` / `scenic-detail`——`scenic`
  - 酒店 `hotels` / `hotel-detail`——`hotel`
  - 灵感广场 `square` / `note-detail` / `share-detail`——`inspirationPost`（仅展示 `auditStatus=1`）；发布 `share-publish` 上传图片后写入云端（`auditStatus=0` 待 CMS 审核）
  - 我的行程 `my-trips` / 定制预览 `custom-preview`——`userTrip`（保存+读取，按 openid，通过 WX 上下文获取）

## 说明文档
- `云开发部署指南.md`    部署步骤（推荐先读）
- `各 BLOCK*.md`          开发过程记录（历史明细）
