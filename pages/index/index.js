const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const { ICONS } = require('../../utils/util');

/* 内置绿色 data URI 线稿换成本地大地色图标；后台上传的云存储/网络图保持原样 */
const NAV_ICON_BY_LABEL = {
  '私家团': '/images/nav/private.svg',
  '拼团': '/images/nav/group.svg',
  '景区': '/images/nav/scenic.svg',
  '酒店': '/images/nav/hotel.svg',
  '旅行攻略': '/images/nav/guide.svg',
  '私人定制': '/images/nav/custom.svg'
};

function presentNavIcon(item) {
  const src = (item && item.icon) || '';
  const local = NAV_ICON_BY_LABEL[item && item.label];
  if (!local) return item;
  const stockSvg = src.indexOf('data:image/svg+xml') === 0 && /2F8F5B/i.test(src);
  if (!src || stockSvg) return Object.assign({}, item, { icon: local });
  return item;
}

Page({
  data: {
    brand: copy.brand,
    companyIntro: copy.companyIntro,
    servicePhone: copy.servicePhone,
    home: copy.home,
    serviceIcon: ICONS.serviceWhite,
    banners: data.banners,
    navIcons: data.navIcons,
    destinations: data.destinations,
    hotRoutes: data.pickRoutes(data.hotRouteIds),
    offers: data.pickRoutes(data.offerIds),
    consultVisible: false
  },
  onShareAppMessage() {
    return {
      title: '呼伦贝尔轻奢定制旅行',
      path: '/pages/index/index'
    }
  },
  onShareTimeline() {
    return {
      title: '呼伦贝尔轻奢定制旅行'
    }
  },
  

  onLoad() {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    })
    this.loadCloud();
  },
  

  // 从云开发读取 banner、首页板块与首页内容，失败则保留本地静态数据
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
          consult: hc.consult || cur.consult
        });
        if (home.about) {
          if (home.about.content) patch.companyIntro = home.about.content;
          if (home.about.phone) patch.servicePhone = home.about.phone;
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
});
