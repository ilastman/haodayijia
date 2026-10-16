const wb = require('../../utils/workbench');

const PAY_TYPES = ['定金', '中期款', '尾款', '其他'];
const COST_LABELS = { hotel: '酒店', car: '车辆', guide: '导游', ticket: '门票', meal: '餐费', misc: '杂费' };

Page({
  data: {
    id: '',
    loading: true,
    order: null,
    vm: null,
    warn: { level: '', tags: [] },
    alert: {},
    scenicMap: {},

    openSec: { base: true, follow: true, itinerary: false, payment: true, cost: true, pricing: true },

    // 以下表单
    payTypes: PAY_TYPES,
    payVisible: false,
    payForm: { type: '定金', amount: '', time: '', dueDate: '', voucher: '', voucherUrl: '', remark: '' },

    followVisible: false,
    followForm: { content: '', nextTime: '' },

    costVisible: false,
    costForm: { hotel: '', car: '', guide: '', ticket: '', meal: '', misc: '' },

    priceVisible: false,
    priceForm: { quote: '', estProfit: '' },

    tplVisible: false,
    tplList: [],
    tplIndex: 0,

    dayEditing: false,
    dayDraft: [],

    archiving: false
  },

  onLoad(q) {
    if (!q || !q.id) { wx.showToast({ title: '参数错误', icon: 'none' }); return; }
    this.setData({ id: q.id });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    const [order, alert, scenicMap] = await Promise.all([
      wb.getOrder(this.data.id), wb.alertConfig(), wb.scenicLeadMap()
    ]);
    if (!order) { this.setData({ loading: false }); wx.showToast({ title: '加载失败', icon: 'none' }); return; }
    this.setData({
      loading: false, order, alert, scenicMap,
      vm: this.decorate(order),
      warn: wb.warnOf(order, alert, scenicMap),
      costForm: Object.assign({}, order.costs || {}),
      priceForm: { quote: (order.pricing && order.pricing.quote) || '', estProfit: (order.pricing && order.pricing.estProfit) || '' }
    });
  },

  decorate(o) {
    const costs = o.costs || {};
    const costList = Object.keys(COST_LABELS).map(k => ({ k, label: COST_LABELS[k], v: wb.num(costs[k]) }));
    const payments = (o.payments || []).slice().sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
    const paidTotal = payments.reduce((s, p) => s + wb.num(p.amount), 0);
    const followUps = (o.followUps || []).slice().sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
    const it = o.itinerary || {};
    return {
      customer: o.customer || {},
      people: o.people || 0,
      dest: o.dest || '',
      departDate: o.departDate || '',
      returnDate: o.returnDate || '',
      status: o.status || '',
      statusClass: wb.STATUS_CLASS[o.status] || '',
      urgency: !!o.urgency,
      archived: !!o.archived,
      costList, totalCost: wb.num(o.totalCost),
      pricing: o.pricing || { quote: 0, estProfit: 0, actualProfit: 0 },
      payments, paidTotal,
      followUps,
      days: it.days || [],
      include: it.include || [],
      exclude: it.exclude || [],
      notices: it.notices || { tips: [], gear: [], refund: [] },
      itSource: it.source || 'blank'
    };
  },

  toggle(e) {
    const k = e.currentTarget.dataset.sec;
    this.setData({ ['openSec.' + k]: !this.data.openSec[k] });
  },

  goEdit() { wx.navigateTo({ url: '/pages/workbench-edit/workbench-edit?id=' + this.data.id }); },

  /* ---------- 跟进 ---------- */
  openFollow() { this.setData({ followVisible: true, followForm: { content: '', nextTime: '' } }); },
  closeFollow() { this.setData({ followVisible: false }); },
  onFollowInput(e) { this.setData({ ['followForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  async saveFollow() {
    const f = this.data.followForm;
    if (!String(f.content || '').trim()) { wx.showToast({ title: '请填写跟进内容', icon: 'none' }); return; }
    const res = await wb.addFollow(this.data.id, { content: f.content, nextTime: f.nextTime });
    if (res && res.code === 200) { this.setData({ followVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 收款 ---------- */
  openPay() { this.setData({ payVisible: true, payForm: { type: '定金', amount: '', time: wb.today(), dueDate: '', voucher: '', voucherUrl: '', remark: '' } }); },
  closePay() { this.setData({ payVisible: false }); },
  onPayInput(e) { this.setData({ ['payForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onPayType(e) { this.setData({ 'payForm.type': PAY_TYPES[Number(e.detail.value)] }); },
  onPayDate(e) { this.setData({ ['payForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  chooseVoucher() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], success: res => {
        const f = res.tempFiles[0];
        wx.showLoading({ title: '上传中' });
        wx.cloud.uploadFile({ cloudPath: 'vouchers/' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.jpg', filePath: f.tempFilePath })
          .then(r => { wx.hideLoading(); this.setData({ 'payForm.voucher': r.fileID, 'payForm.voucherUrl': f.tempFilePath }); })
          .catch(() => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }); });
      }
    });
  },
  async savePay() {
    const p = this.data.payForm;
    if (!wb.num(p.amount)) { wx.showToast({ title: '请填写金额', icon: 'none' }); return; }
    const res = await wb.addPayment(this.data.id, p);
    if (res && res.code === 200) { this.setData({ payVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },
  removePay(e) {
    const pid = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除收款记录', content: '确认删除该条收款记录？', success: async r => {
      if (!r.confirm) return;
      const res = await wb.removePayment(this.data.id, pid);
      if (res && res.code === 200) this.load();
    } });
  },

  /* ---------- 成本 ---------- */
  openCost() { this.setData({ costVisible: true }); },
  closeCost() { this.setData({ costVisible: false }); },
  onCostInput(e) { this.setData({ ['costForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  async saveCost() {
    const c = this.data.costForm;
    const costs = {}; Object.keys(COST_LABELS).forEach(k => { costs[k] = wb.num(c[k]); });
    const res = await wb.addCost(this.data.id, costs);
    if (res && res.code === 200) { this.setData({ costVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 报价 / 毛利 ---------- */
  openPrice() { this.setData({ priceVisible: true }); },
  closePrice() { this.setData({ priceVisible: false }); },
  onPriceInput(e) { this.setData({ ['priceForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  async savePrice() {
    const p = this.data.priceForm;
    const res = await wb.savePricing(this.data.id, { quote: wb.num(p.quote), estProfit: p.estProfit === '' ? null : wb.num(p.estProfit) });
    if (res && res.code === 200) { this.setData({ priceVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 行程单：从模板 ---------- */
  async openTpl() {
    const list = await wb.templates();
    if (!list.length) { wx.showToast({ title: '暂无可选线路模板', icon: 'none' }); return; }
    this.setData({ tplVisible: true, tplList: list, tplIndex: 0 });
  },
  closeTpl() { this.setData({ tplVisible: false }); },
  onTplChange(e) { this.setData({ tplIndex: Number(e.detail.value) }); },
  async applyTpl() {
    const t = this.data.tplList[this.data.tplIndex];
    if (!t) return;
    const res = await wb.fromTemplate(this.data.id, t.id);
    if (res && res.code === 200) { this.setData({ tplVisible: false }); this.load(); wx.showToast({ title: '已生成', icon: 'success' }); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 行程单：手动编辑 ---------- */
  editDays() {
    const days = (this.data.vm.days || []).map(d => Object.assign({}, d));
    if (!days.length) days.push({ dayNum: 1, title: '第1天', content: '', meals: '', hotel: '' });
    this.setData({ dayEditing: true, dayDraft: days });
  },
  addDay() {
    const d = this.data.dayDraft;
    d.push({ dayNum: d.length + 1, title: '第' + (d.length + 1) + '天', content: '', meals: '', hotel: '' });
    this.setData({ dayDraft: d });
  },
  delDay(e) {
    const i = e.currentTarget.dataset.i;
    const d = this.data.dayDraft.slice(); d.splice(i, 1);
    d.forEach((x, idx) => { x.dayNum = idx + 1; });
    this.setData({ dayDraft: d });
  },
  onDayInput(e) {
    const { i, k } = e.currentTarget.dataset;
    this.setData({ ['dayDraft[' + i + '].' + k]: e.detail.value });
  },
  cancelDays() { this.setData({ dayEditing: false }); },
  async saveDays() {
    const res = await wb.saveItinerary(this.data.id, { days: this.data.dayDraft, source: this.data.vm.itSource });
    if (res && res.code === 200) { this.setData({ dayEditing: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 归档 ---------- */
  archive() {
    wx.showModal({ title: '归档订单', content: '归档后员工不可再编辑，仅管理员可在后台彻底删除。确认归档？', success: async r => {
      if (!r.confirm) return;
      this.setData({ archiving: true });
      const res = await wb.archiveOrder(this.data.id);
      this.setData({ archiving: false });
      if (res && res.code === 200) { this.load(); wx.showToast({ title: '已归档', icon: 'success' }); }
      else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
    } });
  },

  /* ---------- 导出 PDF ---------- */
  async exportPdf() {
    await wb.requestSubscribe(this.data.alert);
    wx.showLoading({ title: '生成中' });
    const res = await wb.exportPdf(this.data.id);
    if (!res || res.code !== 200 || !res.data) { wx.hideLoading(); wx.showToast({ title: (res && res.msg) || '生成失败', icon: 'none' }); return; }
    const fileID = res.data.fileID;
    if (fileID && wx.cloud && wx.cloud.downloadFile) {
      try {
        const d = await wx.cloud.downloadFile({ fileID });
        wx.hideLoading();
        wx.openDocument({ filePath: d.tempFilePath, fileType: 'pdf', showMenu: true });
        return;
      } catch (e) { /* 回退下方 */ }
    }
    wx.hideLoading();
    if (res.data.url) wx.setClipboardData({ data: res.data.url });
    wx.showToast({ title: '下载链接已复制', icon: 'none' });
  },

  noop() {}
});
