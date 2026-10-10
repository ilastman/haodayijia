const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ICONS } = require('../../utils/util');

Page({
  data: {
    title: copy.strategy.title,
    searchPh: copy.strategy.searchPlaceholder,
    emptyText: copy.strategy.empty,
    cats: [copy.strategy.all].concat(copy.strategy.cats),
    activeCat: copy.strategy.all,
    search: '',
    searchIcon: ICONS.book,
    list: []
  },

  onLoad() {
    this.apply();
  },

  apply() {
    const { activeCat, search } = this.data;
    const kw = search.trim();
    this.setData({
      list: data.strategies.filter(a => {
        if (activeCat !== copy.strategy.all && a.category !== activeCat) return false;
        if (kw && a.title.indexOf(kw) === -1 && a.summary.indexOf(kw) === -1) return false;
        return true;
      })
    });
  },

  onCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.apply();
  },

  onSearch(e) {
    this.setData({ search: e.detail.value });
    this.apply();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/strategy-detail/strategy-detail?id=' + e.currentTarget.dataset.id });
  }
});
