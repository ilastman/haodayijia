/**
 * 对账表 v3 数据模型（司机行程 + 财务明细 + 买票红名单）
 *
 * 本文件同时复制到：
 *   cloudfunctions/orderCRUD/recon.js
 *   cloudfunctions/workOrderXlsx/recon.js
 * 云函数部署包不能引用小程序目录，三份内容必须保持一致。
 * tools/test-recon.js 会比对文件内容。
 */

const TICKET_RULES = [
  { days: 1, label: '提前1天', note: '临近出行必须确认是否已购', names: ['哈尔滨东北虎林园', '大秃顶子山', '伏尔加庄园', '雪乡', '森林小伙车'] },
  { days: 3, label: '提前3天', note: '热门票需提前锁票', names: ['冰雪大世界', '雪博会', '极地公园', '滑雪', '旅拍', '镜泊湖景区'] },
  { days: 7, label: '提前7天', note: '需预约/审批类景点', names: ['哈工大', '七三一'] },
  { days: 15, label: '提前15天', note: '名额紧张，尽早预订', names: ['长白山'] }
];

const PAY_STATUSES = ['未付', '已付'];
const GUEST_KEYS = ['tripTitle', 'adults', 'children', 'vehicle', 'pickupTime', 'dropoffTime', 'pickupPlace', 'dropoffPlace'];
const MAX_DAYS = 31;

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function str(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max || 500);
}

function payStatus(v) { return PAY_STATUSES.indexOf(v) >= 0 ? v : '未付'; }

function normalizeAmount(v) {
  const raw = str(v, 32);
  const s = raw.replace(/[¥￥,\s]/g, '');
  if (!s) return '';
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return raw;
}

function emptyLine(withName) {
  const o = { amount: '', payStatus: '未付', payTime: '' };
  if (withName) o.name = '';
  return o;
}

function emptyExtra() {
  return { detail: '', amount: '', payStatus: '未付', payTime: '' };
}

function emptyDay(n, date) {
  return {
    dayNum: n || 1,
    date: date || '',
    from: '',
    to: '',
    itinerary: '',
    route: '',
    vehicle: '',
    km: '',
    hotel: '',
    hotelPhone: '',
    meals: '',
    tickets: '',
    scenicPhones: '',
    flight: '',
    remark: '',
    scenics: [emptyLine(true), emptyLine(true), emptyLine(true)],
    plays: [emptyLine(true), emptyLine(true), emptyLine(true)],
    hotelCost: emptyLine(true),
    vehicleCost: emptyLine(false),
    mealCost: emptyLine(false),
    extras: [emptyExtra(), emptyExtra(), emptyExtra()],
    driverClaim: emptyExtra()
  };
}

function emptyRecon() {
  return {
    tripTitle: '',
    adults: '',
    children: '',
    vehicle: '',
    pickupTime: '',
    dropoffTime: '',
    pickupPlace: '',
    dropoffPlace: '',
    days: []
  };
}

function sanitizeLine(x, withName) {
  const o = {
    amount: normalizeAmount(x && x.amount),
    payStatus: payStatus(x && x.payStatus),
    payTime: str(x && x.payTime, 32)
  };
  if (withName) o.name = str(x && x.name, 80);
  return o;
}

function sanitizeExtra(x) {
  return {
    detail: str(x && (x.detail != null && x.detail !== '' ? x.detail : x && x.name), 80),
    amount: normalizeAmount(x && x.amount),
    payStatus: payStatus(x && x.payStatus),
    payTime: str(x && x.payTime, 32)
  };
}

function pad3(arr, mapFn) {
  const src = Array.isArray(arr) ? arr : [];
  const out = [];
  for (let i = 0; i < 3; i++) out.push(mapFn(src[i], i));
  return out;
}

function sanitizeDay(d, i) {
  const x = d || {};
  return {
    dayNum: i + 1,
    date: str(x.date, 32),
    from: str(x.from, 80),
    to: str(x.to, 80),
    itinerary: str(x.itinerary, 2000),
    route: str(x.route, 500),
    vehicle: str(x.vehicle, 160),
    km: str(x.km, 20),
    hotel: str(x.hotel, 160),
    hotelPhone: str(x.hotelPhone, 40),
    meals: str(x.meals, 300),
    tickets: str(x.tickets, 800),
    scenicPhones: str(x.scenicPhones, 300),
    flight: str(x.flight, 200),
    remark: str(x.remark, 800),
    scenics: pad3(x.scenics, item => sanitizeLine(item, true)),
    plays: pad3(x.plays, item => sanitizeLine(item, true)),
    hotelCost: sanitizeLine(x.hotelCost, true),
    vehicleCost: sanitizeLine(x.vehicleCost, false),
    mealCost: sanitizeLine(x.mealCost, false),
    extras: pad3(x.extras, sanitizeExtra),
    driverClaim: sanitizeExtra(x.driverClaim)
  };
}

/**
 * 合并对账 JSON。
 * - 客人栏字段：payload 里出现的键覆盖，未出现的保留 prev
 * - days：仅当 payload.days 为数组时整体替换；省略 days 不会清空已有天数
 */
function sanitizeRecon(raw, prev) {
  const base = emptyRecon();
  const p = prev || {};
  const src = raw || {};
  GUEST_KEYS.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(src, k)) base[k] = str(src[k], 200);
    else base[k] = str(p[k], 200);
  });
  const daysSrc = Array.isArray(src.days) ? src.days : (Array.isArray(p.days) ? p.days : []);
  base.days = daysSrc.slice(0, MAX_DAYS).map(sanitizeDay);
  return base;
}

function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function ymdFromUtc(ms) {
  const d = new Date(ms);
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/** 上海日历上的今天（云函数与本地时区无关） */
function shanghaiTodayUtc(now) {
  const n = now ? new Date(now) : new Date();
  const shifted = new Date(n.getTime() + 8 * 3600 * 1000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function daysUntil(dateStr, now) {
  const t = parseYMD(dateStr);
  if (t == null) return null;
  return Math.round((t - shanghaiTodayUtc(now)) / 86400000);
}

function fillDates(depart, count) {
  const t = parseYMD(depart);
  const out = [];
  const n = Math.max(0, count || 0);
  for (let i = 0; i < n; i++) {
    if (t == null) out.push('');
    else out.push(ymdFromUtc(t + i * 86400000));
  }
  return out;
}

function tripDayCount(depart, ret) {
  const a = parseYMD(depart);
  const b = parseYMD(ret);
  if (a == null || b == null) return 0;
  const n = Math.round((b - a) / 86400000) + 1;
  if (n < 1 || n > MAX_DAYS) return 0;
  return n;
}

function fromItinerary(order) {
  const src = (order && order.itinerary && order.itinerary.days) || [];
  const dates = fillDates(order && order.departDate, src.length);
  return src.map((d, i) => sanitizeDay({
    date: dates[i] || '',
    to: d.title || '',
    itinerary: [d.content || '', Array.isArray(d.spots) ? d.spots.filter(Boolean).join('、') : ''].filter(Boolean).join('\n'),
    meals: d.meals || '',
    hotel: d.hotel || ''
  }, i));
}

function dayHaystack(day) {
  const parts = [day.itinerary, day.tickets, day.remark, day.from, day.to, day.route];
  (day.scenics || []).forEach(s => parts.push(s.name));
  (day.plays || []).forEach(s => parts.push(s.name));
  return parts.filter(Boolean).join('\n');
}

function alertDays(order) {
  const model = sanitizeRecon(order && order.recon, null);
  if (model.days.length) return model.days;
  return fromItinerary(order || {});
}

function ticketAlerts(order, now) {
  const left = daysUntil(order && order.departDate, now);
  const hits = [];
  if (left == null || left < 0) return { left, hits };
  alertDays(order).forEach(day => {
    const text = dayHaystack(day);
    if (!text) return;
    TICKET_RULES.forEach(rule => {
      if (left > rule.days) return;
      rule.names.forEach(name => {
        if (text.indexOf(name) >= 0) {
          hits.push({
            dayNum: day.dayNum,
            name,
            lead: rule.days,
            label: rule.label,
            left,
            tone: 'ticket'
          });
        }
      });
    });
  });
  return { left, hits };
}

function ticketSummary(order, now) {
  const result = ticketAlerts(order, now);
  let text = '';
  if (result.left == null) text = '请先填写出行日期。预警按出行日提前 1 / 3 / 7 / 15 天，对照红名单标红。';
  else if (result.left < 0) text = '出行日已过，不再提示买票预警。';
  else if (!result.hits.length) text = '距出行 ' + result.left + ' 天，当前司机行程和财务名称未命中红名单。';
  else text = '距出行 ' + result.left + ' 天，有 ' + result.hits.length + ' 条买票红色预警。';
  return { left: result.left, hits: result.hits, text };
}

function sumAmt(arr) {
  return (arr || []).reduce((s, x) => s + num(x && x.amount), 0);
}

function dayMoney(day) {
  const d = day || {};
  const ticket = sumAmt(d.scenics) + sumAmt(d.plays);
  const extra = sumAmt(d.extras);
  const total = ticket
    + num(d.hotelCost && d.hotelCost.amount)
    + num(d.vehicleCost && d.vehicleCost.amount)
    + num(d.mealCost && d.mealCost.amount)
    + extra
    + num(d.driverClaim && d.driverClaim.amount);
  return { ticket, total };
}

function paidTotal(order) {
  return ((order && order.payments) || []).reduce((s, p) => s + num(p && p.amount), 0);
}

function financeFlat(day) {
  const d = sanitizeDay(day, (day && day.dayNum ? day.dayNum : 1) - 1);
  const f = {};
  d.scenics.forEach((s, i) => {
    const n = i + 1;
    f['s' + n + 'name'] = s.name;
    f['s' + n + 'amount'] = s.amount;
    f['s' + n + 'status'] = s.payStatus;
    f['s' + n + 'time'] = s.payTime;
  });
  d.plays.forEach((s, i) => {
    const n = i + 1;
    f['p' + n + 'name'] = s.name;
    f['p' + n + 'amount'] = s.amount;
    f['p' + n + 'status'] = s.payStatus;
    f['p' + n + 'time'] = s.payTime;
  });
  f.hname = d.hotelCost.name;
  f.hamount = d.hotelCost.amount;
  f.hstatus = d.hotelCost.payStatus;
  f.htime = d.hotelCost.payTime;
  f.camount = d.vehicleCost.amount;
  f.cstatus = d.vehicleCost.payStatus;
  f.ctime = d.vehicleCost.payTime;
  f.mamount = d.mealCost.amount;
  f.mstatus = d.mealCost.payStatus;
  f.mtime = d.mealCost.payTime;
  d.extras.forEach((s, i) => {
    const n = i + 1;
    f['e' + n + 'detail'] = s.detail;
    f['e' + n + 'amount'] = s.amount;
    f['e' + n + 'status'] = s.payStatus;
    f['e' + n + 'time'] = s.payTime;
  });
  f.claimDetail = d.driverClaim.detail;
  f.damount = d.driverClaim.amount;
  f.dstatus = d.driverClaim.payStatus;
  f.dtime = d.driverClaim.payTime;
  return f;
}

function applyFinanceFlat(day, flat) {
  const f = flat || {};
  const next = sanitizeDay(day, (day && day.dayNum ? day.dayNum : 1) - 1);
  next.scenics = [1, 2, 3].map(n => sanitizeLine({
    name: f['s' + n + 'name'], amount: f['s' + n + 'amount'], payStatus: f['s' + n + 'status'], payTime: f['s' + n + 'time']
  }, true));
  next.plays = [1, 2, 3].map(n => sanitizeLine({
    name: f['p' + n + 'name'], amount: f['p' + n + 'amount'], payStatus: f['p' + n + 'status'], payTime: f['p' + n + 'time']
  }, true));
  next.hotelCost = sanitizeLine({ name: f.hname, amount: f.hamount, payStatus: f.hstatus, payTime: f.htime }, true);
  next.vehicleCost = sanitizeLine({ amount: f.camount, payStatus: f.cstatus, payTime: f.ctime }, false);
  next.mealCost = sanitizeLine({ amount: f.mamount, payStatus: f.mstatus, payTime: f.mtime }, false);
  next.extras = [1, 2, 3].map(n => sanitizeExtra({
    detail: f['e' + n + 'detail'], amount: f['e' + n + 'amount'], payStatus: f['e' + n + 'status'], payTime: f['e' + n + 'time']
  }));
  next.driverClaim = sanitizeExtra({ detail: f.claimDetail, amount: f.damount, payStatus: f.dstatus, payTime: f.dtime });
  return next;
}

/** Excel 序列号。1899-12-30 起算，与模板里的 46330 = 2026-11-04 一致。无法解析时返回 null。 */
function excelSerial(input) {
  const s = String(input || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const days = (Date.UTC(+m[1], +m[2] - 1, +m[3]) - epoch) / 86400000;
  if (m[4] == null) return days;
  return days + ((+m[4] * 60 + +m[5]) / 1440);
}

function alertFormula(row) {
  const cols = ['E', 'L', 'O', 'P', 'T', 'X', 'AB', 'AF', 'AJ'];
  const blob = cols.map(c => c + row).join('&');
  const parts = TICKET_RULES.map(rule => {
    const ors = rule.names.map(name => 'ISNUMBER(SEARCH("' + name + '",' + blob + '))').join(',');
    return 'IF(AND(($H$3-TODAY())<=' + rule.days + ',OR(' + ors + ')),"⚠' + rule.label + ' ","")';
  }).join('&');
  return 'IF($H$3="","",IF(($H$3-TODAY())<0,"",TRIM(SUBSTITUTE(' + parts + ',"  "," "))))';
}

function ruleBanner() {
  return '【买票红色预警速查】' + TICKET_RULES.map(r => r.label + '：' + r.names.join('／')).join('　｜　') + '　→ 详见「买票预警」表';
}

module.exports = {
  TICKET_RULES,
  PAY_STATUSES,
  GUEST_KEYS,
  MAX_DAYS,
  num,
  str,
  emptyDay,
  emptyRecon,
  sanitizeDay,
  sanitizeRecon,
  parseYMD,
  daysUntil,
  fillDates,
  tripDayCount,
  fromItinerary,
  dayHaystack,
  ticketAlerts,
  ticketSummary,
  dayMoney,
  paidTotal,
  financeFlat,
  applyFinanceFlat,
  excelSerial,
  alertFormula,
  ruleBanner
};
