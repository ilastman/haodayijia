# Block 10 完成：后端真实缺陷修复（可运行）

## 修复内容
1. **密码加密**：新增 `cloudfunctions/*/auth.js`，使用 Node 内置 `crypto` 的
   `sha256(salt:password)`。`login` 与 `adminInit` 统一使用 `hashPassword`，不再明文入库/比对。
2. **登录态落库**：`login` 生成 token 后写入 `adminUser.extend.token` 与 `extend.tokenExpire`（7天）。
3. **token 校验落地**：新增 `verifyAdminToken(token)`，查询 `adminUser` 中匹配且未过期的 token。
   7 个 CRUD 云函数 + `fileUpload` 的 `isAdmin`/校验全部改为调用该方法，不再“token 非空即通过”。
4. **修复 fileUpload**：原 `_id: token` 错误查询已移除，改为真实 token 校验并强制管理员权限。
5. **package.json**：为全部 10 个云函数声明 `wx-server-sdk` 依赖与 `main`。

## 校验
- 对 20 个云函数 JS 文件执行 `node --check`，全部通过（仅语法检查，非测试/打包）。

## 目录
- cloudfunctions/{login,adminInit,fileUpload,homeModuleCRUD,bannerCRUD,scenicCRUD,hotelCRUD,privateGroupCRUD,userTripCRUD,inspirationPostCRUD}/auth.js

## 备注
- 首次部署后，调用一次 `adminInit`（可传 username/password）创建管理员，密码自动加密。
- CMS 需在微信环境调用云函数（浏览器直开受 `wx.cloud` 限制）。
