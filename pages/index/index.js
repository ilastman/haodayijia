const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ICONS } = require('../../utils/util');

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

  onBanner(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + id });
    }
  },

  onNav(e) {
    const url = e.currentTarget.dataset.url;
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
