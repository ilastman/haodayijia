const copy = require('../../utils/copy');
const api = require('../../utils/api');
const { ph } = require('../../utils/util');

Page({
  data: {
    c: copy.myTrips,
    list: [],
    showEmpty: false,
    delVisible: false,
    delId: ''
  },

  onShow() {
    this.reload(wx.getStorageSync('myTrips') || []);
    this.setData({ delVisible: false, delId: '' });
    if (!this._cloudLoaded) this.loadCloud();
  },

  // 云端行程：合并进本地列表（缺失的写入本地，保证详情可打开）
  async loadCloud() {
    try {
      const cloudTrips = await api.myTrips();
      this._cloudLoaded = true;
      if (!cloudTrips || !cloudTrips.length) return;
      const local = wx.getStorageSync('myTrips') || [];
      const ids = local.map(t => t.id);
      const missing = cloudTrips.filter(t => ids.indexOf(t.id) < 0);
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
    const list = trips.map(t => {
      let scenic = 0;
      let hotel = 0;
      (t.plans || []).forEach(p => {
        scenic += (p.scenicIds || []).length;
        if (p.hotelId) hotel += 1;
      });
      const brief = [];
      if (t.date) brief.push(t.date);
      brief.push(scenic + ' 个景区 · ' + hotel + ' 家酒店');
      return {
        id: t.id,
        cover: t.cover || ph(t.title || '我的专属行程', 640, 420),
        name: t.title || ('我的专属呼伦贝尔' + (t.days || 3) + '日行程'),
        guestQuoteText: (Number(t.guestQuote) > 0) ? ('¥' + Number(t.guestQuote) + '/人') : '',
        daysText: (t.days || 3) + copy.myTrips.daysUnit,
        brief: brief.join(' · '),
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

  onCancelDel() {
    this.setData({ delVisible: false, delId: '' });
    this.setOpen('', false);
  },

  onConfirmDel() {
    const id = this.data.delId;
    const left = (wx.getStorageSync('myTrips') || []).filter(t => t.id !== id);
    wx.setStorageSync('myTrips', left);
    this.setData({ delVisible: false, delId: '' });
    this.reload(left);
  }
});
