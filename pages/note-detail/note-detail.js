const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    c: copy.noteDetail,
    note: null,
    liked: false,
    faved: false,
    commentDraft: '',
    comments: []
  },

  onLoad(query) {
    const id = query ? query.id : '';
    const note = id ? data.getNote(id) : null;
    if (!note) {
      wx.showToast({ title: '笔记不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    wx.setNavigationBarTitle({ title: '旅行笔记' });
    this.setData({
      note,
      comments: (note.comments || []).slice()
    });
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
  },

  onCommentInput(e) {
    this.setData({ commentDraft: e.detail.value });
  },

  onCommentSend() {
    const text = (this.data.commentDraft || '').trim();
    if (!text) return;
    const u = wx.getStorageSync('userInfo');
    const me = {
      name: (u && u.nickname) || '我',
      avatar: (u && u.avatar) || '',
      text,
      likes: 0
    };
    this.setData({ comments: [me].concat(this.data.comments), commentDraft: '' });
  }
});