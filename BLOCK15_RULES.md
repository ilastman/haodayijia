# Block 15 完成：数据库安全规则改为微信控制台可用格式

## 变更
`db/rules.json` 重写为**真实安全规则表达式**（每集合 `read` / `write`），可直接粘贴到
微信云开发控制台的「自定义安全规则」。

| 集合 | read | write |
|---|---|---|
| homeModule / banner / scenic / hotel / privateGroup | `doc.enable == true` | `false` |
| userTrip | `doc.openid == auth.openid` | `doc.openid == auth.openid` |
| inspirationPost | `doc.auditStatus == 1 \|\| doc.openid == auth.openid` | `doc.openid == auth.openid && doc.auditStatus == 0` |
| adminUser | `false` | `false` |

## 关键设计
- 内容类集合客户端**只读且只读已启用项**；所有写操作走云函数（管理员身份，绕过规则）。
- 灵感广场：用户只能写自己的、状态为待审核(0)的帖子，**无法自行审核通过**。
- `adminUser` 客户端完全不可访问。
- `云开发部署指南.md` 第 4 节同步更新。

## 校验
- `db/rules.json` JSON 合法，8 个集合规则齐全。
