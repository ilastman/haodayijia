/**
 * 员工销售工作台数据服务层
 * - 身份：服务端按 WX openid 解析 staff（客户端不传 staffId，杜绝越权）
 * - 工作台数据经 orderCRUD 云函数；导出经 workOrderPdf
 * - 提醒：页面端由 alertConfig + scenic.ticketLeadDays 计算标红
 */

const cloud = require('./cloud');

async function call(name, data) {
  const res = await cloud.callFunction(name, data);
  if (res && res.code === 200) return res.data;
  return null;
}

async function callRaw(name, data) {
  return cloud.callFunction(name, data);
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* ---------- 身份 ---------- */
async function identity() {
  const res = await cloud.callFunction('staffCRUD', { action: 'me' });
  if (res && res.code === 200 && res.data) return res.data;
  return { isStaff: false };
}
async function bind(code) {
  const res = await cloud.callFunction('staffCRUD', { action: 'bind', data: { code } });
  return res || { code: 500, msg: '网络异常' };
}

/* ---------- 订单 ---------- */
async function listOrders(archived) {
  const res = await cloud.callFunction('orderCRUD', { action: 'list', archived: !!archived });
  if (res && res.code === 200) return res.data || [];
  return null;
}
async function getOrder(id) { return call('orderCRUD', { action: 'get', id }); }
async function createOrder(data) { return callRaw('orderCRUD', { action: 'add', data }); }
async function updateOrder(id, data) { return callRaw('orderCRUD', { action: 'update', id, data }); }
async function archiveOrder(id) { return callRaw('orderCRUD', { action: 'archive', id }); }
async function addFollow(id, follow) { return callRaw('orderCRUD', { action: 'addFollow', id, data: { follow } }); }
async function addPayment(id, payment) { return callRaw('orderCRUD', { action: 'addPayment', id, data: { payment } }); }
async function removePayment(id, paymentId) { return callRaw('orderCRUD', { action: 'removePayment', id, data: { paymentId } }); }
async function addCost(id, costs) { return callRaw('orderCRUD', { action: 'addCost', id, data: { costs } }); }
async function savePricing(id, pricing) { return callRaw('orderCRUD', { action: 'savePricing', id, data: { pricing } }); }
async function saveItinerary(id, itinerary) { return callRaw('orderCRUD', { action: 'saveItinerary', id, data: { itinerary } }); }
async function fromTemplate(id, templateId) { return callRaw('orderCRUD', { action: 'fromTemplate', id, data: { templateId } }); }

/* 线路模板（私家团） */
async function templates() {
  const res = await cloud.callFunction('privateGroupCRUD', { action: 'list' });
  if (res && res.code === 200) return (res.data || []).filter(g => g.online !== false);
  return [];
}

/* ---------- 预警 ---------- */
async function alertConfig() {
  const res = await cloud.callFunction('homeConfigCRUD', {});
  const gc = (res && res.code === 200 && res.data) || {};
  return Object.assign({ departWarnDays: 7, payOverdueDays: 0, msgTemplates: {} }, gc.alert || {});
}
async function scenicLeadMap() {
  const res = await cloud.callFunction('scenicCRUD', { action: 'list' });
  const map = {};
  if (res && res.code === 200) {
    (res.data || []).forEach(s => { if (s.ticketLeadDays) map[s.id] = num(s.ticketLeadDays); });
  }
  return map;
}

/* ---------- PDF 导出 ---------- */
async function exportPdf(id) {
  const res = await cloud.callFunction('workOrderPdf', { action: 'export', id });
  return res || { code: 500, msg: '导出失败' };
}

/* ---------- 订阅消息授权 ---------- */
async function requestSubscribe(alert) {
  const ids = Object.keys((alert && alert.msgTemplates) || {})
    .map(k => alert.msgTemplates[k])
    .filter(Boolean);
  if (!ids.length || !wx.requestSubscribeMessage) return { skipped: true };
  return new Promise(resolve => {
    wx.requestSubscribeMessage({ tmplIds: ids, success: resolve, fail: () => resolve({ skipped: true }) });
  });
}

/* ---------- 日期/状态工具 ---------- */
const STATUS = ['意向客户', '待确认行程', '待定金', '待尾款', '待出团', '已完结', '客户流失'];
const STATUS_CLASS = {
  '意向客户': 's-lead', '待确认行程': 's-plan', '待定金': 's-deposit',
  '待尾款': 's-balance', '待出团': 's-depart', '已完结': 's-done', '客户流失': 's-lost'
};

function parseDate(s) { const t = Date.parse(String(s || '').replace(/-/g, '/')); return isNaN(t) ? null : t; }
function daysUntil(s) { const t = parseDate(s); if (t == null) return null; return Math.floor((t - Date.now()) / 86400000); }
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function today() { return fmtDate(new Date()); }

/* 计算订单的预警标记：{ level:'overdue'|'near'|'', tags:[...] } */
function warnOf(order, alert, scenicMap) {
  const tags = [];
  let level = '';
  const dw = num(alert && alert.departWarnDays) || 7;
  const overdueDays = num(alert && alert.payOverdueDays) || 0;

  const dd = daysUntil(order.departDate);
  if (dd != null && dd >= 0 && dd <= dw) { tags.push('临近出团'); level = 'near'; }

  (order.payments || []).forEach(p => {
    const od = daysUntil(p.dueDate);
    if (od != null && od < -overdueDays) { tags.push((p.type || '款项') + '逾期'); level = 'overdue'; }
    else if (od != null && od <= 0) { tags.push((p.type || '款项') + '到期'); if (level !== 'overdue') level = 'near'; }
  });

  const scenicMapV = scenicMap || {};
  const days = (order.itinerary && order.itinerary.days) || [];
  const seen = {};
  days.forEach(d => {
    if (!d.scenicId || seen[d.scenicId]) return;
    seen[d.scenicId] = 1;
    const lead = scenicMapV[d.scenicId];
    if (lead && dd != null && dd >= 0 && dd <= lead) { tags.push('订票临近'); if (level !== 'overdue') level = 'near'; }
  });

  return { level, tags };
}

module.exports = {
  num, fmtDate, today, STATUS, STATUS_CLASS,
  identity, bind,
  listOrders, getOrder, createOrder, updateOrder, archiveOrder,
  addFollow, addPayment, removePayment, addCost, savePricing, saveItinerary, fromTemplate,
  templates, alertConfig, scenicLeadMap, exportPdf, requestSubscribe, warnOf, daysUntil
};
