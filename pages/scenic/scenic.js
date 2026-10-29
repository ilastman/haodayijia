const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

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
    list: []
  },

  onLoad() {
    this._all = data.scenics;
    this._cats = null;
    this.apply();
    this.loadCloud();
  },

  async loadCloud() {
    try {
      const list = await api.scenics();
      const cats = await api.categories('scenic');
      if (cats && cats.length) this._cats = cats;
      if (list && list.length) this._all = list;
      this.apply();
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  onRegion(e) {
    this.setData({ activeRegion: e.currentTarget.dataset.region, activeSub: 'all', activeCat: copy.scenic.all });
    this.apply();
  },

  onSub(e) {
    this.setData({ activeSub: e.currentTarget.dataset.sub, activeCat: copy.scenic.all });
    this.apply();
  },

  onCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.apply();
  },

  typeHit(s, name) {
    if (s.typeName) return s.typeName === name;
    if (/体验|娱乐/.test(name)) return s.subType === 'entertainment';
    if (name === '景区') return (s.subType || 'scenic') !== 'entertainment';
    return (s.subType || 'scenic') === name;
  },

  apply() {
    const all = this._all || data.scenics;
    const region = this.data.activeRegion;
    const tree = this._cats;
    let subTabs = SUB_TABS;
    let placeNames = null;
    let regions = this.data.regions;
    if (tree && tree.length) {
      const l1 = tree.filter(c => c.level === 1).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
      regions = [ALL].concat(l1.map(c => c.name));
      const regionNodes = region === ALL ? l1 : l1.filter(c => c.name === region);
      const regionIds = regionNodes.map(c => c.id);
      const types = tree.filter(c => c.level === 2 && regionIds.indexOf(c.parentId) >= 0)
        .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const typeNames = [];
      types.forEach(t => { if (typeNames.indexOf(t.name) < 0) typeNames.push(t.name); });
      subTabs = [{ key: 'all', label: '全部' }].concat(typeNames.map(n => ({ key: n, label: n })));
      const activeSub = subTabs.some(t => t.key === this.data.activeSub) ? this.data.activeSub : 'all';
      const chosen = activeSub === 'all' ? types : types.filter(t => t.name === activeSub);
      const typeIds = chosen.map(t => t.id);
      placeNames = [];
      tree.filter(c => c.level === 3 && typeIds.indexOf(c.parentId) >= 0)
        .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
        .forEach(p => { if (placeNames.indexOf(p.name) < 0) placeNames.push(p.name); });
      const cats = [copy.scenic.all].concat(placeNames);
      const activeCat = cats.indexOf(this.data.activeCat) < 0 ? copy.scenic.all : this.data.activeCat;
      const list = all.filter(s => {
        if (region !== ALL && s.regionLevel1 !== region) return false;
        if (activeSub !== 'all' && !this.typeHit(s, activeSub)) return false;
        if (activeCat !== copy.scenic.all && s.dest !== activeCat) return false;
        return true;
      });
      this.setData({ regions, subTabs, activeSub, cats, activeCat, list });
      return;
    }
    const sub = subTabs.some(t => t.key === this.data.activeSub) ? this.data.activeSub : 'all';
    const base = all.filter(s => {
      if (region !== ALL && s.regionLevel1 !== region) return false;
      if (sub !== 'all' && (s.subType || 'scenic') !== sub) return false;
      return true;
    });
    const dests = [];
    base.forEach(s => { if (s.dest && dests.indexOf(s.dest) < 0) dests.push(s.dest); });
    const cats = [copy.scenic.all].concat(dests);
    const activeCat = cats.indexOf(this.data.activeCat) < 0 ? copy.scenic.all : this.data.activeCat;
    this.setData({
      subTabs,
      activeSub: sub,
      cats,
      activeCat,
      list: base.filter(s => activeCat === copy.scenic.all || s.dest === activeCat)
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  }
});
