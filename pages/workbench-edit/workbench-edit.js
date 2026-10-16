const wb = require('../../utils/workbench');

Page({
  data: {
    id: '',
    statusList: wb.STATUS,
    statusIndex: 0,
    form: {
      customer: { name: '', phone: '', wechat: '', source: '', remark: '' },
      people: '', dest: '', departDate: '', returnDate: '',
      status: '意向客户', urgency: false,
      costs: { hotel: '', car: '', guide: '', ticket: '', meal: '', misc: '' },
      pricing: { quote: '', estProfit: '' }
    },
    saving: false
  },

  onLoad(q) {
    if (q && q.id) {
      this.setData({ id: q.id });
      wx.setNavigationBarTitle({ title: '编辑客户 / 订单' });
      this.load(q.id);
    }
  },

  async load(id) {
    const o = await wb.getOrder(id);
    if (!o) { wx.showToast({ title: '加载失败', icon: 'none' }); return; }
    const costs = Object.assign({ hotel: '', car: '', guide: '', ticket: '', meal: '', misc: '' }, o.costs || {});
    Object.keys(costs).forEach(k => { costs[k] = costs[k] ? String(costs[k]) : ''; });
    const pricing = o.pricing || {};
    this.setData({
      form: {
        customer: Object.assign({ name: '', phone: '', wechat: '', source: '', remark: '' }, o.customer || {}),
        people: o.people ? String(o.people) : '',
        dest: o.dest || '',
        departDate: o.departDate || '',
        returnDate: o.returnDate || '',
        status: o.status || '意向客户',
        urgency: !!o.urgency,
        costs,
        pricing: { quote: pricing.quote ? String(pricing.quote) : '', estProfit: (pricing.estProfit || pricing.estProfit === 0) ? String(pricing.estProfit) : '' }
      },
      statusIndex: Math.max(0, wb.STATUS.indexOf(o.status || '意向客户'))
    });
  },

  onCust(e) { const k = e.currentTarget.dataset.k; this.setData({ ['form.customer.' + k]: e.detail.value }); },
  onField(e) { const k = e.currentTarget.dataset.k; this.setData({ ['form.' + k]: e.detail.value }); },
  onCost(e) { const k = e.currentTarget.dataset.k; this.setData({ ['form.costs.' + k]: e.detail.value }); },
  onPrice(e) { const k = e.currentTarget.dataset.k; this.setData({ ['form.pricing.' + k]: e.detail.value }); },
  onStatus(e) { const i = Number(e.detail.value); this.setData({ statusIndex: i, 'form.status': wb.STATUS[i] }); },
  onUrgency(e) { this.setData({ 'form.urgency': e.detail.value }); },

  async save() {
    const f = this.data.form;
    if (!String(f.customer.name || '').trim()) { wx.showToast({ title: '请输入客户姓名', icon: 'none' }); return; }
    this.setData({ saving: true });
    const payload = {
      customer: f.customer,
      people: wb.num(f.people),
      dest: f.dest,
      departDate: f.departDate,
      returnDate: f.returnDate,
      status: f.status,
      urgency: !!f.urgency,
      costs: {
        hotel: wb.num(f.costs.hotel), car: wb.num(f.costs.car), guide: wb.num(f.costs.guide),
        ticket: wb.num(f.costs.ticket), meal: wb.num(f.costs.meal), misc: wb.num(f.costs.misc)
      },
      pricing: { quote: wb.num(f.pricing.quote), estProfit: f.pricing.estProfit === '' ? null : wb.num(f.pricing.estProfit) }
    };
    let res;
    if (this.data.id) res = await wb.updateOrder(this.data.id, payload);
    else { res = await wb.createOrder(payload); }
    this.setData({ saving: false });
    if (res && res.code === 200) {
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        if (!this.data.id && res.data && res.data.id) {
          wx.redirectTo({ url: '/pages/workbench-detail/workbench-detail?id=' + res.data.id });
        } else { wx.navigateBack(); }
      }, 600);
    } else {
      wx.showToast({ title: (res && res.msg) || '保存失败', icon: 'none' });
    }
  }
});
