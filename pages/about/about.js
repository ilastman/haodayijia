const copy = require('../../utils/copy');
const { ICONS } = require('../../utils/util');
const siteConfig = require('../../utils/site-config');
const share = require('../../utils/share');

Page(share.install({
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

  onShow() {
    const pick = () => ({ servicePhone: copy.servicePhone, wechatId: copy.wechatId, address: copy.address, email: copy.email || '', companyIntro: copy.companyIntro, slogan: copy.slogan });
    this.setData(pick());
    siteConfig.load().then(() => this.setData(pick()));
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
}));
