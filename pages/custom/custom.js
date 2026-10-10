const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { isValidPhone, addConsultRecord } = require('../../utils/util');

const MAX_DAYS = 15;
const MIN_DAYS = 1;
const ITEM_H = 58;

function emptyPlan() {
  return { scenicIds: [], hotelId: '', note: '' };
}

function buildPlans(n) {
  const plans = [];
  for (let i = 0; i < n; i++) plans.push(emptyPlan());
  return plans;
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
    editingTripId: ''
  },

  onLoad(query) {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    this.setData({ minDate: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) });
    if (query && query.edit) {
      const trips = wx.getStorageSync('myTrips') || [];
      const t = trips.filter(x => x.id === decodeURIComponent(query.edit))[0];
      if (t) this.prefillTrip(t);
    } else if (query && query.shareId) {
      const share = data.getShare(query.shareId);
      if (share) this.prefillShare(share);
    }
  },

  prefillTrip(t) {
    const max = Math.min(MAX_DAYS, Math.max(MIN_DAYS, parseInt(t.days, 10) || 3));
    const plans = (t.plans || []).slice(0, max).map(p => ({
      scenicIds: (p.scenicIds || []).slice(),
      hotelId: p.hotelId || '',
      note: p.note || ''
    }));
    while (plans.length < max) plans.push(emptyPlan());
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
      editingTripId: t.id
    });
    this.rebuildTabs();
    this.syncPlan();
  },

  prefillShare(share) {
    const max = Math.min(MAX_DAYS, share.days || 3);
    const plans = (share.timeline || []).slice(0, max).map(t => ({
      scenicIds: (t.scenicIds || []).slice(),
      hotelId: t.hotelId || '',
      note: t.note || ''
    }));
    while (plans.length < max) plans.push(emptyPlan());
    this.setData({ days: max, plans, activeDay: 0 });
    this.rebuildTabs();
    this.syncPlan();
  },

  savePlan() {
    wx.setStorageSync('lastCustomPlan', {
      days: this.data.days,
      plans: this.data.plans.map(p => ({
        scenicIds: (p.scenicIds || []).slice(),
        hotelId: p.hotelId || '',
        note: p.note || ''
      })),
      customActive: !!this.data.customActive
    });
  },

  goPublish() {
    this.savePlan();
    wx.navigateTo({ url: '/pages/share-publish/share-publish?from=custom' });
  },

  goGenerate() {
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
    if (n === this.data.days) {
      this.rebuildTabs();
      return;
    }
    const plans = this.data.plans.slice(0, n);
    while (plans.length < n) plans.push(emptyPlan());
    const activeDay = Math.min(this.data.activeDay, n - 1);
    this.setData({ days: n, plans, activeDay });
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
  },

  onAdult(e) {
    const next = this.data.adults + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 1 || next > 99) return;
    this.setData({ adults: next });
  },

  onChild(e) {
    const next = this.data.children + (String(e.currentTarget.dataset.d) === '+' ? 1 : -1);
    if (next < 0 || next > 20) return;
    this.setData({ children: next });
  },

  /* ---------- 每日切换 ---------- */

  onDay(e) {
    this.setData({ activeDay: Number(e.currentTarget.dataset.index) });
    this.syncPlan();
  },

  /* ---------- 自动同步 ---------- */

  syncPlan() {
    const plan = this.data.plans[this.data.activeDay];
    const curScenics = (plan.scenicIds || []).map(data.getScenic).filter(Boolean);
    const curHotel = data.hotels.filter(h => h.id === plan.hotelId)[0] || null;
    let totalScenic = 0;
    let totalHotel = 0;
    this.data.plans.forEach(p => {
      if (p && p.scenicIds) totalScenic += p.scenicIds.length;
      if (p && p.hotelId) totalHotel += 1;
    });
    this.setData({
      curScenics,
      curHotel,
      curNote: plan.note || '',
      totalScenic,
      totalHotel
    });
  },

  scenicOptions() {
    const plan = this.data.plans[this.data.activeDay];
    const ids = plan.scenicIds || [];
    return data.scenics.map(s => Object.assign({}, s, { sel: ids.indexOf(s.id) > -1 }));
  },

  hotelOptions() {
    const plan = this.data.plans[this.data.activeDay];
    return data.hotels.map(h => Object.assign({}, h, { sel: h.id === plan.hotelId }));
  },

  /* ---------- 景区选择 ---------- */

  openScenic() {
    this.setData({ sheet: { type: 'scenic' }, sheetScenics: this.scenicOptions() });
  },

  toggleScenic(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.activeDay;
    const ids = this.data.plans[idx].scenicIds.slice();
    const pos = ids.indexOf(id);
    if (pos > -1) ids.splice(pos, 1);
    else ids.push(id);
    this.setData({ ['plans.' + idx + '.scenicIds']: ids });
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
    const plan = this.data.plans[idx];
    const next = plan.hotelId === id ? '' : id;
    this.setData({ ['plans.' + idx + '.hotelId']: next });
    this.syncPlan();
    this.setData({ sheetHotels: this.hotelOptions() });
  },

  clearHotel() {
    const idx = this.data.activeDay;
    this.setData({ ['plans.' + idx + '.hotelId']: '' });
    this.syncPlan();
  },

  /* ---------- 已选景区排序 ---------- */

  moveSel(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const dir = Number(e.currentTarget.dataset.dir);
    const ids = this.data.plans[this.data.activeDay].scenicIds.slice();
    const to = idx + dir;
    if (to < 0 || to >= ids.length) return;
    const t = ids[idx];
    ids[idx] = ids[to];
    ids[to] = t;
    this.setData({ ['plans.' + this.data.activeDay + '.scenicIds']: ids });
    this.syncPlan();
  },

  removeScenic(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const ids = this.data.plans[this.data.activeDay].scenicIds.slice();
    ids.splice(idx, 1);
    this.setData({ ['plans.' + this.data.activeDay + '.scenicIds']: ids });
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
    const ids = this.data.plans[this.data.activeDay].scenicIds.slice();
    const newIdx = Math.max(0, Math.min(ids.length - 1, d.idx + Math.round((y - d.startY) / ITEM_H)));
    if (newIdx !== d.idx) {
      const moved = ids.splice(d.idx, 1)[0];
      ids.splice(newIdx, 0, moved);
      d.idx = newIdx;
      d.startY = y;
      this.setData({
        ['plans.' + this.data.activeDay + '.scenicIds']: ids,
        dragging: newIdx
      });
      this.syncPlan();
    }
  },

  dragEnd() {
    this._drag = null;
    this.setData({ dragging: -1 });
  },

  /* ---------- 备注 ---------- */

  onNote(e) {
    const idx = this.data.activeDay;
    this.setData({ ['plans.' + idx + '.note']: e.detail.value });
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
    const { form, date, adults, children, plans, customActive, days, c } = this.data;
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
        if (h) parts.push('宿:' + h.name);
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