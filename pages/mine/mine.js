const copy = require('../../utils/copy');
const { ICONS } = require('../../utils/util');
const wb = require('../../utils/workbench');
const user = require('../../utils/user');

const BASE_MENU = [
  { key: 'trips', label: copy.mine.menu.myTrips, url: '/pages/my-trips/my-trips' },
  { key: 'consults', label: copy.mine.menu.consults, url: '/pages/consult-history/consult-history' },
  { key: 'orders', label: copy.mine.menu.orders, url: '/pages/orders/orders' },
  { key: 'contact', label: copy.mine.menu.contact, url: 'contact' },
  { key: 'about', label: copy.mine.menu.about, url: '/pages/about/about' }
];

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
    avatarBusy: false,
    isStaff: false,
    staffName: '',
    menu: BASE_MENU
  },

  onShow() {
    const userInfo = user.local();
    this.setData({
      userInfo,
      editAvatar: userInfo ? userInfo.avatar : '',
      editNick: userInfo ? userInfo.nickname : ''
    });
    this.syncFromCloud();
    this.loadIdentity();
  },

  // 云端资料补齐（本地缺失时）
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

  /* ---------- 头像设置 ---------- */
  onAvatarTap() {
    wx.showActionSheet({
      itemList: ['从相册选择', '使用默认头像'],
      success: res => {
        if (res.tapIndex === 0) this.fromAlbum();
        else if (res.tapIndex === 1) this.useDefaultAvatar();
      }
    });
  },

  fromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const f = (res.tempFiles && res.tempFiles[0]) || null;
        if (f && f.tempFilePath) this.gotoCrop(f.tempFilePath);
      }
    });
  },

  gotoCrop(path) {
    wx.navigateTo({
      url: '/pages/avatar-crop/avatar-crop?src=' + encodeURIComponent(path),
      success: res => {
        if (res.eventChannel) {
          res.eventChannel.on('cropped', cropped => this.onCropped(cropped));
        }
      }
    });
  },

  async onCropped(tempPath) {
    if (!tempPath) return;
    wx.showLoading({ title: '上传中', mask: true });
    let fileID = '';
    try {
      fileID = await this.uploadAvatar(tempPath);
    } catch (e) {
      fileID = '';
    }
    wx.hideLoading();
    if (!fileID) {
      wx.showToast({ title: '上传失败，已暂存本机', icon: 'none' });
    }
    const avatar = fileID || tempPath;
    await this.applyProfile({ avatar, avatarType: fileID ? 'custom' : 'default' });
  },

  /* 前端压缩后上传云存储，返回 fileID */
  uploadAvatar(tempPath) {
    return new Promise((resolve, reject) => {
      const doUpload = p => {
        if (!wx.cloud || !wx.cloud.uploadFile) { reject(new Error('云存储不可用')); return; }
        const ext = (p.split('.').pop() || 'png').split('?')[0];
        const cloudPath = 'avatars/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: p,
          success: res => resolve(res.fileID || ''),
          fail: reject
        });
      };
      if (wx.compressImage) {
        wx.compressImage({
          src: tempPath,
          quality: 70,
          success: res => doUpload(res.tempFilePath || tempPath),
          fail: () => doUpload(tempPath)
        });
      } else {
        doUpload(tempPath);
      }
    });
  },

  async applyProfile(patch) {
    const info = await user.saveProfile(patch);
    this.setData({ userInfo: info, editAvatar: info.avatar, editNick: info.nickname });
    wx.showToast({ title: copy.mine.saved, icon: 'none' });
  },

  onNickInput(e) {
    this.setData({ editNick: e.detail.value });
  },

  async saveProfile() {
    const nickname = (this.data.editNick || '').trim() || '旅行官';
    const openid = (this.data.userInfo && this.data.userInfo.openid) || '';
    const avatar = this.data.editAvatar || user.defaultAvatar(openid || nickname);
    await this.applyProfile({ nickname, avatar });
  },

  onMenu(e) {
    const url = e.currentTarget.dataset.url;
    if (url === 'contact') {
      wx.showActionSheet({
        itemList: ['拨打客服电话', '复制微信 / 企微号'],
        success: res => {
          if (res.tapIndex === 0) wx.makePhoneCall({ phoneNumber: copy.servicePhone });
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
    wx.makePhoneCall({ phoneNumber: copy.servicePhone });
  }
});
