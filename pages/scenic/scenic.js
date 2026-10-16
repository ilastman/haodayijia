const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

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
    this._all = data.scenics;
    this.apply();
    this.loadCloud();
  },

  // 云端景区：加载成功后重建分类并刷新列表，失败保留本地数据
  async loadCloud() {
    try {
      const list = await api.scenics();
      if (!list || !list.length) return;
      this._all = list;
      const dests = [];
      list.forEach(s => {
        if (s.dest && dests.indexOf(s.dest) < 0) dests.push(s.dest);
      });
      const cats = [copy.scenic.all].concat(dests);
      const activeCat = cats.indexOf(this.data.activeCat) < 0 ? copy.scenic.all : this.data.activeCat;
      this.setData({ cats, activeCat });
      this.apply();
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  onCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.apply();
  },

  apply() {
    const all = this._all || data.scenics;
    const activeCat = this.data.activeCat;
    this.setData({
      list: all.filter(a => activeCat === copy.scenic.all || a.dest === activeCat)
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  }
});