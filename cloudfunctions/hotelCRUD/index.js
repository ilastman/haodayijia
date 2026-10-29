const cloud = require('wx-server-sdk');

/**
 * 云函数：hotelCRUD
 * 功能：酒店增删改查（字段与本地 admin SEED 完全对齐）+ 自定义日期价格档期（hotelPrice 子表）
 * 主表字段：{ id, name, cover, album, intro, detailHtml, facilities, price, stars, score, area,
 *             envImg, roomImg, rooms, location, lon, lat, sort, online }
 * 价格子表：hotelPrice = [{ hotelId, hotelName, roomType, start, end, price, sort }]（闭区间）
 * 权限：查询公开；增删改需管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, verifySuperAdmin } = require('./auth');
const COLL = 'hotel';
const PRICE_COLL = 'hotelPrice';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
async function listAll(coll, where) {
  const out = [];
  let skip = 0;
  for (;;) {
    let q = db.collection(coll);
    if (where) q = q.where(where);
    let r;
    try { r = await q.skip(skip).limit(100).get(); }
    catch (e) { return out; }
    const rows = (r && r.data) || [];
    out.push.apply(out, rows);
    if (rows.length < 100) break;
    skip += rows.length;
    if (skip > 10000) break;
  }
  return out;
}
/* 确保价格档期集合存在（首次访问自动创建；已存在则忽略） */
async function ensurePriceColl() {
  try { await db.createCollection(PRICE_COLL); } catch (e) { /* 已存在或权限不足，忽略 */ }
}
/* 按业务 id 读取某酒店的价格档期（去掉 _id/_openid） */
async function pricesByHotel(hotelId) {
  if (!hotelId) return [];
  await ensurePriceColl();
  return (await listAll(PRICE_COLL, { hotelId })).map(strip);
}
/* 全量覆盖某酒店价格档期：先删后插 */
async function replacePrices(hotelId, hotelName, prices) {
  const list = (Array.isArray(prices) ? prices : []).map(normalizePrice).filter(Boolean);
  await ensurePriceColl();
  const oldRows = await listAll(PRICE_COLL, { hotelId });
  /* 并行删除旧档期（分批，避免并发过高） */
  const hn = String(hotelName || '').trim();
  for (let i = 0; i < oldRows.length; i += 20) {
    const batch = oldRows.slice(i, i + 20);
    await Promise.all(batch.map(row => db.collection(PRICE_COLL).doc(row._id).remove()));
  }
  if (!list.length) return 0;
  /* 构造文档后分批并行插入 */
  const docs = list.map((p, i) => ({
    hotelId, hotelName: hn,
    roomType: p.roomType, bedType: p.bedType || '',
    start: p.start, end: p.end, price: p.price,
    priceMin: p.priceMin, priceMax: p.priceMax, priceRaw: p.priceRaw || '',
    fuzzy: !!p.fuzzy, remark: p.remark || '',
    sort: i, createdAt: Date.now()
  }));
  for (let i = 0; i < docs.length; i += 20) {
    const batch = docs.slice(i, i + 20);
    await Promise.all(batch.map(d => db.collection(PRICE_COLL).add({ data: d })));
  }
  return docs.length;
}
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/* 多值文本 -> 数组（支持 / 、 , ， ; ； 换行 分隔） */
function toArray(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v == null ? '' : v).split(/[\/、,，;；\n]+/).map(s => s.trim()).filter(Boolean);
}
/* 经纬度文本 "经度,纬度" -> { lon, lat } | null */
function parseLatLng(s) {
  const m = String(s == null ? '' : s).split(/[,，\s]+/).filter(Boolean);
  if (m.length >= 2) { const lon = Number(m[0]), lat = Number(m[1]); if (!isNaN(lon) && !isNaN(lat)) return { lon, lat }; }
  return null;
}
/* 一级大区与二级区域映射（与小程序 data.js 保持一致） */
const REGIONS = ['呼伦贝尔', '雪乡', '哈尔滨', '新疆'];
const REGION_BY_DEST = {
  海拉尔: '呼伦贝尔', 额尔古纳: '呼伦贝尔', 满洲里: '呼伦贝尔', 黑山头: '呼伦贝尔',
  室韦: '呼伦贝尔', 阿尔山: '呼伦贝尔', 恩和: '呼伦贝尔', 根河: '呼伦贝尔', 莫尔道嘎: '呼伦贝尔'
};
function pad2(n) { return (n < 10 ? '0' : '') + n; }
/* 任意级别文字 -> 1-5 钻（无法识别默认 5） */
function parseStars(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/[1-5]/);
  if (m) return Number(m[0]);
  const cn = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5 };
  for (const k in cn) { if (s.indexOf(k) >= 0) return cn[k]; }
  return 5;
}
async function loadCategoryList() {
  try { return await listAll('category'); }
  catch (e) { return []; }
}
/* 按酒店分类树匹配大区、地点。库还没建好时不提示；对不上只记警告，不拦截入库。 */
function matchHotelCategory(regionName, areaName, cats) {
  const list = (cats || []).filter(c => c.tree === 'hotel');
  const warns = [];
  if (!list.length) return { regionCatId: '', areaCatId: '', warns };
  const region = list.filter(c => c.level === 1 && c.name === regionName)[0] || null;
  if (regionName && !region) warns.push('一级大区「' + regionName + '」不在酒店分类库中，已按原文保存');
  let area = null;
  if (region && areaName) {
    area = list.filter(c => c.level === 2 && c.parentId === region.id && c.name === areaName)[0] || null;
    if (!area) warns.push('地点「' + areaName + '」不在「' + regionName + '」下级，已按原文保存');
  } else if (areaName && !region) {
    warns.push('地点「' + areaName + '」未能挂到分类，已按原文保存');
  }
  return { regionCatId: region ? region.id : '', areaCatId: area ? area.id : '', warns };
}
function deriveRegion(area, regionText) {
  const rt = String(regionText == null ? '' : regionText).trim();
  if (rt) return rt; /* 分类原文原样入库，不强制枚举 */
  const a = String(area == null ? '' : area).trim();
  for (let i = 0; i < REGIONS.length; i++) { if (a.indexOf(REGIONS[i]) >= 0) return REGIONS[i]; }
  return REGION_BY_DEST[a] || '';
}
/* 日期文本 -> 规范化 yyyy-MM-dd；非法返回 null */
function normDate(v) {
  const s = String(v == null ? '' : v).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return y + '-' + pad2(mo) + '-' + pad2(d);
}

/* 价格区间数组 -> 最低价（无数值返回 null） */
function minPrice(prices) {
  let min = null;
  (Array.isArray(prices) ? prices : []).forEach(p => {
    if (p && p.fuzzy) return; /* 模糊档期不参与参考价 */
    const v = Number(p && p.price);
    if (!isNaN(v) && String(p.price).trim() !== '' && (min === null || v < min)) min = v;
  });
  return min;
}

/* 解析价格文本：'680-775' -> {price:680,priceMin:680,priceMax:775,priceRaw:'680-775'}；无数字 null */
function parsePriceRange(v) {
  const raw = String(v == null ? '' : v).trim();
  if (raw === '') return null;
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const list = nums.map(Number).filter(n => !isNaN(n));
  if (!list.length) return null;
  const mn = Math.min.apply(null, list), mx = Math.max.apply(null, list);
  return { price: mn, priceMin: mn, priceMax: mx, priceRaw: raw };
}

/* 归一化单条价格档期 -> 标准结构；非法（缺日期且非模糊 / 非模糊缺价）返回 null
 * 模糊档期允许无价（仅作备注记录）。 */
function normalizePrice(p) {
  p = p || {};
  const fuzzy = !!p.fuzzy;
  const start = fuzzy ? '' : normDate(p.start);
  const end = fuzzy ? '' : normDate(p.end);
  if (!fuzzy && (!start || !end)) return null;
  const pr = parsePriceRange(p.priceRaw != null && p.priceRaw !== '' ? p.priceRaw : p.price);
  if (!pr && !fuzzy) return null;
  return {
    roomType: String(p.roomType || '').trim(),
    bedType: String(p.bedType || '').trim(),
    start: start || '', end: end || '',
    price: pr ? pr.price : 0, priceMin: pr ? pr.priceMin : 0, priceMax: pr ? pr.priceMax : 0,
    priceRaw: pr ? pr.priceRaw : String(p.priceRaw || p.price || ''),
    fuzzy, remark: String(p.remark || '').trim()
  };
}

function collectRoomTypes(meta, list) {
  const roomTypes = [];
  const seenRt = {};
  toArray(meta && meta.roomTypes).forEach(x => { if (x && !seenRt[x]) { seenRt[x] = 1; roomTypes.push(x); } });
  (Array.isArray(meta && meta.rooms) ? meta.rooms : []).forEach(r => {
    const n = String((r && typeof r === 'object' ? r.name : r) || '').trim();
    if (n && !seenRt[n]) { seenRt[n] = 1; roomTypes.push(n); }
  });
  (list || []).forEach(g => {
    const rt = String((g && g.roomType) || '').trim();
    if (rt && !seenRt[rt]) { seenRt[rt] = 1; roomTypes.push(rt); }
  });
  return roomTypes;
}

function collectFacilities(meta) {
  const list = toArray(meta && meta.facility);
  const b = String((meta && meta.breakfast) || '').trim();
  if (b && list.indexOf(b) < 0) list.push(b);
  return list;
}

/* 钻级原文：兼容 level / star / levelText */
function pickLevel(meta) {
  if (!meta) return '';
  const a = String(meta.level == null ? '' : meta.level).trim();
  if (a) return a;
  const b = String(meta.star == null ? '' : meta.star).trim();
  if (b) return b;
  return String(meta.levelText == null ? '' : meta.levelText).trim();
}
function makeHotelKey(name, level, region, area) {
  return [String(name || '').trim(), String(level || '').trim(), String(region || '').trim(), String(area || '').trim()].join('\u0001');
}
function keyFromMeta(meta) {
  return makeHotelKey(
    (meta && (meta.name || meta.hotelName)) || '',
    pickLevel(meta),
    (meta && meta.regionLevel1) || '',
    (meta && meta.area) || ''
  );
}
/* 已入库酒店：优先用级别原文，没有则退回 stars 数字，兼容旧数据 */
function keyFromDoc(doc) {
  const lt = String((doc && doc.levelText) || '').trim();
  const level = lt || (doc && doc.stars != null && String(doc.stars).trim() !== '' ? String(doc.stars) : '');
  return makeHotelKey((doc && doc.name) || '', level, (doc && doc.regionLevel1) || '', (doc && doc.area) || '');
}
function mergeStrList(oldArr, incoming) {
  const out = [];
  const seen = {};
  (Array.isArray(oldArr) ? oldArr : []).concat(Array.isArray(incoming) ? incoming : []).forEach(x => {
    const s = String(x == null ? '' : x).trim();
    if (!s || seen[s]) return;
    seen[s] = 1;
    out.push(s);
  });
  return out;
}
function mergeRooms(existedRooms, incomingRooms, incomingNames) {
  const out = [];
  const idx = {};
  (Array.isArray(existedRooms) ? existedRooms : []).forEach(r => {
    if (!r) return;
    const copy = Object.assign({}, r);
    out.push(copy);
    const n = String(copy.name || '').trim();
    if (n) idx[n] = out.length - 1;
  });
  const extras = [];
  (Array.isArray(incomingRooms) ? incomingRooms : []).forEach(r => {
    if (!r) return;
    extras.push(typeof r === 'object' ? r : { name: String(r), bedType: '', desc: '' });
  });
  (incomingNames || []).forEach(n => {
    const s = String(n || '').trim();
    if (s && extras.every(r => String((r && r.name) || '').trim() !== s)) extras.push({ name: s, bedType: '', desc: '' });
  });
  extras.forEach(nr => {
    const n = String((nr && nr.name) || '').trim();
    if (!n) return;
    if (idx[n] == null) {
      out.push({ name: n, bedType: nr.bedType || '', desc: nr.desc || '', img: nr.img || '' });
      idx[n] = out.length - 1;
      return;
    }
    const cur = out[idx[n]];
    if (!String(cur.bedType || '').trim() && nr.bedType) cur.bedType = nr.bedType;
    if (!String(cur.desc || '').trim() && nr.desc) cur.desc = nr.desc;
    if (!String(cur.img || '').trim() && nr.img) cur.img = nr.img;
  });
  return out;
}
function fillEmpty(existed, upd, key, val) {
  const old = existed && existed[key];
  const empty = old == null || old === '' || (Array.isArray(old) && !old.length);
  if (!empty) return;
  if (val == null || val === '') return;
  if (Array.isArray(val) && !val.length) return;
  upd[key] = val;
}
function mergeIncomingMeta(base, extra) {
  if (!base) return extra;
  ['breakfast', 'decorateYear', 'contact', 'remark', 'facility', 'roomTypes', 'address', 'briefDesc', 'location', 'cover', 'envImg', 'roomImg', 'detailHtml'].forEach(k => {
    if (!String(base[k] == null ? '' : base[k]).trim() && String((extra && extra[k]) == null ? '' : extra[k]).trim()) base[k] = extra[k];
  });
  if (Array.isArray(extra && extra.rooms) && extra.rooms.length) {
    base.rooms = mergeRooms(base.rooms, extra.rooms, []);
  }
  if (Array.isArray(extra && extra.album) && extra.album.length) {
    base.album = mergeStrList(base.album, extra.album);
  }
  return base;
}
function priceDupKey(p) {
  return [
    String((p && p.roomType) || '').trim(),
    String((p && p.bedType) || '').trim(),
    String((p && p.start) || '').trim(),
    String((p && p.end) || '').trim(),
    (p && p.fuzzy) ? '1' : '0',
    String((p && (p.priceRaw != null && p.priceRaw !== '' ? p.priceRaw : p.price)) || '').trim()
  ].join('|');
}
/* 只追加库里没有的档期，不删旧档期 */
async function mergePrices(hotelId, hotelName, prices) {
  const list = (Array.isArray(prices) ? prices : []).map(normalizePrice).filter(Boolean);
  if (!list.length) return 0;
  await ensurePriceColl();
  const oldRows = await listAll(PRICE_COLL, { hotelId });
  const seen = {};
  oldRows.forEach(p => { seen[priceDupKey(p)] = 1; });
  const hn = String(hotelName || '').trim();
  const docs = [];
  list.forEach(p => {
    if (seen[priceDupKey(p)]) return;
    seen[priceDupKey(p)] = 1;
    docs.push({
      hotelId, hotelName: hn,
      roomType: p.roomType, bedType: p.bedType || '',
      start: p.start, end: p.end, price: p.price,
      priceMin: p.priceMin, priceMax: p.priceMax, priceRaw: p.priceRaw || '',
      fuzzy: !!p.fuzzy, remark: p.remark || '',
      sort: oldRows.length + docs.length, createdAt: Date.now()
    });
  });
  for (let i = 0; i < docs.length; i += 20) {
    const batch = docs.slice(i, i + 20);
    await Promise.all(batch.map(d => db.collection(PRICE_COLL).add({ data: d })));
  }
  return docs.length;
}
function buildIncrementalUpdate(existed, meta, roomTypes, minP) {
  const upd = {};
  const incomingRooms = Array.isArray(meta && meta.rooms) ? meta.rooms : [];
  if (roomTypes.length || incomingRooms.length) {
    upd.rooms = mergeRooms(existed.rooms, incomingRooms, roomTypes);
  }
  const fac = collectFacilities(meta);
  if (fac.length) upd.facilities = mergeStrList(existed.facilities, fac);
  fillEmpty(existed, upd, 'intro', String((meta && meta.briefDesc) || '').trim());
  fillEmpty(existed, upd, 'location', String((meta && meta.address) || '').trim());
  fillEmpty(existed, upd, 'remark', String((meta && meta.remark) || '').trim());
  fillEmpty(existed, upd, 'cover', String((meta && meta.cover) || '').trim());
  fillEmpty(existed, upd, 'envImg', String((meta && meta.envImg) || '').trim());
  fillEmpty(existed, upd, 'roomImg', String((meta && meta.roomImg) || '').trim());
  fillEmpty(existed, upd, 'detailHtml', String((meta && meta.detailHtml) || '').trim());
  if (Array.isArray(meta && meta.album) && meta.album.length) {
    upd.album = mergeStrList(existed.album, meta.album);
  }
  const ll = parseLatLng(meta && meta.location);
  if (ll) {
    if (existed.lon == null || existed.lon === '') upd.lon = ll.lon;
    if (existed.lat == null || existed.lat === '') upd.lat = ll.lat;
  }
  if ((existed.price == null || existed.price === 0 || existed.price === '') && minP !== null) upd.price = minP;
  if (meta && meta.regionCatId && !existed.regionCatId) upd.regionCatId = meta.regionCatId;
  if (meta && meta.areaCatId && !existed.areaCatId) upd.areaCatId = meta.areaCatId;
  return upd;
}
function hotelImportLog(meta, action) {
  return {
    name: String((meta && meta.name) || '').trim(),
    level: pickLevel(meta),
    regionLevel1: String((meta && meta.regionLevel1) || '').trim(),
    area: String((meta && meta.area) || '').trim(),
    action,
    msg: action === 'created' ? '新增成功' : '匹配到已有酒店、信息已补全'
  };
}
async function writeImportedHotel(existed, nm, meta, roomTypes, priceList) {
  const minP = minPrice(priceList);
  if (existed) {
    const upd = buildIncrementalUpdate(existed, meta, roomTypes, minP);
    if (Object.keys(upd).length) await db.collection(COLL).doc(existed._id).update({ data: upd });
    const added = priceList.length ? await mergePrices(existed.id, nm, priceList) : 0;
    if (added && (existed.price == null || existed.price === 0 || existed.price === '')) {
      const allMin = minPrice(await pricesByHotel(existed.id));
      if (allMin !== null) {
        await db.collection(COLL).doc(existed._id).update({ data: { price: allMin } });
      }
    }
    return { biz: { id: existed.id, _id: existed._id, name: nm }, created: false, priceCount: added };
  }
  const biz = { id: genId(), name: nm };
  const doc = buildHotelDoc(nm, meta, roomTypes, minP);
  doc.id = biz.id;
  const r = await db.collection(COLL).add({ data: doc });
  biz._id = r._id;
  const added = priceList.length ? await replacePrices(biz.id, nm, priceList) : 0;
  return { biz, created: true, priceCount: added };
}

function buildHotelDoc(nm, meta, roomTypes, minP) {
  const levelRaw = String((meta && meta.level) == null ? '' : meta.level).trim();
  const area = String((meta && meta.area) || '').trim();
  const ll = parseLatLng(meta && meta.location);
  const facilities = collectFacilities(meta);
  const doc = {
    id: '', name: nm,
    area,
    regionLevel1: deriveRegion(area, meta && meta.regionLevel1),
    regionCatId: String((meta && meta.regionCatId) || ''),
    areaCatId: String((meta && meta.areaCatId) || ''),
    stars: parseStars(levelRaw),
    levelText: /^\d+(\.\d+)?$/.test(levelRaw) ? '' : levelRaw,
    rooms: roomTypes.map(x => {
      const hit = (Array.isArray(meta && meta.rooms) ? meta.rooms : []).filter(r => String((r && r.name) || '').trim() === x)[0];
      return { name: x, bedType: String((hit && hit.bedType) || '').trim(), desc: String((hit && hit.desc) || '').trim(), img: (hit && hit.img) || '' };
    }),
    facilities,
    intro: String((meta && meta.briefDesc) || '').trim(),
    price: minP === null ? 0 : minP,
    score: 5,
    sort: Number((meta && meta.sort) || 0) || 0,
    location: String((meta && meta.address) || '').trim(),
    cover: '', album: [], envImg: '', roomImg: '', detailHtml: '', online: true,
    remark: String((meta && meta.remark) || '').trim()
  };
  if (ll) { doc.lon = ll.lon; doc.lat = ll.lat; }
  return doc;
}

/* ============ 横向多档期导入 ============ */
/* 入参：{ hotels:[{name,regionLevel1,area,level,...}],
 *         periods:[{hotelName,level,regionLevel1,area,roomType,start,end,...}] }
 * 必填四项：酒店名称、钻级级别、一级大区、地区。缺一则跳过该酒店。
 * 唯一键 = 上述四项全部相同；命中则增量补全，不覆盖旧字段。任意一项不同则新增。 */
async function importHorizontal(data) {
  const hotelsMeta = (data && Array.isArray(data.hotels)) ? data.hotels : [];
  const periodsIn = (data && Array.isArray(data.periods)) ? data.periods : [];
  const failed = [];

  const metaByKey = {};
  const order = [];
  const allowed = {};
  const namesToKeys = {};
  hotelsMeta.forEach(h => {
    const n = String((h && h.name) || '').trim();
    const regionLevel1 = String((h && h.regionLevel1) || '').trim();
    const area = String((h && h.area) || '').trim();
    const level = pickLevel(h);
    const row = (h && h._row) || '';
    const cell = String((h && h._cell) || '').trim();
    if (!n) { failed.push({ row, cell, msg: '酒店名称不能为空' }); return; }
    if (!level) { failed.push({ row, cell, name: n, msg: '钻级级别不能为空' }); return; }
    if (!regionLevel1) { failed.push({ row, cell, name: n, msg: '一级大区不能为空' }); return; }
    if (!area) { failed.push({ row, cell, name: n, msg: '地区不能为空' }); return; }
    const k = makeHotelKey(n, level, regionLevel1, area);
    const next = Object.assign({}, h, { name: n, regionLevel1, area, level });
    if (!metaByKey[k]) {
      metaByKey[k] = next;
      order.push(k);
      allowed[k] = 1;
      if (!namesToKeys[n]) namesToKeys[n] = [];
      namesToKeys[n].push(k);
    } else {
      mergeIncomingMeta(metaByKey[k], next);
    }
  });

  /* 档期：只挂到已通过必填校验的酒店；日期/价格不完整则跳过该条，不记失败 */
  const groups = {};
  periodsIn.forEach(p => {
    const name = String((p && p.hotelName) || '').trim();
    let k = keyFromMeta({ name, level: p && p.level, regionLevel1: p && p.regionLevel1, area: p && p.area });
    if (!allowed[k]) {
      const hits = namesToKeys[name] || [];
      if (hits.length === 1) k = hits[0];
      else return;
    }
    const fuzzy = !!(p && p.fuzzy);
    const priceRaw = String((p && (p.priceRaw != null && p.priceRaw !== '' ? p.priceRaw : p.price)) || '').trim();
    const pr = parsePriceRange(priceRaw);
    if (!pr && !fuzzy) return;
    let start = '', end = '';
    if (!fuzzy) {
      start = normDate(p.start); end = normDate(p.end);
      if (!start || !end) return;
    }
    if (!groups[k]) groups[k] = [];
    groups[k].push({
      roomType: String((p && p.roomType) || '').trim(),
      bedType: String((p && p.bedType) || '').trim(),
      start, end, fuzzy,
      remark: String((p && p.remark) || '').trim() || (fuzzy ? priceRaw : ''),
      price: pr ? pr.price : 0, priceMin: pr ? pr.priceMin : 0, priceMax: pr ? pr.priceMax : 0,
      priceRaw: pr ? pr.priceRaw : (priceRaw || ''),
      noPrice: !pr
    });
  });
  if (!order.length) {
    if (failed.length) return { code: 200, msg: '导入完成', data: { total: hotelsMeta.length, success: 0, created: 0, updated: 0, priceCount: 0, failed, warnings: [], logs: [] } };
    return { code: 400, msg: '没有可导入的酒店（酒店名称、钻级级别、一级大区、地区均为必填）' };
  }
  const warnings = [];
  const cats = await loadCategoryList();

  const cur = await listAll(COLL);
  const byKey = {};
  cur.forEach(h => { const k = keyFromDoc(h); if (k && !byKey[k]) byKey[k] = h; });

  let success = 0, created = 0, updated = 0, priceCount = 0;
  const logs = [];
  for (const k of order) {
    const meta = metaByKey[k] || {};
    const nm = String(meta.name || '').trim();
    const hit = matchHotelCategory(String(meta.regionLevel1 || '').trim(), String(meta.area || '').trim(), cats);
    meta.regionCatId = hit.regionCatId;
    meta.areaCatId = hit.areaCatId;
    hit.warns.forEach(msg => warnings.push({ name: nm, msg }));
    const list = groups[k] || [];
    const roomTypes = collectRoomTypes(meta, list);
    const existed = byKey[k];
    try {
      const wr = await writeImportedHotel(existed, nm, meta, roomTypes, list);
      if (wr.created) { created++; byKey[k] = { id: wr.biz.id, _id: wr.biz._id, name: nm }; }
      else updated++;
      priceCount += wr.priceCount;
      logs.push(hotelImportLog(meta, wr.created ? 'created' : 'updated'));
      success++;
    } catch (e) {
      failed.push({ name: nm, cell: String(meta._cell || ''), msg: (e && e.message) || '写入失败' });
    }
  }
  return { code: 200, msg: '导入完成', data: { total: periodsIn.length, success, created, updated, priceCount, failed, warnings, logs } };
}

exports.main = async (event) => {
  const { action, token, data, id, ids, orderedIds, field } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      return { code: 200, data: (await listAll(COLL)).map(strip) };
    }
    if (action === 'get') {
      const f = await findBiz(id);
      return f ? { code: 200, data: strip(f) } : { code: 404, msg: '记录不存在' };
    }
    /* 价格档期公开读取（小程序员工核价 / 后台弹窗回显） */
    if (action === 'listPrices') {
      await ensurePriceColl();
      const list = id ? await pricesByHotel(id) : (await listAll(PRICE_COLL)).map(strip);
      return { code: 200, data: list };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'importBatch') {
      /* 横向多档期模式：data.hotels + data.periods */
      if (data && data.mode === 'horizontal') {
        return await importHorizontal(data);
      }
      const rows = (data && Array.isArray(data.rows)) ? data.rows : [];
      if (!rows.length) return { code: 400, msg: '没有可导入的数据' };
      const failed = [];
      let priceCount = 0;

      /* 1) 逐行校验：必填酒店名称、钻级级别、一级大区、地区；缺一跳过该行。
       * 价格/日期缺失或无法解析时不报错，只跳过该条档期，酒店基础信息仍入库。 */
      const good = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {};
        const rowNo = r._row || (i + 2);
        const name = String(r.name || '').trim();
        const area = String(r.area || '').trim();
        const regionLevel1 = String(r.regionLevel1 || '').trim();
        const level = pickLevel(r);
        if (!name) { failed.push({ row: rowNo, msg: '酒店名称不能为空' }); continue; }
        if (!level) { failed.push({ row: rowNo, name, msg: '钻级级别不能为空' }); continue; }
        if (!regionLevel1) { failed.push({ row: rowNo, name, msg: '一级大区不能为空' }); continue; }
        if (!area) { failed.push({ row: rowNo, name, msg: '地区不能为空' }); continue; }
        const startTxt = String(r.startDate == null ? '' : r.startDate).trim();
        const endTxt = String(r.endDate == null ? '' : r.endDate).trim();
        const priceRaw = String(r.price == null ? '' : r.price).trim();
        let start = '', end = '', price = null;
        if (startTxt && endTxt && priceRaw) {
          start = normDate(r.startDate);
          end = normDate(r.endDate);
          const pr = parsePriceRange(priceRaw);
          if (start && end && pr) price = pr.price;
        }
        good.push({ rowNo, name, area, regionLevel1, level, start, end, price, raw: r });
      }

      /* 2) 按四项唯一键分组（同酒店同房型多档期归为一组） */
      const groups = {};
      const order = [];
      good.forEach(g => {
        const k = makeHotelKey(g.name, g.level, g.regionLevel1, g.area);
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(g);
      });

      const cur = await listAll(COLL);
      const byKey = {};
      cur.forEach(h => { const k = keyFromDoc(h); if (k && !byKey[k]) byKey[k] = h; });
      const cats = await loadCategoryList();
      const warnings = [];

      let success = 0, created = 0, updated = 0;
      const logs = [];
      for (const k of order) {
        const list = groups[k];
        const head = list[0];
        const nm = head.name;
        list.slice(1).forEach(g => mergeIncomingMeta(head.raw, g.raw));
        const hit = matchHotelCategory(head.regionLevel1, head.area, cats);
        const meta = Object.assign({}, head.raw, {
          name: nm, area: head.area, regionLevel1: head.regionLevel1,
          regionCatId: hit.regionCatId, areaCatId: hit.areaCatId, level: head.level
        });
        hit.warns.forEach(msg => warnings.push({ name: nm, msg }));
        const roomTypes = [];
        const seenRt = {};
        list.forEach(g => { toArray(g.raw.roomTypes).forEach(x => { if (x && !seenRt[x]) { seenRt[x] = 1; roomTypes.push(x); } }); });
        const existed = byKey[k];
        const prices = list.filter(g => g.start && g.end && g.price != null).map(g => {
          const rts = toArray(g.raw.roomTypes);
          return { roomType: rts.length ? rts[0] : '', start: g.start, end: g.end, price: g.price };
        });
        const wr = await writeImportedHotel(existed, nm, meta, roomTypes, prices);
        if (wr.created) { created++; byKey[k] = { id: wr.biz.id, _id: wr.biz._id, name: nm }; }
        else updated++;
        priceCount += wr.priceCount;
        logs.push(hotelImportLog(meta, wr.created ? 'created' : 'updated'));
        success++;
      }
      return { code: 200, msg: '导入完成', data: { total: rows.length, success, created, updated, priceCount, failed, warnings, logs } };
    }

    /* ---------- 价格档期子表（供后台弹窗手动维护） ---------- */
    if (action === 'initHotelPrice') {
      await ensurePriceColl();
      return { code: 200, msg: '价格档期集合已就绪' };
    }
    if (action === 'savePrices') {
      const hotel = await findBiz(id);
      if (!hotel) return { code: 404, msg: '酒店不存在' };
      const prices = (data && data.prices) || [];
      const n = await replacePrices(id, hotel.name, prices);
      const minP = minPrice((prices || []).map(normalizePrice).filter(Boolean));
      await db.collection(COLL).doc(hotel._id).update({ data: { price: minP === null ? 0 : minP } });
      return { code: 200, msg: '已保存 ' + n + ' 条价格档期', data: { count: n } };
    }

    if (action === 'add') {
      const doc = clean(data);
      if (!doc.id) doc.id = genId();
      if (!Array.isArray(doc.album)) doc.album = [];
      if (!Array.isArray(doc.rooms)) doc.rooms = [];
      if (!Array.isArray(doc.facilities)) doc.facilities = [];
      if (doc.online === undefined) doc.online = true;
      if (doc.sort === undefined) doc.sort = 0;
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id } };
    }
    if (action === 'update') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '记录不存在' };
      const d = clean(data); delete d.id;
      await db.collection(COLL).doc(f._id).update({ data: d });
      return { code: 200, msg: '更新成功' };
    }
    if (action === 'remove') {
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) { const f = await findBiz(bid); if (f) { await db.collection(COLL).doc(f._id).remove(); n++; } }
      return { code: 200, msg: '删除成功', data: { removed: n } };
    }
    if (action === 'reorder') {
      const list = Array.isArray(orderedIds) ? orderedIds : [];
      const fl = field || 'sort';
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const f = await findBiz(list[i]);
        if (f) { const val = fl === 'weight' ? (list.length - i) : (i + 1); await db.collection(COLL).doc(f._id).update({ data: { [fl]: val } }); n++; }
      }
      return { code: 200, msg: '排序更新成功', data: { updated: n } };
    }
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败' };
  }
};
