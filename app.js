const copy = require('./utils/copy');

App({
  globalData: {
    brand: copy.brand,
    servicePhone: copy.servicePhone
  },

  onLaunch() {
    if (!wx.getStorageSync('favorites')) {
      wx.setStorageSync('favorites', []);
    }
    if (!wx.getStorageSync('consultRecords')) {
      wx.setStorageSync('consultRecords', []);
    }
    if (!wx.getStorageSync('userInfo')) {
      wx.setStorageSync('userInfo', null);
    }
  }
});
