const copy = require('./utils/copy');
const config = require('./utils/config');

App({
  globalData: {
    brand: copy.brand,
    servicePhone: copy.servicePhone
  },

  onLaunch() {wx.cloud.init({
    env: "cloudbase-d3gptvn88e6a4d78a",
    traceUser: true
  })
  
    if (!wx.getStorageSync('favorites')) {
      wx.setStorageSync('favorites', []);
    }
    if (!wx.getStorageSync('consultRecords')) {
      wx.setStorageSync('consultRecords', []);
    }
    if (!wx.getStorageSync('userInfo')) {
      wx.setStorageSync('userInfo', null);
    }
    // 初始化云开发（未开通云开发/占位appid时静默跳过，不影响原有功能）
    if (wx.cloud) {
      try {
        wx.cloud.init({ env: config.envId || undefined, traceUser: true });
      } catch (e) {
        // ignore
      }
    }
  }
});
