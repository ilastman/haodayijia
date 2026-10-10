const copy = require('../../utils/copy');
const data = require('../../utils/data');
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
