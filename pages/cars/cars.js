const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ICONS } = require('../../utils/util');

Page({
  data: {
    title: copy.cars.title,
    subtitle: copy.cars.subtitle,
    perDay: copy.cars.perDay,
    rentLabel: copy.cars.rent,
    seatLabel: copy.cars.seat,
    emptyText: copy.cars.empty,
    carIcon: ICONS.car,
    list: data.cars,
    consultVisible: false,
    currentName: ''
  },

  rent(e) {
    this.setData({
      currentName: '租车：' + e.currentTarget.dataset.name,
      consultVisible: true
    });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  }
});
