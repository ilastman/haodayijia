# 云函数说明

- 运行环境：全部 `nodejs16`
- 公共模块：每个云函数目录内均有 `auth.js`（密码加密 + 登录token校验），云函数间不共享代码，故各放一份
- 鉴权模型：`login` 生成 token 并写入 `adminUser.extend.token`；其余云函数通过 `verifyAdminToken(token)` 校验

| 云函数 | 说明 | 鉴权 |
|---|---|---|
| login | 管理员登录，sha256 密码校验，生成token | 公共 |
| adminInit | 初始化管理员（密码加密入库） | 无（仅首次，用完应删除） |
| fileUpload | 图片上传云存储（filePath 或 fileBase64） | 需管理员token |
| homeModuleCRUD | 首页板块增删改查 + 拖拽排序 | 查询公开 / 写需管理员 |
| bannerCRUD | 轮播增删改查 + 拖拽排序 | 查询公开 / 写需管理员 |
| scenicCRUD | 景区增删改查 | 查询公开 / 写需管理员 |
| hotelCRUD | 酒店增删改查 | 查询公开 / 写需管理员 |
| privateGroupCRUD | 私家团增删改查（dayList） | 查询公开 / 写需管理员 |
| userTripCRUD | 用户行程查询/保存：list（管理员/openid）、myTrips（自身）、save（保存更新） | myTrips/save 走 WX 上下文 |
| inspirationPostCRUD | 灵感广场：publish（小程序发布，待审核）/publicList/list/get/audit/delete/delComment | publish 走 WX 上下文；其余写需管理员 |
| dataSeed | 空集合写入演示数据 | 需管理员token |
| dataExport | 导出全部数据JSON（迁移用） | 需管理员token |

## 重要
- 数据库安全规则见 `db/rules.json`；客户端只读、写操作一律走云函数。
- 首次部署后调用一次 `adminInit` 创建管理员，随后建议删除该云函数或加开关。
