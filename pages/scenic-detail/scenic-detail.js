const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

Page({
  data: {
    d: copy.scenicDetail,
    scenic: null
  },

  async onLoad(options) {
    const id = options.id || '';
    let s = null;
    try {
      s = await api.getScenic(id);
    } catch (e) {
      s = null;
    }
    if (!s) s = data.getScenic(id);
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