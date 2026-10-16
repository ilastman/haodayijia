# CMS 使用说明
- cms/index.html 可直接在浏览器打开（需配合云开发环境调用云函数）
- 首次使用需先在云开发控制台创建 adminUser 并设置 username/password
- 登录后保存token到localStorage
- 图片可先上传到云存储后填入URL，或后续接入fileUpload上传
- 灵感广场审核：list需管理员token；publicList仅返回auditStatus=1
