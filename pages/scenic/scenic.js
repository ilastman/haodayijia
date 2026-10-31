const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const scenicQuery = require('../../utils/scenic-query');

const ALL = '全部';
const SUB_TABS = [
  { key: 'all', label: '全部' },
  { key: 'scenic', label: '景区' },
  { key: 'entertainment', label: '原野体验' }
];

Page({
  data: {
    title: copy.scenic.title,
    subtitle: copy.scenic.subtitle,
    emptyText: copy.scenic.empty,
    visit: copy.scenic.visit,
    regions: [ALL].concat(data.REGIONS || []),
    activeRegion: ALL,
    subTabs: SUB_TABS,
    activeSub: 'all',
    cats: [copy.scenic.all].concat(data.scenicDests),
    activeCat: copy.scenic.all,
    list: [],
    /* 云端列表没回来时继续展示本地示例，并标明，避免把示例当成已同步的后台数据 */
    usingLocal: false
  },

  onLoad() {
    this._all = data.scenics;
    this._cats = null;
    this.apply();
    this.loadCloud();
  },

  async loadCloud() {
    let usingLocal = true;
    try {
      const list = await api.scenics();
      const cats = await api.categories('scenic');
      if (cats && cats.length) this._cats = cats;
      if (list && list.length) {
        this._all = list;
        usingLocal = false;
      }
    } catch (e) {
      usingLocal = true;
    }
    this.setData({ usingLocal });
    this.apply();
  },

  onRegion(e) {
    const region = e.currentTarget.dataset.region;
    this.apply({ region, sub: 'all', place: copy.scenic.all });
  },

  onSub(e) {
    this.apply({ sub: e.currentTarget.dataset.sub, place: copy.scenic.all });
  },

  onCat(e) {
    this.apply({ place: e.currentTarget.dataset.cat });
  },

  apply(override) {
    const all = this._all || data.scenics;
    const q = scenicQuery.query(all, this._cats, Object.assign({
      region: this.data.activeRegion,
      sub: this.data.activeSub,
      place: this.data.activeCat,
      allLabel: copy.scenic.all
    }, override || {}), data.REGIONS);
    this.setData({
      regions: q.regions,
      subTabs: q.subTabs,
      activeRegion: q.region,
      activeSub: q.sub,
      cats: q.places,
      activeCat: q.place,
      list: q.list
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  }
});
