/* ============================================================
 * 后台数据源配置
 * - mode='local'：走本地数据桥（tools/preview-server.js 的 /api/db /api/call），
 *   数据落本地 tools/cms-db.json，适合离线开发调试。
 * - mode='cloud'：走微信云开发 HTTP 访问服务（cloudfunctions/httpGateway），
 *   数据落云数据库，图片落云存储。
 *
 * 说明：Cloud.enabled() 要求 mode==='cloud' 且 gateway 非空。
 *   两者未同时满足时，后台自动回退本地数据桥，功能不受影响，便于本地调试。
 *
 * 部署步骤（上线时执行）：
 *   1. 在云开发控制台为云函数 httpGateway 开启「HTTP 访问服务」，复制公网地址；
 *   2. 将地址填入 gateway；
 *   3. mode 保持为 'cloud' 即自动走云。
 * ============================================================ */
window.ADMIN_CONFIG = {
  mode: 'cloud',
  // 云开发环境 ID（后台仅作记录；小程序侧在 utils/config.js 使用）
  envId: 'qq511601433-d9g83bbc542c7988a',
  // 例：https://<env-id>.service.tcloudbase.com/http-gateway
  // 预期地址：httpGateway 部署到新环境并开启 HTTP 访问服务后生效。尚未部署时请求会失败。
  gateway: 'https://qq511601433-d9g83bbc542c7988a.service.tcloudbase.com/httpGateway'
};

/* 全局一级大区（酒店 / 线路 / 景区 共用） */
window.REGIONS = ['呼伦贝尔', '雪乡', '哈尔滨', '新疆'];

