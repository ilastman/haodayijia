# 云开发基础说明（阶段1）

## 目录结构
- cloudfunctions/  云函数目录（login、fileUpload等）
- db/schema/       云数据库集合schema定义
- db/rules.json    云数据库基础权限规则
- cms/             PC端CMS管理后台（后续补充）

## 注意事项
- 所有集合字段均预留 extend:{} 用于后续平滑迁移自建Node后端
- 灵感广场内容默认待审核，前端仅展示 auditStatus=1 的帖子
- 修改、新增、删除操作需管理员登录token
