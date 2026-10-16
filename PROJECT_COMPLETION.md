# 全部完成清单
## 数据库（db）
- schema/homeModule.json
- schema/core.json（banner+scenic）
- schema/products.json（hotel+privateGroup，dayList字段齐全）
- schema/ugc_admin.json（userTrip+inspirationPost+adminUser）
- rules.json（权限规则）

## 云函数（cloudfunctions，9个，nodejs16）
- login
- fileUpload
- homeModuleCRUD（含sort）
- bannerCRUD（含sort）
- scenicCRUD
- hotelCRUD
- privateGroupCRUD（dayList映射）
- userTripCRUD（最简查询）
- inspirationPostCRUD（publicList/list/audit/delete/delComment）

## CMS（cms，极简静态）
- index.html + css/style.css + js/api.js + js/router.js + js/views/*.js（8个页面）
- PLAN.md、README.md

## 说明文件
- README_CLOUD_DEV.md、cloudfunctions/SUMMARY.md、BLOCK*.md
