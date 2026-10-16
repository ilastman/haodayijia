const wb = require('../../utils/workbench');

Page({
  data: {
    ready: false,
    isStaff: false,
    disabled: false,
    tab: 'active',
    list: [],
    alert: {},
    scenicMap: {},
    loading: false
  },

  onShow() { this.init(); },

  async init() {
    const id = await wb.identity();
    if (!id || !id.isStaff) {
      this.setData({ ready: true, isStaff: false, disabled: !!(id && id.disabled) });
      return;
    }
    this.setData({ ready: true, isStaff: true, disabled: false });
    this.reload();
  },

  async reload() {
    this.setData({ loading: true });
    const [active, archived, alert, scenicMap] = await Promise.all([
      wb.listOrders(false), wb.listOrders(true), wb.alertConfig(), wb.scenicLeadMap()
    ]);
    const raw = (this.data.tab === 'active' ? active : archived) || [];
    this.setData({
      alert, scenicMap, loading: false,
      list: this.build(raw, alert, scenicMap)
    });
  },

  build(list, alert, scenicMap) {
    const arr = (list || []).map(o => {
      const w = wb.warnOf(o, alert, scenicMap);
      return {
        id: o.id,
        name: (o.customer && o.customer.name) || '未命名客户',
        people: o.people || 0,
        dest: o.dest || '',
        departDate: o.departDate || '',
        status: o.status || '意向客户',
        statusClass: wb.STATUS_CLASS[o.status] || '',
        urgency: !!o.urgency,
        level: w.level,
        tags: w.tags
      };
    });
    arr.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency ? -1 : 1;
      const da = a.departDate || '9999-99-99';
      const db = b.departDate || '9999-99-99';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    return arr;
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab }, () => this.reload());
  },

  goDetail(e) { wx.navigateTo({ url: '/pages/workbench-detail/workbench-detail?id=' + e.currentTarget.dataset.id }); },
  goAdd() { wx.navigateTo({ url: '/pages/workbench-edit/workbench-edit' }); },
  goBind() { wx.navigateTo({ url: '/pages/workbench-bind/workbench-bind' }); },

  onPullDownRefresh() { this.reload().then(() => wx.stopPullDownRefresh()); }
});
