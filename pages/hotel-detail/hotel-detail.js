const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');

Page({
  data: {
    d: copy.hotelDetail,
    hotel: null,
    consultVisible: false
  },

  async onLoad(options) {
    const id = options.id || '';
    let h = null;
    try {
      h = await api.getHotel(id);
    } catch (e) {
      h = null;
    }
    if (!h) h = data.getHotel(id);
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