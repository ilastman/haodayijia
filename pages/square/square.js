const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    c: copy.square,
    cats: copy.square.cats,
    activeCat: copy.square.all,
    feeds: [],
    colL: [],
    colR: []
  },

  onShow() {
    const pending = wx.getStorageSync('pendingToast');
    if (pending) {
      wx.showToast({ title: pending, icon: 'none' });
      wx.setStorageSync('pendingToast', '');
    }
    this.build();
  },

  build() {
    const mineNotes = wx.getStorageSync('myNotes') || [];
    const mineShares = wx.getStorageSync('myShares') || [];
    this.setData({ feeds: mineNotes.concat(mineShares, data.shares, data.notes) });
    this.apply();
  },

  catOf(item) {
    if (item.kind === 'note') return copy.square.typeNote;
    return data.catMap[item.category] || item.category;
  },

  apply() {
    const { activeCat, feeds } = this.data;
    const all = copy.square.all;
    const list = feeds.filter(x => {
      if (activeCat === all) return true;
      if (activeCat === copy.square.typePlan) return x.kind === 'plan';
      if (activeCat === copy.square.typeNote) return x.kind === 'note';
      return x.kind === 'plan' && this.catOf(x) === activeCat;
    });
    const colL = [];
    const colR = [];
    list.forEach((x, i) => (i % 2 ? colR : colL).push(x));
    this.setData({ colL, colR });
  },

  onCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat });
    this.apply();
  },

  onLike(e) {
    const id = e.currentTarget.dataset.id;
    let changed = false;
    const feeds = this.data.feeds.map(x => {
      if (x.id !== id) return x;
      changed = true;
      return Object.assign({}, x, { liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) });
    });
    if (changed) {
      this.setData({ feeds });
      this.apply();
    }
  },

  goDetail(e) {
    const item = this.data.feeds.filter(x => x.id === e.currentTarget.dataset.id)[0];
    if (item && item.kind === 'note') {
      wx.navigateTo({ url: '/pages/note-detail/note-detail?id=' + item.id });
      return;
    }
    wx.navigateTo({ url: '/pages/share-detail/share-detail?id=' + e.currentTarget.dataset.id });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/share-publish/share-publish' });
  }
});