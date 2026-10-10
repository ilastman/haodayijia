const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { getFavorites } = require('../../utils/util');

Page({
  data: {
    title: copy.favorites.title,
    emptyText: copy.favorites.empty,
    list: []
  },

  onShow() {
    const ids = getFavorites();
    this.setData({ list: ids.map(data.getRoute).filter(Boolean) });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + e.currentTarget.dataset.id });
  }
});
