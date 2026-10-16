const cloud = require('wx-server-sdk');

/**
 * 云函数：orderCRUD
 * 功能：员工销售工作台 客户/订单（一客户一订单）读写
 * 运行环境：nodejs16
 * 权限与隔离（服务端强制）：
 *   - 管理员 token：可全局读、硬删除（唯一）、报表
 *   - 员工：按 WX 上下文 OPENID → staff 表解析归属，仅可读写本人 staffId 的记录；
 *     客户端传入的 staffId 一律忽略/覆盖；员工无删除能力
 * 说明：所有内部价格/成本/利润仅存于本集合（安全规则 read/write=false），游客不可达。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, resolveStaff } = require('./auth');

const COLL = 'order';
const STAFF = 'staff';
const LOG = 'opLog';
const GROUPS = 'privateGroup';

const COST_KEYS = ['hotel', 'car', 'guide', 'ticket', 'meal', 'misc'];
const STATUSES = ['意向客户', '待确认行程', '待定金', '待尾款', '待出团', '已完结', '客户流失'];

function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
function genId() { return 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }

function normalizeCosts(costs) {
  const c = {};
  COST_KEYS.forEach(k => { c[k] = num(costs && costs[k]); });
  return c;
}
function computeDerived(order) {
  const costs = normalizeCosts(order.costs);
  order.costs = costs;
  const totalCost = COST_KEYS.reduce((s, k) => s + num(costs[k]), 0);
  order.totalCost = totalCost;
  const pricing = Object.assign({ quote: 0, estProfit: null, actualProfit: 0 }, order.pricing || {});
  const quote = num(pricing.quote);
  const actualProfit = quote - totalCost;
  const estProfit = (pricing.estProfit === null || pricing.estProfit === undefined || pricing.estProfit === '')
    ? actualProfit : num(pricing.estProfit);
  order.pricing = { quote, estProfit, actualProfit };
  return order;
}
function initStructure(order) {
  order.customer = Object.assign({ name: '', phone: '', wechat: '', source: '', remark: '' }, order.customer || {});
  if (!Array.isArray(order.followUps)) order.followUps = [];
  order.itinerary = Object.assign(
    { source: 'blank', templateId: '', days: [], include: [], exclude: [], notices: { tips: [], gear: [], refund: [] }, versions: [] },
    order.itinerary || {}
  );
  order.itinerary.notices = Object.assign({ tips: [], gear: [], refund: [] }, order.itinerary.notices || {});
  if (!Array.isArray(order.itinerary.versions)) order.itinerary.versions = [];
  if (!Array.isArray(order.payments)) order.payments = [];
  if (STATUSES.indexOf(order.status) < 0) order.status = '意向客户';
  order.urgency = !!order.urgency;
  order.archived = !!order.archived;
  return order;
}

async function log(actor, action, targetId, summary, before, after) {
  try {
    await db.collection(LOG).add({
      data: {
        id: 'log_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        staffId: (actor && actor.id) || '',
        staffName: (actor && actor.name) || 'system',
        action, targetType: 'order', targetId: targetId || '',
        summary: summary || '', before: before || null, after: after || null,
        time: Date.now()
      }
    });
  } catch (e) { /* ignore */ }
}

/* 解析调用者身份：admin 或 staff */
async function resolveCtx(token) {
  const admin = await verifyAdminToken(token);
  if (admin) return { admin: true, actor: { id: 'admin', name: (admin.nickname || admin.username || '管理员') } };
  const { OPENID } = cloud.getWXContext();
  const staff = await resolveStaff(OPENID);
  if (staff) return { staff, actor: { id: staff.id, name: staff.name } };
  return {};
}

/* 载入并校验归属；forEdit=true 时归档订单禁止编辑（管理员同样受限） */
async function loadOwned(id, ctx, forEdit) {
  const order = await findBiz(id);
  if (!order) return { err: { code: 404, msg: '订单不存在' } };
  if (forEdit && order.archived) return { err: { code: 403, msg: '订单已归档，不可编辑' } };
  if (ctx.admin) return { order };
  if (!ctx.staff) return { err: { code: 403, msg: '未识别到员工身份' } };
  if (order.staffId !== ctx.staff.id) return { err: { code: 403, msg: '无权访问该订单' } };
  return { order };
}

exports.main = async (event) => {
  const { action, token, data, id, ids } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };

  try {
    const ctx = await resolveCtx(token);

    /* ---------- 列表 ---------- */
    if (action === 'list' || action === 'adminList') {
      if (!ctx.admin && !ctx.staff) return { code: 403, msg: '未识别到身份' };
      let where = {};
      if (!ctx.admin) where.staffId = ctx.staff.id;
      if (event.archived === true) where.archived = true;
      else if (event.archived === false) where.archived = false;
      if (event.staffId && ctx.admin) where.staffId = event.staffId;
      const r = await db.collection(COLL).where(where).limit(1000).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }

    /* ---------- 详情 ---------- */
    if (action === 'get') {
      const { order, err } = await loadOwned(id, ctx, false);
      if (err) return err;
      return { code: 200, data: strip(order) };
    }

    /* ---------- 新增 ---------- */
    if (action === 'add') {
      if (!ctx.admin && !ctx.staff) return { code: 403, msg: '未识别到身份' };
      const doc = initStructure(clean(data));
      if (!doc.id) doc.id = genId();
      if (ctx.admin) {
        // 管理员可指定归属员工
        const sid = doc.staffId || (data && data.staffId);
        if (!sid) return { code: 400, msg: '管理员创建订单需指定归属员工' };
        const sr = await db.collection(STAFF).where({ id: sid }).limit(1).get();
        if (!sr.data || !sr.data.length) return { code: 404, msg: '归属员工不存在' };
        doc.staffId = sid;
        doc.staffName = sr.data[0].name;
      } else {
        doc.staffId = ctx.staff.id;
        doc.staffName = ctx.staff.name;
      }
      doc.createTime = Date.now();
      doc.updatedAt = doc.createTime;
      computeDerived(doc);
      const r = await db.collection(COLL).add({ data: doc });
      await log(ctx.actor, 'add', doc.id, '新增订单：' + (doc.customer.name || '未命名客户'), null, { customer: doc.customer.name, dest: doc.dest });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id } };
    }

    /* ---------- 编辑 ---------- */
    if (action === 'update') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const d = clean(data);
      delete d.id; delete d.staffId; delete d.staffName; delete d.createTime;
      delete d.archived; delete d.archivedAt; delete d.followUps; delete d.payments;
      // 合并基础字段
      Object.keys(d).forEach(k => { order[k] = d[k]; });
      initStructure(order);
      computeDerived(order);
      order.updatedAt = Date.now();
      const out = clean(order); delete out._id; delete out._openid;
      await db.collection(COLL).doc(order._id).update({ data: out });
      await log(ctx.actor, 'update', order.id, '编辑订单：' + (order.customer.name || ''));
      return { code: 200, msg: '更新成功' };
    }

    /* ---------- 归档 ---------- */
    if (action === 'archive' || action === 'unarchive') {
      const { order, err } = await loadOwned(id, ctx, false);
      if (err) return err;
      if (!ctx.admin && action === 'unarchive') return { code: 403, msg: '无权限：仅管理员可取消归档' };
      const archived = action === 'archive';
      await db.collection(COLL).doc(order._id).update({ data: { archived, archivedAt: archived ? Date.now() : 0, updatedAt: Date.now() } });
      await log(ctx.actor, action, order.id, (archived ? '归档' : '取消归档') + '订单：' + (order.customer.name || ''));
      return { code: 200, msg: archived ? '已归档' : '已取消归档' };
    }

    /* ---------- 跟进记录（只增） ---------- */
    if (action === 'addFollow') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const f = (data && data.follow) || event.follow || data || {};
      const rec = {
        id: 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        time: f.time || new Date().toISOString().slice(0, 10),
        content: String(f.content || '').trim(),
        nextTime: f.nextTime || '',
        operator: ctx.actor.name,
        staffId: ctx.actor.id,
        createTime: Date.now()
      };
      if (!rec.content) return { code: 400, msg: '请填写跟进内容' };
      const followUps = (order.followUps || []).concat([rec]);
      await db.collection(COLL).doc(order._id).update({ data: { followUps, updatedAt: Date.now() } });
      await log(ctx.actor, 'addFollow', order.id, '新增跟进记录');
      return { code: 200, msg: '已记录', data: { follow: rec } };
    }

    /* ---------- 收款台账 ---------- */
    if (action === 'addPayment' || action === 'removePayment') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      let payments = (order.payments || []).slice();
      if (action === 'addPayment') {
        const p = (data && data.payment) || event.payment || data || {};
        const rec = {
          id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          type: p.type || '定金',
          amount: num(p.amount),
          time: p.time || new Date().toISOString().slice(0, 10),
          dueDate: p.dueDate || '',
          voucher: p.voucher || '',
          remark: p.remark || '',
          createTime: Date.now()
        };
        if (!rec.amount) return { code: 400, msg: '请填写收款金额' };
        payments.push(rec);
      } else {
        const pid = (data && data.paymentId) || event.paymentId;
        payments = payments.filter(x => x.id !== pid);
      }
      await db.collection(COLL).doc(order._id).update({ data: { payments, updatedAt: Date.now() } });
      await log(ctx.actor, action, order.id, action === 'addPayment' ? '新增收款记录' : '删除收款记录');
      return { code: 200, msg: '已保存', data: { payments } };
    }

    /* ---------- 分项成本 ---------- */
    if (action === 'addCost') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const costs = normalizeCosts(Object.assign({}, order.costs || {}, (data && data.costs) || event.costs || {}));
      order.costs = costs;
      computeDerived(order);
      await db.collection(COLL).doc(order._id).update({ data: { costs: order.costs, totalCost: order.totalCost, pricing: order.pricing, updatedAt: Date.now() } });
      await log(ctx.actor, 'addCost', order.id, '更新成本核算（总成本 ' + order.totalCost + '）');
      return { code: 200, msg: '已保存', data: { costs: order.costs, totalCost: order.totalCost, pricing: order.pricing } };
    }

    /* ---------- 报价 / 预估毛利 ---------- */
    if (action === 'savePricing') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const pr = (data && data.pricing) || event.pricing || {};
      order.pricing = Object.assign({}, order.pricing || {}, pr);
      computeDerived(order);
      await db.collection(COLL).doc(order._id).update({ data: { pricing: order.pricing, updatedAt: Date.now() } });
      await log(ctx.actor, 'savePricing', order.id, '更新报价/毛利');
      return { code: 200, msg: '已保存', data: { pricing: order.pricing, totalCost: order.totalCost } };
    }

    /* ---------- 内部行程单 ---------- */
    if (action === 'saveItinerary') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const it = (data && data.itinerary) || event.itinerary || {};
      const prev = order.itinerary || {};
      const versions = (prev.versions || []).slice();
      versions.push({ id: 'v_' + Date.now().toString(36), time: Date.now(), operator: ctx.actor.name, snapshot: {
        source: prev.source, templateId: prev.templateId, days: prev.days || [],
        include: prev.include || [], exclude: prev.exclude || [], notices: prev.notices || {}
      } });
      const next = Object.assign({}, prev, it, { versions });
      next.notices = Object.assign({ tips: [], gear: [], refund: [] }, next.notices || {});
      await db.collection(COLL).doc(order._id).update({ data: { itinerary: next, updatedAt: Date.now() } });
      await log(ctx.actor, 'saveItinerary', order.id, '保存内部行程单');
      return { code: 200, msg: '已保存', data: { itinerary: next } };
    }

    /* ---------- 从线路模板生成行程单 ---------- */
    if (action === 'fromTemplate') {
      const { order, err } = await loadOwned(id, ctx, true);
      if (err) return err;
      const templateId = (data && data.templateId) || event.templateId;
      if (!templateId) return { code: 400, msg: '请选择线路模板' };
      const tr = await db.collection(GROUPS).where({ id: templateId }).limit(1).get();
      if (!tr.data || !tr.data.length) return { code: 404, msg: '模板不存在' };
      const t = tr.data[0];
      const days = (t.dayList || []).map((d, i) => ({
        dayNum: d.dayNum || (i + 1),
        title: d.title || ('第' + (i + 1) + '天'),
        content: d.content || '',
        spots: d.spots || [],
        scenicId: d.scenicId || '',
        hotelId: d.hotelId || '',
        meals: d.meals || '',
        hotel: d.hotel || ''
      }));
      const prev = order.itinerary || {};
      const versions = (prev.versions || []).slice();
      versions.push({ id: 'v_' + Date.now().toString(36), time: Date.now(), operator: ctx.actor.name, snapshot: { source: prev.source, templateId: prev.templateId, days: prev.days || [], include: prev.include || [], exclude: prev.exclude || [], notices: prev.notices || {} } });
      const next = {
        source: 'template', templateId,
        days,
        include: t.include || [], exclude: t.exclude || [],
        notices: Object.assign({ tips: [], gear: [], refund: [] }, t.notices || {}),
        versions
      };
      await db.collection(COLL).doc(order._id).update({ data: { itinerary: next, updatedAt: Date.now() } });
      await log(ctx.actor, 'saveItinerary', order.id, '复制线路模板生成行程单：' + (t.title || templateId));
      return { code: 200, msg: '已生成', data: { itinerary: next } };
    }

    /* ---------- 管理员：全员台账汇总 ---------- */
    if (action === 'report') {
      if (!ctx.admin) return { code: 403, msg: '无权限：需管理员token' };
      const r = await db.collection(COLL).limit(1000).get();
      const list = r.data || [];
      const byStatus = {}; STATUSES.forEach(s => { byStatus[s] = 0; });
      const byStaff = {};
      let totalQuote = 0, totalCost = 0, totalEst = 0, totalActual = 0;
      list.forEach(o => {
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        const sid = o.staffId || 'unknown';
        if (!byStaff[sid]) byStaff[sid] = { staffId: sid, staffName: o.staffName || '', count: 0, quote: 0, cost: 0, est: 0, actual: 0 };
        const b = byStaff[sid];
        const quote = num(o.pricing && o.pricing.quote);
        const cost = num(o.totalCost);
        b.count++; b.quote += quote; b.cost += cost;
        b.est += num(o.pricing && o.pricing.estProfit);
        b.actual += num(o.pricing && o.pricing.actualProfit);
        totalQuote += quote; totalCost += cost;
        totalEst += num(o.pricing && o.pricing.estProfit);
        totalActual += num(o.pricing && o.pricing.actualProfit);
      });
      return {
        code: 200,
        data: {
          count: list.length, totalQuote, totalCost, totalEst, totalActual,
          grossProfit: totalQuote - totalCost,
          byStatus, byStaff: Object.keys(byStaff).map(k => byStaff[k]),
          archived: list.filter(o => o.archived).length
        }
      };
    }

    /* ---------- 管理员：硬删除（唯一删除权限） ---------- */
    if (action === 'delete' || action === 'remove') {
      if (!ctx.admin) return { code: 403, msg: '无权限：仅管理员可删除订单' };
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) {
        const f = await findBiz(bid);
        if (f) {
          await db.collection(COLL).doc(f._id).remove();
          await log(ctx.actor, 'delete', f.id, '管理员彻底删除订单：' + (f.customer && f.customer.name || ''), { staffId: f.staffId, customer: f.customer }, null);
          n++;
        }
      }
      return { code: 200, msg: '删除成功', data: { removed: n } };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
