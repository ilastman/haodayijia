const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

Page({
  data: {
    c: copy.noteDetail,
    note: null,
    liked: false,
    faved: false
  },

  async onLoad(query) {
    const id = query ? query.id : '';
    let note = null;
    try {
      note = await api.getNote(id);
    } catch (e) {
      note = null;
    }
    if (!note) note = id ? data.getNote(id) : null;
    if (!note) {
      wx.showToast({ title: '笔记不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    wx.setNavigationBarTitle({ title: '旅行笔记' });
    this.setData({ note });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.note.images
    });
  },

  onLike() {
    const note = this.data.note;
    const liked = !this.data.liked;
    this.setData({ liked, ['note.likes']: note.likes + (liked ? 1 : -1) });
  },

  onFav() {
    const c = this.data.c;
    const faved = !this.data.faved;
    this.setData({ faved });
    wx.showToast({ title: faved ? c.faved : c.fav, icon: 'none' });
  }
});