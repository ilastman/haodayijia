/**
 * 把「我的行程」冻成订单上的一份副本。纯函数，供 orderCRUD 与单测使用。
 * 之后源行程被删，订单仍留着行程正文和内部报价快照。
 * 财务读取走 financeOfOrder：有冻结快照就读快照，不再读被清零的 pricing / costs。
 */

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function isRealSnapshot(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
  return Array.isArray(q.breakdown) && q.breakdown.length > 0;
}

function clone(v) {
  if (v == null) return v;
  return JSON.parse(JSON.stringify(v));
}

function first() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return arguments.length ? arguments[arguments.length - 1] : '';
}

/* dbTrip 优先（云端已存的快照），没有再用客户端随导入带上的 trip。 */
function buildImportedTrip(dbTrip, client, meta) {
  const db = (dbTrip && typeof dbTrip === 'object') ? dbTrip : {};
  const c = (client && typeof client === 'object') ? client : {};
  const m = meta || {};
  const quote = (isRealSnapshot(db.quote) && clone(db.quote)) || (isRealSnapshot(c.quote) && clone(c.quote)) || null;
  const dbPlans = Array.isArray(db.plans) ? db.plans : [];
  const clientPlans = Array.isArray(c.plans) ? c.plans : [];
  const plans = dbPlans.length ? clone(dbPlans) : clone(clientPlans);
  const daySummaries = Array.isArray(m.days) ? m.days : [];
  const frozen = {
    tripId: String(m.tripId || db.id || c.id || ''),
    title: String(m.title || db.title || c.title || ''),
    date: first(db.date, c.date, ''),
    days: first(db.days, c.days, daySummaries.length || 0),
    adults: db.adults != null ? db.adults : (c.adults != null ? c.adults : ''),
    children: db.children != null ? db.children : (c.children != null ? c.children : ''),
    guestName: first(db.guestName, c.guestName, ''),
    guestAdultPrice: num(db.guestAdultPrice != null ? db.guestAdultPrice : c.guestAdultPrice),
    guestChildPrice: num(db.guestChildPrice != null ? db.guestChildPrice : c.guestChildPrice),
    guestQuote: num(db.guestQuote != null ? db.guestQuote : c.guestQuote),
    cover: first(db.cover, c.cover, ''),
    audience: first(db.audience, c.audience, ''),
    pace: first(db.pace, c.pace, ''),
    clauses: db.clauses || c.clauses || null,
    carId: first(db.carId, c.carId, ''),
    carPackageSelections: Array.isArray(db.carPackageSelections) ? clone(db.carPackageSelections) : (Array.isArray(c.carPackageSelections) ? clone(c.carPackageSelections) : []),
    carCostOverride: db.carCostOverride != null ? db.carCostOverride : (c.carCostOverride || ''),
    plans: plans || [],
    daySummaries,
    frozenAt: m.now || Date.now()
  };
  if (db.carUseCustom !== undefined || Array.isArray(db.carUseOffsets)) {
    frozen.carUseCustom = db.carUseCustom;
    frozen.carUseOffsets = db.carUseOffsets;
  } else if (c.carUseCustom !== undefined || Array.isArray(c.carUseOffsets)) {
    frozen.carUseCustom = c.carUseCustom;
    frozen.carUseOffsets = c.carUseOffsets;
  }
  if (quote) frozen.quote = quote;
  return frozen;
}

/* 财务区要显示的金额。有冻结的内部快照时读快照和对客价，否则仍读原来的 pricing / costs。 */
function financeOfOrder(order) {
  const snap = order && order.itinerary && order.itinerary.importedTrip;
  const q = snap && snap.quote;
  if (snap && isRealSnapshot(q)) {
    const guest = num(snap.guestQuote);
    const cost = num(q.total);
    return {
      frozen: true,
      quote: guest,
      cost,
      profit: Math.round((guest - cost) * 100) / 100,
      est: Math.round((guest - cost) * 100) / 100,
      hotel: num(q.hotel),
      ticket: num(q.ticket),
      package: num(q.package),
      car: num(q.car),
      carPackage: num(q.carPackage),
      guestQuote: guest,
      total: cost,
      status: q.status || '',
      guide: 0,
      meal: 0,
      misc: 0
    };
  }
  const pricing = (order && order.pricing) || {};
  const costs = (order && order.costs) || {};
  const actual = num(pricing.actualProfit);
  const estRaw = pricing.estProfit;
  return {
    frozen: false,
    quote: num(pricing.quote),
    cost: num(order && order.totalCost),
    profit: actual,
    est: (estRaw === null || estRaw === undefined || estRaw === '') ? actual : num(estRaw),
    hotel: num(costs.hotel),
    ticket: num(costs.ticket),
    package: 0,
    car: num(costs.car),
    carPackage: 0,
    guestQuote: num(pricing.quote),
    total: num(order && order.totalCost),
    status: '',
    guide: num(costs.guide),
    meal: num(costs.meal),
    misc: num(costs.misc)
  };
}

module.exports = { isRealSnapshot, buildImportedTrip, financeOfOrder };
