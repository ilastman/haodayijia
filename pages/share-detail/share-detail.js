const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    c: copy.shareDetail,
    share: null,
    days: [],
    liked: false,
    faved: false,
    commentDraft: '',
    comments: []
  },

  onLoad(query) {
    const id = query ? query.id : '';
    const share = id ? data.getShare(id) : null;
    if (!share) {
      wx.showToast({ title: '分享不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    wx.setNavigationBarTitle({ title: '行程分享' });
    this.setData({
      share,
      days: this.buildDays(share),
      comments: (share.comments || []).slice()
    });
  },

  buildDays(share) {
    return (share.timeline || []).map(t => {
      const scenics = (t.scenicIds || []).map(data.getScenic).filter(Boolean);
      const hotel = t.hotelId ? (data.hotels.filter(h => h.id === t.hotelId)[0] || null) : null;
      const thumb = (scenics[0] && scenics[0].thumb) || (hotel && hotel.pic) || '';
      return { scenics, hotel, note: t.note || '', thumb };
    });
  },

  onLike() {
    const share = this.data.share;
    const liked = !this.data.liked;
    this.setData({ liked, ['share.likes']: share.likes + (liked ? 1 : -1) });
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
  },

  goCustom() {
    wx.navigateTo({ url: '/pages/custom/custom?shareId=' + this.data.share.id });
  }
});