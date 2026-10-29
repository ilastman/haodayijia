const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const cloud = require('../../utils/cloud');
const wb = require('../../utils/workbench');
const quote = require('../../utils/quote');
const gallery = require('../../utils/gallery');
const { isValidPhone, addConsultRecord, ph } = require('../../utils/util');

const MAX_DAYS = 15;
const MIN_DAYS = 1;
const ITEM_H = 58;

function emptyPlan() {
  return { scenicIds: [], hotelId: '', altHotelIds: [], note: '', roomType: '', roomQty: 1, promoImgs: [] };
}

function buildPlans(n) {
  const plans = [];
  for (let i = 0; i < n; i++) plans.push(emptyPlan());
  return plans;
}

function normalizePlans(v, days) {
  const n = Math.max(MIN_DAYS, parseInt(days, 10) || 3);
  const src = Array.isArray(v) ? v : [];
  const out = src.slice(0, n).map(p => ({
    scenicIds: (p && Array.isArray(p.scenicIds) ? p.scenicIds : []).slice(),
    hotelId: (p && p.hotelId) || '',
    altHotelIds: (p && Array.isArray(p.altHotelIds) ? p.altHotelIds : []).slice(),
    note: (p && p.note) || '',
    roomType: (p && p.roomType) || '',
    roomQty: Math.max(1, parseInt(p && p.roomQty, 10) || 1),
    promoImgs: gallery.clipPromo(p && p.promoImgs)
  }));
  while (out.length < n) out.push(emptyPlan());
  return out;
}

Page({
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
    altHotels: [],
    curNote: '',
    totalScenic: 0,
    totalHotel: 0,
    dragging: -1,
    sheet: null,
    sheetScenics: [],
    sheetHotels: [],
    submitShow: false,
    successShow: false,
    form: { name: '', phone: '', wechat: '' },
    formError: '',
    editingTripId: '',
    cover: '',
    coverLib: [],
    promoLib: [],
    curPromo: [],

    /* 员工内部核价（仅员工可见） */
    isStaff: false,
    calcHotelsById: {},
    hotelPricesById: {},
    calcScenicsById: {},
    internalQuote: null,
    curRoomTypes: []
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
    this.loadGallery();
  },

  onShow() {
    this.loadGallery();
  },

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

  /* 员工身份识别：仅员工加载云端后台价并显示内部核价 */
  async initStaff() {
    let idn = null;
    try { idn = await wb.identity(); } catch (e) { idn = null; }
    if (!idn || !idn.isStaff) { this.setData({ isStaff: false }); return; }
    this.setData({ isStaff: true });
    const [hotels, scenics, priceList] = await Promise.all([api.hotels(), this.loadRawScenics(), this.loadHotelPrices()]);
    const hotelPricesById = {};
    (priceList || []).forEach(p => {
      if (!p || !p.hotelId) return;
      (hotelPricesById[p.hotelId] = hotelPricesById[p.hotelId] || []).push(p);
    });
    const calcHotelsById = {};
    (hotels || []).forEach(h => {
      if (h && h.id) calcHotelsById[h.id] = Object.assign({}, h, { prices: hotelPricesById[h.id] || [] });
    });
    const calcScenicsById = {};
    (scenics || []).forEach(s => { if (s && s.id) calcScenicsById[s.id] = s; });
    this.setData({ calcHotelsById, hotelPricesById, calcScenicsById });
    this.calcInternal();
    this.syncPlan();
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
  async loadHotelPrices() {
    const res = await cloud.callFunction('hotelCRUD', { action: 'listPrices' });
    if (res && res.code === 200 && Array.isArray(res.data)) return res.data;
    return [];
  },

  /* 计算内部核算价（仅员工）；每晚按入住日期匹配价格档期 */
  calcInternal() {
    if (!this.data.isStaff) return;
    const plans = this.data.plans.map((p, i) => Object.assign({}, p, {
      checkinDate: quote.addDays(this.data.date, i)
    }));
    const internalQuote = quote.calcQuote({
      plans,
      hotelsById: this.data.calcHotelsById,
      hotelPricesById: this.data.hotelPricesById,
      scenicsById: this.data.calcScenicsById,
      departDate: this.data.date,
      people: (parseInt(this.data.adults, 10) || 0) + (parseInt(this.data.children, 10) || 0),
      carCost: 0
    });
    this.setData({ internalQuote });
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
      cover: t.cover || ''
    });
    this.rebuildTabs();
    this.syncPlan();
  },

  prefillShare(share) {
    const max = Math.min(MAX_DAYS, share.days || 3);
    const plans = normalizePlans(share.timeline, max);
    this.setData({ days: max, plans, activeDay: 0 });
    this.rebuildTabs();
    this.syncPlan();
  },

  quoteSnapshot() {
    const q = this.data.internalQuote;
    if (q) return { hotel: q.hotel, ticket: q.ticket, total: q.total };
    const hotelsById = {};
    data.hotels.forEach(h => { if (h && h.id) hotelsById[h.id] = h; });
    const pub = quote.publicHotelQuote(this.data.plans, hotelsById);
    return { hotel: pub.hotel, ticket: 0, total: pub.total };
  },

  savePlan() {
    wx.setStorageSync('lastCustomPlan', {
      id: this.data.editingTripId || '',
      days: this.data.days,
      plans: normalizePlans(this.data.plans, this.data.days),
      customActive: !!this.data.customActive,
      date: this.data.date || '',
      adults: this.data.adults,
      children: this.data.children,
      cover: this.data.cover || '',
      quote: this.quoteSnapshot()
    });
  },

  goGenerate() {
    if (!this.data.cover) {
      wx.showToast({ title: this.data.c.coverMiss, icon: 'none' });
      return;
    }
    this.savePlan();
    const q = [
      'days=' + this.data.days,
      'date=' + encodeURIComponent(this.data.date || ''),
      'adults=' + this.data.adults,
      'children=' + this.data.children
    ];
    if (this.data.editingTripId) q.push('edit=' + encodeURIComponent(this.data.editingTripId));
    wx.navigateTo({ url: '/pages/custom-preview/custom-preview?' + q.join('&') });
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
    this.setData({ date: e.detail.value });
    this.syncPlan();
  },

  onAdult(e) {
    const next = this.data.adults + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 1 || next > 99) return;
    this.setData({ adults: next });
    this.calcInternal();
  },

  onChild(e) {
    const next = this.data.children + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 0 || next > 20) return;
    this.setData({ children: next });
    this.calcInternal();
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
    const curScenics = (plan.scenicIds || []).map(data.getScenic).filter(Boolean);
    const curHotel = data.hotels.filter(h => h.id === plan.hotelId)[0] || null;
    const altIds = Array.isArray(plan.altHotelIds) ? plan.altHotelIds : [];
    const altHotels = curHotel ? data.hotels
      .filter(h => h.id !== curHotel.id && h.stars === curHotel.stars)
      .map(h => ({ id: h.id, name: h.name, sel: altIds.indexOf(h.id) > -1 })) : [];
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
    this.setData({
      curScenics,
      curHotel,
      altHotels,
      curNote: plan.note || '',
      curPromo: gallery.clipPromo(plan.promoImgs),
      totalScenic,
      totalHotel,
      curRoomTypes
    });
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

  scenicOptions() {
    const plan = this.planAt(this.data.activeDay);
    const ids = plan.scenicIds || [];
    return data.scenics.map(s => Object.assign({}, s, { sel: ids.indexOf(s.id) > -1 }));
  },

  hotelOptions() {
    const plan = this.planAt(this.data.activeDay);
    return data.hotels.map(h => Object.assign({}, h, { sel: h.id === plan.hotelId }));
  },

  /* ---------- 景区选择 ---------- */

  openScenic() {
    this.setData({ sheet: { type: 'scenic' }, sheetScenics: this.scenicOptions() });
  },

  toggleScenic(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[idx].scenicIds;
    const pos = ids.indexOf(id);
    if (pos > -1) ids.splice(pos, 1);
    else ids.push(id);
    this.setData({ plans });
    this.syncPlan();
    this.setData({ sheetScenics: this.scenicOptions() });
  },

  /* ---------- 酒店选择 ---------- */

  openHotel() {
    this.setData({ sheet: { type: 'hotel' }, sheetHotels: this.hotelOptions() });
  },

  toggleHotel(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const cur = plans[idx].hotelId;
    plans[idx].hotelId = cur === id ? '' : id;
    plans[idx].altHotelIds = [];
    plans[idx].roomType = '';
    plans[idx].roomQty = 1;
    this.setData({ plans });
    this.syncPlan();
    this.setData({ sheetHotels: this.hotelOptions() });
  },

  toggleAlt(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[idx].altHotelIds;
    const pos = ids.indexOf(id);
    if (pos > -1) ids.splice(pos, 1);
    else ids.push(id);
    this.setData({ plans });
    this.syncPlan();
  },

  clearHotel() {
    const idx = this.data.activeDay;
    const plans = normalizePlans(this.data.plans, this.data.days);
    plans[idx].hotelId = '';
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
    plans[this.data.activeDay].scenicIds.splice(idx, 1);
    this.setData({ plans });
    this.syncPlan();
  },

  dragStart(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const t = (e.touches && e.touches[0]) || {};
    this._drag = { idx, startY: t.clientY || 0 };
    this.setData({ dragging: idx });
  },

  dragMove(e) {
    const d = this._drag;
    if (!d) return;
    const t = (e.touches && e.touches[0]) || {};
    const y = t.clientY;
    const plans = normalizePlans(this.data.plans, this.data.days);
    const ids = plans[this.data.activeDay].scenicIds;
    const newIdx = Math.max(0, Math.min(ids.length - 1, d.idx + Math.round((y - d.startY) / ITEM_H)));
    if (newIdx !== d.idx) {
      const moved = ids.splice(d.idx, 1)[0];
      ids.splice(newIdx, 0, moved);
      d.idx = newIdx;
      d.startY = y;
      this.setData({
        plans,
        dragging: newIdx
      });
      this.syncPlan();
    }
  },

  dragEnd() {
    this._drag = null;
    this.setData({ dragging: -1 });
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
    this.setData({ sheet: null });
  },

  openSubmit() {
    this.setData({ submitShow: true, formError: '' });
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
      const sc = (p.scenicIds || []).map(data.getScenic).filter(Boolean).map(s => s.name).join('、');
      const seg = '第' + (i + 1) + '天';
      const parts = [];
      if (sc) parts.push('景区:' + sc);
      if (p.hotelId) {
        const h = data.hotels.filter(x => x.id === p.hotelId)[0];
        if (h) {
          let hseg = '宿:' + h.name;
          const alts = (p.altHotelIds || []).map(id => data.hotels.filter(x => x.id === id)[0]).filter(Boolean).map(x => x.name);
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
      formError: ''
    });
    setTimeout(() => { this.setData({ successShow: false }); }, 2500);
  },

  closeSuccess() {
    this.setData({ successShow: false });
  }
});