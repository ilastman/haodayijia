const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ph, ICONS } = require('../../utils/util');

Page({
  data: {
    title: copy.order.title,
    tabs: copy.order.tabs,
    statusText: copy.order.status,
    emptyText: copy.order.empty,
    againLabel: copy.order.again,
    activeTab: 0,
    list: [],
    consultVisible: false
  },

  onShow() {
    this.buildList();
  },

  buildList() {
    const records = wx.getStorageSync('consultRecords') || [];
    const consultOrders = records.map((r, i) => ({
      id: 'c' + i,
      routeId: r.routeId || '',
      title: r.routeTitle || '定制方案咨询',
      cover: ph('咨询单', 640, 400),
      date: r.date || '待定',
      people: r.people || '未填写',
      amount: 0,
      status: 'pending',
      name: r.name
    }));
    const all = consultOrders.concat(data.sampleOrders);
    this.filterList(all);
  },

  filterList(all) {
    const tabMap = ['', 'pending', 'done', 'cancelled'];
    const st = tabMap[this.data.activeTab];
    const list = st ? all.filter(o => o.status === st) : all;
    this.setData({ list });
  },

  onTab(e) {
    this.setData({ activeTab: Number(e.currentTarget.dataset.idx) });
    this.buildList();
  },

  openConsult() {
    this.setData({ consultVisible: true });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  },

  callService() {
    wx.makePhoneCall({ phoneNumber: copy.servicePhone.replace(/-/g, '') });
  }
});
