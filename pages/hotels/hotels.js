const copy = require('../../utils/copy');
const data = require('../../utils/data');
const api = require('../../utils/api');
const { ICONS } = require('../../utils/util');

Page({
  data: {
    title: copy.hotels.title,
    subtitle: copy.hotels.subtitle,
    perNight: copy.hotels.perNight,
    scoreLabel: copy.hotels.score,
    bookLabel: copy.hotels.book,
    emptyText: copy.hotels.empty,
    pinIcon: ICONS.pin,
    list: data.hotels,
    consultVisible: false,
    currentName: ''
  },

  onLoad() {
    this.loadCloud();
  },

  // 云端酒店：加载成功后刷新列表，失败保留本地数据
  async loadCloud() {
    try {
      const list = await api.hotels();
      if (list && list.length) this.setData({ list });
    } catch (e) {
      // 静默失败，继续使用本地数据
    }
  },

  book(e) {
    this.setData({
      currentName: '酒店：' + e.currentTarget.dataset.name,
      consultVisible: true
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/hotel-detail/hotel-detail?id=' + e.currentTarget.dataset.id });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  }
});
