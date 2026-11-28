/**
 * 行程计费日的存取。纯函数，供 userTripCRUD 与单测使用。
 * 不存金额。carUseCustom=false 表示跟行程每一天（旧数据）。
 * 空数组表示明确 0 天，不能写成「没这个字段」。
 */
const CAR_OFFSET_MAX = 45;

function packStoredCarUse(d) {
  if (!d || typeof d !== 'object') return null;
  const has = d.carUseCustom !== undefined || Array.isArray(d.carUseOffsets);
  if (!has) return null;
  const custom = d.carUseCustom === true || d.carUseCustom === 'true' || d.carUseCustom === 1
    || (d.carUseCustom === undefined && Array.isArray(d.carUseOffsets));
  if (!custom) return { carUseCustom: false, carUseOffsets: null };
  const seen = {};
  const offsets = [];
  (Array.isArray(d.carUseOffsets) ? d.carUseOffsets : []).forEach(x => {
    const n = parseInt(x, 10);
    if (isNaN(n) || n < 0 || n > CAR_OFFSET_MAX || seen[n]) return;
    seen[n] = 1;
    offsets.push(n);
  });
  offsets.sort((a, b) => a - b);
  return { carUseCustom: true, carUseOffsets: offsets };
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* 与小程序 quote.isStoredQuote 同一口径：有逐项 breakdown 才是内部快照。 */
function isRealSnapshot(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
  return Array.isArray(q.breakdown) && q.breakdown.length > 0;
}

const QUOTE_LINE_KEYS = ['day', 'type', 'name', 'hotelId', 'room', 'date', 'unit', 'qty', 'subtotal', 'fuzzy', 'fuzzyText', 'note', 'scenicId', 'packageId', 'vehicleId', 'pickKey', 'adultUnit', 'adultQty', 'childUnit', 'childQty', 'childRule'];

function sanitizeQuote(q) {
  const breakdown = q.breakdown.slice(0, 300).map(line => {
    const src = line || {};
    const b = {};
    QUOTE_LINE_KEYS.forEach(k => { if (src[k] !== undefined) b[k] = src[k]; });
    return b;
  }).filter(b => b.type);
  if (!breakdown.length) return null;
  const pending = q.status === 'pending' || breakdown.some(b => b && b.fuzzy) || num(q.hotelFuzzy) > 0 || num(q.carFuzzy) > 0;
  return {
    hotel: num(q.hotel),
    ticket: num(q.ticket),
    package: num(q.package),
    car: num(q.car),
    carPackage: num(q.carPackage),
    carDays: num(q.carDays),
    total: num(q.total),
    nights: num(q.nights),
    days: num(q.days),
    people: num(q.people),
    adults: num(q.adults),
    children: num(q.children),
    hotelFuzzy: num(q.hotelFuzzy),
    carFuzzy: num(q.carFuzzy),
    breakdown,
    fuzzy: Array.isArray(q.fuzzy) ? q.fuzzy.slice(0, 80) : [],
    missing: Array.isArray(q.missing) ? q.missing.slice(0, 80) : [],
    status: pending ? 'pending' : 'complete'
  };
}

/* 员工才接受内部报价。不是完整快照（含裸的 {hotel:0,ticket:0,total:0}）时返回 undefined，
 * 调用方不要写 quote 字段，这样更新不会把已有快照盖成三个 0。 */
function packStoredQuote(incoming, isStaff) {
  if (!isStaff) return undefined;
  if (!isRealSnapshot(incoming)) return undefined;
  return sanitizeQuote(incoming);
}

function packCarPackages(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(g => g && g.vehicleId).slice(0, 20).map(g => ({
    vehicleId: String(g.vehicleId),
    items: (Array.isArray(g.items) ? g.items : []).filter(Boolean).slice(0, 30).map(it => ({
      id: String(it.id || ''),
      name: String(it.name || '').slice(0, 40),
      price: it.price == null ? '' : String(it.price).slice(0, 24),
      qty: Math.max(1, parseInt(it.qty, 10) || 1)
    }))
  }));
}

/* 分享读取：去掉内部金额和员工备注，保留计费日与行程正文。 */
function toPublicTrip(doc) {
  const d = Object.assign({}, doc || {});
  delete d._id;
  delete d._openid;
  delete d.openid;
  delete d.quote;
  delete d.internalQuote;
  delete d.staffRemark;
  delete d.carCostOverride;
  delete d.carPackageSelections;
  return d;
}

module.exports = { packStoredCarUse, packStoredQuote, packCarPackages, isRealSnapshot, toPublicTrip, CAR_OFFSET_MAX };
