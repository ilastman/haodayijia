const copy = require('../../utils/copy');
const api = require('../../utils/api');
const quote = require('../../utils/quote');
const { ph } = require('../../utils/util');
const workbench = require('../../utils/workbench');

Page({
  data: {
    c: copy.myTrips,
    list: [],
    showEmpty: false,
    delVisible: false,
    delId: '',
    isStaff: false
  },

  onShow() {
    this.reload(wx.getStorageSync('myTrips') || []);
    this.setData({ delVisible: false, delId: '' });
    if (!this._cloudLoaded) this.loadCloud();
    this.checkStaff();
  },

  async checkStaff() {
    try {
      const me = await workbench.identity();
      const isStaff = !!(me && me.isStaff === true);
      if (isStaff !== this.data.isStaff) this.setData({ isStaff });
    } catch (e) { /* 非员工 */ }
  },

  // 云端行程：合并进本地列表（缺失的写入本地，保证详情可打开）
  async loadCloud() {
    try {
      const cloudTrips = await api.myTrips();
      this._cloudLoaded = true;
      if (!cloudTrips || !cloudTrips.length) return;
      const local = wx.getStorageSync('myTrips') || [];
      const ids = local.map(t => t.id);
      const deleted = wx.getStorageSync('myTripsDeleted') || [];
      const missing = cloudTrips.filter(t => ids.indexOf(t.id) < 0 && deleted.indexOf(t.id) < 0);
      // retry cloud delete for tombstoned trips still present in cloud
      cloudTrips.filter(t => deleted.indexOf(t.id) > -1).forEach(t => this.removeCloud(t.id));
      /* 云端员工备注回填本地（本地无备注时） */
      let touched = false;
      local.forEach(t => {
        const ct = cloudTrips.filter(x => x.id === t.id)[0];
        if (!ct) return;
        if (ct.staffRemark && !t.staffRemark) { t.staffRemark = ct.staffRemark; touched = true; }
        /* 本地旧缓存没有计费日时，用云端删减补上 */
        if (quote.carryMissingCarUse(t, ct)) touched = true;
      });
      if (touched && !missing.length) { wx.setStorageSync('myTrips', local); this.reload(local); }
      if (missing.length) {
        const merged = missing.concat(local);
        wx.setStorageSync('myTrips', merged);
        this.reload(merged);
      }
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  reload(trips) {
    const safe = (Array.isArray(trips) ? trips : []).filter(t => t && typeof t === 'object' && t.id);
    const list = safe.map(t => {
      let scenic = 0;
      let hotel = 0;
      (Array.isArray(t.plans) ? t.plans : []).forEach(p => {
        if (!p) return;
        scenic += (Array.isArray(p.scenicIds) ? p.scenicIds : []).length;
        if (p.hotelId) hotel += 1;
      });
      const brief = [];
      if (t.date) brief.push(t.date);
      brief.push(scenic + ' 个景区 · ' + hotel + ' 家酒店');
      return {
        id: t.id,
        cover: t.cover || ph(t.title || '我的专属行程', 640, 420),
        name: t.title || ('我的专属呼伦贝尔' + (t.days || 3) + '日行程'),
        guestQuoteText: (function () {
          const ap = Number(t.guestAdultPrice) || 0;
          const cp = Number(t.guestChildPrice) || 0;
          const total = Number(t.guestQuote) || 0;
          const parts = [];
          if (ap > 0) parts.push('成人¥' + ap);
          if (cp > 0) parts.push('儿童¥' + cp);
          if (total > 0) parts.push('总¥' + total);
          else if (!parts.length && total > 0) parts.push('¥' + total);
          /* 旧版仅有每人价 */
          if (!ap && !cp && total > 0 && !Object.prototype.hasOwnProperty.call(t, 'guestAdultPrice')) {
            return '¥' + total + '/人';
          }
          return parts.join(' · ');
        })(),
        daysText: (t.days || 3) + copy.myTrips.daysUnit,
        brief: brief.join(' · '),
        staffRemark: t.staffRemark || '',
        open: false
      };
    });
    this.setData({ list, showEmpty: list.length === 0 });
  },

  goTrip(e) {
    wx.navigateTo({ url: '/pages/custom-preview/custom-preview?trip=' + e.currentTarget.dataset.id });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/custom/custom' });
  },

  point(e) {
    const t = e && (e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0]);
    return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 };
  },

  onSwipeStart(e) {
    const p = this.point(e);
    this._sw = { id: e.currentTarget.dataset.id, x: p.x, y: p.y, dir: 0 };
  },

  onSwipeMove(e) {
    if (!this._sw) return;
    const p = this.point(e);
    const dx = p.x - this._sw.x;
    const dy = p.y - this._sw.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      this._sw.dir = dx;
      this.setOpen(this._sw.id, dx < -40);
    }
  },

  onSwipeEnd() {
    this._sw = null;
  },

  setOpen(id, open) {
    const list = this.data.list.map(it => {
      const o = it.id === id ? open : false;
      return it.open === o ? it : Object.assign({}, it, { open: o });
    });
    this.setData({ list });
  },

  onLongPress(e) {
    this.openDel(e.currentTarget.dataset.id);
  },

  onDeleteTap(e) {
    this.openDel(e.currentTarget.dataset.id);
  },

  openDel(id) {
    this.setData({ delVisible: true, delId: id });
  },

  noop() {},

  /* 员工备注：失焦/完成即保存（本地 + 云端） */
  onRemarkInput(e) {
    const id = e.currentTarget.dataset.id;
    const v = e.detail.value;
    (this._remarkDraft || (this._remarkDraft = {}))[id] = v;
  },

  async onRemarkSave(e) {
    if (!this.data.isStaff) return;
    const id = e.currentTarget.dataset.id;
    const remark = String(e.detail.value != null ? e.detail.value : ((this._remarkDraft || {})[id] || '')).slice(0, 500);
    const local = wx.getStorageSync('myTrips') || [];
    const t = local.filter(x => x && x.id === id)[0];
    if (!t || (t.staffRemark || '') === remark) return;
    t.staffRemark = remark;
    wx.setStorageSync('myTrips', local);
    this.setData({ list: this.data.list.map(it => it.id === id ? Object.assign({}, it, { staffRemark: remark }) : it) });
    let code = await api.setTripRemark(id, remark);
    if (code === 404) { const ok = await api.saveTrip(t).catch(() => false); code = ok ? 200 : 0; }
    wx.showToast({ title: code === 200 ? copy.myTrips.remarkSaved : copy.myTrips.remarkFail, icon: 'none' });
  },

  onCancelDel() {
    this.setData({ delVisible: false, delId: '' });
    this.setOpen('', false);
  },

  onConfirmDel() {
    const id = this.data.delId;
    const left = (wx.getStorageSync('myTrips') || []).filter(t => t.id !== id);
    wx.setStorageSync('myTrips', left);
    // tombstone: keep cloud merge from resurrecting it even if cloud delete fails
    const deleted = wx.getStorageSync('myTripsDeleted') || [];
    if (id && deleted.indexOf(id) < 0) { deleted.push(id); wx.setStorageSync('myTripsDeleted', deleted.slice(-200)); }
    this.setData({ delVisible: false, delId: '' });
    this.reload(left);
    this.removeCloud(id);
  },

  async removeCloud(id) {
    if (!id) return;
    const ok = await api.removeTrip(id);
    if (ok) {
      const d = (wx.getStorageSync('myTripsDeleted') || []).filter(x => x !== id);
      wx.setStorageSync('myTripsDeleted', d);
    }
  }
});
