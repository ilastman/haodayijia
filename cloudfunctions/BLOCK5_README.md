# Block 5 说明
- userTripCRUD：最简查询接口（管理员可查全部；用户需指定openid）
- inspirationPostCRUD：publicList（仅auditStatus=1，小程序用）、list（管理员全量）、get、audit（1通过/2驳回）、delete（删帖）、delComment（按索引删评论）
- 灵感广场默认待审核，publicList仅返回审核通过
- 写操作需管理员token
