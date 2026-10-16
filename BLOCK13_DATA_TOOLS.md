# Block 13 完成：数据工具 + 契约校验

## 1. 接口契约校验（重要）
比对 CMS 调用与云函数支持 action，结果**全部匹配**：
- bannerCRUD / homeModuleCRUD：list, add, update, delete, sort ✓
- scenicCRUD / hotelCRUD / privateGroupCRUD：list, add, update, delete ✓
- inspirationPostCRUD：list, publicList, audit, delete, delComment ✓

## 2. 新增云函数
- `dataExport`（管理员）：分页导出8个集合为JSON，用于迁移自建Node后端。
- `dataSeed`（管理员）：集合为空时写入演示数据（homeModule/banner/scenic/hotel）。

## 3. CMS 系统设置页升级
新增「写入演示数据」「导出全部数据(JSON)」按钮，导出为本地文件下载。

## 4. 校验
- 全部 JS（34个）`node --check` 通过。

## 当前云函数总数：12
login, adminInit, fileUpload, homeModuleCRUD, bannerCRUD, scenicCRUD,
hotelCRUD, privateGroupCRUD, userTripCRUD, inspirationPostCRUD, dataSeed, dataExport
