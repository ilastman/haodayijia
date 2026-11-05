/**
 * 员工内部核价计算（纯函数，无副作用，便于 Node 单测）
 * - 酒店：逐日累加，第 N 晚住第 N 晚；每晚按【入住日期】闭区间匹配价格档期
 *         小计 = 所选房型当档期价 × 当天间数
 * - 景区：解析文本 ticketPrice 得到固定单价，同景区重复出现重复累加
 * - 车辆：按出发日起的计费日逐日命中 prices 档期；套票按次，不随计费天数重复
 *         未自定义计费日时默认行程每一天（兼容旧行程）
 * 价格数据来源：hotelPrice 集合（自定义日期区间，闭区间 []
 */

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* 解析景区文本票价："120元" -> 120；"免费"/空/无数字 -> 0 */
function parseTicketPrice(text) {
  const m = String(text == null ? '' : text).match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/* 是否有可计价的票价文本（含数字） */
function hasPriceText(text) {
  return /\d/.test(String(text == null ? '' : text));
}

/* 景区门票单价（ticketUnits）：成人全票；儿童半价优先 -> 儿童可免则 0 -> 否则全票 */
function ticketUnits(s) {
  const adultUnit = parseTicketPrice(s && s.ticketPrice);
  if (!(adultUnit > 0)) return { adultUnit: 0, childUnit: 0, childRule: '免费', childReason: '景区免费' };
  if (hasPriceText(s && s.ticketHalfPrice) && parseTicketPrice(s.ticketHalfPrice) > 0) {
    return { adultUnit, childUnit: parseTicketPrice(s.ticketHalfPrice), childRule: '半价', childReason: '儿童半价' };
  }
  const free = s && (s.ticketChildFree === true || s.ticketChildFree === 'true');
  if (free) return { adultUnit, childUnit: 0, childRule: '免票', childReason: '儿童免票' };
  return { adultUnit, childUnit: adultUnit, childRule: '全票', childReason: '' };
}

/* 景区优惠类别表（ticketCategories）：后台有则用；无则由 ticketPrice/ticketHalfPrice/ticketChildFree 推导 */
function ticketCategoriesOf(s) {
  const raw = s && Array.isArray(s.ticketCategories) ? s.ticketCategories : [];
  const list = raw.filter(x => x && String(x.name || '').trim()).map((x, i) => ({
    id: String(x.id || ('tc_' + i)), name: String(x.name).trim(), price: parseTicketPrice(x.price)
  }));
  if (list.length) return list;
  const t = ticketUnits(s);
  if (!(t.adultUnit > 0)) return [{ id: 'free', name: '免票', price: 0 }];
  const out = [{ id: 'full', name: '全票', price: t.adultUnit }];
  if (hasPriceText(s && s.ticketHalfPrice) && parseTicketPrice(s.ticketHalfPrice) > 0) out.push({ id: 'half', name: '半票', price: parseTicketPrice(s.ticketHalfPrice) });
  if (s && (s.ticketChildFree === true || s.ticketChildFree === 'true')) out.push({ id: 'free', name: '免票', price: 0 });
  return out;
}

/* 默认选中：成人「全票」；儿童 半票 > 免票 > 全票（与 ticketUnits 半价优先一致）；找不到同名项则取第一项 */
function defaultTicketCat(cats, isChild) {
  const order = isChild ? ['半票', '免票', '全票'] : ['全票'];
  for (let k = 0; k < order.length; k++) {
    const hit = cats.filter(c => c.name === order[k])[0];
    if (hit) return hit;
  }
  return cats[0];
}

/* 按人分行的门票明细（仅定制师内部核算用，客户侧不渲染）；picks 为每行已点选的类别 id */
function ticketPersons(cats, adults, children, picks) {
  const rows = [];
  const options = cats.map(c => c.name + ' ¥' + c.price);
  const total = adults + children;
  for (let n = 0; n < total; n++) {
    const isChild = n >= adults;
    const pid = picks && picks[n];
    let cat = pid ? cats.filter(c => c.id === pid)[0] : null;
    const picked = !!cat;
    if (!cat) cat = defaultTicketCat(cats, isChild);
    rows.push({
      who: isChild ? ('儿童' + (n - adults + 1)) : ('成人' + (n + 1)),
      catId: cat.id, kind: cat.name, price: cat.price, amount: cat.price,
      pickIndex: cats.indexOf(cat), options, picked
    });
  }
  return rows;
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

/* 没有出行月份时用雪季，有月份则按月份。 */
function seasonOf(month) {
  const m = parseInt(month, 10) || 0;
  if (m >= 5 && m <= 6) return '初夏草原';
  if (m >= 7 && m <= 8) return '盛夏草原';
  if (m >= 9 && m <= 10) return '金秋草原';
  if (m >= 11 || (m >= 1 && m <= 4)) return '冬季雪原';
  return '冬季雪原';
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
  /* 无精确档期时，模糊档期里的房型也作为可选房型（价格仍按模糊提示，不计入） */
  ((hotel && hotel.prices) || []).forEach(p => {
    if (!(p && p.fuzzy)) return;
    const n = String(p.roomType || '').trim();
    if (n && !seen[n]) { seen[n] = 1; fallback.push(n); }
  });
  if (fallback.length) return fallback;
  return ['标准间'];
}

/* 某酒店在指定日期、指定房型的报价信息。
 * 只有「入住日落在精确档期内 + 房型命中 + 单一价」才算精确价；
 * 其余（房型对不上 / 只有模糊档期 / 区间价 / 无档期）一律标记 fuzzy，price=0（待确认），
 * 不再静默回退当日最低价或 hotel.price（参考最低价）。
 * 返回 { price, exact, fuzzy, reason, ref } */
function priceInfoOfRoom(hotel, dateStr, roomType) {
  const out = { price: 0, exact: false, fuzzy: true, reason: '', ref: '' };
  if (!hotel) { out.reason = '酒店不存在'; return out; }
  const all = ((hotel && hotel.prices) || []);
  const want = String(roomType || '').trim();
  const sameRoom = p => !want || String((p && p.roomType) || '').trim() === want;
  const label = p => String((p && (p.priceRaw || p.price)) || '').trim();
  const hit = periodsOnDate(all.filter(p => p && !p.fuzzy), dateStr);
  const roomHit = hit.filter(p => sameRoom(p) && num(p.price) > 0);
  if (roomHit.length) {
    const p = roomHit[0];
    const mn = num(p.priceMin || p.price), mx = num(p.priceMax || p.price);
    if (mx > mn) {
      out.reason = '该日为区间价，需与酒店确认';
      out.ref = (want || p.roomType || '') + ' ' + label(p);
      return out;
    }
    return { price: num(p.price), exact: true, fuzzy: false, reason: '', ref: '' };
  }
  if (hit.length) {
    out.reason = '该入住日无「' + want + '」房型精确价';
    out.ref = hit.filter(p => num(p.price) > 0).map(p => (p.roomType || '') + ' ' + label(p)).join('；');
    return out;
  }
  const fz = all.filter(p => p && p.fuzzy && sameRoom(p));
  if (fz.length) {
    out.reason = '入住日无精确档期，仅有模糊报价';
    out.ref = fz.map(p => label(p) + (p.remark ? '（' + p.remark + '）' : '')).filter(Boolean).join('；');
    return out;
  }
  out.reason = all.length ? '入住日不在任何价格档期内' : '酒店未录入价格档期';
  return out;
}

/* 精确每晚价；对不上精确价返回 0（不再回退最低价） */
function priceOfRoom(hotel, dateStr, roomType) {
  return priceInfoOfRoom(hotel, dateStr, roomType).price;
}

/* 兼容旧调用：某酒店在指定日期的精确价（无房型限定时取首条命中，不取最低价） */
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

/*
 * 核价主函数
 * opts = {
 *   plans: [{ scenicIds:[], hotelId:'', roomType:'', roomQty:1, checkinDate:'2026-11-20' }],
 *   hotelsById: { id: hotel },   // hotel.prices = [{roomType,start,end,price}]（或由 hotelPricesById 注入）
 *   hotelPricesById: { id: [{roomType,start,end,price}] },  // 可选：覆盖 hotelsById[id].prices
 *   scenicsById: { id: scenic },             // 需含 ticketPrice（原始字段）
 *   departDate, returnDate, people, carCost
 * }
 * 返回 { hotel, ticket, car, total, nights, days, people, breakdown:[...], missing:[...] }
 */

/* 远野体验等无门票景区：noTicket 标记或类型名含「远野」 */
function isNoTicket(s) {
  if (!s) return false;
  if (s.noTicket === true || s.noTicket === false) return s.noTicket; /* 表格写入的显式标记优先 */
  return String(s.typeName || '').indexOf('远野') >= 0;
}

/* packages[{id,name,price}] suite tickets */
function packagesOf(s) {
  const raw = s && Array.isArray(s.packages) ? s.packages : [];
  return raw.filter(x => x && String(x.name || '').trim()).map((x, i) => ({
    id: String(x.id || ('pkg_' + i)),
    name: String(x.name).trim(),
    price: parseTicketPrice((x.price === '\u514d\u8d39') ? '0' : x.price),
    priceText: (x.price == null || x.price === '') ? '' : String(x.price).trim()
  }));
}

function packageSelectionsAmount(scenicsById, packageSelections, people) {
  const ppl = Math.max(1, parseInt(people, 10) || 1);
  let total = 0;
  const rows = [];
  (Array.isArray(packageSelections) ? packageSelections : []).forEach(g => {
    if (!g || !g.scenicId) return;
    const s = scenicsById[g.scenicId];
    const sname = (s && s.name) || g.scenicId;
    (g.items || []).forEach(it => {
      if (!it) return;
      const unit = parseTicketPrice((it.price === '\u514d\u8d39') ? '0' : it.price);
      const sub = unit * ppl;
      total += sub;
      rows.push({
        type: 'package', name: sname + ' \u00b7 ' + (it.name || ''),
        unit: unit, qty: ppl, subtotal: sub,
        scenicId: g.scenicId, packageId: it.id || '',
        note: '\u5957\u7968 \uffe5' + unit + '\u00d7' + ppl + '\u4eba'
      });
    });
  });
  return { total, rows };
}

/* ---------- 用车：按日期档期（对齐酒店 priceInfo）+ 车套票（接送机/市游，按次） ---------- */
function priceNums(v) { return (String(v == null ? '' : v).match(/\d+(?:\.\d+)?/g) || []).map(Number); }
/* 某车型某日用车价：只有命中非模糊档期且为单一价才算精确；其余 fuzzy（不取最低价，待确认） */
function priceInfoOfVehicle(v, dateStr) {
  const out = { price: 0, exact: false, fuzzy: true, reason: '', ref: '' };
  if (!v) { out.reason = '车型不存在'; return out; }
  const all = Array.isArray(v.prices) ? v.prices : [];
  const label = p => String((p && p.price) == null ? '' : p.price).trim();
  const hit = periodsOnDate(all.filter(p => p && !p.fuzzy), dateStr).filter(p => priceNums(p.price).length);
  if (hit.length) {
    const ns = priceNums(hit[0].price);
    if (ns.length > 1 && Math.max.apply(null, ns) > Math.min.apply(null, ns)) {
      out.reason = '该日为区间价，需确认'; out.ref = label(hit[0]); return out;
    }
    return { price: ns[0], exact: true, fuzzy: false, reason: '', ref: '' };
  }
  const fz = all.filter(p => p && p.fuzzy);
  if (fz.length) {
    out.reason = '用车日无精确档期，仅有模糊报价';
    out.ref = fz.map(p => label(p) + (p.remark ? '（' + p.remark + '）' : '')).join('；');
    return out;
  }
  out.reason = all.length ? '用车日不在任何价格档期内' : '车型未录入价格档期';
  return out;
}
function vehiclePackagesOf(v) {
  const raw = v && Array.isArray(v.packages) ? v.packages : [];
  return raw.filter(x => x && String(x.name || '').trim()).map((x, i) => ({
    id: String(x.id || ('vpk_' + i)),
    name: String(x.name).trim(),
    price: parseTicketPrice((x.price === '\u514d\u8d39') ? '0' : x.price),
    priceText: (x.price == null || x.price === '') ? '' : String(x.price).trim()
  }));
}
/* 车图旁的说明。intro 原文保留；已含示意声明时不重复追加。没有图就不声明「示意图」。 */
const CAR_ILLUS_NOTE = '车型示意图，实际以安排为准';
function vehicleHasImage(car) {
  return !!(car && String(car.image || car.cover || '').trim());
}
function vehicleCaption(car) {
  if (!car) return '';
  const intro = String(car.intro || '').replace(/\s+/g, ' ').trim();
  const stated = intro.indexOf('实际以安排为准') >= 0;
  if (!vehicleHasImage(car)) return intro;
  if (!intro) return CAR_ILLUS_NOTE;
  if (stated) return intro;
  return intro + '（' + CAR_ILLUS_NOTE + '）';
}
/* 车套票合计：按次计价（不乘人数）；carPackageSelections=[{vehicleId, items:[{id,name,price}]}] */
function carPackageAmount(vehiclesById, sels) {
  let total = 0; const rows = [];
  (Array.isArray(sels) ? sels : []).forEach(g => {
    if (!g || !g.vehicleId) return;
    const v = vehiclesById && vehiclesById[g.vehicleId];
    const vname = (v && v.name) || g.vehicleId;
    (g.items || []).forEach(it => {
      if (!it) return;
      const unit = parseTicketPrice((it.price === '\u514d\u8d39') ? '0' : it.price);
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      total += unit * qty;
      rows.push({ type: 'carPackage', name: vname + ' · ' + (it.name || ''), unit, qty, subtotal: unit * qty, vehicleId: g.vehicleId, packageId: it.id || '', note: '车套票 ¥' + unit + '×' + qty + '次' });
    });
  });
  return { total, rows };
}
/* 计费用车日：相对出发日的偏移。未自定义时跟行程天数；自定义后可取消某天、加回或加到行程之外。 */
const CAR_OFFSET_MAX = 45;

function sanitizeCarOffsets(raw) {
  const seen = {};
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach(x => {
    const n = parseInt(x, 10);
    if (isNaN(n) || n < 0 || n > CAR_OFFSET_MAX || seen[n]) return;
    seen[n] = 1;
    out.push(n);
  });
  out.sort((a, b) => a - b);
  return out;
}

function hasCarUseField(src) {
  if (!src || typeof src !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(src, 'carUseCustom')
    || Object.prototype.hasOwnProperty.call(src, 'carUseOffsets');
}

/* 持久化形态。custom 为假时不写死天数，重新打开仍跟行程。 */
function packCarUse(custom, offsets) {
  if (custom !== true && custom !== 'true' && custom !== 1) {
    return { carUseCustom: false, carUseOffsets: null };
  }
  return { carUseCustom: true, carUseOffsets: sanitizeCarOffsets(offsets) };
}

/* 从行程/分享/云端记录读回。没有字段 = 旧数据，不是「0 天」。 */
function pickCarUse(src) {
  if (!hasCarUseField(src)) return { carUseCustom: false, carUseOffsets: null };
  const s = src || {};
  const custom = s.carUseCustom === true || s.carUseCustom === 'true' || s.carUseCustom === 1 || Array.isArray(s.carUseOffsets);
  if (!custom) return { carUseCustom: false, carUseOffsets: null };
  return { carUseCustom: true, carUseOffsets: sanitizeCarOffsets(s.carUseOffsets) };
}

/* 本地缓存没有计费日、云端有时才补上。已有本地选择不被云端盖掉。 */
function carryMissingCarUse(localTrip, cloudTrip) {
  if (!localTrip || hasCarUseField(localTrip) || !hasCarUseField(cloudTrip)) return false;
  const packed = pickCarUse(cloudTrip);
  localTrip.carUseCustom = packed.carUseCustom;
  localTrip.carUseOffsets = packed.carUseOffsets;
  return true;
}

/* 当前生效的计费偏移。未自定义时为 0..tripDays-1。 */
function readCarUse(src, tripDays) {
  const picked = pickCarUse(src);
  if (picked.carUseCustom) return { custom: true, offsets: picked.carUseOffsets };
  const n = Math.max(0, parseInt(tripDays, 10) || 0);
  const offsets = [];
  for (let i = 0; i < n && i <= CAR_OFFSET_MAX; i++) offsets.push(i);
  return { custom: false, offsets };
}

/* 减：去掉最晚的计费日。加：先加回行程内被取消的天，再往后加一天。 */
function stepCarUse(offsets, tripDays, dir) {
  const days = Math.max(0, parseInt(tripDays, 10) || 0);
  const cur = sanitizeCarOffsets(offsets);
  if (dir < 0) {
    if (!cur.length) return cur;
    return cur.slice(0, cur.length - 1);
  }
  const on = {};
  cur.forEach(i => { on[i] = 1; });
  for (let i = 0; i < days; i++) {
    if (!on[i]) return sanitizeCarOffsets(cur.concat([i]));
  }
  const last = cur.length ? cur[cur.length - 1] : -1;
  const next = Math.max(days, last + 1);
  if (next > CAR_OFFSET_MAX) return cur;
  return sanitizeCarOffsets(cur.concat([next]));
}

function toggleCarUseOffset(offsets, offset) {
  const n = parseInt(offset, 10);
  if (isNaN(n) || n < 0 || n > CAR_OFFSET_MAX) return sanitizeCarOffsets(offsets);
  const cur = sanitizeCarOffsets(offsets);
  const pos = cur.indexOf(n);
  if (pos > -1) cur.splice(pos, 1);
  else cur.push(n);
  return sanitizeCarOffsets(cur);
}

/* 删掉或恢复某一天。若结果正好是行程里的每一天，回到未自定义，方便旧行程继续跟天数。 */
function carUseAfterToggle(offsets, tripDays, offset) {
  const next = toggleCarUseOffset(offsets, offset);
  const days = Math.max(0, parseInt(tripDays, 10) || 0);
  if (next.length === days) {
    let same = true;
    for (let i = 0; i < days; i++) if (next[i] !== i) same = false;
    if (same) return { custom: false, offsets: null };
  }
  return { custom: true, offsets: next };
}

/* 行程里被去掉的计费日，供一行「恢复」。不含行程外多出来的天。 */
function droppedCarDays(tripDays, use) {
  const u = use || {};
  if (!u.custom) return [];
  const on = {};
  (u.offsets || []).forEach(i => { on[i] = 1; });
  const n = Math.max(0, parseInt(tripDays, 10) || 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!on[i]) out.push({ offset: i, label: '第' + (i + 1) + '天' });
  }
  return out;
}

/* 分享载入只带计费日选择和套票勾选，不带内部核算金额、手填覆盖。 */
function publicSharePayload(src) {
  const s = src || {};
  const car = pickCarUse(s);
  const plans = Array.isArray(s.plans) ? s.plans : (Array.isArray(s.timeline) ? s.timeline : []);
  return {
    id: s.id || '',
    days: s.days || plans.length || 0,
    date: s.date || '',
    adults: s.adults,
    children: s.children,
    plans: plans,
    timeline: Array.isArray(s.timeline) ? s.timeline : plans,
    carId: s.carId || '',
    carPackageSelections: Array.isArray(s.carPackageSelections) ? s.carPackageSelections : [],
    carUseCustom: car.carUseCustom,
    carUseOffsets: car.carUseOffsets
  };
}

/* 用车天价：每个偏移按出发日+偏移的实际日期命中档期，跨档不拿起价乘天数 */
function vehicleDaysByOffsets(v, departDate, offsets) {
  let total = 0; const rows = []; const fuzzy = [];
  sanitizeCarOffsets(offsets).forEach(off => {
    const d = addDays(departDate, off);
    const info = priceInfoOfVehicle(v, d);
    const unit = info.exact ? info.price : 0;
    total += unit;
    if (!info.exact) fuzzy.push({ type: 'carPrice', id: v && v.id, day: off + 1, date: d, reason: info.reason, ref: info.ref });
    rows.push({
      day: '第' + (off + 1) + '天', type: 'car', name: (v && v.name) || '用车', date: d, offset: off,
      unit, qty: 1, subtotal: unit, canDrop: true,
      fuzzy: !info.exact,
      fuzzyText: info.exact ? '' : ('用车价格模糊：' + (d || '未填日期') + ' ' + info.reason + (info.ref ? '；参考 ' + info.ref : '') + '，待确认')
    });
  });
  return { total, rows, fuzzy };
}

/* 连续 carDays 天（旧调用）。逐日档期，不是起价 × 天数。 */
function vehicleDaysAmount(v, departDate, carDays) {
  const n = Math.max(0, parseInt(carDays, 10) || 0);
  const offsets = [];
  for (let i = 0; i < n && i <= CAR_OFFSET_MAX; i++) offsets.push(i);
  return vehicleDaysByOffsets(v, departDate, offsets);
}

/* 按天选用车的展示。行程内的天始终列出；行程外只列出已加的计费日。 */
function carUseDayViews(vehicle, departDate, tripDays, offsets) {
  const days = Math.max(0, parseInt(tripDays, 10) || 0);
  const onList = sanitizeCarOffsets(offsets);
  const on = {};
  onList.forEach(i => { on[i] = 1; });
  let max = days - 1;
  onList.forEach(i => { if (i > max) max = i; });
  const views = [];
  for (let i = 0; i <= max; i++) {
    const date = addDays(departDate, i);
    const info = vehicle ? priceInfoOfVehicle(vehicle, date) : null;
    const billed = !!on[i];
    let priceText = '待确认';
    if (info && info.exact) priceText = '¥' + info.price;
    views.push({
      offset: i,
      label: '第' + (i + 1) + '天',
      date: date,
      dateText: date ? date.slice(5) : '',
      extra: i >= days,
      on: billed,
      priceText: billed ? priceText : '不用车',
      fuzzy: !!(billed && (!info || !info.exact))
    });
  }
  return views;
}

function resolveCarOffsets(o, tripDays) {
  const src = o || {};
  if (hasCarUseField(src) && (src.carUseCustom === true || src.carUseCustom === 'true' || src.carUseCustom === 1 || Array.isArray(src.carUseOffsets))) {
    return sanitizeCarOffsets(src.carUseOffsets);
  }
  if (src.carDays != null && src.carDays !== '') {
    const n = Math.max(0, parseInt(src.carDays, 10) || 0);
    const offsets = [];
    for (let i = 0; i < n && i <= CAR_OFFSET_MAX; i++) offsets.push(i);
    return offsets;
  }
  return readCarUse({}, tripDays).offsets;
}

function calcQuote(opts) {
  const o = opts || {};
  const plans = Array.isArray(o.plans) ? o.plans : [];
  const hotelsById = o.hotelsById || {};
  const hotelPricesById = o.hotelPricesById || {};
  const scenicsById = o.scenicsById || {};
  /* 成人/儿童分开计价；只传 people 时视为全部成人（兼容旧调用） */
  const hasSplit = o.adults != null || o.children != null;
  const adults = hasSplit ? Math.max(0, parseInt(o.adults, 10) || 0) : num(o.people);
  const children = hasSplit ? Math.max(0, parseInt(o.children, 10) || 0) : 0;
  const people = hasSplit ? adults + children : num(o.people);
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
    if (hotelPricesById[hotelId]) return Object.assign({}, h, { prices: hotelPricesById[hotelId] });
    if (h.prices) return h;
    return Object.assign({}, h, { prices: pricesOf(hotelId) });
  }

  const breakdown = [];
  const missing = [];
  const fuzzy = [];
  let hotelTotal = 0;
  let ticketTotal = 0;
  let packageTotal = 0;

  plans.forEach((p, i) => {
    const plan = p || {};
    const dayLabel = '第' + (i + 1) + '天';
    const checkinDate = normDate(plan.checkinDate) || addDays(o.departDate, i);

    const ids = (plan.scenicIds || []);
    ids.forEach(id => {
      const s = scenicsById[id];
      if (!s) { missing.push({ type: 'scenic', id, day: i + 1 }); return; }
      if (isNoTicket(s)) return; /* 远野体验：无门票口径，仅套票勾选计价 */
      const t = ticketUnits(s);
      const cats = ticketCategoriesOf(s);
      const pickKey = i + '_' + id;
      const persons = ticketPersons(cats, adults, children, o.ticketPicks && o.ticketPicks[pickKey]);
      const sub = persons.reduce((acc, r) => acc + (Number(r.price) || 0), 0);
      ticketTotal += sub;
      breakdown.push({
        day: dayLabel, type: 'scenic', name: s.name, pickKey,
        unit: t.adultUnit, qty: adults + children, subtotal: sub,
        adultUnit: t.adultUnit, adultQty: adults,
        childUnit: t.childUnit, childQty: children, childRule: t.childRule,
        cats, persons, ticketAlert: String((s && s.ticketAlert) || ''),
        note: '成人 ¥' + t.adultUnit + '×' + adults + ' + 儿童 ¥' + t.childUnit + '×' + children + '（' + t.childRule + '）'
      });
    });

    const dayPkg = packageSelectionsAmount(scenicsById, plan.packageSelections, people);
    packageTotal += dayPkg.total;
    dayPkg.rows.forEach(r => { breakdown.push(Object.assign({ day: dayLabel }, r)); });

    /* 每天多条住宿预订：每条各自房型×间数累加（兼容旧单酒店） */
    bookingsOf(plan).forEach(bk => {
      const h = hotelView(bk.hotelId);
      if (!h) { missing.push({ type: 'hotel', id: bk.hotelId, day: i + 1 }); return; }
      const roomType = String(bk.roomType || '').trim() || roomTypesOf(h, checkinDate)[0];
      const info = priceInfoOfRoom(h, checkinDate, roomType);
      const perNight = info.exact ? info.price : 0;
      const qty = Math.max(1, parseInt(bk.roomQty, 10) || 1);
      const sub = perNight * qty;
      hotelTotal += sub;
      if (!info.exact) fuzzy.push({ type: 'hotelPrice', id: h.id, day: i + 1, date: checkinDate, room: roomType, reason: info.reason, ref: info.ref });
      breakdown.push({
        day: dayLabel, type: 'hotel', name: h.name, room: roomType, date: checkinDate, unit: perNight, qty, subtotal: sub,
        fuzzy: !info.exact,
        fuzzyText: info.exact ? '' : ('价格模糊：' + checkinDate + ' ' + info.reason + (info.ref ? '；参考 ' + info.ref : '') + '，待与酒店确认')
      });
    });
  });

  /* 用车：手填 carCost>0 覆盖日租合计；日租按计费日逐日档期。套票另计，不乘天数。 */
  let carAuto = 0, carFuzzy = 0, carPackage = 0;
  const billedOffsets = resolveCarOffsets(o, plans.length || days);
  const v = o.carId && o.vehiclesById ? o.vehiclesById[o.carId] : null;
  if (o.carId && o.vehiclesById && !v) missing.push({ type: 'car', id: o.carId });
  if (v) {
    const vd = vehicleDaysByOffsets(v, o.departDate, billedOffsets);
    carAuto = vd.total; carFuzzy = vd.fuzzy.length;
    if (!(car > 0)) { vd.rows.forEach(r => breakdown.push(r)); vd.fuzzy.forEach(f => fuzzy.push(f)); }
  }
  const cp = carPackageAmount(o.vehiclesById || {}, o.carPackageSelections);
  carPackage = cp.total;
  cp.rows.forEach(r => breakdown.push(Object.assign({ day: '用车' }, r)));
  const carDaysTotal = car > 0 ? car : carAuto;
  if (car > 0 && v) breakdown.push({ day: '用车', type: 'car', name: v.name + '（手填覆盖）', unit: car, qty: 1, subtotal: car });
  const total = hotelTotal + ticketTotal + packageTotal + carDaysTotal + carPackage;

  return {
    hotel: hotelTotal,
    fuzzy,
    hotelFuzzy: fuzzy.filter(f => f.type === 'hotelPrice').length,
    ticket: ticketTotal,
    package: packageTotal,
    car: carDaysTotal + carPackage,
    carDays: carDaysTotal,
    carAuto,
    carManual: car > 0,
    carFuzzy: car > 0 ? 0 : carFuzzy,
    carPackage,
    carUseCount: billedOffsets.length,
    carUseOffsets: billedOffsets,
    carUseCustom: !!(o.carUseCustom === true || o.carUseCustom === 'true' || o.carUseCustom === 1 || Array.isArray(o.carUseOffsets)),
    total,
    nights,
    days,
    people,
    adults,
    children,
    breakdown,
    missing
  };
}

/* 每天住宿预订列表：优先 hotelBookings；旧数据由 hotelId/roomType/roomQty 推导 */
function bookingsOf(plan) {
  const p = plan || {};
  const list = Array.isArray(p.hotelBookings) ? p.hotelBookings.filter(b => b && b.hotelId) : [];
  if (list.length) return list.map(b => ({ hotelId: b.hotelId, roomType: String(b.roomType || ''), roomQty: Math.max(1, parseInt(b.roomQty, 10) || 1) }));
  return p.hotelId ? [{ hotelId: p.hotelId, roomType: String(p.roomType || ''), roomQty: Math.max(1, parseInt(p.roomQty, 10) || 1) }] : [];
}

/* 无内部票价时的酒店参考合计：所选酒店公开价 × 当天间数 */
function publicHotelQuote(plans, hotelsById) {
  let hotel = 0;
  (Array.isArray(plans) ? plans : []).forEach(p => {
    bookingsOf(p).forEach(bk => {
      const h = hotelsById && hotelsById[bk.hotelId];
      if (!h) return;
      hotel += num(h.price) * bk.roomQty;
    });
  });
  return { hotel, ticket: 0, car: 0, total: hotel };
}

const LEVEL1_REGIONS = ['哈尔滨', '呼伦贝尔', '新疆'];
const AREA_TO_LEVEL1 = {
  海拉尔: '呼伦贝尔', 额尔古纳: '呼伦贝尔', 满洲里: '呼伦贝尔', 黑山头: '呼伦贝尔',
  室韦: '呼伦贝尔', 阿尔山: '呼伦贝尔', 恩和: '呼伦贝尔', 根河: '呼伦贝尔', 莫尔道嘎: '呼伦贝尔',
  哈尔滨: '哈尔滨',
  喀拉峻: '新疆', 那拉提: '新疆', 伊犁: '新疆', 乌鲁木齐: '新疆', 独库: '新疆'
};

/* 酒店一级大区。只接受哈尔滨 / 呼伦贝尔 / 新疆，不用海拉尔这类地点名。 */
function level1Place(hotel) {
  if (!hotel) return '';
  const region = String(hotel.regionLevel1 || '').trim();
  if (LEVEL1_REGIONS.indexOf(region) >= 0) return region;
  if (region) return '';
  return AREA_TO_LEVEL1[String(hotel.area || '').trim()] || '';
}

/* 分享页标题：赵先生的呼伦贝尔行程。不含天数晚数，没有称呼时省略人名。 */
function shareTitle(opts) {
  const o = opts || {};
  const who = String(o.guestName || '').trim();
  const place = String(o.place || '').trim() || '呼伦贝尔';
  return (who ? who + '的' : '') + place + '行程';
}

/* 标题里的地点：第一晚酒店的一级大区。 */
function tripPlace(plans, scenicsById, hotelsById) {
  const list = Array.isArray(plans) ? plans : [];
  for (let i = 0; i < list.length; i++) {
    const h = hotelsById && list[i] && hotelsById[list[i].hotelId];
    const place = level1Place(h);
    if (place) return place;
  }
  return '';
}

function moneyText(n) {
  const x = Math.round(num(n) * 100) / 100;
  if (Object.is(x, -0)) return '0';
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  return String(x);
}

/* 对客报价文案：优先成人价/儿童价；兼容旧版「每人报价」数字。不带内部核算。 */
function guestQuoteText(opts) {
  if (opts != null && typeof opts !== 'object') {
    const n = num(opts);
    if (!(n > 0)) return '';
    return '¥' + moneyText(n) + '/人';
  }
  const o = opts || {};
  const ap = num(o.adultPrice != null ? o.adultPrice : o.guestAdultPrice);
  const cp = num(o.childPrice != null ? o.childPrice : o.guestChildPrice);
  const parts = [];
  if (ap > 0) parts.push('成人¥' + moneyText(ap));
  if (cp > 0) parts.push('儿童¥' + moneyText(cp));
  if (parts.length) return parts.join(' · ');
  const t = num(o.total != null ? o.total : (o.guestQuote != null ? o.guestQuote : o.guestTotalPrice));
  if (t > 0) return '¥' + moneyText(t);
  return '';
}

/* 自动总价 = 成人价×成人数 + 儿童价×儿童数 */
function calcGuestTotal(adultPrice, childPrice, adults, children) {
  const ap = num(adultPrice);
  const cp = num(childPrice);
  const a = Math.max(0, parseInt(adults, 10) || 0);
  const c = Math.max(0, parseInt(children, 10) || 0);
  return Math.round((ap * a + cp * c) * 100) / 100;
}

/*
 * 客人详情页总价视图。
 * 新用法：guestTotalView({ adultPrice, childPrice, adults, children, total? })
 *   total 有值则用手改总价；否则按公式自动算。
 * 旧用法：guestTotalView(每人价, adults, children) —— 兼容历史数据。
 */
function guestTotalView(opts, adults, children) {
  if (opts != null && typeof opts !== 'object') {
    const unit = num(opts);
    if (!(unit > 0)) return null;
    const a = Math.max(0, parseInt(adults, 10) || 0);
    const c = Math.max(0, parseInt(children, 10) || 0);
    const people = a + c;
    if (!people) return null;
    const total = Math.round(unit * people * 100) / 100;
    const unitText = moneyText(unit);
    return {
      unit,
      adultPrice: unit,
      childPrice: unit,
      adults: a,
      children: c,
      people,
      total,
      autoTotal: total,
      manual: false,
      text: '¥' + unitText + '/人',
      totalText: '¥' + moneyText(total),
      note: '¥' + unitText + '/人 · ' + a + ' 成人 · ' + c + ' 儿童'
    };
  }
  const o = opts || {};
  const ap = num(o.adultPrice != null ? o.adultPrice : o.guestAdultPrice);
  const cp = num(o.childPrice != null ? o.childPrice : o.guestChildPrice);
  const a = Math.max(0, parseInt(o.adults != null ? o.adults : adults, 10) || 0);
  const c = Math.max(0, parseInt(o.children != null ? o.children : children, 10) || 0);
  const people = a + c;
  const autoTotal = calcGuestTotal(ap, cp, a, c);
  const hasManual = o.total != null && o.total !== '' && !Number.isNaN(Number(o.total));
  const total = hasManual ? num(o.total) : autoTotal;
  if (!(total > 0) && !(ap > 0) && !(cp > 0)) return null;
  if (!people && !(total > 0)) return null;
  const noteParts = [];
  if (ap > 0 || a > 0) noteParts.push('成人 ¥' + moneyText(ap) + ' × ' + a);
  if (cp > 0 || c > 0) noteParts.push('儿童 ¥' + moneyText(cp) + ' × ' + c);
  const note = noteParts.length
    ? noteParts.join(' + ') + (hasManual && Math.abs(total - autoTotal) > 1e-9 ? '（总价已手改）' : '')
    : (a + ' 成人 · ' + c + ' 儿童');
  return {
    adultPrice: ap,
    childPrice: cp,
    adults: a,
    children: c,
    people,
    total,
    autoTotal,
    manual: !!(hasManual && Math.abs(total - autoTotal) > 1e-9),
    text: guestQuoteText({ adultPrice: ap, childPrice: cp, total }),
    totalText: total > 0 ? ('¥' + moneyText(total)) : '',
    note
  };
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
    pending: !(total > 0) || num(q && q.hotelFuzzy) > 0,
    hotelFuzzy: num(q && q.hotelFuzzy),
    fuzzy: (q && q.fuzzy) || [],
    note: '酒店 ¥' + hotel + ' · 门票 ¥' + ticket + ' · ' + a + ' 成人 · ' + c + ' 儿童'
  };
}

module.exports = {
  num, parseTicketPrice, ticketUnits, ticketPersons, ticketCategoriesOf, defaultTicketCat, isNoTicket, packagesOf, packageSelectionsAmount, normDate, monthOf, seasonOf, addDays,
  periodHasDate, periodHasMonth,
  bookingsOf, periodsOnDate, roomTypesOnDate, roomTypesOf, priceOfRoom, priceInfoOfRoom, matchHotelPrice,
  priceInfoOfVehicle, vehiclePackagesOf, vehicleCaption, vehicleHasImage, carPackageAmount, vehicleDaysAmount, vehicleDaysByOffsets,
  sanitizeCarOffsets, hasCarUseField, packCarUse, pickCarUse, carryMissingCarUse, readCarUse, stepCarUse, toggleCarUseOffset,
  carUseAfterToggle, droppedCarDays,
  carUseDayViews, publicSharePayload, resolveCarOffsets,
  deriveDays, calcQuote, publicHotelQuote, annotateQuote,
  shareTitle, tripPlace, guestQuoteText, guestTotalView, calcGuestTotal
};
