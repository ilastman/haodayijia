const cloud = require('wx-server-sdk');

/**
 * 云函数：userTripCRUD
 * 功能：用户行程查询 / 保存（小程序「我的行程」）
 * 字段（与本地 admin SEED.userTrip 对齐）：
 *   { id, openid, nickname, avatar, title, days, cover, plan, plans, date, adults, children, guestAdultPrice, guestChildPrice, guestQuote, quote, status, createTime, updatedAt }
 * 权限：list/remove 需管理员 token；myTrips/save 取 WX openid
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, resolveStaff } = require('./auth');
const { packStoredCarUse, toPublicTrip } = require('./tripFields');
const COLL = 'userTrip';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
function genId() { return 'trip' + Date.now(); }

exports.main = async (event) => {
  const { action, token, id, ids, data } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    /* ---------- 管理端：查询全部 ---------- */
    if (action === 'list') {
      if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };
      const r = await db.collection(COLL).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }

    /* ---------- 小程序端：我的行程 ---------- */
    if (action === 'myTrips') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: '无法获取openid' };
      const r = await db.collection(COLL).where({ openid: OPENID }).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }

    /* ---------- 小程序端：保存/更新（按 openid + 本地id 去重） ---------- */
    if (action === 'save') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: '无法获取openid' };
      const d = data || {};
      const plans = Array.isArray(d.plans) ? d.plans.map(p => ({
        scenicIds: Array.isArray(p.scenicIds) ? p.scenicIds : [],
        hotelId: p.hotelId || '',
        altHotelIds: Array.isArray(p.altHotelIds) ? p.altHotelIds : [],
        note: p.note || '',
        roomType: p.roomType || '',
        roomQty: Math.max(1, parseInt(p.roomQty, 10) || 1),
        hotelBookings: (Array.isArray(p.hotelBookings) ? p.hotelBookings : []).filter(b => b && b.hotelId).slice(0, 10).map(b => ({ hotelId: String(b.hotelId), roomType: String(b.roomType || ''), roomQty: Math.max(1, parseInt(b.roomQty, 10) || 1) })),
        packageSelections: Array.isArray(p.packageSelections) ? p.packageSelections : [],
        promoImgs: (Array.isArray(p.promoImgs) ? p.promoImgs : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 2),
        scenicSnaps: (Array.isArray(p.scenicSnaps) ? p.scenicSnaps : []).filter(x => x && x.id).slice(0, 20),
        hotelSnaps: (Array.isArray(p.hotelSnaps) ? p.hotelSnaps : []).filter(x => x && x.id).slice(0, 10)
      })) : null;
      const plan = d.plan || (plans ? plans.map(p => p.note || '').filter(Boolean).join('\n') : '');
      const doc = {
        openid: OPENID,
        id: d.id || genId(),
        nickname: d.nickname || '',
        avatar: d.avatar || '',
        title: d.title || '我的专属行程',
        days: d.days || (plans ? plans.length : 0),
        cover: d.cover || '',
        carId: d.carId || '',
        plan,
        date: d.date || '',
        adults: isNaN(parseInt(d.adults, 10)) ? 2 : Math.max(1, parseInt(d.adults, 10)),
        children: isNaN(parseInt(d.children, 10)) ? 0 : Math.max(0, parseInt(d.children, 10)),
        guestName: String(d.guestName || '').trim().slice(0, 20),
        guestAdultPrice: Math.max(0, Number(d.guestAdultPrice) || 0),
        guestChildPrice: Math.max(0, Number(d.guestChildPrice) || 0),
        guestQuote: Math.max(0, Number(d.guestQuote) || 0), /* 对客总价 */
        audience: String(d.audience || '').trim().slice(0, 24),
        pace: String(d.pace || '').trim().slice(0, 24),
        clauses: (d.clauses && typeof d.clauses === 'object') ? d.clauses : null,
        quote: (d.quote && typeof d.quote === 'object') ? {
          hotel: Number(d.quote.hotel) || 0,
          ticket: Number(d.quote.ticket) || 0,
          total: Number(d.quote.total) || 0
        } : { hotel: 0, ticket: 0, total: 0 },
        status: d.status || '',
        createTime: d.createTime || d.savedAt || Date.now(),
        updatedAt: Date.now()
      };
      if (plans) doc.plans = plans;
      if (d.staffRemark !== undefined) doc.staffRemark = String(d.staffRemark || '').slice(0, 500);
      /* 没带计费日字段时不写，避免旧客户端把已保存的删减覆盖掉 */
      const carUse = packStoredCarUse(d);
      if (carUse) {
        doc.carUseCustom = carUse.carUseCustom;
        doc.carUseOffsets = carUse.carUseOffsets;
      }

      const exist = await db.collection(COLL).where({ openid: OPENID, id: doc.id }).limit(1).get();
      if (exist.data && exist.data.length) {
        await db.collection(COLL).doc(exist.data[0]._id).update({ data: doc });
        return { code: 200, msg: '更新成功', data: { id: doc.id } };
      }
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '保存成功', data: { id: doc.id, _id: r._id } };
    }

    /* ---------- 员工：我的行程备注（仅员工、仅本人名下行程） ---------- */
    if (action === 'setRemark') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: 'no openid' };
      if (!(await resolveStaff(OPENID))) return { code: 403, msg: '仅员工可备注' };
      if (!id) return { code: 400, msg: 'id必填' };
      const remark = String((data && data.staffRemark) || '').slice(0, 500);
      const r = await db.collection(COLL).where({ openid: OPENID, id }).update({ data: { staffRemark: remark, updatedAt: Date.now() } });
      const n = (r && r.stats && r.stats.updated) || 0;
      if (!n) {
        const e = await db.collection(COLL).where({ openid: OPENID, id }).limit(1).get();
        if (!(e.data && e.data.length)) return { code: 404, msg: '云端无此行程' };
      }
      return { code: 200, msg: 'ok' };
    }

    /* ---------- mini program: delete my own trip (openid scoped) ---------- */
    if (action === 'removeMine') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: 'no openid' };
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) {
        const r = await db.collection(COLL).where({ openid: OPENID, id: bid }).remove();
        n += (r && r.stats && r.stats.removed) || 0;
      }
      return { code: 200, msg: 'ok', data: { removed: n } };
    }

    /* ---------- 分享页：按 id 读取，去掉内部核算 ---------- */
    if (action === 'getPublic') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '行程不存在' };
      return { code: 200, data: toPublicTrip(strip(f)) };
    }

    /* ---------- 管理端：改人数 / 标题等（生成后仍可改） ---------- */
    if (action === 'update') {
      if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '行程不存在' };
      const d = data || {};
      const patch = { updatedAt: Date.now() };
      ['title', 'plan', 'status', 'cover', 'date'].forEach(k => { if (d[k] !== undefined) patch[k] = d[k]; });
      if (d.days !== undefined) patch.days = Math.max(1, parseInt(d.days, 10) || 1);
      if (d.adults !== undefined) patch.adults = Math.max(1, parseInt(d.adults, 10) || 1);
      if (d.children !== undefined) patch.children = Math.max(0, parseInt(d.children, 10) || 0);
      if (d.guestName !== undefined) patch.guestName = String(d.guestName || '').trim().slice(0, 20);
      if (d.guestAdultPrice !== undefined) patch.guestAdultPrice = Math.max(0, Number(d.guestAdultPrice) || 0);
      if (d.guestChildPrice !== undefined) patch.guestChildPrice = Math.max(0, Number(d.guestChildPrice) || 0);
      if (d.guestQuote !== undefined) patch.guestQuote = Math.max(0, Number(d.guestQuote) || 0);
      if (d.quote && typeof d.quote === 'object') {
        patch.quote = {
          hotel: Number(d.quote.hotel) || 0,
          ticket: Number(d.quote.ticket) || 0,
          total: Number(d.quote.total) || 0
        };
      }
      await db.collection(COLL).doc(f._id).update({ data: patch });
      return { code: 200, msg: '已保存' };
    }

    /* ---------- 管理端：删除 ---------- */
    if (action === 'remove' || action === 'delete') {
      if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) { const f = await findBiz(bid); if (f) { await db.collection(COLL).doc(f._id).remove(); n++; } }
      return { code: 200, msg: '删除成功', data: { removed: n } };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
