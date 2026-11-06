const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const cloud = require('../../utils/cloud');
const wb = require('../../utils/workbench');
const quote = require('../../utils/quote');
const gallery = require('../../utils/gallery');
const catalog = require('../../utils/catalog');
const clause = require('../../utils/clause');
const carFilter = require('../../utils/carFilter');
const { isValidPhone, addConsultRecord, ph } = require('../../utils/util');
const { allowCollect } = require('../../utils/consent');
const share = require('../../utils/share');

const MAX_DAYS = 15;
const MIN_DAYS = 1;
const ITEM_H = 58;

function emptyPlan() {
  return { scenicIds: [], hotelId: '', altHotelIds: [], note: '', roomType: '', roomQty: 1, hotelBookings: [], promoImgs: [], packageSelections: [] };
}

function buildPlans(n) {
  const plans = [];
  for (let i = 0; i < n; i++) plans.push(emptyPlan());
  return plans;
}

function normalizePlans(v, days) {
  const n = Math.max(MIN_DAYS, parseInt(days, 10) || 3);
  const src = Array.isArray(v) ? v : [];
  const out = src.slice(0, n).map(p => normBookings({
    scenicIds: (p && Array.isArray(p.scenicIds) ? p.scenicIds : []).slice(),
    hotelBookings: (p && Array.isArray(p.hotelBookings) ? p.hotelBookings : []),
    hotelId: (p && p.hotelId) || '',
    altHotelIds: (p && Array.isArray(p.altHotelIds) ? p.altHotelIds : []).slice(),
    note: (p && p.note) || '',
    roomType: (p && p.roomType) || '',
    roomQty: Math.max(1, parseInt(p && p.roomQty, 10) || 1),
    promoImgs: gallery.clipPromo(p && p.promoImgs),
    scenicSnaps: (p && Array.isArray(p.scenicSnaps) ? p.scenicSnaps : []).slice(),
    hotelSnaps: (p && Array.isArray(p.hotelSnaps) ? p.hotelSnaps : []).slice(),
    packageSelections: normalizePackageSelections(p && p.packageSelections, (p && p.scenicIds) || [])
  }));
  while (out.length < n) out.push(emptyPlan());
  return out;
}

/* 每天多条住宿预订：hotelBookings[0] 恒与 hotelId/roomType/roomQty 同步（兼容旧预览/工作台），其余为追加的酒店+房型 */
function normBookings(p) {
  const raw = (p.hotelBookings || []).filter(b => b && b.hotelId).map(b => ({ hotelId: String(b.hotelId), roomType: String(b.roomType || ''), roomQty: Math.max(1, parseInt(b.roomQty, 10) || 1) }));
  if (!p.hotelId && raw.length) { p.hotelId = raw[0].hotelId; p.roomType = raw[0].roomType; p.roomQty = raw[0].roomQty; }
  p.hotelBookings = p.hotelId ? [{ hotelId: p.hotelId, roomType: p.roomType || '', roomQty: p.roomQty || 1 }].concat(raw.slice(1)) : [];
  return p;
}

function normalizePackageSelections(v, scenicIds) {
  const ids = Array.isArray(scenicIds) ? scenicIds : [];
  const src = Array.isArray(v) ? v : [];
  return src.filter(g => g && g.scenicId && ids.indexOf(g.scenicId) > -1).map(g => ({
    scenicId: g.scenicId,
    items: (Array.isArray(g.items) ? g.items : []).filter(it => it && it.id).map(it => ({
      id: String(it.id),
      name: String(it.name || ''),
      price: (it.price == null || it.price === '') ? '' : String(it.price)
    }))
  }));
}


Page(share.install({
  data: {
    c: copy.custom,
    days: 3,
    customActive: false,
    customDays: '',
    date: '',
    minDate: '',
    adults: 2,
    children: 0,
    activeDay: 0,
    dayTabs: ['第1天', '第2天', '第3天'],
    plans: buildPlans(3),
    curScenics: [],
    curHotel: null,
    altPicked: [],
    altCanPick: false,
    curNote: '',
    totalScenic: 0,
    totalHotel: 0,
    dragIndex: -1,
    dropIndex: -1,
    dragDy: 0,
    itemH: ITEM_H,
    rowShift: [],
    sheet: null,
    sheetScenics: [],
    sheetHotels: [],
    submitShow: false,
    successShow: false,
    form: { name: '', phone: '', wechat: '' },
    formAgreed: false,
    formError: '',
    editingTripId: '',
    generating: false,
    cover: '',
    clauses: clause.emptyClauses(),
    clauseCards: clause.cards(),
    sheetClauses: [],
    clauseKind: '',
    audience: copy.custom.metaAudienceDefault,
    pace: copy.custom.metaPaceDefault,
    seasonText: '冬季雪原',
    coverLib: [],
    promoLib: [],
    carId: '',
    curCar: null,
    sheetCars: [],
    cars: [],
    carPackageSelections: [],
    curCarPackages: [],
    carCostOverride: '',
    /* 计费用车：false/null = 跟行程每一天（旧行程）。自定义后可取消某天或加天，不改行程。 */
    carUseCustom: false,
    carUseOffsets: null,
    carDropped: [],
    carFilter: carFilter.defaultFilter(),
    carFilterOpts: carFilter.buildOpts([], {}, carFilter.defaultFilter()),
    carNoneRegion: carFilter.NONE_REGION,
    carEmptyText: '',
    curPromo: [],

    /* 员工内部核价（仅员工可见） */
    isStaff: false,
    calcHotelsById: {},
    hotelPricesById: {},
    calcScenicsById: {},
    internalQuote: null,
    ticketPicks: {}, /* 内部核算按人点选：{ 日序_景区id: [类别id,...] } */
    curRoomTypes: [],
    guestName: '',
    guestAdultPrice: '',
    guestChildPrice: '',
    guestQuote: '', /* 对客总价：自动=成人价×成人数+儿童价×儿童数，可手改 */
    guestTotalText: '',
    guestTotalNote: '',
    sheetRegion: catalog.ALL,
    sheetSub: 'all',
    sheetPlace: catalog.ALL,
    sheetRegions: [catalog.ALL],
    sheetSubs: [{ key: 'all', label: '全部' }],
    sheetPlaces: [catalog.ALL],
    /* 备选弹层级别筛选：全部 + 同区域内出现过的 stars */
    sheetAltLevel: 'all',
    sheetLevel: 'all',
    sheetLevels: [{ key: 'all', label: '全部级别' }],
    sheetAltLevels: [{ key: 'all', label: '全部' }],
    sheetKeyword: ''
  },

  plansArray() {
    if (Array.isArray(this.data.plans)) return this.data.plans;
    const plans = buildPlans(this.data.days);
    this.setData({ plans });
    return plans;
  },

  planAt(i) {
    const plans = this.plansArray();
    const p = plans[i];
    return (p && typeof p === 'object') ? p : emptyPlan();
  },

  onLoad(query) {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    this.setData({ minDate: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) });
    if (query && query.edit) {
      const trips = wx.getStorageSync('myTrips') || [];
      const t = trips.filter(x => x.id === decodeURIComponent(query.edit))[0];
      if (t) this.prefillTrip(t);
    } else if (query && query.draft) {
      const saved = wx.getStorageSync('lastCustomPlan') || null;
      if (saved) this.prefillTrip(saved);
    } else if (query && query.shareId) {
      const share = data.getShare(query.shareId);
      if (share) this.prefillShare(share);
    }
    this.initStaff();
    this.loadPackageScenics();
    this.loadGallery();
    this.loadCatalog();
    this.loadClauses();
  },

  onShow() {
    this._generating = false;
    if (this.data.generating) this.setData({ generating: false });
    this.loadGallery();
    this.loadCatalog();
    this.loadClauses();
  },

  async loadClauses() {
    let remote = null;
    try {
      const res = await cloud.callFunction('clauseCRUD', { action: 'list' });
      if (res && res.code === 200 && Array.isArray(res.data) && res.data.length) remote = res.data;
    } catch (e) { remote = null; }
    const all = remote || clause.defaults();
    const lists = {};
    clause.KINDS.forEach(k => { lists[k.kind] = all.filter(t => t.kind === k.kind && t.enabled !== false); });
    this._clauseLists = lists;
    const clauses = clause.normalizeClauses(this.data.clauses);
    this.setData({ clauses, clauseCards: clause.cards(clauses) });
    if (this.data.sheet && this.data.sheet.type === 'clause') this.refreshClauseSheet();
  },

  async loadCatalog() {
    let scenics = null;
    let hotels = null;
    let scenicCats = [];
    let hotelCats = [];
    try {
      const all = await Promise.all([
        api.scenics(),
        api.hotels(),
        api.categories('scenic'),
        api.categories('hotel')
      ]);
      scenics = all[0];
      hotels = all[1];
      scenicCats = all[2] || [];
      hotelCats = all[3] || [];
    } catch (e) { /* 继续用本地分类 */ }
    this.loadVehicles();
    if (scenics && scenics.length) this._scenics = scenics;
    if (hotels && hotels.length) this._hotels = hotels;
    this._scenicCats = scenicCats;
    this._hotelCats = hotelCats;
    if (this.data.sheet && (this.data.sheet.type === 'scenic' || this.data.sheet.type === 'hotel')) this.refreshSheet();
  },

  async loadVehicles() {
    let list = null;
    try { list = await api.vehicles(); } catch (e) { list = null; }
    const cars = (list && list.length) ? list : data.cars;
    let meta = null;
    try { meta = await api.vehicleMeta(); } catch (e) { meta = null; }
    this._carMeta = meta || {};
    const byId = {};
    cars.forEach(c => { if (c && c.id) byId[c.id] = c; });
    this.setData({ cars, vehiclesById: byId, carFilterOpts: carFilter.buildOpts(cars, this._carMeta, this.data.carFilter) });
    this.syncPlan();
    if (this.data.sheet && this.data.sheet.type === 'car') this.refreshSheet();
  },
  carsOf() { return (this.data.cars && this.data.cars.length) ? this.data.cars : data.cars; },
  carViewPackages(car) {
    const g = (this.data.carPackageSelections || []).filter(x => x && car && x.vehicleId === car.id)[0];
    const sel = {};
    ((g && g.items) || []).forEach(it => { sel[it.id] = 1; });
    return quote.vehiclePackagesOf(car).map(p => Object.assign({}, p, { sel: !!sel[p.id], priceLabel: p.priceText !== '' ? '¥' + p.price + '/次' : '' }));
  },

  scenicsOf() { return (this._scenics && this._scenics.length) ? this._scenics : data.scenics; },
  hotelsOf() { return (this._hotels && this._hotels.length) ? this._hotels : data.hotels; },
  scenicById(id) { return this.scenicsOf().filter(s => s.id === id)[0] || data.getScenic(id); },
  scenicRawById(id) {
    if (this.data.calcScenicsById && this.data.calcScenicsById[id]) return this.data.calcScenicsById[id];
    if (this._rawScenicsById && this._rawScenicsById[id]) return this._rawScenicsById[id];
    return this.scenicById(id);
  },
  hotelById(id) { return this.hotelsOf().filter(h => h.id === id)[0] || data.hotels.filter(h => h.id === id)[0] || null; },

  async loadGallery() {
    let list = [];
    try {
      const res = await api.gallery();
      if (Array.isArray(res)) list = res;
    } catch (e) { list = []; }
    this.setData({
      coverLib: list.filter(gallery.isCover),
      promoLib: list.filter(g => g && g.url && !gallery.isCover(g))
    });
  },

  async loadPackageScenics() {
    try {
      const list = await this.loadRawScenics();
      const map = {};
      (list || []).forEach(s => { if (s && s.id) map[s.id] = s; });
      this._rawScenicsById = map;
      const merged = Object.assign({}, map, this.data.calcScenicsById || {});
      this.setData({ calcScenicsById: merged });
      this.syncPlan();
    } catch (e) { /* ignore */ }
  },

  /* 员工身份识别：仅员工加载云端后台价并显示内部核价 */
  async initStaff() {
    let idn = null;
    try { idn = await wb.identity(); } catch (e) { idn = null; }
    if (!idn || !idn.isStaff) { this.setData({ isStaff: false }); return; }
    this.setData({ isStaff: true });
    const [hotels, scenics] = await Promise.all([api.hotels(), this.loadRawScenics()]);
    const calcHotelsById = {};
    (hotels || []).forEach(h => {
      if (h && h.id) calcHotelsById[h.id] = Object.assign({}, h, { prices: [] });
    });
    const calcScenicsById = {};
    (scenics || []).forEach(s => { if (s && s.id) calcScenicsById[s.id] = s; });
    this._priceLoaded = {};
    this.setData({ calcHotelsById, hotelPricesById: {}, calcScenicsById });
    this.syncPlan();
  },

  /* 按需加载所选酒店的价格档期（全量 ~3MB 超 callFunction 1MB 上限，会导致拿不到档期、换日期价不变） */
  ensureHotelPrices() {
    if (!this.data.isStaff) return;
    const loaded = this._priceLoaded || (this._priceLoaded = {});
    const ids = [];
    (this.data.plans || []).forEach(p => {
      if (!p) return;
      [p.hotelId].concat((p.hotelBookings || []).map(b => b && b.hotelId)).forEach(hid => { if (hid && !loaded[hid] && ids.indexOf(hid) < 0) ids.push(hid); });
    });
    if (!ids.length) return;
    ids.forEach(id => { loaded[id] = 'loading'; });
    this.loadHotelPrices(ids).then(list => {
      const byId = Object.assign({}, this.data.hotelPricesById);
      const calc = Object.assign({}, this.data.calcHotelsById);
      ids.forEach(id => { byId[id] = []; });
      (list || []).forEach(p => { if (p && p.hotelId && byId[p.hotelId]) byId[p.hotelId].push(p); });
      ids.forEach(id => {
        loaded[id] = 1;
        if (calc[id]) calc[id] = Object.assign({}, calc[id], { prices: byId[id] });
      });
      this.setData({ hotelPricesById: byId, calcHotelsById: calc });
      this.syncPlan();
    }).catch(() => { ids.forEach(id => { delete loaded[id]; }); });
  },

  /* 含 ticketPrice 的原始景区列表（api.scenics() 会剥离该字段） */
  async loadRawScenics() {
    const res = await cloud.callFunction('scenicCRUD', { action: 'list' });
    if (res && res.code === 200 && Array.isArray(res.data)) {
      return res.data.filter(s => s && s.online !== false);
    }
    return [];
  },

  /* 全量价格档期（hotelPrice 子表，闭区间） */
  async loadHotelPrices(ids) {
    /* 逐个酒店按 id 取档期（每家仅几十条，远低于 callFunction 1MB 上限；兼容未部署的旧云函数） */
    const list = await Promise.all((ids || []).map(id => cloud.callFunction('hotelCRUD', { action: 'listPrices', id })
      .then(res => (res && res.code === 200 && Array.isArray(res.data)) ? res.data : Promise.reject(new Error((res && res.msg) || 'listPrices failed')))));
    return [].concat.apply([], list);
  },

  /* 当前计费日。未自定义时跟行程每一天。不改 plans。 */
  carUseNow() {
    const tripDays = (this.data.plans || []).length || this.data.days || 0;
    const use = quote.readCarUse({
      carUseCustom: this.data.carUseCustom,
      carUseOffsets: this.data.carUseOffsets
    }, tripDays);
    return { tripDays, use };
  },

  /* 计算内部核算价（仅员工）；每晚按入住日期匹配价格档期。用车按计费日逐日档期，与行程天数分开。 */
  calcInternal() {
    const view = this.carUseNow();
    const carDropped = quote.droppedCarDays(view.tripDays, view.use);
    if (!this.data.isStaff) {
      this.setData({ carDropped: [] });
      return;
    }
    const plans = normalizePlans(this.data.plans, this.data.days).map((p, i) => Object.assign({}, p, {
      checkinDate: quote.addDays(this.data.date, i)
    }));
    const packed = quote.packCarUse(view.use.custom, view.use.offsets);
    const internalQuote = quote.calcQuote({
      plans,
      hotelsById: this.data.calcHotelsById,
      hotelPricesById: this.data.hotelPricesById,
      scenicsById: this.data.calcScenicsById,
      departDate: this.data.date,
      adults: parseInt(this.data.adults, 10) || 0, /* ticketSplit */
      children: parseInt(this.data.children, 10) || 0,
      people: (parseInt(this.data.adults, 10) || 0) + (parseInt(this.data.children, 10) || 0),
      ticketPicks: this.data.ticketPicks,
      carCost: parseFloat(this.data.carCostOverride) || 0,
      carId: this.data.carId || '',
      carUseCustom: packed.carUseCustom,
      carUseOffsets: packed.carUseOffsets,
      vehiclesById: this.data.vehiclesById || {},
      carPackageSelections: this.data.carPackageSelections || []
    });
    this.setData({ internalQuote, carDropped });
  },

  /* 定制师为某景区某出行人点选优惠类别，立即重算内部核算 */
  onTicketPick(e) {
    const key = e.currentTarget.dataset.key;
    const pi = parseInt(e.currentTarget.dataset.pi, 10) || 0;
    const idx = parseInt(e.detail.value, 10) || 0;
    const iq = this.data.internalQuote;
    const row = iq && (iq.breakdown || []).filter(b => b.pickKey === key)[0];
    if (!row || !row.cats || !row.cats[idx]) return;
    const ids = row.persons.map(r => (r.picked ? r.catId : ''));
    ids[pi] = row.cats[idx].id;
    const ticketPicks = Object.assign({}, this.data.ticketPicks, { [key]: ids });
    this.setData({ ticketPicks });
    this.calcInternal();
  },

  prefillTrip(t) {
    const max = Math.min(MAX_DAYS, Math.max(MIN_DAYS, parseInt(t.days, 10) || 3));
    const plans = normalizePlans(t.plans, max);
    const preset = [3, 5, 7].indexOf(max) > -1;
    this.setData({
      days: max,
      plans,
      activeDay: 0,
      date: t.date || '',
      adults: parseInt(t.adults, 10) || 2,
      children: parseInt(t.children, 10) || 0,
      customActive: !preset,
      customDays: preset ? '' : String(max),
      editingTripId: t.id || '',
      cover: t.cover || '',
      audience: t.audience || copy.custom.metaAudienceDefault,
      pace: t.pace || copy.custom.metaPaceDefault,
      clauses: clause.normalizeClauses(t.clauses),
      clauseCards: clause.cards(t.clauses),
      carId: t.carId || '',
      carPackageSelections: Array.isArray(t.carPackageSelections) ? t.carPackageSelections : [],
      carCostOverride: t.carCostOverride || '',
      carUseCustom: false,
      carUseOffsets: null,
      guestName: t.guestName || '',
      guestAdultPrice: '',
      guestChildPrice: '',
      guestQuote: ''
    });
    const pref = this.normalizeGuestPrices(t);
    let carPacked = quote.pickCarUse(t);
    if (!quote.hasCarUseField(t)) {
      const side = this.recallCarUse(t.id || '');
      if (side && quote.hasCarUseField(side)) carPacked = quote.pickCarUse(side);
    }
    this.setData({
      guestAdultPrice: pref.guestAdultPrice,
      guestChildPrice: pref.guestChildPrice,
      guestQuote: pref.guestQuote,
      carUseCustom: carPacked.carUseCustom,
      carUseOffsets: carPacked.carUseOffsets
    });
    this.refreshGuestTotal({
      guestAdultPrice: pref.guestAdultPrice,
      guestChildPrice: pref.guestChildPrice,
      guestQuote: pref.guestQuote,
      adults: parseInt(t.adults, 10) || 2,
      children: parseInt(t.children, 10) || 0,
      keepTotal: true
    });
    this.rebuildTabs();
    this.syncPlan();
  },

  prefillShare(share) {
    const s = share || {};
    const srcDays = parseInt(s.days, 10) || (Array.isArray(s.plans) && s.plans.length) || (Array.isArray(s.timeline) && s.timeline.length) || 3;
    const max = Math.min(MAX_DAYS, Math.max(MIN_DAYS, srcDays));
    const plans = normalizePlans(s.plans || s.timeline, max);
    const carPacked = quote.pickCarUse(quote.publicSharePayload(s));
    this.setData({
      days: max,
      plans,
      activeDay: 0,
      date: s.date || '',
      adults: parseInt(s.adults, 10) || this.data.adults,
      children: s.children != null && s.children !== '' ? (parseInt(s.children, 10) || 0) : this.data.children,
      carId: s.carId || '',
      carPackageSelections: Array.isArray(s.carPackageSelections) ? s.carPackageSelections : [],
      /* 分享不带回内部手填覆盖和内部核算，客人侧也看不到这块 */
      carCostOverride: '',
      carUseCustom: carPacked.carUseCustom,
      carUseOffsets: carPacked.carUseOffsets,
      internalQuote: null
    });
    this.rebuildTabs();
    this.syncPlan();
  },

  quoteSnapshot() {
    const q = this.data.internalQuote;
    if (q) return { hotel: q.hotel, ticket: q.ticket, package: q.package || 0, car: q.car || 0, carPackage: q.carPackage || 0, total: q.total };
    const hotelsById = {};
    data.hotels.forEach(h => { if (h && h.id) hotelsById[h.id] = h; });
    const pub = quote.publicHotelQuote(normalizePlans(this.data.plans, this.data.days), hotelsById);
    return { hotel: pub.hotel, ticket: 0, total: pub.total };
  },

  /* 预览页用静态 data 查不到云端景区/酒店 id，保存时附带快照 */
  withSnaps(plans) {
    return (plans || []).map(p => {
      const scenicSnaps = (p.scenicIds || []).map(id => this.scenicById(id)).filter(Boolean)
        .map(s => {
        const g = ((p.packageSelections || []).filter(x => x && x.scenicId === s.id)[0]) || null;
        return {
          id: s.id, name: s.name || '', cover: s.cover || s.image || s.img || '', dest: s.dest || '', tips: s.tips || [],
          packageIntro: (this.scenicRawById(s.id) || {}).packageIntro || '',
          packages: g ? (g.items || []).slice() : []
        };
      });
      const hotelSnaps = [p.hotelId].concat((p.hotelBookings || []).map(b => b && b.hotelId), p.altHotelIds || []).filter((x, k, a) => x && a.indexOf(x) === k).map(id => this.hotelById(id)).filter(Boolean)
        .map(h => ({ id: h.id, name: h.name || '', image: h.image || h.cover || h.img || '', stars: h.stars || '', area: h.area || '', regionLevel1: h.regionLevel1 || '' }));
      return Object.assign({}, p, { scenicSnaps, hotelSnaps });
    });
  },

  recallCarUse(id) {
    try {
      if (id) {
        const all = wx.getStorageSync('customCarUseById') || {};
        if (all && all[id]) return all[id];
      }
      return null;
    } catch (e) { return null; }
  },

  rememberCarUse(id, packed) {
    if (!id || !packed) return;
    try {
      const all = wx.getStorageSync('customCarUseById') || {};
      all[id] = { carUseCustom: !!packed.carUseCustom, carUseOffsets: packed.carUseOffsets };
      wx.setStorageSync('customCarUseById', all);
    } catch (e) { /* 本地缓存失败不影响当前页 */ }
  },

  /* 我的行程里已有这条时，只补计费用车，不改景区/酒店。 */
  mergeLocalTripCar(id, packed) {
    if (!id) return;
    try {
      const trips = wx.getStorageSync('myTrips') || [];
      const idx = trips.findIndex(t => t && t.id === id);
      if (idx < 0) return;
      trips[idx] = Object.assign({}, trips[idx], {
        carId: this.data.carId || '',
        carPackageSelections: this.data.carPackageSelections || [],
        carCostOverride: this.data.carCostOverride || '',
        carUseCustom: packed.carUseCustom,
        carUseOffsets: packed.carUseOffsets
      });
      wx.setStorageSync('myTrips', trips);
    } catch (e) { /* ignore */ }
  },

  savePlan() {
    const carPacked = quote.packCarUse(this.data.carUseCustom, this.data.carUseOffsets);
    const record = {
      id: this.data.editingTripId || '',
      days: this.data.days,
      plans: this.withSnaps(normalizePlans(this.data.plans, this.data.days)),
      customActive: !!this.data.customActive,
      date: this.data.date || '',
      adults: this.data.adults,
      children: this.data.children,
      cover: this.data.cover || '',
      audience: this.data.audience || '',
      pace: this.data.pace || '',
      clauses: clause.normalizeClauses(this.data.clauses),
      carId: this.data.carId || '',
      carPackageSelections: this.data.carPackageSelections || [],
      carCostOverride: this.data.carCostOverride || '',
      carUseCustom: carPacked.carUseCustom,
      carUseOffsets: carPacked.carUseOffsets,
      guestName: this.data.guestName || '',
      guestAdultPrice: this.data.guestAdultPrice || '',
      guestChildPrice: this.data.guestChildPrice || '',
      guestQuote: this.data.guestQuote || '',
      quote: this.quoteSnapshot()
    };
    wx.setStorageSync('lastCustomPlan', record);
    this.rememberCarUse(record.id, carPacked);
    this.mergeLocalTripCar(record.id, carPacked);
  },

  goGenerate() {
    if (this._generating) return;
    if (!this.data.cover) {
      wx.showToast({ title: this.data.c.coverMiss, icon: 'none' });
      return;
    }
    this._generating = true;
    let editingTripId = this.data.editingTripId;
    if (!editingTripId) editingTripId = 'trip' + Date.now();
    this.setData({ generating: true, editingTripId });
    this.savePlan();
    const q = [
      'days=' + this.data.days,
      'date=' + encodeURIComponent(this.data.date || ''),
      'adults=' + this.data.adults,
      'children=' + this.data.children,
      'edit=' + encodeURIComponent(editingTripId)
    ];
    const unlock = () => {
      this._generating = false;
      if (this.data.generating) this.setData({ generating: false });
    };
    wx.navigateTo({
      url: '/pages/custom-preview/custom-preview?' + q.join('&'),
      success: unlock,
      fail: unlock
    });
  },

  onHide() {
    this.savePlan();
  },

  /* ---------- 基础信息 ---------- */

  onDays(e) {
    const n = String(e.currentTarget.dataset.n);
    if (n === 'custom') {
      this.setData({ customActive: true });
      const parsed = parseInt(this.data.customDays, 10);
      if (parsed >= MIN_DAYS && parsed <= MAX_DAYS) this.setDays(parsed);
      return;
    }
    this.setData({ customActive: false });
    this.setDays(parseInt(n, 10));
  },

  onCustomInput(e) {
    const v = String(e.detail.value || '').replace(/\D/g, '').slice(0, 2);
    this.setData({ customDays: v });
    const parsed = parseInt(v, 10);
    if (parsed >= MIN_DAYS && parsed <= MAX_DAYS) this.setDays(parsed);
  },

  setDays(n) {
    const days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, parseInt(n, 10) || MIN_DAYS));
    if (days === this.data.days && Array.isArray(this.data.plans)) {
      this.rebuildTabs();
      return;
    }
    const plans = normalizePlans(this.data.plans, days);
    const activeDay = Math.min(this.data.activeDay, days - 1);
    this.setData({ days, plans, activeDay });
    this.rebuildTabs();
    this.syncPlan();
  },

  rebuildTabs() {
    const n = this.data.days;
    const tabs = [];
    for (let i = 0; i < n; i++) tabs.push((i + 1) + this.data.c.daysUnit);
    this.setData({ dayTabs: tabs });
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value, seasonText: quote.seasonOf(quote.monthOf(e.detail.value)) });
    this.syncPlan();
  },

  onAudience(e) {
    this.setData({ audience: e.detail.value });
  },

  onPace(e) {
    this.setData({ pace: e.detail.value });
  },

  onAdult(e) {
    const next = this.data.adults + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 1 || next > 99) return;
    this.setData({ adults: next });
    this.refreshGuestTotal({ adults: next });
    this.calcInternal();
  },

  onChild(e) {
    const next = this.data.children + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 0 || next > 20) return;
    this.setData({ children: next });
    this.refreshGuestTotal({ children: next });
    this.calcInternal();
  },

  /* 旧每人报价 → 成人/儿童同价；新字段优先。返回字符串字段便于 input 回显。 */
  normalizeGuestPrices(src) {
    const s = src || {};
    const adults = Math.max(0, parseInt(s.adults != null ? s.adults : this.data.adults, 10) || 0);
    const children = Math.max(0, parseInt(s.children != null ? s.children : this.data.children, 10) || 0);
    const hasSplitKeys = Object.prototype.hasOwnProperty.call(s, 'guestAdultPrice')
      || Object.prototype.hasOwnProperty.call(s, 'guestChildPrice');
    const clean = (v) => {
      if (v == null || v === '') return '';
      return String(v).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    };
    let ap = clean(s.guestAdultPrice);
    let cp = clean(s.guestChildPrice);
    let total = clean(s.guestQuote);
    if (!hasSplitKeys && total !== '' && Number(total) > 0) {
      /* 旧版：guestQuote 是每人价，拆成成人/儿童同价并算出总价 */
      const unit = Number(total);
      ap = String(unit);
      cp = String(unit);
      const auto = quote.calcGuestTotal(unit, unit, adults, children);
      total = auto > 0 ? String(auto) : '';
    } else if (total === '' && (ap !== '' || cp !== '')) {
      const auto = quote.calcGuestTotal(ap, cp, adults, children);
      total = auto > 0 ? String(auto) : '';
    }
    return { guestAdultPrice: ap, guestChildPrice: cp, guestQuote: total };
  },

  refreshGuestTotal(patch) {
    const p = patch || {};
    const guestAdultPrice = p.guestAdultPrice != null ? p.guestAdultPrice : this.data.guestAdultPrice;
    const guestChildPrice = p.guestChildPrice != null ? p.guestChildPrice : this.data.guestChildPrice;
    const adults = p.adults != null ? p.adults : this.data.adults;
    const children = p.children != null ? p.children : this.data.children;
    const keepTotal = !!p.keepTotal;
    const auto = quote.calcGuestTotal(guestAdultPrice, guestChildPrice, adults, children);
    let guestQuote = p.guestQuote != null ? p.guestQuote : this.data.guestQuote;
    if (!keepTotal) {
      guestQuote = auto > 0 ? String(auto) : '';
    } else if ((guestQuote == null || guestQuote === '') && auto > 0) {
      guestQuote = String(auto);
    }
    const view = quote.guestTotalView({
      adultPrice: guestAdultPrice,
      childPrice: guestChildPrice,
      adults,
      children,
      total: guestQuote
    });
    this.setData({
      guestQuote: guestQuote == null ? '' : String(guestQuote),
      guestTotalText: view ? view.totalText : '',
      guestTotalNote: view ? view.note : ''
    });
  },

  /* ---------- 每日切换 ---------- */

  onDay(e) {
    this.setData({ activeDay: Number(e.currentTarget.dataset.index) });
    this.syncPlan();
  },

  /* ---------- 自动同步 ---------- */

  syncPlan() {
    const plans = this.plansArray();
    const plan = this.planAt(this.data.activeDay);
    const selMap = {};
    (plan.packageSelections || []).forEach(g => {
      if (g && g.scenicId) selMap[String(g.scenicId)] = (g.items || []).map(it => String(it.id));
    });
    const curScenics = (plan.scenicIds || []).map(id => {
      const base = this.scenicById(id);
      if (!base) return null;
      const raw = this.scenicRawById(id) || base;
      const pkgs = quote.packagesOf(raw).map(pk => {
        const picked = selMap[String(id)] || [];
        let priceLabel = '价格待定';
        if (pk.priceText === '0' || pk.price === 0) priceLabel = '免费';
        else if (pk.price > 0) priceLabel = '￥' + pk.price;
        else if (pk.priceText) priceLabel = pk.priceText;
        /* 价格仅定制师内部可见；客户侧只展示「包含：」后文案 */
        return Object.assign({}, pk, { sel: picked.indexOf(String(pk.id)) > -1, priceLabel: this.data.isStaff ? priceLabel : '' });
      });
      return Object.assign({}, base, { packageIntro: raw.packageIntro || '', packages: pkgs });
    }).filter(Boolean);
    const curHotel = plan.hotelId ? this.hotelById(plan.hotelId) : null;
    const hotels = this.hotelsOf();
    let altDirty = false;
    plans.forEach(p => {
      if (!p || !p.hotelId || !Array.isArray(p.altHotelIds) || !p.altHotelIds.length) return;
      const dayHotel = hotels.filter(h => h.id === p.hotelId)[0];
      if (!dayHotel) return;
      const nextIds = p.altHotelIds.filter(id => catalog.sameGradeAlt(dayHotel, hotels.filter(h => h.id === id)[0]));
      if (nextIds.length !== p.altHotelIds.length) {
        p.altHotelIds = nextIds;
        altDirty = true;
      }
    });
    if (altDirty) this.setData({ plans: normalizePlans(this.data.plans, this.data.days) });
    const pool = curHotel ? hotels.filter(h => catalog.sameGradeAlt(curHotel, h)) : [];
    const kept = (plan.altHotelIds || []).slice();
    const altPicked = kept.map(id => {
      const h = this.hotelById(id);
      if (!h) return null;
      return { id: h.id, name: h.name, stars: h.stars || '', area: h.area || '', image: h.image || '' };
    }).filter(Boolean);
    let totalScenic = 0;
    let totalHotel = 0;
    plans.forEach(p => {
      if (p && Array.isArray(p.scenicIds)) totalScenic += p.scenicIds.length;
      if (p && p.hotelId) totalHotel += 1;
    });
    const curRoomTypes = curHotel ? this.roomTypesFor(curHotel) : [];
    /* 已选酒店但未选房型时，默认取第一个房型（与 UI 展示一致，便于保存/预览） */
    if (curHotel && !plan.roomType && curRoomTypes.length) {
      const plans2 = normalizePlans(this.data.plans, this.data.days);
      plans2[this.data.activeDay].roomType = curRoomTypes[0];
      plan.roomType = curRoomTypes[0];
      this.setData({ plans: plans2 });
    }
    /* 追加的住宿预订行（第 2 条起），每条独立酒店+房型+间数 */
    const bookHotelOpts = curHotel ? [curHotel].concat(pool.filter(h => h.id !== curHotel.id)) : [];
    const extraPlan = this.planAt(this.data.activeDay);
    const curExtraBookings = curHotel ? (extraPlan.hotelBookings || []).slice(1).map((b, k) => {
      const h = this.hotelById(b.hotelId);
      const types = h ? this.roomTypesFor(h) : ['标准间'];
      return { bi: k + 1, hotelId: b.hotelId, name: h ? h.name : b.hotelId, types, roomType: b.roomType || types[0], qty: b.roomQty || 1 };
    }) : [];
    const rawCar = this.carsOf().filter(c => c.id === this.data.carId)[0] || null;
    this.setData({
      bookHotelOpts: bookHotelOpts.map(h => ({ id: h.id, name: h.name })),
      bookHotelNames: bookHotelOpts.map(h => h.name),
      curExtraBookings,
      curScenics,
      curHotel,
      altPicked,
      altCanPick: pool.length > 0,
      curCar: rawCar ? Object.assign({}, rawCar, { caption: quote.vehicleCaption(rawCar) }) : null,
      curCarPackages: this.carViewPackages(rawCar),
      curNote: plan.note || '',
      curPromo: gallery.clipPromo(plan.promoImgs),
      totalScenic,
      totalHotel,
      curRoomTypes,
      seasonText: quote.seasonOf(quote.monthOf(this.data.date))
    });
    this.ensureHotelPrices();
    this.calcInternal();
  },

  /* 当前酒店可选房型（员工用云价房型；游客用静态 rooms；均回退标准间） */
  roomTypesFor(hotel) {
    if (this.data.isStaff) {
      const ch = this.data.calcHotelsById[hotel.id];
      const checkin = quote.addDays(this.data.date, this.data.activeDay);
      if (ch) return quote.roomTypesOf(ch, checkin);
    }
    const rooms = (hotel && hotel.rooms) || [];
    const names = rooms.map(r => String((r && typeof r === 'object' ? r.name : r) || '').split(/[：:]/)[0].trim()).filter(Boolean);
    return names.length ? names : ['标准间'];
  },

  /* 名字关键字：trim 后对 name 做包含匹配（英文不区分大小写），叠在区域/类别/地点之后 */
  matchSheetName(item) {
    const kw = String(this.data.sheetKeyword || '').trim().toLowerCase();
    if (!kw) return true;
    return String((item && item.name) || '').toLowerCase().indexOf(kw) > -1;
  },

  scenicOptions() {
    const plan = this.planAt(this.data.activeDay);
    const ids = plan.scenicIds || [];
    const fac = catalog.facet('scenic', this.scenicsOf(), this._scenicCats || [], {
      region: this.data.sheetRegion,
      sub: this.data.sheetSub,
      place: this.data.sheetPlace
    }, data.REGIONS || []);
    const list = fac.list.filter(s => this.matchSheetName(s)).map(s => Object.assign({}, s, { sel: ids.indexOf(s.id) > -1 }));
    return { fac, list };
  },

  hotelOptions() {
    const plan = this.planAt(this.data.activeDay);
    const fac = catalog.facet('hotel', this.hotelsOf(), this._hotelCats || [], {
      region: this.data.sheetRegion,
      place: this.data.sheetPlace
    }, data.REGIONS || []);
    const named = fac.list.filter(h => this.matchSheetName(h));
    /* 级别（星级/钻级）筛选：与区域/地点筛选叠加，选项取当前区域下实际存在的级别 */
    const lv = [];
    named.forEach(h => { const s = String(h.stars || '').trim(); if (s && lv.indexOf(s) < 0) lv.push(s); });
    lv.sort((a, b) => (parseFloat(b) || 0) - (parseFloat(a) || 0));
    const levels = [{ key: 'all', label: '全部级别' }].concat(lv.map(s => ({ key: s, label: s })));
    const level = lv.indexOf(this.data.sheetLevel) > -1 ? this.data.sheetLevel : 'all';
    const list = named
      .filter(h => level === 'all' || String(h.stars || '').trim() === level)
      .map(h => Object.assign({}, h, { sel: h.id === plan.hotelId }));
    return { fac, list, levels, level };
  },

  /* 同区域备选，可按级别筛选：先 sameLevel2Area，再按 sheetAltLevel 滤 stars */
  altOptions() {
    const plan = this.planAt(this.data.activeDay);
    const cur = plan.hotelId ? this.hotelById(plan.hotelId) : null;
    const ids = (plan && plan.altHotelIds) || [];
    const empty = { list: [], levels: [{ key: 'all', label: '全部' }] };
    if (!cur) return empty;
    const areaPool = this.hotelsOf().filter(h => catalog.sameGradeAlt(cur, h));
    const stars = [];
    areaPool.forEach(h => {
      const s = String(h.stars || '').trim();
      if (s && stars.indexOf(s) < 0) stars.push(s);
    });
    const levels = [{ key: 'all', label: '全部' }].concat(stars.map(s => ({ key: s, label: s })));
    const level = this.data.sheetAltLevel || 'all';
    const list = areaPool
      .filter(h => level === 'all' || String(h.stars || '').trim() === level)
      .map(h => Object.assign({}, h, { sel: ids.indexOf(h.id) > -1 }));
    return { list, levels };
  },

  refreshSheet() {
    const type = this.data.sheet && this.data.sheet.type;
    if (type === 'scenic') {
      const pack = this.scenicOptions();
      this.setData({
        sheetScenics: pack.list,
        sheetRegions: pack.fac.regions,
        sheetSubs: pack.fac.subs,
        sheetPlaces: pack.fac.places,
        sheetRegion: pack.fac.region,
        sheetSub: pack.fac.sub,
        sheetPlace: pack.fac.place
      });
      return;
    }
    if (type === 'hotel') {
      const pack = this.hotelOptions();
      this.setData({
        sheetHotels: pack.list,
        sheetLevels: pack.levels,
        sheetLevel: pack.level,
        sheetRegions: pack.fac.regions,
        sheetPlaces: pack.fac.places,
        sheetRegion: pack.fac.region,
        sheetPlace: pack.fac.place
      });
      return;
    }
    if (type === 'alt') {
      const pack = this.altOptions();
      this.setData({ sheetHotels: pack.list, sheetAltLevels: pack.levels });
      return;
    }
    if (type === 'car') {
      const id = this.data.carId || '';
      const f = this.data.carFilter || {};
      const all = this.carsOf();
      const shown = carFilter.apply(all, f);
      this.setData({
        carFilterOpts: carFilter.buildOpts(all, this._carMeta, f),
        carEmptyText: carFilter.emptyText(all.length, shown.length, f),
        sheetCars: shown.map(c => Object.assign({}, c, { sel: c.id === id }))
      });
    }
  },

  onSheetRegion(e) {
    this.setData({ sheetRegion: e.currentTarget.dataset.region, sheetSub: 'all', sheetPlace: catalog.ALL });
    this.refreshSheet();
  },

  onSheetSub(e) {
    this.setData({ sheetSub: e.currentTarget.dataset.sub, sheetPlace: catalog.ALL });
    this.refreshSheet();
  },

  onSheetPlace(e) {
    this.setData({ sheetPlace: e.currentTarget.dataset.place });
    this.refreshSheet();
  },

  onSheetKeyword(e) {
    this.setData({ sheetKeyword: (e.detail && e.detail.value) || '' });
    this.refreshSheet();
  },

  clearSheetKeyword() {
    this.setData({ sheetKeyword: '' });
    this.refreshSheet();
  },

  onGuestName(e) {
    this.setData({ guestName: e.detail.value });
  },

  _digitPrice(e) {
    return String((e && e.detail && e.detail.value) || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  },

  onGuestAdultPrice(e) {
    const v = this._digitPrice(e);
    this.setData({ guestAdultPrice: v });
    this.refreshGuestTotal({ guestAdultPrice: v }); /* 改单价重算总价 */
  },

  onGuestChildPrice(e) {
    const v = this._digitPrice(e);
    this.setData({ guestChildPrice: v });
    this.refreshGuestTotal({ guestChildPrice: v }); /* 改单价重算总价 */
  },

  onGuestQuote(e) {
    const v = this._digitPrice(e);
    this.setData({ guestQuote: v });
    this.refreshGuestTotal({ guestQuote: v, keepTotal: true }); /* 手改总价，不因单价回写 */
  },

  /* ---------- 景区选择 ---------- */

  openScenic() {
    this.setData({
      sheet: { type: 'scenic' },
      sheetRegion: catalog.ALL,
      sheetSub: 'all',
      sheetPlace: catalog.ALL,
      sheetKeyword: ''
    });
    this.refreshSheet();
  },

  togglePackage(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const sid = String(ds.sid == null ? '' : ds.sid);
    const iid = String(ds.iid == null ? '' : ds.iid);
    const pidx = ds.pidx === undefined || ds.pidx === '' ? -1 : Number(ds.pidx);
    if (!sid) return;
    const scenic = (this.data.curScenics || []).filter(s => s && String(s.id) === sid)[0];
    let it = null;
    if (scenic && Array.isArray(scenic.packages)) {
      if (iid) it = scenic.packages.filter(x => x && String(x.id) === iid)[0] || null;
      if (!it && pidx >= 0) it = scenic.packages[pidx] || null;
    }
    if (!it) {
      const raw = this.scenicRawById(sid) || this.scenicById(sid);
      const pkgs = quote.packagesOf(raw || {});
      if (iid) it = pkgs.filter(x => x && String(x.id) === iid)[0] || null;
      if (!it && pidx >= 0) it = pkgs[pidx] || null;
    }
    if (!it || !it.id) return;
    const pickId = String(it.id);
    const plans = normalizePlans(this.data.plans, this.data.days);
    const p = plans[this.data.activeDay];
    if (!Array.isArray(p.packageSelections)) p.packageSelections = [];
    let g = p.packageSelections.filter(x => x && String(x.scenicId) === sid)[0];
    if (!g) { g = { scenicId: sid, items: [] }; p.packageSelections.push(g); }
    const pos = g.items.findIndex(x => x && String(x.id) === pickId);
    if (pos > -1) g.items.splice(pos, 1);
    else g.items.push({
      id: pickId,
      name: it.name || '',
      price: (it.priceText != null && it.priceText !== '') ? it.priceText : String(it.price != null ? it.price : '')
    });
    if (!g.items.length) p.packageSelections = p.packageSelections.filter(x => x && String(x.scenicId) !== sid);
    this.setData({ plans });
    this.syncPlan();
    this.measureRow();
  },
  toggleScenic(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[idx].scenicIds;
    const pos = ids.indexOf(id);
    if (pos > -1) {
      ids.splice(pos, 1);
      plans[idx].packageSelections = (plans[idx].packageSelections || []).filter(g => g && g.scenicId !== id);
    } else ids.push(id);
    this.setData({ plans });
    this.syncPlan();
    this.refreshSheet();
    this.measureRow();
  },

  /* ---------- 酒店选择 ---------- */

  openHotel() {
    this.setData({
      sheet: { type: 'hotel' },
      sheetRegion: catalog.ALL,
      sheetSub: 'all',
      sheetPlace: catalog.ALL,
      sheetLevel: 'all',
      sheetKeyword: ''
    });
    this.refreshSheet();
  },

  onSheetLevel(e) {
    this.setData({ sheetLevel: e.currentTarget.dataset.level || 'all' });
    this.refreshSheet();
  },

  toggleHotel(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const cur = plans[idx].hotelId;
    plans[idx].hotelId = cur === id ? '' : id;
    if (!plans[idx].hotelId) plans[idx].hotelBookings = [];
    plans[idx].altHotelIds = [];
    plans[idx].roomType = '';
    plans[idx].roomQty = 1;
    this.setData({ plans });
    this.syncPlan();
    this.refreshSheet();
  },

  openClause(e) {
    const kind = e.currentTarget.dataset.kind;
    this.setData({ sheet: { type: 'clause' }, clauseKind: kind });
    this.refreshClauseSheet();
  },

  refreshClauseSheet() {
    const kind = this.data.clauseKind;
    const lists = this._clauseLists || {};
    const rows = lists[kind] || clause.defaults().filter(t => t.kind === kind);
    const cur = (this.data.clauses && this.data.clauses[kind]) || {};
    this.setData({
      sheetClauses: rows.map(t => Object.assign({}, t, { sel: t.id === cur.templateId }))
    });
  },

  pickClause(e) {
    const id = e.currentTarget.dataset.id;
    const row = (this.data.sheetClauses || []).filter(t => t.id === id)[0];
    if (!row) return;
    const clauses = clause.normalizeClauses(this.data.clauses);
    clauses[row.kind] = clause.snapshot(row);
    this.setData({ clauses, clauseCards: clause.cards(clauses), sheet: null });
  },

  openCar() {
    this.setData({ sheet: { type: 'car' }, carFilter: carFilter.defaultFilter() });
    this.refreshSheet();
  },

  onCarFilter(e) {
    const ds = e.currentTarget.dataset || {};
    const k = ds.k;
    const v = (ds.v == null || ds.v === '') ? carFilter.ALL : ds.v;
    const f = carFilter.norm(this.data.carFilter);
    if (k !== 'region' && k !== 'category' && k !== 'line') return;
    f[k] = v;
    /* 一级变了清二级三级；二级变了清三级（对齐酒店 region→place 联动） */
    if (k === 'region') { f.category = carFilter.ALL; f.line = carFilter.ALL; }
    else if (k === 'category') { f.line = carFilter.ALL; }
    this.setData({ carFilter: f });
    this.refreshSheet();
  },

  toggleCarPackage(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const vid = this.data.carId;
    const car = this.carsOf().filter(c => c.id === vid)[0];
    if (!car) return;
    const it = quote.vehiclePackagesOf(car).filter(x => x.id === String(ds.iid))[0];
    if (!it) return;
    const sels = (this.data.carPackageSelections || []).map(g => Object.assign({}, g, { items: (g.items || []).slice() }));
    let g = sels.filter(x => x.vehicleId === vid)[0];
    if (!g) { g = { vehicleId: vid, items: [] }; sels.push(g); }
    const pos = g.items.findIndex(x => x && x.id === it.id);
    if (pos > -1) g.items.splice(pos, 1);
    else g.items.push({ id: it.id, name: it.name, price: it.priceText !== '' ? it.priceText : String(it.price) });
    this.setData({ carPackageSelections: sels.filter(x => x.items.length) });
    this.syncPlan();
  },

  onCarCostInput(e) {
    this.setData({ carCostOverride: String((e.detail && e.detail.value) || '').trim() });
    this.calcInternal();
  },

  /* 内部报价某一天用车行上的删除/恢复。不改行程天数。 */
  applyCarUseToggle(offset) {
    if (!this.data.isStaff) return;
    const view = this.carUseNow();
    const next = quote.carUseAfterToggle(view.use.offsets, view.tripDays, offset);
    this.setData({
      carUseCustom: next.custom,
      carUseOffsets: next.custom ? next.offsets : null
    });
    this.syncPlan();
  },

  dropCarUseDay(e) {
    this.applyCarUseToggle((e.currentTarget.dataset || {}).offset);
  },

  restoreCarUseDay(e) {
    this.applyCarUseToggle((e.currentTarget.dataset || {}).offset);
  },

  toggleCar(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const next = this.data.carId === id ? '' : id;
    /* 换车：仅保留新车型的套票勾选 */
    this.setData({ carId: next, carPackageSelections: (this.data.carPackageSelections || []).filter(g => g && g.vehicleId === next) });
    this.syncPlan();
    this.refreshSheet();
  },

  clearCar() {
    this.setData({ carId: '', carPackageSelections: [] });
    this.syncPlan();
  },

  openAlt() {
    if (!this.planAt(this.data.activeDay).hotelId) return;
    this.setData({ sheet: { type: 'alt' }, sheetAltLevel: 'all' });
    this.refreshSheet();
  },

  onSheetAltLevel(e) {
    this.setData({ sheetAltLevel: e.currentTarget.dataset.level || 'all' });
    this.refreshSheet();
  },

  toggleAlt(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const cur = plans[idx].hotelId ? this.hotelById(plans[idx].hotelId) : null;
    const hotel = this.hotelById(id);
    const ids = plans[idx].altHotelIds;
    const pos = ids.indexOf(id);
    if (pos > -1) ids.splice(pos, 1);
    else if (cur && hotel && catalog.sameGradeAlt(cur, hotel)) ids.push(id);
    this.setData({ plans });
    this.syncPlan();
    this.refreshSheet();
  },

  clearHotel() {
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    plans[idx].hotelId = '';
    plans[idx].hotelBookings = [];
    plans[idx].altHotelIds = [];
    plans[idx].roomType = '';
    plans[idx].roomQty = 1;
    this.setData({ plans });
    this.syncPlan();
  },

  /* ---------- 每日房型 / 间数 ---------- */

  onRoomType(e) {
    const idx = this.data.activeDay;
    const types = this.data.curRoomTypes;
    const plans = normalizePlans(this.data.plans, this.data.days);
    plans[idx].roomType = types[Number(e.detail.value)] || '';
    this.setData({ plans });
    this.syncPlan();
  },

  onRoomQty(e) {
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const cur = Math.max(1, parseInt(plans[idx].roomQty, 10) || 1);
    const next = cur + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 1 || next > 20) return;
    plans[idx].roomQty = next;
    this.setData({ plans });
    this.calcInternal();
  },

  /* ---------- 追加住宿预订（同店可多条：一间大床 + 一间标间） ---------- */

  addBooking() {
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const p = plans[idx];
    if (!p.hotelId) return;
    if (p.hotelBookings.length >= 10) return;
    const h = this.hotelById(p.hotelId);
    const types = h ? this.roomTypesFor(h) : [];
    p.hotelBookings.push({ hotelId: p.hotelId, roomType: types[0] || '', roomQty: 1 });
    this.setData({ plans });
    this.syncPlan();
  },

  editBooking(e, fn) {
    const bi = Number(e.currentTarget.dataset.bi);
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const b = plans[idx].hotelBookings[bi];
    if (!b || bi < 1) return;
    if (fn(b, plans[idx], bi) === false) return;
    this.setData({ plans });
    this.syncPlan();
  },

  onBookHotel(e) {
    const opt = (this.data.bookHotelOpts || [])[Number(e.detail.value)];
    if (!opt) return;
    this.editBooking(e, b => {
      const h = this.hotelById(opt.id);
      const types = h ? this.roomTypesFor(h) : [];
      b.hotelId = opt.id;
      b.roomType = types[0] || '';
    });
  },

  onBookRoomType(e) {
    const bi = Number(e.currentTarget.dataset.bi);
    const row = (this.data.curExtraBookings || []).filter(x => x.bi === bi)[0];
    if (!row) return;
    this.editBooking(e, b => { b.roomType = row.types[Number(e.detail.value)] || ''; });
  },

  onBookQty(e) {
    const plus = String(e.currentTarget.dataset.d) === '+';
    this.editBooking(e, b => {
      const next = (b.roomQty || 1) + (plus ? 1 : -1);
      if (next < 1 || next > 20) return false;
      b.roomQty = next;
    });
  },

  removeBooking(e) {
    this.editBooking(e, (b, p, bi) => { p.hotelBookings.splice(bi, 1); });
  },

  /* ---------- 已选景区排序 ---------- */

  moveSel(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const dir = Number(e.currentTarget.dataset.dir);
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[this.data.activeDay].scenicIds;
    const to = idx + dir;
    if (to < 0 || to >= ids.length) return;
    const t = ids[idx];
    ids[idx] = ids[to];
    ids[to] = t;
    this.setData({ plans });
    this.syncPlan();
  },

  removeScenic(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const plans = normalizePlans(this.data.plans, this.data.days);
    const removed = plans[this.data.activeDay].scenicIds.splice(idx, 1)[0];
    if (removed) plans[this.data.activeDay].packageSelections = (plans[this.data.activeDay].packageSelections || []).filter(g => g && g.scenicId !== removed);
    this.setData({ plans });
    this.syncPlan();
  },

  /* 把手拖动：手指跟着走，松手才改顺序。不在移动过程中重排数据，避免和页面滚动抢手势。 */
  rowShifts(n, from, drop, dy, h) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (from < 0) out.push(0);
      else if (i === from) out.push(dy);
      else if (drop > from && i > from && i <= drop) out.push(-h);
      else if (drop < from && i >= drop && i < from) out.push(h);
      else out.push(0);
    }
    return out;
  },

  measureRow() {
    if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') return;
    try {
      const q = wx.createSelectorQuery();
      const scoped = q && q.in ? q.in(this) : q;
      if (!scoped || !scoped.select) return;
      const sel = (this.data.dragIndex >= 0) ? '.sel-item.dragging' : '.sel-item';
      scoped.select(sel).boundingClientRect(rect => {
        if (!rect || !(rect.height > 20)) return;
        this._itemH = rect.height;
        if (this.data.itemH !== rect.height) this.setData({ itemH: rect.height });
      }).exec();
    } catch (err) { /* 预览环境没有节点查询时用固定行高 */ }
  },

  dragStart(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const t = (e.touches && e.touches[0]) || {};
    const n = (this.data.curScenics || []).length;
    if (!n || idx < 0 || idx >= n) return;
    this._drag = { from: idx, startY: t.clientY || 0 };
    const h = this._itemH || this.data.itemH || ITEM_H;
    this.setData({
      dragIndex: idx,
      dropIndex: idx,
      dragDy: 0,
      rowShift: this.rowShifts(n, idx, idx, 0, h)
    });
    this.measureRow();
  },

  dragMove(e) {
    const d = this._drag;
    if (!d) return;
    const t = (e.touches && e.touches[0]) || {};
    const y = t.clientY || 0;
    const n = (this.data.curScenics || []).length;
    const h = this._itemH || this.data.itemH || ITEM_H;
    const dy = y - d.startY;
    let drop = d.from + Math.round(dy / h);
    if (drop < 0) drop = 0;
    if (drop > n - 1) drop = n - 1;
    this.setData({
      dragDy: dy,
      dropIndex: drop,
      rowShift: this.rowShifts(n, d.from, drop, dy, h)
    });
  },

  dragEnd() {
    const d = this._drag;
    this._drag = null;
    const from = d ? d.from : -1;
    const drop = this.data.dropIndex;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[this.data.activeDay].scenicIds;
    if (d && from >= 0 && drop >= 0 && drop !== from && drop < ids.length) {
      const moved = ids.splice(from, 1)[0];
      ids.splice(drop, 0, moved);
    }
    this.setData({
      plans,
      dragIndex: -1,
      dropIndex: -1,
      dragDy: 0,
      rowShift: []
    });
    if (d && from !== drop) this.syncPlan();
  },

  /* ---------- 封面 / 每日宣传图 ---------- */

  storeUpload(filePath, done) {
    if (!filePath) return;
    if (typeof wx !== 'undefined' && wx.cloud && wx.cloud.uploadFile) {
      wx.showLoading({ title: '上传中' });
      const ext = (/\.(\w+)$/.exec(filePath) || [])[1] || 'jpg';
      wx.cloud.uploadFile({
        cloudPath: 'custom/' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext,
        filePath
      }).then(r => {
        wx.hideLoading();
        done((r && r.fileID) || filePath);
      }).catch(() => {
        wx.hideLoading();
        done(filePath);
      });
      return;
    }
    done(filePath);
  },

  chooseLocal(count, cb) {
    const n = Math.max(1, count || 1);
    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: n,
        mediaType: ['image'],
        success: res => {
          const files = (res && res.tempFiles) || [];
          cb(files.map(f => f && f.tempFilePath).filter(Boolean));
        }
      });
      return;
    }
    if (typeof wx.chooseImage === 'function') {
      try {
        wx.chooseImage({
          count: n,
          success: res => cb((res && res.tempFilePaths) || [])
        });
        return;
      } catch (err) { /* 预览环境没有选图，走占位图 */ }
    }
    const pads = [];
    for (let i = 0; i < n; i++) pads.push(ph(n > 1 ? '宣传图' : '私人定制封面', 640, 360));
    cb(pads);
  },

  openCoverLib() {
    this.setData({ sheet: { type: 'cover' } });
  },

  pickCoverLib(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    this.setData({ cover: url, sheet: null });
  },

  uploadCover() {
    this.chooseLocal(1, paths => {
      if (!paths.length) return;
      this.storeUpload(paths[0], url => this.setData({ cover: url }));
    });
  },

  clearCover() {
    this.setData({ cover: '' });
  },

  openPromoLib() {
    if ((this.data.curPromo || []).length >= gallery.MAX_PROMO) {
      wx.showToast({ title: this.data.c.promoFull, icon: 'none' });
      return;
    }
    this.setData({ sheet: { type: 'promo' } });
  },

  addPromo(url) {
    if (!url) return;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const arr = plans[idx].promoImgs;
    if (arr.length >= gallery.MAX_PROMO) {
      wx.showToast({ title: this.data.c.promoFull, icon: 'none' });
      return;
    }
    if (arr.indexOf(url) >= 0) return;
    arr.push(url);
    this.setData({ plans });
    this.syncPlan();
  },

  pickPromoLib(e) {
    this.addPromo(e.currentTarget.dataset.url);
    if ((this.planAt(this.data.activeDay).promoImgs || []).length >= gallery.MAX_PROMO) this.setData({ sheet: null });
  },

  uploadPromo() {
    const left = gallery.MAX_PROMO - (this.data.curPromo || []).length;
    if (left <= 0) {
      wx.showToast({ title: this.data.c.promoFull, icon: 'none' });
      return;
    }
    this.chooseLocal(left, paths => {
      const queue = paths.slice(0, left);
      const next = i => {
        if (i >= queue.length) return;
        this.storeUpload(queue[i], url => { this.addPromo(url); next(i + 1); });
      };
      next(0);
    });
  },

  removePromo(e) {
    const i = Number(e.currentTarget.dataset.index);
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    plans[idx].promoImgs.splice(i, 1);
    this.setData({ plans });
    this.syncPlan();
  },

  /* ---------- 备注 ---------- */

  onNote(e) {
    const plans = normalizePlans(this.data.plans, this.data.days);
    plans[this.data.activeDay].note = e.detail.value;
    this.setData({ plans, curNote: e.detail.value });
  },

  /* ---------- 弹层 ---------- */

  noop() {},

  closeSheet() {
    this.setData({ sheet: null, sheetKeyword: '' });
  },

  openSubmit() {
    this.setData({ submitShow: true, formError: '', formAgreed: false });
  },

  toggleFormAgree() {
    this.setData({ formAgreed: !this.data.formAgreed, formError: '' });
  },

  openLegal(e) {
    const kind = (e.currentTarget.dataset || {}).kind === 'agreement' ? 'agreement' : 'privacy';
    wx.navigateTo({ url: '/pages/legal/legal?kind=' + kind });
  },

  onFormInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value, formError: '' });
  },

  closeSubmit() {
    this.setData({ submitShow: false, formError: '' });
  },

  doSubmit() {
    const { form, date, adults, children, customActive, days, c } = this.data;
    const plans = normalizePlans(this.data.plans, days);
    if (!allowCollect(this.data.formAgreed)) {
      this.setData({ formError: '请先阅读并同意《用户服务协议》和《隐私政策》' });
      return;
    }
    if (!form.name.trim()) {
      this.setData({ formError: c.nameError });
      return;
    }
    if (!isValidPhone(form.phone)) {
      this.setData({ formError: c.phoneError });
      return;
    }
    const lines = [];
    plans.forEach((p, i) => {
      if (!p) return;
      const sc = (p.scenicIds || []).map(id => this.scenicById(id)).filter(Boolean).map(s => s.name).join('、');
      const seg = '第' + (i + 1) + '天';
      const parts = [];
      if (sc) parts.push('景区:' + sc);
      if (p.hotelId) {
        const h = this.hotelById(p.hotelId);
        if (h) {
          let hseg = '宿:' + h.name;
          const alts = (p.altHotelIds || []).map(id => this.hotelById(id)).filter(Boolean).map(x => x.name);
          const more = (p.hotelBookings || []).slice(1).map(b => { const bh = this.hotelById(b.hotelId); return (bh ? bh.name : '') + ' ' + (b.roomType || '') + '×' + (b.roomQty || 1); });
          hseg += ' ' + (p.roomType || '') + '×' + (p.roomQty || 1);
          if (more.length) hseg += '；' + more.join('；');
          if (alts.length) hseg += '（备选:' + alts.join('、') + '）';
          parts.push(hseg);
        }
      }
      if (p.note) parts.push('备注:' + p.note);
      lines.push(seg + (parts.length ? ' · ' + parts.join('；') : ''));
    });
    addConsultRecord({
      name: form.name.trim(),
      phone: form.phone.trim(),
      people: adults + '大' + children + '小',
      date: date || '未选择',
      remark: ('定制天数:' + (customActive ? (days + '天(自定义)') : (days + '天')) + (form.wechat ? (' · 微信号:' + form.wechat.trim()) : '')) + '\n' + lines.join('\n'),
      routeId: 'custom',
      routeTitle: '私人定制行程'
    });
    this.savePlan();
    this.setData({
      submitShow: false,
      successShow: true,
      form: { name: '', phone: '', wechat: '' },
      formAgreed: false,
      formError: ''
    });
    setTimeout(() => { this.setData({ successShow: false }); }, 2500);
  },

  closeSuccess() {
    this.setData({ successShow: false });
  }
}));