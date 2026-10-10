const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    title: copy.scenic.title,
    subtitle: copy.scenic.subtitle,
    emptyText: copy.scenic.empty,
    visit: copy.scenic.visit,
    cats: [copy.scenic.all].concat(data.scenicDests),
    activeCat: copy.scenic.all,
    list: []
  },

  onLoad() {
    this.apply();
  },

  onCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.apply();
  },

  apply() {
    const { activeCat } = this.data;
    const all = copy.scenic.all;
    this.setData({
      list: data.scenics.filter(a => activeCat === all || a.dest === activeCat)
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  }
});