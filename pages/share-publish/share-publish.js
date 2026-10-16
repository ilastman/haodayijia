const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const { ph } = require('../../utils/util');

const PRESETS = [ph('封面 夏日草原', 640, 420), ph('封面 阿尔山秋色', 640, 420), ph('封面 冬季雪原', 640, 420)];
const NOTE_PRESETS = [ph('随拍 草原夕阳', 640, 480), ph('随拍 湿地栈道', 640, 480), ph('随拍 套娃广场', 640, 480), ph('随拍 木刻楞小屋', 640, 480), ph('随拍 马场日落', 640, 480), ph('随拍 秋色白桦', 640, 480)];
const MAX_DAYS = 15;
const MAX_IMAGES = 6;

function emptyPlan() {
  return { scenicIds: [], hotelId: '', note: '' };
}

Page({
  data: {
    c: copy.sharePublish,
    mode: 'plan',
    presets: PRESETS,
    coverIdx: 0,
    cover: '',
    title: '',
    intro: '',
    days: 3,
    customDays: '',
    seasons: copy.sharePublish.seasons,
    season: '',
    plans: [emptyPlan(), emptyPlan(), emptyPlan()],
    activeDay: 0,
    dayTabs: [1, 2, 3],
    curScenics: [],
    curHotel: null,
    sheetScenics: [],
    sheetHotels: [],
    sheetType: '',
    fromCustom: false,
    noteImages: [],
    notePresets: NOTE_PRESETS,
    noteTitle: '',
    noteContent: '',
    noteTags: copy.sharePublish.noteTags,
    noteTag: ''
  },

  onLoad(query) {
    const fromCustom = !!(query && query.from === 'custom');
    const saved = wx.getStorageSync('lastCustomPlan');
    let plans = this.data.plans.slice();
    let days = this.data.days;
    if (saved && saved.days && Array.isArray(saved.plans)) {
      days = Math.max(1, Math.min(MAX_DAYS, saved.days));
      plans = saved.plans.slice(0, days);
      while (plans.length < days) plans.push(emptyPlan());
      plans = plans.map(p => ({ scenicIds: (p.scenicIds || []).slice(), hotelId: p.hotelId || '', note: p.note || '' }));
    }
    this.setData({ plans, days, fromCustom });
    this.rebuildTabs();
    this.syncPlan();
  },

  onMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode });
  },

  rebuildTabs() {
    const tabs = [];
    for (let i = 0; i < this.data.days; i++) tabs.push(i + 1);
    this.setData({ dayTabs: tabs });
  },

  indexOfDay(idx) {
    return idx;
  },

  syncPlan() {
    const p = this.data.plans[this.data.activeDay];
    const curScenics = (p.scenicIds || []).map(data.getScenic).filter(Boolean);
    const curHotel = p.hotelId ? (data.hotels.filter(h => h.id === p.hotelId)[0] || null) : null;
    this.setData({ curScenics, curHotel });
  },

  onDay(e) {
    this.setData({ activeDay: e.currentTarget.dataset.idx });
    this.syncPlan();
  },

  onDays(e) {
    const val = e.currentTarget.dataset.v;
    let days;
    if (val === 'custom') {
      if (this.data.customDays) days = parseInt(this.data.customDays, 10) || 3;
      else days = this.data.days;
    } else {
      days = parseInt(val, 10);
    }
    days = Math.max(1, Math.min(MAX_DAYS, days || 3));
    const plans = this.data.plans.slice(0, days);
    while (plans.length < days) plans.push(emptyPlan());
    this.setData({ plans, days });
    this.rebuildTabs();
    if (this.data.activeDay >= days) this.setData({ activeDay: days - 1 });
    this.syncPlan();
  },

  onCustomDays(e) {
    this.setData({ customDays: e.detail.value });
    const n = parseInt(e.detail.value, 10);
    if (n && n >= 1 && n <= MAX_DAYS) {
      const plans = this.data.plans.slice(0, n);
      while (plans.length < n) plans.push(emptyPlan());
      this.setData({ plans, days: n });
      this.rebuildTabs();
      if (this.data.activeDay >= n) this.setData({ activeDay: n - 1 });
      this.syncPlan();
    }
  },

  onSeason(e) {
    this.setData({ season: e.currentTarget.dataset.s });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onIntro(e) {
    this.setData({ intro: e.detail.value });
  },

  onCover() {
    if (typeof wx.chooseImage === 'function') {
      const cb = res => {
        if (res.tempFilePaths && res.tempFilePaths[0]) {
          this.setData({ cover: res.tempFilePaths[0], coverIdx: -1 });
        }
      };
      try { wx.chooseImage({ count: 1, success: cb }); return; } catch (err) {}
    }
    const idx = (this.data.coverIdx + 1) % PRESETS.length;
    this.setData({ coverIdx: idx, cover: PRESETS[idx] });
  },

  onAddImage() {
    const left = MAX_IMAGES - this.data.noteImages.length;
    if (left <= 0) return;
    if (typeof wx.chooseImage === 'function') {
      const cb = res => {
        const next = (this.data.noteImages || []).concat(res.tempFilePaths || []);
        this.setData({ noteImages: next.slice(0, MAX_IMAGES) });
      };
      try { wx.chooseImage({ count: left, success: cb }); return; } catch (err) {}
    }
    const used = this.data.noteImages.length;
    const next = this.data.noteImages.concat([NOTE_PRESETS[used % NOTE_PRESETS.length]]);
    this.setData({ noteImages: next.slice(0, MAX_IMAGES) });
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.idx;
    const next = this.data.noteImages.slice();
    next.splice(idx, 1);
    this.setData({ noteImages: next });
  },

  onNoteTitle(e) {
    this.setData({ noteTitle: e.detail.value });
  },

  onNoteContent(e) {
    this.setData({ noteContent: e.detail.value });
  },

  onNoteTag(e) {
    this.setData({ noteTag: e.currentTarget.dataset.t });
  },

  openScenic() {
    this.setData({
      sheetType: 'scenic',
      sheetScenics: data.scenics.map(s => Object.assign({}, s, {
        checked: (this.data.curScenics || []).some(x => x.id === s.id)
      }))
    });
  },

  onSheetScenic(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.sheetScenics.map(s => s.id === id ? Object.assign({}, s, { checked: !s.checked }) : s);
    this.setData({ sheetScenics: list });
  },

  confirmScenic(e) {
    const ids = this.data.sheetScenics.filter(s => s.checked).map(s => s.id);
    this.setData({ ['plans.' + this.data.activeDay + '.scenicIds']: ids });
    this.syncPlan();
  },

  openHotel() {
    this.setData({
      sheetType: 'hotel',
      sheetHotels: data.hotels.slice()
    });
  },

  onSheetHotel(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ ['plans.' + this.data.activeDay + '.hotelId']: id });
    this.syncPlan();
  },

  clearHotel() {
    this.setData({ ['plans.' + this.data.activeDay + '.hotelId']: '' });
    this.syncPlan();
  },

  removeScenic(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.plans[this.data.activeDay];
    this.setData({ ['plans.' + this.data.activeDay + '.scenicIds']: (p.scenicIds || []).filter(x => x !== id) });
    this.syncPlan();
  },

  onNote(e) {
    this.setData({ ['plans.' + this.data.activeDay + '.note']: e.detail.value });
  },

  closeSheet() {
    this.setData({ sheetType: '' });
  },

  noop() {},

  // 云端发布灵感：上传图片 -> 写入 inspirationPost（待审核）。失败静默，不影响本地保存
  async cloudPublish(postType, payload) {
    try {
      if (!(typeof wx !== 'undefined' && wx.cloud)) return;
      const paths = payload.images && payload.images.length ? payload.images : (payload.cover ? [payload.cover] : []);
      const fileIDs = [];
      for (const p of paths) {
        if (!p) continue;
        if (p.indexOf('cloud://') === 0 || /^https?:\/\//.test(p)) { fileIDs.push(p); continue; }
        const fid = await api.uploadImage(p);
        fileIDs.push(fid || p);
      }
      const ext = {
        title: payload.title || '',
        tags: payload.tags || [],
        category: payload.category || '',
        authorName: (payload.author && payload.author.name) || '',
        authorAvatar: (payload.author && payload.author.avatar) || '',
        intro: payload.intro || '',
        days: payload.days || 0,
        season: payload.season || '',
        highlights: payload.highlights || [],
        timeline: payload.timeline || [],
        images: fileIDs
      };
      await api.publishPost({
        postType,
        coverImg: fileIDs[0] || '',
        contentText: payload.contentText || '',
        extend: ext
      });
    } catch (e) {
      // 云端发布失败不阻塞（已本地保存）
    }
  },

  publish() {
    if (this.data.mode === 'note') return this.publishNote();
    this.publishPlan();
  },

  publishPlan() {
    const c = this.data.c;
    const title = (this.data.title || '').trim();
    if (!title) {
      wx.showToast({ title: c.publishFail, icon: 'none' });
      return;
    }
    const u = wx.getStorageSync('userInfo');
    const intro = (this.data.intro || '').trim() || '想和你分享这条路线，希望对你有帮助。';
    const share = {
      id: 'my' + Date.now(),
      kind: 'plan',
      category: '自由行',
      title,
      days: this.data.days,
      season: this.data.season || this.data.seasons[0],
      cover: this.data.cover || PRESETS[0],
      coverV: ph('我的行程 ' + title, 480, 640),
      intro,
      highlights: [title, intro],
      timeline: this.data.plans.map(p => ({ scenicIds: (p.scenicIds || []).slice(), hotelId: p.hotelId || '', note: p.note || '' })),
      author: { name: (u && u.nickname) || '呼伦贝尔旅行官', avatar: (u && u.avatar) || '' },
      time: '2026-10-08',
      likes: 0,
      comments: [],
      liked: false,
      mine: true
    };
    const mine = wx.getStorageSync('myShares') || [];
    mine.unshift(share);
    wx.setStorageSync('myShares', mine);
    this.cloudPublish('trip', {
      title,
      days: this.data.days,
      season: this.data.season || this.data.seasons[0],
      category: share.category,
      intro,
      cover: share.cover,
      highlights: share.highlights,
      timeline: share.timeline,
      author: share.author
    });
    wx.setStorageSync('pendingToast', c.success);
    wx.switchTab({ url: '/pages/square/square' });
  },

  publishNote() {
    const c = this.data.c;
    const title = (this.data.noteTitle || '').trim();
    if (!title) {
      wx.showToast({ title: c.noteFail, icon: 'none' });
      return;
    }
    if (this.data.noteImages.length === 0) {
      wx.showToast({ title: c.noteImageFail, icon: 'none' });
      return;
    }
    const u = wx.getStorageSync('userInfo');
    const content = (this.data.noteContent || '').trim()
      .split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (content.length === 0) content.push('记录一段旅途，把此刻的风景和心情留给后来的你。');
    const note = {
      id: 'myNote' + Date.now(),
      kind: 'note',
      title,
      tags: [this.data.noteTag].filter(Boolean),
      coverV: this.data.noteImages[0],
      images: this.data.noteImages.slice(),
      content,
      author: { name: (u && u.nickname) || '草原旅人', avatar: (u && u.avatar) || '' },
      time: '2026-10-08',
      likes: 0,
      comments: [],
      liked: false,
      mine: true
    };
    const mine = wx.getStorageSync('myNotes') || [];
    mine.unshift(note);
    wx.setStorageSync('myNotes', mine);
    this.cloudPublish('note', {
      title,
      tags: note.tags,
      category: '',
      intro: content[0] || '',
      images: this.data.noteImages.slice(),
      contentText: content.join('\n'),
      author: note.author
    });
    wx.setStorageSync('pendingToast', c.success);
    wx.switchTab({ url: '/pages/square/square' });
  }
});