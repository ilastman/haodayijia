# CMS极简后台（规划）
## 目录
cms/
  index.html  # Vue3 + Element Plus CDN 单页面
  css/
    style.css
  js/
    api.js      # 云函数调用封装（wx.cloud.callFunction）
    router.js   # 简单路由
    views/      # 各页面视图

## 页面清单
- login：登录
- home-module：首页板块（卡片+拖拽排序+增删改）
- banner：轮播管理
- scenic：景区（多图、坐标、上下架）
- hotel：酒店（多图、设施、坐标）
- private-group：私家团（日程：景区酒店下拉）
- inspiration-audit：灵感广场审核（审核通过/驳回/删帖/删评）
- settings：极简（退出登录）

## 说明
- 纯静态，不用npm/vite/build
- 图片上传走 fileUpload 云函数
- 所有写操作需token
