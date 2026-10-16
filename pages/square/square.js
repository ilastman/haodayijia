const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

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
    this.build();
    if (!this._cloudLoaded) this.loadCloud();
  },

  // 云端灵感广场（仅审核通过），加载成功后与本地内容合并
  async loadCloud() {
    try {
      const posts = await api.inspirationPosts();
      this._cloudLoaded = true;
      if (posts && posts.length) {
        this._cloudPosts = posts;
        this.build();
      }
    } catch (e) {
      // 静默失败，继续展示本地内容
    }
  },

  build() {
    const tail = (this._cloudPosts && this._cloudPosts.length) ? [] : data.shares.concat(data.notes);
    this.setData({ feeds: (this._cloudPosts || []).concat(tail) });
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
  }
});