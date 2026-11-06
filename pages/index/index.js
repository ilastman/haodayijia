const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const { ICONS } = require('../../utils/util');
const share = require('../../utils/share');

/* 内置绿色 data URI 线稿换成本地大地色图标；后台上传的云存储/网络图保持原样 */
const NAV_ICON_BY_LABEL = {
  '私家团': '/images/nav/private.png',
  '拼团': '/images/nav/group.svg',
  '景区': '/images/nav/scenic.svg',
  '酒店': '/images/nav/hotel.png',
  '旅行攻略': '/images/nav/guide.svg',
  '私人定制': '/images/nav/custom.png'
};

function presentNavIcon(item) {
  const src = (item && item.icon) || '';
  const local = NAV_ICON_BY_LABEL[item && item.label];
  if (!local) return item;
  if (item && (item.label === '私家团' || item.label === '酒店' || item.label === '私人定制')) {
    return Object.assign({}, item, { icon: local });
  }
  const stockSvg = src.indexOf('data:image/svg+xml') === 0 && /2F8F5B/i.test(src);
  if (!src || stockSvg) return Object.assign({}, item, { icon: local });
  return item;
}

/* 首屏封面：顶贴屏顶；高度约半屏再稍高一点（≈65% 可视高），绝不全屏。 */
function readChromeMetrics() {
  let winW = 375;
  let winH = 667;
  let status = 20;
  try {
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || (wx.getSystemInfoSync && wx.getSystemInfoSync()) || {};
    winW = info.windowWidth || info.screenWidth || winW;
    winH = info.windowHeight || winH;
    status = info.statusBarHeight || status;
  } catch (e) {}

  let menu = null;
  try {
    menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
  } catch (e) {}
  if (!menu || !menu.height || !menu.top) {
    menu = {
      width: 87,
      height: 32,
      top: status + 4,
      bottom: status + 36,
      left: winW - 94,
      right: winW - 7
    };
  }

  // 半屏再稍高：可视窗口高度的 65%，并夹在 48%～62% 之间，避免又拉成全屏
  let heroHeight = Math.round(winH * 0.65);
  const lo = Math.round(winH * 0.55);
  const hi = Math.round(winH * 0.72);
  if (heroHeight < lo) heroHeight = lo;
  if (heroHeight > hi) heroHeight = hi;

  const belowCapsule = Math.max(6, menu.top - status);
  return {
    statusBarHeight: status,
    menuTop: menu.top,
    navRowHeight: menu.height,
    chromeHeight: menu.bottom + belowCapsule,
    capsuleGap: Math.max(12, winW - menu.left + 8),
    heroHeight: heroHeight
  };
}

Page(share.install({
  data: Object.assign({
    brand: copy.brand,
    companyIntro: copy.companyIntro,
    servicePhone: copy.servicePhone,
    home: copy.home,
    serviceIcon: ICONS.serviceWhite,
    banners: [],
    navIcons: (data.navIcons || []).map(presentNavIcon),
    destinations: data.destinations,
    hotRoutes: data.pickRoutes(data.hotRouteIds),
    offers: data.pickRoutes(data.offerIds),
    consultVisible: false,
    chromeSolid: false
  }, readChromeMetrics()),

  onLoad() {
    this._chromeSolid = false;
    this.applyMetrics();
    this.paintStatusBar(false);
    this.loadCloud();
  },

  onReady() {
    this.applyMetrics();
  },

  onShow() {
    this.applyMetrics();
    this.paintStatusBar(!!this._chromeSolid);
  },

  applyMetrics() {
    const m = readChromeMetrics();
    const d = this.data;
    if (
      m.heroHeight === d.heroHeight &&
      m.chromeHeight === d.chromeHeight &&
      m.capsuleGap === d.capsuleGap &&
      m.menuTop === d.menuTop &&
      m.navRowHeight === d.navRowHeight &&
      m.statusBarHeight === d.statusBarHeight
    ) return;
    this.setData(m);
  },

  paintStatusBar(solid) {
    if (!wx.setNavigationBarColor) return;
    try {
      wx.setNavigationBarColor({
        frontColor: solid ? '#000000' : '#ffffff',
        backgroundColor: solid ? '#F6F1E7' : '#000000',
        animation: { duration: 200, timingFunc: 'easeIn' }
      });
    } catch (e) {}
  },

  onPageScroll(e) {
    const solid = (e.scrollTop || 0) > 12;
    if (solid === this._chromeSolid) return;
    this._chromeSolid = solid;
    this.setData({ chromeSolid: solid });
    this.paintStatusBar(solid);
  },

  onSearch() {
    wx.switchTab({ url: '/pages/routes/routes' });
  },
  

  // 封面只采用云端 banner，不回填本地占位图。其余板块云端失败时保留本地静态数据。
  async loadCloud() {
    try {
      const [banners, navIcons, home] = await Promise.all([api.banners(), api.homeModules(), api.homeContent()]);
      const patch = {};
      if (banners && banners.length) patch.banners = banners;
      if (navIcons && navIcons.length) patch.navIcons = navIcons.map(presentNavIcon);
      if (home) {
        if (home.hot && home.hot.length) patch.hotRoutes = home.hot;
        if (home.offers && home.offers.length) patch.offers = home.offers;
        if (home.destinations && home.destinations.length) patch.destinations = home.destinations;
        const hc = home.homeCopy || {};
        const cur = this.data.home;
        patch.home = Object.assign({}, cur, {
          hotTitle: hc.hotTitle || cur.hotTitle,
          destTitle: hc.destTitle || cur.destTitle,
          offerTitle: hc.offerTitle || cur.offerTitle,
          introTitle: hc.introTitle || cur.introTitle,
          more: hc.more || cur.more,
          consult: hc.consult || cur.consult,
          searchPlaceholder: hc.searchPlaceholder || cur.searchPlaceholder
        });
        if (home.about) {
          if (home.about.content) patch.companyIntro = home.about.content;
          if (home.about.phone) patch.servicePhone = home.about.phone;
          try { require('../../utils/site-config').load(); } catch (e) { /* ignore */ }
        }
      }
      if (Object.keys(patch).length) this.setData(patch);
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  onBanner(e) {
    const ds = e.currentTarget.dataset;
    if (ds.id) {
      wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + ds.id });
      return;
    }
    this.openUrl(ds.jump);
  },

  onNav(e) {
    this.openUrl(e.currentTarget.dataset.url);
  },

  /* 首页定制名片。WXML 为 bindtap="goCustom"。分包根是 pages/custom 时，注册路由仍是 pages/custom/custom。 */
  goCustom() {
    wx.navigateTo({ url: '/pages/custom/custom' });
  },

  openUrl(url) {
    if (!url) return;
    if (url.indexOf('tab:') === 0) {
      const rest = url.slice(4);
      const parts = rest.split('?');
      const page = parts[0];
      if (parts[1]) {
        const params = {};
        parts[1].split('&').forEach(kv => {
          const seg = kv.split('=');
          params[seg[0]] = decodeURIComponent(seg[1] || '');
        });
        wx.setStorageSync('pendingRouteFilter', params);
      }
      wx.switchTab({ url: '/pages/' + page + '/' + page });
    } else {
      wx.navigateTo({ url });
    }
  },

  onDest(e) {
    const name = e.currentTarget.dataset.name;
    wx.setStorageSync('pendingRouteFilter', { dest: name });
    wx.switchTab({ url: '/pages/routes/routes' });
  },

  goRoutes() {
    wx.switchTab({ url: '/pages/routes/routes' });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + e.currentTarget.dataset.id });
  },

  openConsult() {
    this.setData({ consultVisible: true });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  }
}));
