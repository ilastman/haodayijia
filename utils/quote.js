/**
 * 员工内部核价计算（纯函数，无副作用，便于 Node 单测）
 * - 酒店：逐日累加，第 N 晚住第 N 晚；每晚按【入住日期】闭区间匹配价格档期
 *         小计 = 所选房型当档期价 × 当天间数
 * - 景区：未选游玩项目时，解析文本 ticketPrice 得到固定单价，同景区重复出现重复累加
 *         选了游玩项目时，按项目 price 文本计价（「10元」→ 10），同一景区当天只计一次，不再叠加门票
 * - 车辆：暂不参与选择（carCost 传 0 或外部值）
 * 价格数据来源：hotelPrice 集合（自定义日期区间，闭区间 []
 */

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* 解析景区文本票价："120元" -> 120；"免费"/空/无数字 -> 0 */
function parseTicketPrice(text) {
  const m = String(text == null ? '' : text).match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/* 归一化日期为可字符串比较的 yyyy-MM-dd（取前 10 位）；无法识别返回 '' */
function normDate(dateStr) {
  const m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(dateStr == null ? '' : dateStr));
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return '';
}

/* 取月份数字，如 '2026-07-15' -> 7 */
function monthOf(dateStr) {
  const m = /(\d{4})-(\d{1,2})/.exec(String(dateStr || ''));
  if (m) return parseInt(m[2], 10);
  const d = new Date(String(dateStr || '').replace(/-/g, '/'));
  return isNaN(d.getTime()) ? 0 : (d.getMonth() + 1);
}

/* 在出发日基础上加 n 天，返回 yyyy-MM-dd（无法解析出发日则返回 ''） */
function addDays(dateStr, n) {
  const base = normDate(dateStr);
  if (!base) return '';
  const d = new Date(base.replace(/-/g, '/'));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (parseInt(n, 10) || 0));
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/* 闭区间判断：date >= start 且 date <= end（字符串比较，兼容跨年） */
function periodHasDate(period, dateStr) {
  const d = normDate(dateStr);
  if (!d) return false;
  const s = normDate(period && period.start);
  const e = normDate(period && period.end);
  if (!s || !e) return false;
  return d >= s && d <= e;
}

/* 兼容旧名：区间是否包含某月（保留供外部使用） */
function periodHasMonth(period, month) {
  if (!month) return false;
  const s = monthOf(period && period.start);
  const e = monthOf(period && period.end);
  if (!s || !e) return false;
  if (s <= e) return month >= s && month <= e;
  return month >= s || month <= e;
}

/*
 * 价格档期列表（扁平结构）：
 *   [{ roomType:'标准间', start:'2026-11-15', end:'2026-12-15', price:880 }, ...]
 * 说明：一房型一档期一条记录，来源为 hotelPrice 集合。
 */

/* 命中某日期的所有档期（可能多房型各一条） */
function periodsOnDate(prices, dateStr) {
  const list = Array.isArray(prices) ? prices : [];
  return list.filter(p => periodHasDate(p, dateStr));
}

/* 某日期的可选房型名列表（去重，保留顺序） */
function roomTypesOnDate(prices, dateStr) {
  const list = periodsOnDate(prices, dateStr);
  const names = [];
  const seen = {};
  list.forEach(p => {
    const n = String((p && p.roomType) || '').trim();
    if (n && !seen[n]) { seen[n] = 1; names.push(n); }
  });
  return names;
}

/* 某日期的可选房型名列表；无命中回退 hotel.rooms 文本；再回退 ['标准间'] */
function roomTypesOf(hotel, dateStr) {
  const prices = (hotel && hotel.prices) || [];
  const names = roomTypesOnDate(prices, dateStr);
  if (names.length) return names;
  const seen = {};
  names.forEach(n => { seen[n] = 1; });
  const fallback = [];
  (hotel && hotel.rooms || []).forEach(r => {
    const n = String((r && typeof r === 'object' ? r.name : r) || '').split(/[：:]/)[0].trim();
    if (n && !seen[n]) { seen[n] = 1; fallback.push(n); }
  });
  if (fallback.length) return fallback;
  return ['标准间'];
}

/* 某酒店在指定日期、指定房型的每晚价；找不到房型回退当日最低价；无命中回退 hotel.price */
function priceOfRoom(hotel, dateStr, roomType) {
  if (!hotel) return 0;
  const hit = periodsOnDate((hotel && hotel.prices) || [], dateStr);
  if (hit.length) {
    const want = String(roomType || '').trim();
    let found = null;
    const prices = [];
    hit.forEach(p => {
      const v = num(p && p.price);
      if (v > 0) prices.push(v);
      if (want && String((p && p.roomType) || '').trim() === want && v > 0) found = v;
    });
    if (found != null) return found;
    if (prices.length) return Math.min.apply(null, prices);
  }
  return num(hotel.price);
}

/* 兼容旧调用：某酒店在指定日期的每晚参考价（最低价） */
function matchHotelPrice(hotel, dateStr) {
  return priceOfRoom(hotel, dateStr, '');
}

/* 推导行程天数：优先 出行~返程 日期差；否则用行程天数；兜底 1 */
function deriveDays(order) {
  const d1 = Date.parse(String((order && order.departDate) || '').replace(/-/g, '/'));
  const d2 = Date.parse(String((order && order.returnDate) || '').replace(/-/g, '/'));
  if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
    const n = Math.round((d2 - d1) / 86400000) + 1;
    if (n > 0) return n;
  }
  const itDays = (order && order.itinerary && order.itinerary.days) || [];
  if (Array.isArray(itDays) && itDays.length) return itDays.length;
  return 1;
}

/* 当天某景区已选游玩项目。price 保持原文字，计价时再解析数字。 */
function playPicks(plan, scenicId) {
  const rows = (plan && plan.playItemSelections) || [];
  const row = rows.filter(r => r && String(r.scenicId || '') === String(scenicId || ''))[0];
  if (!row || !Array.isArray(row.items)) return [];
  return row.items.filter(it => it && (it.name || it.id)).map(it => ({
    id: String(it.id || ''),
    name: String(it.name || '游玩项目'),
    price: String(it.price == null ? '' : it.price)
  }));
}

/*
 * 核价主函数
 * opts = {
 *   plans: [{ scenicIds:[], playItemSelections:[{scenicId, items:[{id,name,price}]}], hotelId:'', roomType:'', roomQty:1, checkinDate:'2026-11-20' }],
 *   hotelsById: { id: hotel },   // hotel.prices = [{roomType,start,end,price}]（或由 hotelPricesById 注入）
 *   hotelPricesById: { id: [{roomType,start,end,price}] },  // 可选：覆盖 hotelsById[id].prices
 *   scenicsById: { id: scenic },             // 需含 ticketPrice（原始字段）
 *   departDate, returnDate, people, carCost
 * }
 * 返回 { hotel, ticket, car, total, nights, days, people, breakdown:[...], missing:[...] }
 */
function calcQuote(opts) {
  const o = opts || {};
  const plans = Array.isArray(o.plans) ? o.plans : [];
  const hotelsById = o.hotelsById || {};
  const hotelPricesById = o.hotelPricesById || {};
  const scenicsById = o.scenicsById || {};
  const people = num(o.people);
  const car = num(o.carCost);

  const days = deriveDays(o);
  const nights = Math.max(1, days - 1);

  /* 取某酒店在指定日期的价格档期数组（优先 hotelPricesById 注入） */
  function pricesOf(hotelId) {
    if (hotelPricesById[hotelId]) return hotelPricesById[hotelId];
    const h = hotelsById[hotelId];
    return (h && h.prices) || [];
  }
  /* 临时构造带 prices 的酒店视图供 priceOfRoom/roomTypesOf 使用 */
  function hotelView(hotelId) {
    const h = hotelsById[hotelId];
    if (!h) return null;
    if (h.prices) return h;
    return Object.assign({}, h, { prices: pricesOf(hotelId) });
  }

  const breakdown = [];
  const missing = [];
  let hotelTotal = 0;
  let ticketTotal = 0;

  plans.forEach((p, i) => {
    const plan = p || {};
    const dayLabel = '第' + (i + 1) + '天';
    const checkinDate = normDate(plan.checkinDate) || addDays(o.departDate, i);

    const ids = (plan.scenicIds || []);
    const playCharged = {};
    ids.forEach(id => {
      const s = scenicsById[id];
      const picks = playPicks(plan, id);
      if (picks.length) {
        if (playCharged[id]) return;
        playCharged[id] = 1;
        if (!s) missing.push({ type: 'scenic', id, day: i + 1 });
        picks.forEach(it => {
          const unit = parseTicketPrice(it.price);
          const sub = unit * people;
          ticketTotal += sub;
          const who = s && s.name ? (s.name + ' · ' + it.name) : it.name;
          breakdown.push({ day: dayLabel, type: 'play', name: who, unit, qty: people, subtotal: sub });
        });
        return;
      }
      if (!s) { missing.push({ type: 'scenic', id, day: i + 1 }); return; }
      const unit = parseTicketPrice(s.ticketPrice);
      const sub = unit * people;
      ticketTotal += sub;
      breakdown.push({ day: dayLabel, type: 'scenic', name: s.name, unit, qty: people, subtotal: sub });
    });

    if (plan.hotelId) {
      const h = hotelView(plan.hotelId);
      if (!h) { missing.push({ type: 'hotel', id: plan.hotelId, day: i + 1 }); return; }
      const roomType = String(plan.roomType || '').trim() || roomTypesOf(h, checkinDate)[0];
      const perNight = priceOfRoom(h, checkinDate, roomType);
      const qty = Math.max(1, parseInt(plan.roomQty, 10) || 1);
      const sub = perNight * qty;
      hotelTotal += sub;
      if (!perNight) missing.push({ type: 'hotelPrice', id: h.id, day: i + 1 });
      breakdown.push({ day: dayLabel, type: 'hotel', name: h.name, room: roomType, date: checkinDate, unit: perNight, qty, subtotal: sub });
    }
  });

  const total = hotelTotal + ticketTotal + car;

  return {
    hotel: hotelTotal,
    ticket: ticketTotal,
    car,
    total,
    nights,
    days,
    people,
    breakdown,
    missing
  };
}

/* 无内部票价时的酒店参考合计：所选酒店公开价 × 当天间数 */
function publicHotelQuote(plans, hotelsById) {
  let hotel = 0;
  (Array.isArray(plans) ? plans : []).forEach(p => {
    const h = hotelsById && hotelsById[p && p.hotelId];
    if (!h) return;
    const qty = Math.max(1, parseInt(p.roomQty, 10) || 1);
    hotel += num(h.price) * qty;
  });
  return { hotel, ticket: 0, car: 0, total: hotel };
}

/* 分享页标题：张先生的5天4晚的海拉尔行程。没有称呼时省略人名。 */
function shareTitle(opts) {
  const o = opts || {};
  const days = Math.max(1, parseInt(o.days, 10) || 1);
  const nights = Math.max(0, days - 1);
  const who = String(o.guestName || '').trim();
  const place = String(o.place || '').trim() || '呼伦贝尔';
  return (who ? who + '的' : '') + days + '天' + nights + '晚的' + place + '行程';
}

/* 标题里的地点：优先第一个景区所在地，其次酒店地点 */
function tripPlace(plans, scenicsById, hotelsById) {
  const list = Array.isArray(plans) ? plans : [];
  for (let i = 0; i < list.length; i++) {
    const ids = (list[i] && list[i].scenicIds) || [];
    for (let j = 0; j < ids.length; j++) {
      const s = scenicsById && scenicsById[ids[j]];
      const name = s && (s.dest || s.area);
      if (name) return name;
    }
  }
  for (let i = 0; i < list.length; i++) {
    const h = hotelsById && list[i] && hotelsById[list[i].hotelId];
    if (h && h.area) return h.area;
  }
  return '';
}

/* 对客报价只保留客人能看的每人价格，不带内部核算 */
function guestQuoteText(amount) {
  const n = num(amount);
  if (!(n > 0)) return '';
  return '¥' + n + '/人';
}

/* 行程总价标注：金额 + 酒店/门票构成 + 成人/儿童人数。仅员工可见。 */
function annotateQuote(q, adults, children) {
  const hotel = num(q && q.hotel);
  const ticket = num(q && q.ticket);
  const total = (q && q.total != null) ? num(q.total) : hotel + ticket + num(q && q.car);
  const a = Math.max(0, parseInt(adults, 10) || 0);
  const c = Math.max(0, parseInt(children, 10) || 0);
  return {
    label: '行程总价',
    total,
    hotel,
    ticket,
    adults: a,
    children: c,
    pending: !(total > 0),
    note: '酒店 ¥' + hotel + ' · 门票 ¥' + ticket + ' · ' + a + ' 成人 · ' + c + ' 儿童'
  };
}

module.exports = {
  num, parseTicketPrice, normDate, monthOf, addDays, playPicks,
  periodHasDate, periodHasMonth,
  periodsOnDate, roomTypesOnDate, roomTypesOf, priceOfRoom, matchHotelPrice,
  deriveDays, calcQuote, publicHotelQuote, annotateQuote,
  shareTitle, tripPlace, guestQuoteText
};
