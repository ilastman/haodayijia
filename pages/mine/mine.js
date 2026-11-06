const copy = require('../../utils/copy');
const { ICONS } = require('../../utils/util');
const wb = require('../../utils/workbench');
const user = require('../../utils/user');
const siteConfig = require('../../utils/site-config');
const share = require('../../utils/share');

const BASE_MENU = [
  { key: 'trips', label: copy.mine.menu.myTrips, url: '/pages/my-trips/my-trips' },
  { key: 'consults', label: copy.mine.menu.consults, url: '/pages/consult-history/consult-history' },
  { key: 'orders', label: copy.mine.menu.orders, url: '/pages/orders/orders' },
  { key: 'contact', label: copy.mine.menu.contact, url: 'contact' },
  { key: 'agreement', label: '用户服务协议', url: '/pages/legal/legal?kind=agreement' },
  { key: 'privacy', label: '隐私政策', url: '/pages/legal/legal?kind=privacy' },
  { key: 'about', label: copy.mine.menu.about, url: '/pages/about/about' }
];

Page(share.install({
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
    isStaff: false,
    staffName: '',
    menu: BASE_MENU
  },

  onShow() {
    let userInfo = user.local();
    if (!userInfo || !userInfo.avatar || !userInfo.nickname) userInfo = user.ensureGuestProfile();
    this.setData({
      userInfo,
      editAvatar: userInfo ? userInfo.avatar : '',
      editNick: userInfo ? userInfo.nickname : ''
    });
    this.syncFromCloud();
    this.loadIdentity();
    this.loadSiteConfig();
  },

  // 后台「全局配置」客服电话/微信 → 我的页
  loadSiteConfig() {
    const pick = () => ({ servicePhone: copy.servicePhone, wechatId: copy.wechatId });
    this.setData(pick());
    siteConfig.load().then(() => this.setData(pick()));
  },

  async syncFromCloud() {
    if (this.data.userInfo && this.data.userInfo.avatar && this.data.userInfo.nickname) return;
    try {
      const merged = await user.syncFromCloud();
      const cur = this.data.userInfo || {};
      this.setData({
        userInfo: merged,
        editAvatar: merged.avatar || cur.avatar || '',
        editNick: merged.nickname || cur.nickname || ''
      });
    } catch (e) {
      // 静默失败，保持本地
    }
  },

  async loadIdentity() {
    const id = await wb.identity();
    const isStaff = !!(id && id.isStaff);
    const menu = BASE_MENU.slice();
    if (isStaff) {
      menu.unshift({ key: 'workbench', label: copy.mine.menu.workbench, url: '/pages/workbench/workbench' });
    } else {
      menu.push({ key: 'staffBind', label: copy.mine.menu.staffBind, url: '/pages/workbench-bind/workbench-bind' });
    }
    this.setData({ isStaff, staffName: (id && id.staff && id.staff.name) || '', menu });
  },

  openProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  onMenu(e) {
    const url = e.currentTarget.dataset.url;
    if (url === 'contact') {
      wx.showActionSheet({
        itemList: ['拨打客服电话', '复制微信 / 企微号'],
        success: res => {
          if (res.tapIndex === 0) wx.makePhoneCall({ phoneNumber: String(copy.servicePhone).replace(/-/g, '') });
          else if (res.tapIndex === 1) {
            wx.setClipboardData({ data: copy.wechatId, success: () => wx.showToast({ title: '已复制', icon: 'none' }) });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url });
  },

  callService() {
    wx.makePhoneCall({ phoneNumber: String(copy.servicePhone).replace(/-/g, '') });
  }
}));
