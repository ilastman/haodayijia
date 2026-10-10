const copy = require('../../utils/copy');

Page({
  data: {
    title: copy.consults.title,
    emptyText: copy.consults.empty,
    list: []
  },

  onShow() {
    this.setData({ list: wx.getStorageSync('consultRecords') || [] });
  },

  callAgain(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  }
});
