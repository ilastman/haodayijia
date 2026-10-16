const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

const CATS = copy.routes.cats;
const ALL = CATS[0];

const CAT_ROUTES = {
  夏日草原: ['r001', 'r003', 'r005', 'r006'],
  阿尔山秋线: ['r002', 'r008'],
  冬季雪原: ['r008'],
  亲子私旅: ['r001', 'r005'],
  小众秘境: ['r004', 'r007']
};

const SEASON_WEIGHT = {
  夏日草原: { 夏: 0, 秋: 2, 冬: 3 },
  阿尔山秋线: { 秋: 0, 夏: 2, 冬: 2 },
  冬季雪原: { 冬: 0, 夏: 3, 秋: 2 },
  亲子私旅: { 春: 1, 夏: 1, 秋: 1, 冬: 1 },
  小众秘境: { 春: 1, 夏: 1, 秋: 1, 冬: 1 }
};

function currentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 6 && m <= 8) return '夏';
  if (m >= 9 && m <= 11) return '秋';
  if (m === 12 || m <= 3) return '冬';
  return '春';
}

function rankOf(route, season) {
  let best = 4;
  Object.entries(CAT_ROUTES).forEach(([cat, ids]) => {
    if (ids.indexOf(route.id) === -1) return;
    const w = (SEASON_WEIGHT[cat] && SEASON_WEIGHT[cat][season]) != null
      ? SEASON_WEIGHT[cat][season]
      : 2;
    if (w < best) best = w;
  });
  return best;
}

const CopyArray = [];

function buildList() {
  const season = currentSeason();
  const order = { 私家团: 0, 拼团: 1 };
  return data.routes
    .map(r => ({ r, rank: rankOf(r, season), back: order[r.type] != null ? order[r.type] : 0, i: data.routes.indexOf(r) }))
    .sort((a, b) => a.rank - b.rank || a.back - b.back || a.i - b.i)
    .map(x => x.r);
}

function matchDays(route, opt) {
  if (opt === '全部') return true;
  if (opt === '1-3天') return route.days <= 3;
  if (opt === '4-6天') return route.days >= 4 && route.days <= 6;
  if (opt === '7天及以上') return route.days >= 7;
  return true;
}

function decorate(route) {
  const nights = Math.max(1, route.days - 1);
  return {
    id: route.id,
    name: route.title,
    daysText: route.days + '天' + nights + '晚',
    brief: route.brief,
    cover: route.cover
  };
}

Page({
  data: {
    copy: copy.routes,
    cats: CATS,
    activeCat: ALL,
    moreOpen: false,
    daysOptions: copy.routes.daysOptions,
    destOptions: ['全部'].concat(data.destList),
    typeOptions: ['全部'].concat(data.typeList),
    more: { days: '全部', dest: '全部', type: '全部' },
    list: [],
    showEmpty: false
  },

  onLoad(options) {
    const more = this.data.more;
    if (options.dest) more.dest = decodeURIComponent(options.dest);
    if (options.type) more.type = decodeURIComponent(options.type);
    this.setData({ more });
    this.render();
    if (!this._cloudLoaded) this.loadCloud();
  },

  // 云端私家团：加载成功后并入线路列表
  async loadCloud() {
    try {
      const groups = await api.privateGroups();
      this._cloudLoaded = true;
      if (!groups || !groups.length) return;
      this._cloudRoutes = groups;
      this.render();
      const dests = [];
      groups.forEach(g => { if (g.dest && dests.indexOf(g.dest) < 0) dests.push(g.dest); });
      if (dests.length) {
        const opts = ['全部'].concat(data.destList);
        dests.forEach(d => { if (opts.indexOf(d) < 0) opts.push(d); });
        if (opts.length !== this.data.destOptions.length) this.setData({ destOptions: opts });
      }
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  onShow() {
    const pending = wx.getStorageSync('pendingRouteFilter');
    if (!pending) return;
    wx.removeStorageSync('pendingRouteFilter');
    const more = Object.assign({}, this.data.more);
    if (pending.dest) more.dest = pending.dest;
    if (pending.type) more.type = pending.type;
    this.setData({ more });
    this.render();
  },

  onPullDownRefresh() {
    this.render(() => wx.stopPullDownRefresh());
  },

  onCategory(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.render();
  },

  onMoreToggle() {
    this.setData({ moreOpen: !this.data.moreOpen });
  },

  onMoreKey(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.currentTarget.dataset.v;
    this.setData({ ['more.' + k]: v });
    this.render();
  },

  onCard(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + id });
  },

  goCustom() {
    wx.navigateTo({ url: '/pages/custom/custom' });
  },

  goSquare() {
    wx.switchTab({ url: '/pages/square/square' });
  },

  getMatched(list) {
    const { activeCat, more } = this.data;
    return list.filter(r => {
      if (activeCat !== ALL && CAT_ROUTES[activeCat] && CAT_ROUTES[activeCat].indexOf(r.id) === -1) return false;
      if (more.dest !== '全部' && r.dest !== more.dest) return false;
      if (more.type !== '全部' && r.type !== more.type) return false;
      if (!matchDays(r, more.days)) return false;
      return true;
    });
  },

  render(done) {
    const base = (this._cloudRoutes && this._cloudRoutes.length) ? this._cloudRoutes : buildList();
    const matched = this.getMatched(base);
    const list = matched.map(decorate);
    this.setData({
      list,
      showEmpty: list.length === 0
    }, () => { if (done) done(); });
  }
});