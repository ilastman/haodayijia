# 好大一家旅行社 · 小程序 + CMS 部署清单

> 逐步执行，按顺序勾选即可。**不要改动小程序前端页面逻辑**（`pages/*`、`utils/*` 仅配置项 `envId` 允许改）。
> 每完成一大步，建议 `git commit` 存一个快照，便于回滚。

- 项目根：`C:\xiaochengxu`
- AppID：`wx01bb5f6cfc904f92`
- 云环境 ID：`cloudbase-d3gptvn88e6a4d78a`
- 后台入口：微信开发者工具里运行 `tools/preview-server.js` 后访问 `http://127.0.0.1:8080/admin/index.html`
- 后台默认账号：`admin / admin123`

---

## 0. 前置条件

- [ ] 安装微信开发者工具（稳定版），并用 AppID `wx01bb5f6cfc904f92` 打开本项目。
- [ ] 云开发已开通，环境 ID 为 `cloudbase-d3gptvn88e6a4d78a`（云开发控制台可确认）。
- [ ] 本机 Node.js ≥ 16（当前 v24 可用），PowerShell 中 `npm.cmd` 可用（本机策略拦截 `npm` 时可改用 `npm.cmd`）。
- [ ] 无需 cloudbase CLI；云函数部署走微信开发者工具「上传并部署」，初始化函数走云开发控制台「测试」。

### 命令速查（本地打包 / 校验）

```powershell
# 生成云函数种子数据（改了 admin/js/data.js 后必须重跑）
node tools/build-cloud-seed.js

# 本地起后台 + 预览服务（端口 8080，含 /api/db /api/call 本地数据桥）
node tools/preview-server.js

# 打包小程序预览数据（校验用，非部署必需）
node tools/build-preview.js

# 全量语法校验（示例：校验所有后台 JS）
Get-ChildItem -Recurse -Filter *.js -Path admin\js | ForEach-Object { node --check $_.FullName }
```

> 改动 `db/schema/*.json` 或 `admin/js/data.js` 后：删除 `tools/cms-db.json` → 重启 `preview-server.js`，让本地桥按新种子重新播种。

---

## 1. 部署前本地自检（强烈建议）

- [ ] 运行 `node tools/build-cloud-seed.js`，确认生成 `cloudfunctions/dataSeed/seed.json`，且包含 `globalConfig`（含 `routesPage`）与各业务集合。
- [ ] 校验 `cloudfunctions/dataSeed/seed.json` 为合法 JSON。
- [ ] 运行 `node --check` 校验 `cloudfunctions/*/index.js`、`admin/js/**/*.js`、`utils/*.js` 全部通过。
- [ ] 启动 `node tools/preview-server.js`，浏览器打开后台，用 `admin/admin123` 登录，抽查：
  - [ ] 线路管理 / 酒店管理 / 景区管理：新增、编辑、删除、图片上传均正常（本地桥）。
  - [ ] 定制行程管理 / 灵感广场管理 / 用户管理：列表、编辑/审核/删除正常。
  - [ ] 首页布局 +「线路页板块」Tab：板块拖拽排序、显隐、文案保存正常。
  - [ ] 全局配置、素材库保存正常。

> 此步全绿再做云端部署，能把问题挡在本地。

---

## 2. 云函数清单（共 15 个，逐个上传）

> 部署方式：微信开发者工具左侧目录树 → 右键 `cloudfunctions/<函数名>` → **「上传并部署：云端安装依赖」**。
> 运行环境建议 **Node.js 16**。所有函数依赖 `wx-server-sdk ~2.6.3`。
> ⚠️ `dataSeed` 目录内除 `index.js` 外还必须有 `auth.js` 与 `seed.json`；`login`/`adminInit`/`fileUpload` 各自目录含 `auth.js`。

| 云函数 | 作用 | 上传并部署 | 特殊依赖文件 |
|---|---|---|---|
| `httpGateway` | PC 后台经 HTTP 访问服务转发到各云函数 | [ ] | — |
| `login` | 管理员登录 / 退出，签发 token | [ ] | `auth.js` |
| `adminInit` | 初始化管理员账号（仅首次） | [ ] | `auth.js` |
| `fileUpload` | 图片上传云存储 / fileID 解析临时链接 | [ ] | `auth.js` |
| `dataSeed` | 导入演示种子数据 | [ ] | `auth.js`、`seed.json` |
| `dataExport` | 导出全部集合（备份用） | [ ] | — |
| `homeModuleCRUD` | 首页模块 | [ ] | — |
| `bannerCRUD` | 轮播 | [ ] | — |
| `scenicCRUD` | 景区 | [ ] | — |
| `hotelCRUD` | 酒店 | [ ] | — |
| `privateGroupCRUD` | 私家团 / 线路 | [ ] | — |
| `userTripCRUD` | 用户定制行程 | [ ] | — |
| `inspirationPostCRUD` | 灵感广场 UGC | [ ] | — |
| `homeConfigCRUD` | 全局配置 `globalConfig` | [ ] | — |
| `assetCRUD` | 素材库 `asset` | [ ] | — |

- [ ] 15 个函数全部上传成功（控制台「云函数」列表可见，且状态无报错）。

> 上传前确认 `cloudfunctions/dataSeed/seed.json` 是最新的（见步骤 1）。

---

## 3. 创建数据库集合

在**云开发控制台 → 数据库**，创建以下 10 个集合（名称区分大小写，务必一致）：

- [ ] `homeModule`
- [ ] `banner`
- [ ] `scenic`
- [ ] `hotel`
- [ ] `privateGroup`
- [ ] `userTrip`
- [ ] `inspirationPost`
- [ ] `adminUser`
- [ ] `globalConfig`
- [ ] `asset`

> 集合可先建为空，数据由步骤 6/7 的 `adminInit`、`dataSeed` 写入。

---

## 4. 应用数据库安全规则（`db/rules.json`）

本项目**所有读写统一走云函数**（服务端以管理员身份运行，默认绕过安全规则），因此客户端直连一律关闭，最安全。

对每个集合执行：数据库 → 选择集合 → **权限设置 → 自定义安全规则** → 粘贴对应片段：

- [ ] `homeModule` → `{ "read": false, "write": false }`
- [ ] `banner` → `{ "read": false, "write": false }`
- [ ] `scenic` → `{ "read": false, "write": false }`
- [ ] `hotel` → `{ "read": false, "write": false }`
- [ ] `privateGroup` → `{ "read": false, "write": false }`
- [ ] `userTrip` → `{ "read": false, "write": false }`
- [ ] `inspirationPost` → `{ "read": false, "write": false }`
- [ ] `adminUser` → `{ "read": false, "write": false }`
- [ ] `globalConfig` → `{ "read": false, "write": false }`
- [ ] `asset` → `{ "read": false, "write": false }`

> 完整来源：`db/rules.json`（控制台每个集合只需 `read` / `write` 两个字段）。

---

## 5. 初始化管理员账号（`adminInit`）

在**云开发控制台 → 云函数 → adminInit → 测试**，用以下测试参数运行：

```json
{ "username": "admin", "password": "admin123", "nickname": "管理员", "role": "super" }
```

- [ ] 返回 `{ "code": 200, "msg": "初始化管理员成功" }`（已存在则返回 `管理员已存在`，同样 OK）。
- [ ] 数据库 `adminUser` 集合出现 1 条记录，且 `password` 为哈希值。

> ⚠️ **上线前务必修改默认密码**：重新用新密码调用一次；若已存在则先在数据库删掉该记录再初始化。

---

## 6. 导入种子数据（`dataSeed`）

在**云开发控制台 → 云函数 → dataSeed → 测试**，用以下参数运行（首次初始化可免 token）：

```json
{ "confirm": "SEED" }
```

- [ ] 返回 `{ "code": 200, "msg": "数据导入完成", "data": {...} }`，各集合 `added/updated` 计数正常。
- [ ] 抽查集合数据：`homeModule`(6) `banner`(3) `scenic`(21) `hotel`(8) `privateGroup`(8) `inspirationPost`(16)。
- [ ] `globalConfig` 集合内 `_id = "global"` 的文档存在，且包含 `routesPage` 字段。
- [ ] `asset` 集合（映射自 seed 的 `assets`）已导入。

> 说明：`dataSeed` 按业务 `id` upsert（存在则更新、不存在则新增），可重复运行；`adminUser` 不在其中，请用步骤 5 初始化。

---

## 7. 开启 HTTP 访问服务（后台接云关键步骤）

- [ ] 云开发控制台 → 云函数 → `httpGateway` → **HTTP 访问服务** → 开启/添加触发路径。
- [ ] 复制生成的公网地址，形如：

  ```text
  https://cloudbase-d3gptvn88e6a4d78a.service.tcloudbase.com/httpGateway
  ```

  （实际路径以控制台显示为准，通常是函数名。）
- [ ] 打开 `admin/js/config.js`，把地址填入 `gateway`：

  ```js
  window.ADMIN_CONFIG = {
    mode: 'cloud',
    envId: 'cloudbase-d3gptvn88e6a4d78a',
    gateway: 'https://cloudbase-d3gptvn88e6a4d78a.service.tcloudbase.com/httpGateway'
  };
  ```
- [ ] 保存。`Cloud.enabled()` 现在为 `true`，后台自动改走云端（`gateway` 为空时自动回退本地桥，属正常降级）。

> 该函数已内置 CORS 头与 `OPTIONS` 预检，浏览器可跨域直连。
> 网关白名单（`ALLOWED`）已含各 CRUD、`login`、`fileUpload`、`homeConfigCRUD`、`assetCRUD`、`dataSeed`、`dataExport`、`adminInit`。

---

## 8. 后台云端联调验证

- [ ] 刷新 `http://127.0.0.1:8080/admin/index.html`（服务仍由 `preview-server.js` 提供静态文件；数据走云）。
- [ ] 用 `admin / admin123` 登录成功（此时为**云端**登录，token 存 `localStorage`）。
- [ ] 各模块列表能读到云数据；新增/编辑/删除会写回云端；刷新后数据仍在。
- [ ] 图片上传：上传后返回 `cloud://` fileID；浏览器预览框能显示（经 `fileUpload getURL` 解析临时链接）。
- [ ] 首页布局 / 线路页板块保存后，`globalConfig` 文档已更新。
- [ ] 「用户管理」聚合列表正常（来源 `userTrip` + `inspirationPost`）。
- [ ] 关闭网络或清空 `gateway` 时，后台能自动回退本地桥且不报错（降级验证）。

---

## 9. 小程序端接云验证（不改页面逻辑，仅配置）

- [ ] 确认 `utils/config.js` 的 `envId = 'cloudbase-d3gptvn88e6a4d78a'`。
- [ ] 生产/真机联调：将 `utils/config.js` 的 `useBridge` 置为 `false`（不再走本地桥，直接走 `wx.cloud.callFunction`）。

  > 开发预览可保留 `useBridge: true`；真机 / 体验版 / 发布前务必置 `false`。
- [ ] 微信开发者工具详情 → 本地设置 → 勾选「不校验合法域名」仅用于本地预览；**正式发布需在 mp 后台配置合法域名**。
- [ ] 验证小程序端：
  - [ ] 首页轮播/线路/景区/酒店正常读取。
  - [ ] 用户提交定制行程（`userTripCRUD`）、发布灵感（`inspirationPostCRUD` 发布 `status=0`）成功。
  - [ ] 灵感广场只读列表读取到 `status=1` 的内容。

---

## 10. 安全加固（上线前）

- [ ] **修改默认管理员密码**（见步骤 5 提示）。
- [ ] 从 `cloudfunctions/httpGateway/index.js` 的 `ALLOWED` 中**移除 `adminInit` 与 `dataSeed`**（初始化完成后不再需要公网暴露），重新上传该函数。
- [ ] 把 `httpGateway` 的 CORS `access-control-allow-origin` 从 `*` 收紧为后台实际域名（如使用静态托管地址）。
- [ ] 视需要为「HTTP 访问服务」开启鉴权 / IP 限制。
- [ ] 定期用 `dataExport`（管理员 token）导出备份，或使用云开发数据库自带备份。

---

## 11. 回滚 / 重置

- [ ] **重导种子**：`dataSeed` 传 `{ "confirm": "SEED" }`（不会删除、只 upsert；如需清空请手工删除集合文档后再导）。
- [ ] **重置管理员**：删除 `adminUser` 记录 → 重跑 `adminInit`。
- [ ] **换回本地调试**：把 `admin/js/config.js` 的 `gateway` 置空即可回退本地桥；或 `mode:'local'`。
- [ ] **代码回滚**：`git log --oneline` 找到部署前快照 → `git checkout <commit>`（按需）。

---

## 12. 常见问题排查

| 现象 | 排查方向 |
|---|---|
| 后台登录报错 / 一直失败 | `adminUser` 是否已初始化（步骤 5）；`login` 函数是否上传；网关 URL 是否正确 |
| 后台列表为空 | 是否已 `dataSeed`（步骤 6）；集合名大小写是否一致；`gateway` 是否填写 |
| 浏览器控制台 CORS 报错 | `httpGateway` 是否已开 HTTP 访问服务；是否返回了 CORS 头；重传该函数 |
| 图片不显示 | `fileUpload` 的 `getURL` 是否可用；fileID 是否为 `cloud://`；token 是否有效 |
| 小程序读取不到数据 | `useBridge` 是否为 `false`；`envId` 是否正确；对应 CRUD 函数是否部署；安全规则是否 `false`（走函数没问题） |
| 写入被拒 | 云函数是否校验 token；后台 token 是否过期（7 天）；重登 |
| 线路页板块改了前端没变 | 预期行为：`routesPage` 仅后台落库，**前端本次不消费**（不改 `pages/routes`，按既定决策） |

---

## 附：集合 ↔ 云函数 ↔ 局部字段对应

| 集合 | 云函数 | 关键字段（业务 `id` 为查询键，云 `_id` 仅内部用） |
|---|---|---|
| `homeModule` | `homeModuleCRUD` | id,title,sub,icon,desc,url,show,sort |
| `banner` | `bannerCRUD` | id,img,title,jump,enable,sort |
| `scenic` | `scenicCRUD` | id,name,cover,album,intro,detailHtml,tags,dest,duration,bestSeason,lon,lat,weight,online |
| `hotel` | `hotelCRUD` | id,name,cover,album,intro,detailHtml,facilities,price,stars,score,area,envImg,roomImg,rooms,location,lon,lat,sort,online |
| `privateGroup` | `privateGroupCRUD` | id,title,cover,images,price,originalPrice,days,departure,dest,type,tags,brief,highlights,detailHtml,include,exclude,notices,reviews,itinerary,dayList,sort,online |
| `userTrip` | `userTripCRUD` | id,openid,nickname,avatar,title,days,cover,plan,plans,date,status,createTime,updatedAt |
| `inspirationPost` | `inspirationPostCRUD` | id,openid,nickname,avatar,type,title,tags,cover,imgs,content,tripRef,category,days,season,highlights,timeline,intro,like,commentCount,comments,status(0/1/2),createTime |
| `adminUser` | `login` / `adminInit` | id,username,password(hash),nickname,avatar,role,lastLogin,extend{token,tokenExpire} |
| `globalConfig` | `homeConfigCRUD` | 单文档 `_id="global"`：notice,slogan,companyIntro,contact,homeCopy,homeSections,routesPage,tabs |
| `asset` | `assetCRUD` | id,url,name,size,time |

---

## 附：部署顺序总览（一句话版）

1. 本地自检 → 2. 上传 15 个云函数 → 3. 建 10 个集合 → 4. 应用安全规则 → 5. `adminInit` 建管理员 → 6. `dataSeed` 导数据 → 7. 开 `httpGateway` HTTP 访问服务并回填 `gateway` → 8. 后台云端联调 → 9. 小程序 `useBridge:false` 接云 → 10. 改密码 + 加固 → 收尾快照。
