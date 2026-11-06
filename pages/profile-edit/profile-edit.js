const copy = require('../../utils/copy');
const user = require('../../utils/user');
const share = require('../../utils/share');
const { allowCollect } = require('../../utils/consent');

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

Page(share.install({
  data: {
    avatar: '',
    nickname: '',
    gender: '',
    genderIndex: 0,
    genderOptions: ['男', '女', '保密'],
    birthday: '',
    phone: '',
    agreed: false,
    email: '',
    today: todayStr(),
    saving: false,
    avatarType: 'default'
  },

  onShow() {
    const info = user.ensureGuestProfile() || {};
    const genderOptions = this.data.genderOptions;
    let genderIndex = 0;
    if (info.gender) {
      const i = genderOptions.indexOf(info.gender);
      if (i >= 0) genderIndex = i;
    }
    this.setData({
      avatar: info.avatar || '',
      nickname: info.nickname || '',
      gender: info.gender || '',
      genderIndex,
      birthday: info.birthday || '',
      phone: info.phone || '',
      email: info.email || '',
      today: todayStr(),
      avatarType: info.avatarType || 'default'
    });
  },

  onNickInput(e) { this.setData({ nickname: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  ensureAgreed() {
    if (allowCollect(this.data.agreed)) return true;
    wx.showToast({ title: '请先阅读并同意协议和隐私政策', icon: 'none' });
    return false;
  },
  toggleAgree() { this.setData({ agreed: !this.data.agreed }); },
  openLegal(e) {
    const kind = (e.currentTarget.dataset || {}).kind === 'agreement' ? 'agreement' : 'privacy';
    wx.navigateTo({ url: '/pages/legal/legal?kind=' + kind });
  },
  onEmailInput(e) { this.setData({ email: e.detail.value }); },

  async onGenderChange(e) {
    if (!this.ensureAgreed()) return;
    const i = Number(e.detail.value) || 0;
    const gender = this.data.genderOptions[i];
    const patch = { genderIndex: i, gender };
    // 选了男/女且当前是默认头像：立刻换成对应性别池里的一张
    const g = user.normalizeGender(gender);
    const isDefault = (this.data.avatarType || 'default') === 'default'
      || (user.DEFAULT_AVATARS || []).indexOf(this.data.avatar) >= 0;
    if (g && isDefault) {
      const avatar = user.randomAvatar(this.data.avatar, g);
      patch.avatar = avatar;
      patch.avatarType = 'default';
      await user.saveProfile({ gender, avatar, avatarType: 'default' });
    } else {
      await user.saveProfile({ gender });
    }
    this.setData(patch);
  },

  onBirthdayChange(e) {
    if (!this.ensureAgreed()) return;
    this.setData({ birthday: e.detail.value || '' });
  },

  onAvatarTap() {
    if (!this.ensureAgreed()) return;
    wx.showActionSheet({
      itemList: ['从相册选择', '使用默认头像'],
      success: res => {
        if (res.tapIndex === 0) this.fromAlbum();
        else if (res.tapIndex === 1) this.useDefaultAvatar();
      }
    });
  },

  async useDefaultAvatar() {
    const avatar = user.randomAvatar(this.data.avatar, this.data.gender);
    this.setData({ avatar, avatarType: 'default' });
    await user.saveProfile({ avatar, avatarType: 'default' });
    wx.showToast({ title: '已更换默认头像', icon: 'none' });
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

  uploadAvatar(tempPath) {
    return new Promise((resolve, reject) => {
      const doUpload = p => {
        if (!wx.cloud || !wx.cloud.uploadFile) { reject(new Error('云存储不可用')); return; }
        const ext = (p.split('.').pop() || 'png').split('?')[0];
        const cloudPath = 'avatars/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: p,
          success: r => resolve(r.fileID || ''),
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

  async onCropped(tempPath) {
    if (!tempPath) return;
    wx.showLoading({ title: '上传中', mask: true });
    let fileID = '';
    try { fileID = await this.uploadAvatar(tempPath); } catch (e) { fileID = ''; }
    wx.hideLoading();
    if (!fileID) wx.showToast({ title: '上传失败，已暂存本机', icon: 'none' });
    const avatar = fileID || tempPath;
    this.setData({ avatar, avatarType: fileID ? 'custom' : 'default' });
    await user.saveProfile({ avatar, avatarType: fileID ? 'custom' : 'default' });
  },

  async onSave() {
    if (this.data.saving) return;
    if (!this.ensureAgreed()) return;
    const openid = (user.local() && user.local().openid) || '';
    const nickname = (this.data.nickname || '').trim() || user.defaultNickname(openid || Date.now());
    const avatar = this.data.avatar || user.defaultAvatar(openid || nickname, this.data.gender);
    const phone = (this.data.phone || '').trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不对', icon: 'none' });
      return;
    }
    const email = (this.data.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式不对', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await user.saveProfile({
        nickname,
        avatar,
        gender: this.data.gender || '',
        birthday: this.data.birthday || '',
        phone,
        email
      });
      wx.showToast({ title: copy.mine.saved, icon: 'none' });
      setTimeout(() => wx.navigateBack({ delta: 1 }), 400);
    } finally {
      this.setData({ saving: false });
    }
  }
}));
