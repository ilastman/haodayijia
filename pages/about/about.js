const copy = require('../../utils/copy');
const { ICONS } = require('../../utils/util');

Page({
  data: {
    brand: copy.brand,
    slogan: copy.slogan,
    paragraphs: copy.aboutParagraphs,
    companyIntro: copy.companyIntro,
    labels: copy.about,
    servicePhone: copy.servicePhone,
    serviceHours: copy.serviceHours,
    wechatId: copy.wechatId,
    address: copy.address,
    phoneIcon: ICONS.phone
  },

  callService() {
    wx.makePhoneCall({ phoneNumber: this.data.servicePhone.replace(/-/g, '') });
  },

  copyWechat() {
    wx.setClipboardData({
      data: this.data.wechatId,
      success: () => wx.showToast({ title: copy.about.copied, icon: 'none' })
    });
  }
});
