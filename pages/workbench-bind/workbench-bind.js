const wb = require('../../utils/workbench');

Page({
  data: { code: '', loading: false },

  onInput(e) { this.setData({ code: e.detail.value }); },

  async submit() {
    const code = (this.data.code || '').trim();
    if (!code) { wx.showToast({ title: '请输入绑定码', icon: 'none' }); return; }
    this.setData({ loading: true });
    const res = await wb.bind(code);
    this.setData({ loading: false });
    if (res && res.code === 200) {
      wx.showToast({ title: '绑定成功', icon: 'success' });
      setTimeout(() => { wx.redirectTo({ url: '/pages/workbench/workbench' }); }, 700);
    } else {
      wx.showToast({ title: (res && res.msg) || '绑定失败', icon: 'none' });
    }
  }
});
