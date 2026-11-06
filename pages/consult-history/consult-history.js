const copy = require('../../utils/copy');
const share = require('../../utils/share');

Page(share.install({
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
}));
