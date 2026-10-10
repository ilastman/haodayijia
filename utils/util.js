/**
 * 工具函数：图片占位、SVG 图标、通用格式化
 */

/** 生成本地占位图（data URI，无网络依赖，后期替换真实图片即可） */
function ph(text, w, h) {
  w = w || 640;
  h = h || 360;
  const fs = Math.max(18, Math.round(h / 9));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
    '<rect width="100%" height="100%" fill="#F0EBE1"/>' +
    '<rect x="4" y="4" width="' + (w - 8) + '" height="' + (h - 8) + '" fill="none" stroke="#DCD3C2" stroke-width="2" stroke-dasharray="10,8"/>' +
    '<text x="50%" y="50%" fill="#B3A98F" font-size="' + fs + '" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">' + text + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** 生成线稿 SVG 图标（data URI） */
function icon(inner, color) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + (color || '#2F8F5B') + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    inner +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const ICONS = {
  // 私家团：人像
  privateGroup: icon('<circle cx="9" cy="8" r="3.2"/><circle cx="16.8" cy="9.6" r="2.6"/><path d="M3.4 19.4c0-3.1 2.5-5.4 5.6-5.4s5.6 2.3 5.6 5.4"/><path d="M15.4 14.6c2.7.3 4.8 2.3 4.8 4.8"/>'),
  // 拼团：价签
  group: icon('<path d="M3.2 12.2V4.4a1.2 1.2 0 011.2-1.2h7.8l8 8-8 8z"/><circle cx="7.6" cy="7.6" r="1.5"/>'),
  // 租车：汽车
  car: icon('<path d="M4.2 16.2v-3.4L6.2 7.6A2 2 0 018.1 6.3h7.8a2 2 0 011.9 1.3l2 5.2v3.4"/><path d="M3.2 16.2h17.6"/><path d="M6.4 12.8h11.2"/><circle cx="7.6" cy="17.8" r="1.7"/><circle cx="16.4" cy="17.8" r="1.7"/>'),
  // 酒店：床
  bed: icon('<path d="M3.2 18.6v-7.2"/><path d="M3.2 17.4h17.6v1.2"/><path d="M6.4 11.4h8.4a5 5 0 015 5v1"/><circle cx="7.4" cy="8.8" r="1.9"/><path d="M3.2 14.6h3.2"/>'),
  // 攻略：书
  book: icon('<path d="M4 5.6A2.4 2.4 0 016.4 3.2H12v16.4H6.4A2.4 2.4 0 004 21.6z"/><path d="M20 5.6a2.4 2.4 0 00-2.4-2.4H12v16.4h5.6A2.4 2.4 0 0120 21.6z"/>'),
  // 电话
  phone: icon('<path d="M6.6 3.4h3l1.6 4-2 1.6a12.4 12.4 0 005.8 5.8l1.6-2 4 1.6v3a2 2 0 01-2.2 2A17.6 17.6 0 014.6 5.6a2 2 0 012-2.2z"/>'),
  // 客服
  service: icon('<path d="M4.4 14.2a7.6 7.6 0 0115.2 0"/><path d="M4.4 13.6v3.2a1.6 1.6 0 001.6 1.6h.8v-4.8H6a1.6 1.6 0 00-1.6 1.6z"/><path d="M19.6 13.6v3.2a1.6 1.6 0 01-1.6 1.6h-.8v-4.8h.8a1.6 1.6 0 011.6 1.6z"/><path d="M19.6 17v.6a2.4 2.4 0 01-2.4 2.4h-3"/>'),
  // 定位
  pin: icon('<path d="M12 21s6.6-6 6.6-11A6.6 6.6 0 005.4 10c0 5 6.6 11 6.6 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  // 日历
  calendar: icon('<rect x="3.6" y="5" width="16.8" height="15.4" rx="2"/><path d="M3.6 10h16.8"/><path d="M8.4 3.4v3.2"/><path d="M15.6 3.4v3.2"/>'),
  // 收藏
  star: icon('<path d="M12 3.6l2.6 5.4 5.8.8-4.2 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.6 9.8l5.8-.8z"/>'),
  // 空心勾
  check: icon('<path d="M4.8 12.6l4.6 4.6 9.8-10.4"/>'),
  // 用户
  user: icon('<circle cx="12" cy="8.4" r="4"/><path d="M4.6 20.4c0-4 3.4-6.6 7.4-6.6s7.4 2.6 7.4 6.6"/>'),
  // 景区：山与太阳
  scenic: icon('<path d="M3.2 18.8l5.6-8.4 3.2 4.6 2.6-3.7 6.2 7.5z"/><circle cx="8.2" cy="7" r="2.1"/><path d="M16.8 4.6v2.4"/><path d="M15.6 5.8h2.4"/>'),
  // 私人定制：铅笔与路线
  custom: icon('<path d="M12.4 4.6l7 7a1.4 1.4 0 010 2l-8.4 8.4H6.6V12.8l8.4-8.4a1.4 1.4 0 012 0z"/><path d="M4.6 20.4l1.6-3.4"/>'),
  // 点赞：心形
  heart: icon('<path d="M12 20s-7-4.3-9-8.6C1.1 8.4 3 5.6 6 5.4c2.2-.2 3.9 1 4.9 2.6h2.2c1-1.6 2.7-2.8 4.9-2.6 3 .2 4.9 3 3 6-2 4.3-9 8.6-9 8.6z"/>'),
  // 评论：聊天气泡
  comment: icon('<path d="M4 5.2h16a1.4 1.4 0 011.4 1.4v9a1.4 1.4 0 01-1.4 1.4H9.4l-4.8 3.4v-3.4H4A1.4 1.4 0 012.6 15.6v-9A1.4 1.4 0 014 5.2z"/>'),
  // 白色客服（悬浮按钮用）
  serviceWhite: icon('<path d="M4.4 14.2a7.6 7.6 0 0115.2 0"/><path d="M4.4 13.6v3.2a1.6 1.6 0 001.6 1.6h.8v-4.8H6a1.6 1.6 0 00-1.6 1.6z"/><path d="M19.6 13.6v3.2a1.6 1.6 0 01-1.6 1.6h-.8v-4.8h.8a1.6 1.6 0 011.6 1.6z"/><path d="M19.6 17v.6a2.4 2.4 0 01-2.4 2.4h-3"/>', '#FFFFFF')
};

/** 手机号校验 */
function isValidPhone(p) {
  return /^1[3-9]\d{9}$/.test((p || '').trim());
}

/** 读取收藏列表 */
function getFavorites() {
  return wx.getStorageSync('favorites') || [];
}

function isFavorite(id) {
  return getFavorites().indexOf(id) > -1;
}

/** 切换收藏，返回是否已收藏 */
function toggleFavorite(id) {
  const list = getFavorites();
  const idx = list.indexOf(id);
  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.unshift(id);
  }
  wx.setStorageSync('favorites', list);
  return idx === -1;
}

/** 追加咨询留资记录 */
function addConsultRecord(record) {
  const list = wx.getStorageSync('consultRecords') || [];
  record.time = record.time || formatNow();
  list.unshift(record);
  wx.setStorageSync('consultRecords', list);
  return record;
}

function formatNow() {
  const d = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

module.exports = {
  ph,
  icon,
  ICONS,
  isValidPhone,
  getFavorites,
  isFavorite,
  toggleFavorite,
  addConsultRecord,
  formatNow
};
