const wb = require('../../utils/workbench');
const api = require('../../utils/api');
const data = require('../../utils/data');
const reconLib = require('../../utils/recon');

const PAY_TYPES = ['定金', '中期款', '尾款', '其他'];
const COST_LABELS = { hotel: '酒店', car: '车辆', guide: '导游', ticket: '门票', meal: '餐费', misc: '杂费' };
const DRIVER_FIELDS = [
  { k: 'date', label: '日期', type: 'date' },
  { k: 'from', label: '出发地' },
  { k: 'to', label: '目的地' },
  { k: 'itinerary', label: '详细行程', type: 'textarea' },
  { k: 'route', label: '行车路线' },
  { k: 'vehicle', label: '用车信息（车型/车牌/司机）' },
  { k: 'km', label: '预计路程（公里）', type: 'digit' },
  { k: 'hotel', label: '入住酒店（房型×间数）' },
  { k: 'hotelPhone', label: '酒店联系电话' },
  { k: 'meals', label: '餐饮安排' },
  { k: 'tickets', label: '景区票种明细', type: 'textarea' },
  { k: 'scenicPhones', label: '景区联系电话', type: 'textarea' },
  { k: 'flight', label: '航班接送（当日）' },
  { k: 'remark', label: '其他备注', type: 'textarea' }
];
const FINANCE_SPEC = [
  { title: '景区1', name: 's1name', amount: 's1amount', status: 's1status', time: 's1time' },
  { title: '景区2', name: 's2name', amount: 's2amount', status: 's2status', time: 's2time' },
  { title: '景区3', name: 's3name', amount: 's3amount', status: 's3status', time: 's3time' },
  { title: '游玩1', name: 'p1name', amount: 'p1amount', status: 'p1status', time: 'p1time' },
  { title: '游玩2', name: 'p2name', amount: 'p2amount', status: 'p2status', time: 'p2time' },
  { title: '游玩3', name: 'p3name', amount: 'p3amount', status: 'p3status', time: 'p3time' },
  { title: '酒店住宿', name: 'hname', amount: 'hamount', status: 'hstatus', time: 'htime' },
  { title: '用车', amount: 'camount', status: 'cstatus', time: 'ctime' },
  { title: '餐饮', amount: 'mamount', status: 'mstatus', time: 'mtime' },
  { title: '保险/其他1', detail: 'e1detail', amount: 'e1amount', status: 'e1status', time: 'e1time' },
  { title: '保险/其他2', detail: 'e2detail', amount: 'e2amount', status: 'e2status', time: 'e2time' },
  { title: '保险/其他3', detail: 'e3detail', amount: 'e3amount', status: 'e3status', time: 'e3time' },
  { title: '司机报账', detail: 'claimDetail', amount: 'damount', status: 'dstatus', time: 'dtime' }
];

function finRowsOf(day) {
  const f = reconLib.financeFlat(day);
  return FINANCE_SPEC.map(s => ({
    title: s.title,
    showName: !!s.name,
    showDetail: !!s.detail,
    nameKey: s.name || '',
    detailKey: s.detail || '',
    amountKey: s.amount,
    statusKey: s.status,
    timeKey: s.time,
    nameVal: s.name ? (f[s.name] || '') : '',
    detailVal: s.detail ? (f[s.detail] || '') : '',
    amountVal: f[s.amount] || '',
    statusVal: f[s.status] || '未付',
    timeVal: f[s.time] || ''
  }));
}

function flatFromRows(rows) {
  const f = {};
  (rows || []).forEach(r => {
    if (r.nameKey) f[r.nameKey] = r.nameVal;
    if (r.detailKey) f[r.detailKey] = r.detailVal;
    f[r.amountKey] = r.amountVal;
    f[r.statusKey] = r.statusVal;
    f[r.timeKey] = r.timeVal;
  });
  return f;
}

function financeLines(day) {
  const lines = [];
  (day.scenics || []).forEach((s, i) => {
    if (s.name || s.amount) lines.push('景区' + (i + 1) + ' ' + (s.name || '未命名') + ' ¥' + (s.amount || 0) + ' ' + (s.payStatus || ''));
  });
  (day.plays || []).forEach((s, i) => {
    if (s.name || s.amount) lines.push('游玩' + (i + 1) + ' ' + (s.name || '未命名') + ' ¥' + (s.amount || 0) + ' ' + (s.payStatus || ''));
  });
  if (day.hotelCost && (day.hotelCost.name || day.hotelCost.amount)) lines.push('住宿 ' + (day.hotelCost.name || '') + ' ¥' + (day.hotelCost.amount || 0) + ' ' + day.hotelCost.payStatus);
  if (day.vehicleCost && day.vehicleCost.amount) lines.push('用车 ¥' + day.vehicleCost.amount + ' ' + day.vehicleCost.payStatus);
  if (day.mealCost && day.mealCost.amount) lines.push('餐饮 ¥' + day.mealCost.amount + ' ' + day.mealCost.payStatus);
  (day.extras || []).forEach((s, i) => {
    if (s.detail || s.amount) lines.push('其他' + (i + 1) + ' ' + (s.detail || '') + ' ¥' + (s.amount || 0) + ' ' + s.payStatus);
  });
  if (day.driverClaim && (day.driverClaim.detail || day.driverClaim.amount)) lines.push('司机报账 ' + (day.driverClaim.detail || '') + ' ¥' + (day.driverClaim.amount || 0) + ' ' + day.driverClaim.payStatus);
  return lines;
}

Page({
  data: {
    id: '',
    loading: true,
    order: null,
    vm: null,
    warn: { level: '', tags: [] },
    alert: {},
    scenicMap: {},

    openSec: { base: true, follow: true, itinerary: false, payment: true, cost: true, pricing: true, driver: true, finance: false, ticket: true },
    ticketRuleLines: reconLib.TICKET_RULES.map(r => r.label + '：' + r.names.join('、')),
    payStatuses: reconLib.PAY_STATUSES,
    driverVisible: false,
    driverIndex: 0,
    driverFields: [],
    driverDraftDays: [],
    financeVisible: false,
    financeIndex: 0,
    finRows: [],
    financeDraftDays: [],

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

    mtVisible: false,
    mtList: [],
    mtIndex: 0,
    mtLoading: false,

    dayEditing: false,
    dayDraft: [],

    archiving: false
  },

  onLoad(q) {
    this.orderId = (q && q.id) || '';
    if (!this.orderId) { wx.showToast({ title: '参数错误', icon: 'none' }); return; }
    this.setData({ id: this.orderId });
  },

  onShow() {
    if (this.orderId) this.load();
  },

  async load() {
    const id = this.orderId || this.data.id;
    if (!id) return;
    this.setData({ loading: true });
    const [order, alert, scenicMap] = await Promise.all([
      wb.getOrder(id), wb.alertConfig(), wb.scenicLeadMap()
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
    const model = reconLib.sanitizeRecon(o.recon, null);
    const summary = reconLib.ticketSummary(o);
    const reconDays = model.days.map(d => {
      const hits = summary.hits.filter(h => h.dayNum === d.dayNum);
      return Object.assign({}, d, {
        money: reconLib.dayMoney(d),
        hits,
        hitText: hits.map(h => h.label + '·' + h.name).join('、'),
        financeLines: financeLines(d)
      });
    });
    const financeSum = reconDays.reduce((s, d) => s + d.money.total, 0);
    const quote = wb.num((o.pricing && o.pricing.quote) || 0);
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
      itSource: it.source || 'blank',
      balance: quote - paidTotal,
      recon: {
        tripTitle: model.tripTitle,
        adults: model.adults,
        children: model.children,
        vehicle: model.vehicle,
        pickupTime: model.pickupTime,
        dropoffTime: model.dropoffTime,
        pickupPlace: model.pickupPlace,
        dropoffPlace: model.dropoffPlace
      },
      reconDays,
      financeSum,
      reconProfit: quote - financeSum,
      ticketText: summary.text,
      ticketHits: summary.hits.map((h, i) => Object.assign({ id: h.dayNum + '-' + h.name + '-' + i }, h))
    };
  },

  toggle(e) {
    const k = e.currentTarget.dataset.sec;
    this.setData({ ['openSec.' + k]: !this.data.openSec[k] });
  },

  oid() { return this.orderId || this.data.id; },
  goEdit() { wx.navigateTo({ url: '/pages/workbench-edit/workbench-edit?id=' + this.oid() }); },

  /* ---------- 跟进 ---------- */
  openFollow() { this.setData({ followVisible: true, followForm: { content: '', nextTime: '' } }); },
  closeFollow() { this.setData({ followVisible: false }); },
  onFollowInput(e) { this.setData({ ['followForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  async saveFollow() {
    const f = this.data.followForm;
    if (!String(f.content || '').trim()) { wx.showToast({ title: '请填写跟进内容', icon: 'none' }); return; }
    const res = await wb.addFollow(this.oid(), { content: f.content, nextTime: f.nextTime });
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
    const res = await wb.addPayment(this.oid(), p);
    if (res && res.code === 200) { this.setData({ payVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },
  removePay(e) {
    const pid = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除收款记录', content: '确认删除该条收款记录？', success: async r => {
      if (!r.confirm) return;
      const res = await wb.removePayment(this.oid(), pid);
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
    const res = await wb.addCost(this.oid(), costs);
    if (res && res.code === 200) { this.setData({ costVisible: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 报价 / 毛利 ---------- */
  openPrice() { this.setData({ priceVisible: true }); },
  closePrice() { this.setData({ priceVisible: false }); },
  onPriceInput(e) { this.setData({ ['priceForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  async savePrice() {
    const p = this.data.priceForm;
    const res = await wb.savePricing(this.oid(), { quote: wb.num(p.quote), estProfit: p.estProfit === '' ? null : wb.num(p.estProfit) });
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
    const go = async () => {
      const res = await wb.fromTemplate(this.oid(), t.id);
      if (res && res.code === 200) { this.setData({ tplVisible: false }); this.load(); wx.showToast({ title: '已生成', icon: 'success' }); }
      else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
    };
    if ((this.data.vm.days || []).length) {
      wx.showModal({ title: '复制线路模板', content: '将覆盖当前内部行程单。司机行程和财务对账不会被改动。', success: r => { if (r.confirm) go(); } });
    } else go();
  },

  /* ---------- 行程单：复制我的行程 ---------- */
  async openMyTrips() {
    this.setData({ mtLoading: true });
    let list = await api.myTrips();
    if (!list || !list.length) list = wx.getStorageSync('myTrips') || [];
    this.setData({ mtLoading: false });
    if (!list.length) { wx.showToast({ title: '暂无我的行程，请先在「我的行程」创建', icon: 'none' }); return; }
    this.setData({ mtVisible: true, mtList: list, mtIndex: 0 });
  },
  closeMyTrips() { this.setData({ mtVisible: false }); },
  onMtSelect(e) { this.setData({ mtIndex: Number(e.currentTarget.dataset.i) }); },
  doMyTrip() {
    const t = this.data.mtList[this.data.mtIndex];
    if (!t) return;
    wx.showModal({
      title: '复制我的行程',
      content: '将覆盖内部行程单，并清空本单报价、分项成本和收款台账。司机行程与财务对账不会被自动清空。',
      success: r => { if (r.confirm) this.applyMyTripNow(t); }
    });
  },
  async applyMyTripNow(t) {
    const days = (t.plans || []).map((p, i) => {
      const names = (p.scenicIds || []).map(id => { const s = data.getScenic(id); return s ? s.name : ''; }).filter(Boolean);
      const hotel = p.hotelId ? data.getHotel(p.hotelId) : null;
      const content = (names.join('、') + (p.note ? (names.length ? '\n' : '') + p.note : '')) || p.note || '';
      return {
        dayNum: i + 1,
        title: names[0] || ('第' + (i + 1) + '天'),
        content,
        scenicId: (p.scenicIds && p.scenicIds[0]) || '',
        hotelId: p.hotelId || '',
        meals: '',
        hotel: hotel ? hotel.name : ''
      };
    });
    if (!days.length) { wx.showToast({ title: '该行程没有可复制的天数', icon: 'none' }); return; }
    wx.showLoading({ title: '复制中' });
    const res = await wb.applyMyTrip(this.oid(), { tripId: t.id, title: t.title, days });
    wx.hideLoading();
    if (res && res.code === 200) {
      const nd = ((res.data && res.data.itinerary && res.data.itinerary.days) || days).map(d => Object.assign({}, d));
      await this.load();
      this.setData({ mtVisible: false, 'openSec.itinerary': true, dayEditing: true, dayDraft: nd });
      wx.showToast({ title: '已复制，可编辑', icon: 'none' });
    } else {
      wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
    }
  },

  /* ---------- 行程单：编辑 ---------- */
  editDays() {
    const days = (this.data.vm.days || []).map(d => Object.assign({ title: '', content: '', meals: '', hotel: '' }, d));
    if (!days.length) days.push({ dayNum: 1, title: '第1天', content: '', meals: '', hotel: '' });
    this.setData({ dayEditing: true, dayDraft: days, 'openSec.itinerary': true });
  },
  addDay() {
    const d = this.data.dayDraft.slice();
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
    const res = await wb.saveItinerary(this.oid(), { days: this.data.dayDraft, source: this.data.vm.itSource });
    if (res && res.code === 200) { this.setData({ dayEditing: false }); this.load(); }
    else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
  },

  /* ---------- 归档 ---------- */
  archive() {
    wx.showModal({ title: '归档订单', content: '归档后员工不可再编辑，仅管理员可在后台彻底删除。确认归档？', success: async r => {
      if (!r.confirm) return;
      this.setData({ archiving: true });
      const res = await wb.archiveOrder(this.oid());
      this.setData({ archiving: false });
      if (res && res.code === 200) { this.load(); wx.showToast({ title: '已归档', icon: 'success' }); }
      else wx.showToast({ title: (res && res.msg) || '失败', icon: 'none' });
    } });
  },

  /* ---------- 对账：司机 / 财务 ---------- */
  reconPayload(days) {
    const base = reconLib.sanitizeRecon(this.data.order && this.data.order.recon, null);
    if (days) base.days = days;
    return reconLib.sanitizeRecon(base, null);
  },
  async persistRecon(days) {
    const res = await wb.saveRecon(this.oid(), this.reconPayload(days));
    if (res && res.code === 200) {
      this.setData({ driverVisible: false, financeVisible: false });
      await this.load();
      wx.showToast({ title: '已保存', icon: 'success' });
      return true;
    }
    wx.showToast({ title: (res && res.msg) || '保存失败', icon: 'none' });
    return false;
  },
  openDriverAt(i, days) {
    const day = days[i];
    if (!day) return;
    const driverFields = DRIVER_FIELDS.map(f => Object.assign({}, f, { val: day[f.k] || '' }));
    this.setData({ driverVisible: true, driverIndex: i, driverDraftDays: days, driverFields, 'openSec.driver': true });
  },
  editDriver(e) {
    const i = Number(e.currentTarget.dataset.i);
    const days = reconLib.sanitizeRecon(this.data.order && this.data.order.recon, null).days;
    this.openDriverAt(i, days);
  },
  addReconDay() {
    const days = reconLib.sanitizeRecon(this.data.order && this.data.order.recon, null).days;
    if (days.length >= reconLib.MAX_DAYS) { wx.showToast({ title: '最多 31 天', icon: 'none' }); return; }
    const dates = reconLib.fillDates(this.data.order && this.data.order.departDate, days.length + 1);
    days.push(reconLib.emptyDay(days.length + 1, dates[days.length] || ''));
    this.openDriverAt(days.length - 1, days);
  },
  closeDriver() { this.setData({ driverVisible: false }); },
  onDriverInput(e) {
    const i = e.currentTarget.dataset.i;
    this.setData({ ['driverFields[' + i + '].val']: e.detail.value });
  },
  onDriverDate(e) {
    const i = e.currentTarget.dataset.i;
    this.setData({ ['driverFields[' + i + '].val']: e.detail.value });
  },
  async saveDriver() {
    const days = (this.data.driverDraftDays || []).map(d => Object.assign({}, d));
    const i = this.data.driverIndex;
    if (!days[i]) return;
    this.data.driverFields.forEach(f => { days[i][f.k] = f.val; });
    days.forEach((d, idx) => { d.dayNum = idx + 1; });
    await this.persistRecon(days);
  },
  deleteDriverDay() {
    wx.showModal({ title: '删除这一天', content: '这一天的司机行程和财务会一起删掉。', success: async r => {
      if (!r.confirm) return;
      const days = (this.data.driverDraftDays || []).slice();
      days.splice(this.data.driverIndex, 1);
      days.forEach((d, idx) => { d.dayNum = idx + 1; });
      await this.persistRecon(days);
    } });
  },
  editFinance(e) {
    const i = Number(e.currentTarget.dataset.i);
    const days = reconLib.sanitizeRecon(this.data.order && this.data.order.recon, null).days;
    if (!days[i]) return;
    this.setData({
      financeVisible: true,
      financeIndex: i,
      financeDraftDays: days,
      finRows: finRowsOf(days[i]),
      'openSec.finance': true
    });
  },
  closeFinance() { this.setData({ financeVisible: false }); },
  onFinInput(e) {
    const i = e.currentTarget.dataset.i;
    const f = e.currentTarget.dataset.f;
    this.setData({ ['finRows[' + i + '].' + f]: e.detail.value });
  },
  onFinStatus(e) {
    const i = e.currentTarget.dataset.i;
    const val = reconLib.PAY_STATUSES[Number(e.detail.value)] || '未付';
    this.setData({ ['finRows[' + i + '].statusVal']: val });
  },
  onFinDate(e) {
    const i = e.currentTarget.dataset.i;
    this.setData({ ['finRows[' + i + '].timeVal']: e.detail.value });
  },
  async saveFinance() {
    const days = (this.data.financeDraftDays || []).map(d => Object.assign({}, d));
    const i = this.data.financeIndex;
    if (!days[i]) return;
    days[i] = reconLib.applyFinanceFlat(days[i], flatFromRows(this.data.finRows));
    await this.persistRecon(days);
  },
  seedByDates() {
    const o = this.data.order || {};
    const n = reconLib.tripDayCount(o.departDate, o.returnDate);
    if (!n) { wx.showToast({ title: '请先填写出行和返程，且不超过 31 天', icon: 'none' }); return; }
    const run = () => {
      const dates = reconLib.fillDates(o.departDate, n);
      this.persistRecon(dates.map((date, i) => reconLib.emptyDay(i + 1, date)));
    };
    if ((this.data.vm.reconDays || []).length) {
      wx.showModal({ title: '按团期生成', content: '将覆盖已填写的司机行程和财务，生成 ' + n + ' 天空白记录。', success: r => { if (r.confirm) run(); } });
    } else run();
  },
  seedFromItinerary() {
    const o = this.data.order || {};
    const seeded = reconLib.fromItinerary(o);
    if (!seeded.length) { wx.showToast({ title: '内部行程单还没有天数', icon: 'none' }); return; }
    const run = () => this.persistRecon(seeded);
    if ((this.data.vm.reconDays || []).length) {
      wx.showModal({ title: '从行程单带入', content: '用内部行程单覆盖司机行程的日期、标题、安排、用餐和住宿。已填的财务会丢失。', success: r => { if (r.confirm) run(); } });
    } else run();
  },

  /* ---------- 导出对账明细 ---------- */
  async exportRecon() {
    await wb.requestSubscribe(this.data.alert);
    wx.showLoading({ title: '生成对账明细' });
    const res = await wb.exportRecon(this.oid());
    if (!res || res.code !== 200 || !res.data) {
      wx.hideLoading();
      const msg = (res && res.msg) || '生成失败';
      wx.showToast({ title: msg === '数据源不可用' ? '请先部署 workOrderXlsx' : msg, icon: 'none' });
      return;
    }
    const fileID = res.data.fileID;
    const fallback = () => {
      if (res.data.url) wx.setClipboardData({ data: res.data.url });
      wx.showToast({ title: res.data.url ? '下载链接已复制' : '无法打开文件', icon: 'none' });
    };
    if (fileID && wx.cloud && wx.cloud.downloadFile) {
      try {
        const d = await wx.cloud.downloadFile({ fileID });
        wx.hideLoading();
        wx.openDocument({ filePath: d.tempFilePath, fileType: 'xlsx', showMenu: true, fail: fallback });
        return;
      } catch (e) { /* 回退复制链接 */ }
    }
    wx.hideLoading();
    fallback();
  },

  noop() {}
});
