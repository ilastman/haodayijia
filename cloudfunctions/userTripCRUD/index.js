const cloud = require('wx-server-sdk');

/**
 * 云函数：userTripCRUD
 * 功能：用户行程查询 / 保存（小程序「我的行程」）
 * 字段（与本地 admin SEED.userTrip 对齐）：
 *   { id, openid, nickname, avatar, title, days, cover, plan, plans, date, status, createTime, updatedAt }
 * 权限：list/remove 需管理员 token；myTrips/save 取 WX openid
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
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
        note: p.note || ''
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
        plan,
        date: d.date || '',
        status: d.status || '',
        createTime: d.createTime || d.savedAt || Date.now(),
        updatedAt: Date.now()
      };
      if (plans) doc.plans = plans;

      const exist = await db.collection(COLL).where({ openid: OPENID, id: doc.id }).limit(1).get();
      if (exist.data && exist.data.length) {
        await db.collection(COLL).doc(exist.data[0]._id).update({ data: doc });
        return { code: 200, msg: '更新成功', data: { id: doc.id } };
      }
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '保存成功', data: { id: doc.id, _id: r._id } };
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
