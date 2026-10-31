/**
 * 数据源配置
 * - 生产/真机：走微信云开发（wx.cloud.callFunction），envId 为云开发环境 ID
 * - 开发预览：useBridge=true 时，优先通过本地数据桥读取 CMS 后台数据
 *   （由 tools/preview-server.js 提供 /api/call 与 /api/db）
 * - 需在微信开发者工具中勾选「不校验合法域名...」方可访问 127.0.0.1
 * - 任一数据源不可用时自动回退到本地静态数据（utils/data.js），保证 UI 不空白
 */
module.exports = {
  // 云开发环境 ID（当前环境 qq511601433）
  envId: 'qq511601433-d9g83bbc542c7988a',
  // 本地数据桥开关：本地开发预览可用；真机/生产可置为 false
  useBridge: true,
  apiBase: 'http://127.0.0.1:8080'
};
