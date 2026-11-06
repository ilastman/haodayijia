const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const quote = require('../../utils/quote');
const gallery = require('../../utils/gallery');
const clause = require('../../utils/clause');
const cloud = require('../../utils/cloud');
const wb = require('../../utils/workbench');
const { ph } = require('../../utils/util');
const share = require('../../utils/share');

const MAX_DAYS = 15;
const MAX_TILES = 4;
const TIME_STAMP = '2026-10-08';

/* 来源没有计费日字段时返回 null，保存时不覆盖云端已有删减。 */
function carUseState(src) {
  if (!src || !quote.hasCarUseField(src)) return null;
  const packed = quote.pickCarUse(src);
  return { carUseKnown: true, carUseCustom: packed.carUseCustom, carUseOffsets: packed.carUseOffsets };
}

const FIXED_TIPS = [
  '草原昼夜温差大，即使夏季也请备一件薄外套',
  '呼伦贝尔盛夏多阵雨，建议随身携带雨具',
  '全程为半自由行，游览时间可与司机协商微调',
  '请携带身份证原件，儿童携带户口本（国门等景区需查验）'
];

const HOTEL_TIPS = {
  h1: '早起可看草原晨雾，出门前带好证件与随行物品',
  h2: '傍晚可上露台看湿地日落，早晚温差大请添衣',
  h3: '村内道路较窄，车停村口步行游览更舒适',
  h4: '草原夜间温度低，营地备有电热毯与厚被，观星时请关掉手机屏幕',
  h5: '满洲里夜景约 20 点亮灯，国门 / 套娃景区需携带身份证',
  h6: '泡温泉前后请补充水分，秋冬出行注意防寒保暖',
  h7: '林区早晚气温低，请穿防水防滑鞋以防露水',
  h8: '界河观景台风大，拍照时请扶好帽子与随身物品'
};

function monthFromDate(str) {
  const m = parseInt(String(str || '').split('-')[1], 10);
  return isFinite(m) ? m : 0;
}

function buildInfo(days, month, audience, pace) {
  const people = String(audience || '').trim() || copy.custom.metaAudienceDefault;
  const rhythm = String(pace || '').trim() || copy.custom.metaPaceDefault;
  return [
    { k: copy.detail.baseInfo[0], v: days + '天' },
    { k: copy.detail.baseInfo[1], v: people },
    { k: copy.detail.baseInfo[2], v: rhythm },
    { k: copy.detail.baseInfo[3], v: quote.seasonOf(month) }
  ];
}

function snapScenic(p, id) {
  return data.getScenic(id) || ((p && p.scenicSnaps) || []).filter(x => x && x.id === id)[0] || null;
}

function snapHotel(p, id) {
  return (data.hotels || []).filter(x => x.id === id)[0] || ((p && p.hotelSnaps) || []).filter(x => x && x.id === id)[0] || null;
}

function plansHotelMap(plans) {
  const map = hotelsByIdFrom(data.hotels);
  (plans || []).forEach(p => ((p && p.hotelSnaps) || []).forEach(h => { if (h && h.id && !map[h.id]) map[h.id] = h; }));
  return map;
}

function plansScenicMap(plans) {
  const map = {};
  (data.scenics || []).forEach(s => { if (s && s.id) map[s.id] = s; });
  (plans || []).forEach(p => ((p && p.scenicSnaps) || []).forEach(s => { if (s && s.id && !map[s.id]) map[s.id] = s; }));
  return map;
}

function hotelsByIdFrom(list) {
  const map = {};
  (list || []).forEach(h => { if (h && h.id) map[h.id] = h; });
  return map;
}

function buildOverallTips(plans) {
  const tips = FIXED_TIPS.slice();
  const seen = {};
  FIXED_TIPS.forEach(t => { seen[t] = 1; });
  (plans || []).forEach(p => {
    (p.scenicIds || []).forEach(id => {
      const s = snapScenic(p, id);
      if (!s) return;
      (s.tips || []).forEach(t => {
        if (tips.length >= 7 || seen[t]) return;
        seen[t] = 1;
        tips.push(t);
      });
    });
    if (p.hotelId && HOTEL_TIPS[p.hotelId] && tips.length < 7 && !seen[HOTEL_TIPS[p.hotelId]]) {
      seen[HOTEL_TIPS[p.hotelId]] = 1;
      tips.push(HOTEL_TIPS[p.hotelId]);
    }
  });
  return tips;
}


/* 兼容旧版每人报价：无成人/儿童价字段时，guestQuote 视为每人价并拆分。 */
function normalizeGuestPriceFields(src, adults, children) {
  const s = src || {};
  const a = Math.max(0, parseInt(adults, 10) || 0);
  const c = Math.max(0, parseInt(children, 10) || 0);
  const hasSplitKeys = Object.prototype.hasOwnProperty.call(s, 'guestAdultPrice')
    || Object.prototype.hasOwnProperty.call(s, 'guestChildPrice');
  const clean = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 0) return String(n);
    return String(v);
  };
  let ap = clean(s.guestAdultPrice);
  let cp = clean(s.guestChildPrice);
  let total = clean(s.guestQuote);
  if (!hasSplitKeys && total !== '' && Number(total) > 0) {
    const unit = Number(total);
    ap = String(unit);
    cp = String(unit);
    const auto = quote.calcGuestTotal(unit, unit, a, c);
    total = auto > 0 ? String(auto) : '';
  } else if (total === '' && (ap !== '' || cp !== '')) {
    const auto = quote.calcGuestTotal(ap, cp, a, c);
    total = auto > 0 ? String(auto) : '';
  }
  return { guestAdultPrice: ap, guestChildPrice: cp, guestQuote: total };
}

Page(share.install({
  data: {
    c: copy.customPreview,
    d: copy.detail,
    days: 3,
    date: '',
    adults: '',
    children: '',
    heroTiles: [],
    dayList: [],
    heroTitle: '',
    fromList: false,
    editingId: '',
    infoTags: [],
    overallTips: [],
    cover: '',
    guestName: '',
    guestAdultPrice: '',
    guestChildPrice: '',
    guestQuote: '',
    guestQuoteText: '',
    guestTotalText: '',
    guestTotalNote: '',
    isStaff: false,
    internalView: null,
    clauses: clause.emptyClauses(),
    travelView: clause.view(),
    carUseKnown: false,
    carUseCustom: false,
    carUseOffsets: null
  },

  onLoad(query) {
    query = query || {};
    let base = null;
    let fromList = false;
    const editingId = query.edit ? decodeURIComponent(query.edit) : '';
    if (query.trip) {
      const trips = wx.getStorageSync('myTrips') || [];
      base = trips.filter(t => t.id === query.trip)[0] || null;
      fromList = true;
    }
    const saved = wx.getStorageSync('lastCustomPlan') || {};
    const days = Math.min(MAX_DAYS, Math.max(1, parseInt(query.days, 10) || (base && base.days) || saved.days || 3));
    const plans = (((base && base.plans) || (saved.plans || [])).slice()).slice(0, days);
    while (plans.length < days) plans.push({ scenicIds: [], hotelId: '', altHotelIds: [], note: '', roomType: '', roomQty: 1, promoImgs: [] });
    const date = query.date ? decodeURIComponent(query.date) : (base && base.date) || '';
    let adults = 2;
    let children = 0;
    if (query.adults !== undefined && query.adults !== '') adults = query.adults;
    else if (base && base.adults !== undefined && base.adults !== '') adults = base.adults;
    else if (!fromList && saved.adults !== undefined && saved.adults !== '') adults = saved.adults;
    if (query.children !== undefined && query.children !== '') children = query.children;
    else if (base && base.children !== undefined && base.children !== '') children = base.children;
    else if (!fromList && saved.children !== undefined && saved.children !== '') children = saved.children;
    const cover = (base && base.cover) || (!fromList && saved.cover) || '';
    const guestName = (base && base.guestName) || (!fromList && saved.guestName) || '';
    const priceSrc = (base && (base.guestAdultPrice != null || base.guestChildPrice != null || base.guestQuote != null))
      ? base
      : ((!fromList && saved) ? saved : {});
    const guestPrices = normalizeGuestPriceFields(priceSrc, adults, children);
    const guestAdultPrice = guestPrices.guestAdultPrice;
    const guestChildPrice = guestPrices.guestChildPrice;
    const guestQuote = guestPrices.guestQuote;
    const guestPrice = quote.guestTotalView({
      adultPrice: guestAdultPrice,
      childPrice: guestChildPrice,
      adults,
      children,
      total: guestQuote
    }) || {};
    const scenicMap = plansScenicMap(this._plans);
    const hotelMap = plansHotelMap(this._plans);
    const clauses = clause.normalizeClauses((base && base.clauses) || (!fromList && saved.clauses) || null);
    const audience = (base && base.audience) || (!fromList && saved.audience) || '';
    const pace = (base && base.pace) || (!fromList && saved.pace) || '';
    const heroTitle = quote.shareTitle({
      days,
      guestName,
      place: quote.tripPlace(plans, plansScenicMap(plans), plansHotelMap(plans))
    });
    const carUse = carUseState(base) || (!fromList ? carUseState(saved) : null) || { carUseKnown: false, carUseCustom: false, carUseOffsets: null };
    this._plans = plans;
    this.setData({
      days,
      date,
      adults,
      children,
      cover,
      carId: (base && base.carId) || (!fromList && saved.carId) || '',
      carUseKnown: carUse.carUseKnown,
      carUseCustom: carUse.carUseCustom,
      carUseOffsets: carUse.carUseOffsets,
      guestName,
      guestAdultPrice,
      guestChildPrice,
      guestQuote,
      guestQuoteText: quote.guestQuoteText({ adultPrice: guestAdultPrice, childPrice: guestChildPrice, total: guestQuote }),
      guestTotalText: guestPrice.totalText || '',
      guestTotalNote: guestPrice.note || '',
      heroTiles: this.buildHero(plans),
      dayList: plans.map((p, i) => this.buildDay(p, i, days)),
      heroTitle,
      fromList,
      editingId: fromList ? (query.trip || '') : editingId,
      audience,
      pace,
      clauses,
      travelView: clause.view(clauses),
      infoTags: buildInfo(days, monthFromDate(date), audience, pace),
      overallTips: buildOverallTips(plans),
      isStaff: false,
      internalView: null
    });
    this.refreshQuote();
    if (query.trip && !base) this.loadShared(query.trip);
    else this.fillMissingSnaps(this._plans).then(ps => {
      this._plans = ps;
      this.setData({ heroTiles: this.buildHero(ps), dayList: ps.map((p, i) => this.buildDay(p, i, this.data.days)), overallTips: buildOverallTips(ps) });
    }).catch(() => {});
    // 私人定制生成后直接进入预览：自动存入「我的行程」（本地 + 云端），避免用户未点保存导致列表为空
    if (!query.trip && !fromList) this.saveToMine({ silent: true });
  },

  async loadShared(id) {
    let trip = null;
    try { trip = await api.getPublicTrip(id); } catch (e) { trip = null; }
    if (!trip || !trip.id) return;
    this._shareReadyId = trip.id;
    const plans = (Array.isArray(trip.plans) ? trip.plans : []).slice();
    const days = Math.min(MAX_DAYS, Math.max(1, parseInt(trip.days, 10) || plans.length || 1));
    while (plans.length < days) plans.push({ scenicIds: [], hotelId: '', altHotelIds: [], note: '', roomType: '', roomQty: 1, promoImgs: [] });
    this._plans = await this.fillMissingSnaps(plans.slice(0, days));
    const scenicMap = plansScenicMap(this._plans);
    const hotelMap = plansHotelMap(this._plans);
    const guestName = trip.guestName || '';
    const adultsN = trip.adults != null ? trip.adults : 2;
    const childrenN = trip.children != null ? trip.children : 0;
    const guestPrices = normalizeGuestPriceFields(trip, adultsN, childrenN);
    const guestPrice = quote.guestTotalView({
      adultPrice: guestPrices.guestAdultPrice,
      childPrice: guestPrices.guestChildPrice,
      adults: adultsN,
      children: childrenN,
      total: guestPrices.guestQuote
    }) || {};
    const carUse = carUseState(trip) || { carUseKnown: false, carUseCustom: false, carUseOffsets: null };
    this.setData({
      days,
      date: trip.date || '',
      adults: adultsN,
      children: childrenN,
      cover: trip.cover || '',
      carId: trip.carId || '',
      carUseKnown: carUse.carUseKnown,
      carUseCustom: carUse.carUseCustom,
      carUseOffsets: carUse.carUseOffsets,
      guestName,
      guestAdultPrice: guestPrices.guestAdultPrice,
      guestChildPrice: guestPrices.guestChildPrice,
      guestQuote: guestPrices.guestQuote,
      guestQuoteText: quote.guestQuoteText({ adultPrice: guestPrices.guestAdultPrice, childPrice: guestPrices.guestChildPrice, total: guestPrices.guestQuote }),
      guestTotalText: guestPrice.totalText || '',
      guestTotalNote: guestPrice.note || '',
      heroTitle: quote.shareTitle({ days, guestName, place: quote.tripPlace(this._plans, scenicMap, hotelMap) }),
      heroTiles: this.buildHero(this._plans),
      dayList: this._plans.map((p, i) => this.buildDay(p, i, days)),
      fromList: true,
      editingId: trip.id,
      audience: trip.audience || '',
      pace: trip.pace || '',
      clauses: clause.normalizeClauses(trip.clauses),
      travelView: clause.view(trip.clauses),
      infoTags: buildInfo(days, monthFromDate(trip.date || ''), trip.audience, trip.pace),
      overallTips: buildOverallTips(this._plans),
      isStaff: false,
      internalView: null
    });
  },

  // old trips saved without snaps: resolve cloud scenic/hotel ids from cloud lists
  async fillMissingSnaps(plans) {
    const needS = plans.some(p => (p.scenicIds || []).some(id => !snapScenic(p, id)));
    const needH = plans.some(p => [p.hotelId].concat((p.hotelBookings || []).map(b => b && b.hotelId), p.altHotelIds || []).filter(Boolean).some(id => !snapHotel(p, id)));
    if (!needS && !needH) return plans;
    let scenics = [];
    let hotels = [];
    try { if (needS) scenics = await this.loadRawScenics(); } catch (e) { scenics = []; }
    try { if (needH) hotels = (await api.hotels()) || []; } catch (e) { hotels = []; }
    const sById = {}; (scenics || []).forEach(s => { if (s && s.id) sById[s.id] = s; });
    const hById = {}; (hotels || []).forEach(h => { if (h && h.id) hById[h.id] = h; });
    return plans.map(p => {
      const ss = ((p.scenicSnaps) || []).slice();
      (p.scenicIds || []).forEach(id => { if (!snapScenic(p, id) && sById[id]) { const s = sById[id]; ss.push({ id, name: s.name || '', cover: s.cover || s.image || s.img || '', dest: s.dest || '', tips: s.tips || [] }); } });
      const hs = ((p.hotelSnaps) || []).slice();
      [p.hotelId].concat((p.hotelBookings || []).map(b => b && b.hotelId), p.altHotelIds || []).filter(Boolean).forEach(id => { if (!snapHotel(p, id) && hById[id] && !hs.some(x => x && x.id === id)) { const h = hById[id]; hs.push({ id, name: h.name || '', image: h.image || h.cover || h.img || '', stars: h.stars || '', area: h.area || '' }); } });
      return Object.assign({}, p, { scenicSnaps: ss, hotelSnaps: hs });
    });
  },

  draftBody() {
    const body = {
      id: this.data.editingId || '',
      days: this.data.days,
      date: this.data.date,
      adults: this.data.adults,
      children: this.data.children,
      cover: this.data.cover,
      carId: this.data.carId || '',
      guestName: this.data.guestName || '',
      guestAdultPrice: this.data.guestAdultPrice || '',
      guestChildPrice: this.data.guestChildPrice || '',
      guestQuote: this.data.guestQuote || '',
      audience: this.data.audience || '',
      pace: this.data.pace || '',
      clauses: clause.normalizeClauses(this.data.clauses),
      plans: this._plans,
      quote: (this.data.isStaff && this.data.internalView) ? {
        hotel: this.data.internalView.hotel || 0,
        ticket: this.data.internalView.ticket || 0,
        total: this.data.internalView.total || 0
      } : undefined
    };
    if (this.data.carUseKnown) {
      const packed = quote.packCarUse(this.data.carUseCustom, this.data.carUseOffsets);
      body.carUseCustom = packed.carUseCustom;
      body.carUseOffsets = packed.carUseOffsets;
    }
    return body;
  },

  goEdit() {
    const draft = this.draftBody();
    wx.setStorageSync('lastCustomPlan', draft);
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const prev = pages.length > 1 ? pages[pages.length - 2] : null;
    const route = (prev && (prev.route || prev.__route__)) || '';
    if (route.indexOf('pages/custom/custom') >= 0 && prev && typeof prev.prefillTrip === 'function') {
      prev.prefillTrip(draft);
      wx.navigateBack();
      return;
    }
    if (draft.id) {
      const trips = wx.getStorageSync('myTrips') || [];
      const idx = trips.findIndex(t => t.id === draft.id);
      const row = Object.assign({}, draft, { title: this.data.heroTitle });
      if (idx > -1) trips[idx] = Object.assign({}, trips[idx], row);
      else trips.unshift(row);
      wx.setStorageSync('myTrips', trips);
      wx.navigateTo({ url: '/pages/custom/custom?edit=' + encodeURIComponent(draft.id) });
      return;
    }
    wx.navigateTo({ url: '/pages/custom/custom?draft=1' });
  },

  async refreshQuote() {
    let idn = null;
    try { idn = await wb.identity(); } catch (e) { idn = null; }
    if (!idn || !idn.isStaff) {
      this.setData({ isStaff: false, internalView: null });
      return;
    }
    const [hotels, scenics, priceList] = await Promise.all([
      api.hotels(),
      this.loadRawScenics(),
      this.loadHotelPrices((this._plans || []).reduce((a, p) => a.concat(quote.bookingsOf(p).map(b => b.hotelId)), []).filter((x, k, a) => x && a.indexOf(x) === k))
    ]);
    const hotelPricesById = {};
    (priceList || []).forEach(p => {
      if (!p || !p.hotelId) return;
      (hotelPricesById[p.hotelId] = hotelPricesById[p.hotelId] || []).push(p);
    });
    const calcHotelsById = hotelsByIdFrom(data.hotels);
    (hotels || []).forEach(h => {
      if (h && h.id) calcHotelsById[h.id] = Object.assign({}, h, { prices: hotelPricesById[h.id] || h.prices || [] });
    });
    const calcScenicsById = {};
    (scenics || []).forEach(s => { if (s && s.id) calcScenicsById[s.id] = s; });
    const plans = (this._plans || []).map((p, i) => Object.assign({}, p, {
      checkinDate: quote.addDays(this.data.date, i)
    }));
    const internal = quote.calcQuote({
      plans,
      hotelsById: calcHotelsById,
      hotelPricesById,
      scenicsById: calcScenicsById,
      departDate: this.data.date,
      adults: parseInt(this.data.adults, 10) || 0, /* ticketSplit */
      children: parseInt(this.data.children, 10) || 0,
      people: (parseInt(this.data.adults, 10) || 0) + (parseInt(this.data.children, 10) || 0),
      carCost: 0
    });
    this.setData({
      isStaff: true,
      internalView: quote.annotateQuote(internal, this.data.adults, this.data.children)
    });
  },

  async loadRawScenics() {
    const res = await cloud.callFunction('scenicCRUD', { action: 'list' });
    if (res && res.code === 200 && Array.isArray(res.data)) return res.data.filter(s => s && s.online !== false);
    return [];
  },

  async loadHotelPrices(ids) {
    if (!ids || !ids.length) return [];
    try {
      /* 逐个酒店按 id 取档期（每家仅几十条，远低于 callFunction 1MB 上限；兼容未部署的旧云函数） */
      const list = await Promise.all((ids || []).map(id => cloud.callFunction('hotelCRUD', { action: 'listPrices', id })
        .then(res => (res && res.code === 200 && Array.isArray(res.data)) ? res.data : Promise.reject(new Error((res && res.msg) || 'listPrices failed')))));
      return [].concat.apply([], list);
    } catch (e) { return []; }
  },

  onRight() {
    if (this.data.fromList) this.goEdit();
    else this.saveToMine();
  },

  buildHero(plans) {
    const seen = [];
    plans.forEach(p => {
      (p.scenicIds || []).forEach(id => {
        if (seen.length >= MAX_TILES || seen.some(t => t.id === id)) return;
        const s = snapScenic(p, id);
        if (s) seen.push({ id, img: s.cover, name: s.name });
      });
    });
    while (seen.length < MAX_TILES) seen.push({ id: 'empty' + seen.length, img: '', name: '' });
    return seen;
  },

  buildDay(p, i, days) {
    const pkgMap = {};
    (p.packageSelections || []).forEach(g => { if (g && g.scenicId) pkgMap[g.scenicId] = g.items || []; });
    const scenics = (p.scenicIds || []).map(id => snapScenic(p, id)).filter(Boolean).map(s => {
      const items = pkgMap[s.id] || s.packages || [];
      const pkgNames = (items || []).map(it => (it && it.name) || '').filter(Boolean).join('、');
      return { id: s.id, name: s.name, img: s.cover, dest: s.dest, pkgNames: pkgNames };
    });
    let hotel = null;
    if (p.hotelId) {
      const h = snapHotel(p, p.hotelId);
      if (h) {
        const alts = (p.altHotelIds || []).map(id => snapHotel(p, id)).filter(Boolean).map(x => x.name);
        const roomType = p.roomType || '';
        const qty = Math.max(1, parseInt(p.roomQty, 10) || 1);
        const bookings = quote.bookingsOf(p).map(b => { const bh = snapHotel(p, b.hotelId); return { name: bh ? bh.name : '', roomType: b.roomType || '', qty: b.roomQty }; });
        hotel = { id: h.id, name: h.name, img: h.image, meta: h.stars + ' · ' + h.area, alts, roomType, qty, bookings: bookings.length > 1 ? bookings : [] };
      }
    }
    const scene = scenics.length ? scenics[0].name : copy.customPreview.noScenic;
    return {
      index: i,
      line: (i + 1) + copy.customPreview.dayUnit,
      scene,
      scenics,
      hotel,
      note: p.note || '',
      promos: gallery.clipPromo(p.promoImgs)
    };
  },

  goScenic(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  },

  goHotel(e) {
    wx.navigateTo({ url: '/pages/hotel-detail/hotel-detail?id=' + e.currentTarget.dataset.id });
  },

  saveToMine(opts) {
    const silent = !!(opts && opts.silent === true);
    if (this._saving) return;
    this._saving = true;
    try {
    const days = this.data.days;
    const title = this.data.heroTitle || quote.shareTitle({ days, guestName: this.data.guestName });
    let cover = this.data.cover || (this.data.heroTiles[0] && this.data.heroTiles[0].img);
    if (!cover) cover = ph('我的专属呼伦贝尔 ' + days + '日行程', 640, 420);
    const id = this.data.editingId || ('trip' + Date.now());
    if (!this.data.editingId) this.setData({ editingId: id });
    const trip = {
      id,
      title,
      days,
      date: this.data.date,
      adults: this.data.adults,
      children: this.data.children,
      guestName: this.data.guestName || '',
      guestAdultPrice: Number(this.data.guestAdultPrice) || 0,
      guestChildPrice: Number(this.data.guestChildPrice) || 0,
      guestQuote: Number(this.data.guestQuote) || 0,
      audience: this.data.audience || '',
      pace: this.data.pace || '',
      clauses: clause.normalizeClauses(this.data.clauses),
      cover,
      carId: this.data.carId || '',
      quote: (this.data.isStaff && this.data.internalView) ? {
        hotel: this.data.internalView.hotel || 0,
        ticket: this.data.internalView.ticket || 0,
        total: this.data.internalView.total || 0
      } : { hotel: 0, ticket: 0, total: 0 },
      heroTitle: this.data.heroTitle,
      plans: this._plans.map(p => ({
        scenicIds: (p.scenicIds || []).slice(),
        hotelId: p.hotelId || '',
        altHotelIds: Array.isArray(p.altHotelIds) ? p.altHotelIds.slice() : [],
        note: p.note || '',
        roomType: p.roomType || '',
        roomQty: Math.max(1, parseInt(p.roomQty, 10) || 1),
        hotelBookings: quote.bookingsOf(p),
        promoImgs: gallery.clipPromo(p.promoImgs),
        scenicSnaps: (Array.isArray(p.scenicSnaps) ? p.scenicSnaps : []).filter(x => x && x.id).slice(0, 20),
        hotelSnaps: (Array.isArray(p.hotelSnaps) ? p.hotelSnaps : []).filter(x => x && x.id).slice(0, 10)
      })),
      savedAt: TIME_STAMP
    };
    if (this.data.carUseKnown) {
      const packed = quote.packCarUse(this.data.carUseCustom, this.data.carUseOffsets);
      trip.carUseCustom = packed.carUseCustom;
      trip.carUseOffsets = packed.carUseOffsets;
    }
    const trips = wx.getStorageSync('myTrips') || [];
    const idx = trips.findIndex(t => t.id === trip.id);
    const existed = idx > -1;
    if (existed) trips[idx] = trip;
    else trips.unshift(trip);
    wx.setStorageSync('myTrips', trips);
    const savedId = trip.id;
    api.saveTrip(trip).then(ok => {
      if (ok && savedId) this._shareReadyId = savedId;
    }).catch(() => {});
    if (!silent) wx.showToast({ title: existed ? copy.customPreview.saveUpdated : copy.customPreview.saveSuccess, icon: 'none' });
    } finally {
      this._saving = false;
    }
  }
}));