const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ph } = require('../../utils/util');

const MAX_DAYS = 15;
const MAX_TILES = 4;
const TIME_STAMP = '2026-10-08';

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

function buildInfo(days, month) {
  let people;
  let pace;
  if (days <= 3) { people = '大众休闲 · 全家皆宜'; pace = '节奏轻快'; }
  else if (days <= 6) { people = '亲子家庭 · 结伴同游'; pace = '松紧有度'; }
  else if (days <= 9) { people = '深度漫游 · 摄影旅友'; pace = '从容慢游'; }
  else { people = '长假深玩 · 户外爱好者'; pace = '逐日漫游'; }
  let season = '夏季草原';
  if (month >= 5 && month <= 6) season = '初夏草原';
  else if (month >= 7 && month <= 8) season = '盛夏草原';
  else if (month >= 9 && month <= 10) season = '金秋草原';
  else if (month >= 11 || (month >= 1 && month <= 4)) season = '冬季雪原';
  return [
    { k: copy.detail.baseInfo[0], v: days + '天' },
    { k: copy.detail.baseInfo[1], v: people },
    { k: copy.detail.baseInfo[2], v: pace },
    { k: copy.detail.baseInfo[3], v: season }
  ];
}

function buildOverallTips(plans) {
  const tips = FIXED_TIPS.slice();
  const seen = {};
  FIXED_TIPS.forEach(t => { seen[t] = 1; });
  (plans || []).forEach(p => {
    (p.scenicIds || []).forEach(id => {
      const s = data.getScenic(id);
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

Page({
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
    overallTips: []
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
    while (plans.length < days) plans.push({ scenicIds: [], hotelId: '', note: '' });
    const heroTitle = copy.customPreview.heroTitle + days + copy.customPreview.heroTitleSuffix;
    this._plans = plans;
    const date = query.date ? decodeURIComponent(query.date) : (base && base.date) || '';
    this.setData({
      days,
      date,
      adults: query.adults || (base && base.adults) || '',
      children: query.children || (base && base.children) || '',
      heroTiles: this.buildHero(plans),
      dayList: plans.map((p, i) => this.buildDay(p, i, days)),
      heroTitle,
      fromList,
      editingId: fromList ? (query.trip || '') : editingId,
      infoTags: buildInfo(days, monthFromDate(date)),
      overallTips: buildOverallTips(plans)
    });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/custom/custom?edit=' + encodeURIComponent(this.data.editingId) });
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
        const s = data.getScenic(id);
        if (s) seen.push({ id, img: s.cover, name: s.name });
      });
    });
    while (seen.length < MAX_TILES) seen.push({ id: 'empty' + seen.length, img: '', name: '' });
    return seen;
  },

  buildDay(p, i, days) {
    const scenics = (p.scenicIds || []).map(data.getScenic).filter(Boolean).map(s => ({
      id: s.id,
      name: s.name,
      img: s.cover,
      dest: s.dest
    }));
    let hotel = null;
    if (p.hotelId) {
      const h = data.hotels.filter(x => x.id === p.hotelId)[0];
      if (h) hotel = { id: h.id, name: h.name, img: h.image, meta: h.stars + ' · ' + h.area };
    }
    const scene = scenics.length ? scenics[0].name : copy.customPreview.noScenic;
    return { index: i, line: (i + 1) + copy.customPreview.dayUnit, scene, scenics, hotel, note: p.note || '' };
  },

  goScenic(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  },

  goHotel(e) {
    wx.navigateTo({ url: '/pages/hotel-detail/hotel-detail?id=' + e.currentTarget.dataset.id });
  },

  goPublish() {
    const days = this.data.days;
    const title = '我的专属呼伦贝尔' + days + '日行程';
    const u = wx.getStorageSync('userInfo');
    let cover = this.data.heroTiles[0].img;
    if (!cover) cover = ph('我的专属呼伦贝尔 ' + days + '日行程', 640, 420);
    const share = {
      id: 'my' + Date.now(),
      kind: 'plan',
      category: '自由行',
      title,
      days,
      season: '夏季草原',
      cover,
      coverV: ph('我的行程 ' + title, 480, 640),
      intro: '这是为我量身安排的' + days + '天呼伦贝尔专属旅途，愿走到哪一片草地，哪里都是花园。',
      highlights: [title, this.data.heroTitle + '，' + copy.customPreview.slogan],
      timeline: this._plans.map(p => ({
        scenicIds: (p.scenicIds || []).slice(),
        hotelId: p.hotelId || '',
        note: p.note || ''
      })),
      author: { name: (u && u.nickname) || '呼伦贝尔旅行官', avatar: (u && u.avatar) || '' },
      time: TIME_STAMP,
      likes: 0,
      comments: [],
      liked: false,
      mine: true
    };
    const mine = wx.getStorageSync('myShares') || [];
    mine.unshift(share);
    wx.setStorageSync('myShares', mine);
    wx.setStorageSync('pendingToast', copy.customPreview.publishSuccess);
    wx.switchTab({ url: '/pages/square/square' });
  },

  saveToMine() {
    const days = this.data.days;
    const title = '我的专属呼伦贝尔' + days + '日行程';
    let cover = this.data.heroTiles[0].img;
    if (!cover) cover = ph('我的专属呼伦贝尔 ' + days + '日行程', 640, 420);
    const id = this.data.editingId || ('trip' + Date.now());
    const trip = {
      id,
      title,
      days,
      date: this.data.date,
      adults: this.data.adults,
      children: this.data.children,
      cover,
      heroTitle: this.data.heroTitle,
      plans: this._plans.map(p => ({
        scenicIds: (p.scenicIds || []).slice(),
        hotelId: p.hotelId || '',
        note: p.note || ''
      })),
      savedAt: TIME_STAMP
    };
    const trips = wx.getStorageSync('myTrips') || [];
    const idx = trips.findIndex(t => t.id === trip.id);
    if (idx > -1) {
      trips[idx] = trip;
      wx.setStorageSync('myTrips', trips);
      wx.showToast({ title: copy.customPreview.saveUpdated, icon: 'none' });
      return;
    }
    trips.unshift(trip);
    wx.setStorageSync('myTrips', trips);
    wx.showToast({ title: copy.customPreview.saveSuccess, icon: 'none' });
  }
});