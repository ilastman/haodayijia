const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const { ICONS } = require('../../utils/util');

const ALL = '全部';

Page({
  data: {
    title: copy.hotels.title,
    subtitle: copy.hotels.subtitle,
    perNight: copy.hotels.perNight,
    scoreLabel: copy.hotels.score,
    bookLabel: copy.hotels.book,
    emptyText: copy.hotels.empty,
    pinIcon: ICONS.pin,
    regions: [ALL].concat(data.REGIONS || []),
    activeRegion: ALL,
    places: [ALL],
    activePlace: ALL,
    list: data.hotels,
    consultVisible: false,
    currentName: ''
  },

  onLoad() {
    this._all = data.hotels;
    this._cats = null;
    this.apply();
    this.loadCloud();
  },

  async loadCloud() {
    try {
      const list = await api.hotels();
      const cats = await api.categories('hotel');
      if (cats && cats.length) this._cats = cats;
      if (list && list.length) this._all = list;
      this.apply();
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  onRegion(e) {
    this.setData({ activeRegion: e.currentTarget.dataset.region, activePlace: ALL });
    this.apply();
  },

  onPlace(e) {
    this.setData({ activePlace: e.currentTarget.dataset.place });
    this.apply();
  },

  apply() {
    const all = this._all || data.hotels;
    const region = this.data.activeRegion;
    const tree = this._cats;
    let regions = this.data.regions;
    let places = [ALL];
    if (tree && tree.length) {
      const l1 = tree.filter(c => c.level === 1).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
      regions = [ALL].concat(l1.map(c => c.name));
      const nodes = region === ALL ? l1 : l1.filter(c => c.name === region);
      const ids = nodes.map(c => c.id);
      tree.filter(c => c.level === 2 && ids.indexOf(c.parentId) >= 0)
        .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .forEach(p => { if (places.indexOf(p.name) < 0) places.push(p.name); });
    } else {
      all.forEach(h => {
        if (!h.area) return;
        if (region !== ALL && h.regionLevel1 !== region) return;
        if (places.indexOf(h.area) < 0) places.push(h.area);
      });
    }
    const activePlace = places.indexOf(this.data.activePlace) < 0 ? ALL : this.data.activePlace;
    this.setData({
      regions,
      places,
      activePlace,
      list: all.filter(h => {
        if (region !== ALL && h.regionLevel1 !== region) return false;
        if (activePlace !== ALL && h.area !== activePlace) return false;
        return true;
      })
    });
  },

  book(e) {
    this.setData({
      currentName: '酒店：' + e.currentTarget.dataset.name,
      consultVisible: true
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/hotel-detail/hotel-detail?id=' + e.currentTarget.dataset.id });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  }
});
