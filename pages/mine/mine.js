const copy = require('../../utils/copy');
const { ICONS } = require('../../utils/util');

Page({
  data: {
    copy: copy.mine,
    servicePhone: copy.servicePhone,
    serviceHours: copy.serviceHours,
    wechatId: copy.wechatId,
    userIcon: ICONS.user,
    phoneIcon: ICONS.phone,
    userInfo: null,
    editAvatar: '',
    editNick: '',
    menu: [
      { key: 'trips', label: copy.mine.menu.myTrips, url: '/pages/my-trips/my-trips' },
      { key: 'consults', label: copy.mine.menu.consults, url: '/pages/consult-history/consult-history' },
      { key: 'orders', label: copy.mine.menu.orders, url: '/pages/orders/orders' },
      { key: 'contact', label: copy.mine.menu.contact, url: 'contact' },
      { key: 'about', label: copy.mine.menu.about, url: '/pages/about/about' }
    ]
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || null;
    this.setData({
      userInfo,
      editAvatar: userInfo ? userInfo.avatar : '',
      editNick: userInfo ? userInfo.nickname : ''
    });
  },

  onChooseAvatar(e) {
    this.setData({ editAvatar: e.detail.avatarURL });
  },

  onNickInput(e) {
    this.setData({ editNick: e.detail.value });
  },

  saveProfile() {
    const nickname = (this.data.editNick || '').trim() || '旅行官';
    const userInfo = { avatar: this.data.editAvatar, nickname };
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo });
    wx.showToast({ title: copy.mine.saved, icon: 'none' });
  },

  onMenu(e) {
    const url = e.currentTarget.dataset.url;
    if (url === 'contact') {
      wx.showActionSheet({
        itemList: ['拨打电话 ' + this.data.servicePhone, '复制微信号 ' + this.data.wechatId],
        success: res => {
          if (res.tapIndex === 0) {
            wx.makePhoneCall({ phoneNumber: this.data.servicePhone.replace(/-/g, '') });
          } else if (res.tapIndex === 1) {
            wx.setClipboardData({ data: this.data.wechatId, success: () => wx.showToast({ title: copy.about.copied, icon: 'none' }) });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url });
  },

  callService() {
    wx.makePhoneCall({ phoneNumber: this.data.servicePhone.replace(/-/g, '') });
  }
});
