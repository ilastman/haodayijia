const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    d: copy.scenicDetail,
    scenic: null
  },

  onLoad(options) {
    const s = data.getScenic(options.id || '');
    if (!s) {
      wx.showToast({ title: '景区不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ scenic: s });
    wx.setNavigationBarTitle({ title: s.name });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.scenic.images
    });
  }
});