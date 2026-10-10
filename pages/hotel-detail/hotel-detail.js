const copy = require('../../utils/copy');
const data = require('../../utils/data');

Page({
  data: {
    d: copy.hotelDetail,
    hotel: null,
    consultVisible: false
  },

  onLoad(options) {
    const h = data.getHotel(options.id || '');
    if (!h) {
      wx.showToast({ title: '酒店不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ hotel: h });
    wx.setNavigationBarTitle({ title: h.name });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.hotel.images
    });
  },

  openConsult() {
    this.setData({ consultVisible: true });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  }
});