/**
 * 云函数文件说明（速览）
 *
 * httpGateway/index.js
 *   - 浏览器 CMS 统一 HTTP 转发网关；控制台只需为它开启 HTTP 触发/HTTP 访问服务
 *   - 请求体 JSON：{ name: "云函数名", data: {...} }，经 cloud.callFunction 转发
 *
 * login/index.js
 *   - 管理员登录：sha256(salt:密码) 校验，生成 token 并写入 adminUser.extend.token
 *   - 运行环境：nodejs16；公共调用，仅与 adminUser 交互
 *
 * fileUpload/index.js
 *   - 图片上传云存储，返回 fileID + url
 *   - 支持 filePath（小程序临时路径）或 fileBase64（浏览器CMS）
 *   - 需管理员 token（已强制校验）
 *
 * auth.js（每个云函数目录各一份）
 *   - hashPassword / generateToken / verifyAdminToken
 *   - verifyAdminToken 查询 adminUser.extend.token 且校验 tokenExpire
 *
 * 其余 CRUD / dataSeed / dataExport 详见 SUMMARY.md
 */
