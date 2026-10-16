const cloud = require('wx-server-sdk');

/**
 * 云函数：privateGroupCRUD
 * 功能：私家团线路增删改查（字段与本地 admin SEED 完全对齐）
 * 字段：{ id, title, cover, images, price, originalPrice, days, departure, dest, type, tags,
 *         brief, highlights, detailHtml, include, exclude, notices, reviews, itinerary, dayList, sort, online }
 * 权限：查询公开；增删改需管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'privateGroup';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

exports.main = async (event) => {
  const { action, token, data, id, ids, orderedIds, field } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      const r = await db.collection(COLL).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }
    if (action === 'get') {
      const f = await findBiz(id);
      return f ? { code: 200, data: strip(f) } : { code: 404, msg: '记录不存在' };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'add') {
      const doc = clean(data);
      if (!doc.id) doc.id = genId();
      if (!Array.isArray(doc.images)) doc.images = [];
      if (!Array.isArray(doc.tags)) doc.tags = [];
      if (!Array.isArray(doc.highlights)) doc.highlights = [];
      if (!Array.isArray(doc.include)) doc.include = [];
      if (!Array.isArray(doc.exclude)) doc.exclude = [];
      if (!Array.isArray(doc.reviews)) doc.reviews = [];
      if (!Array.isArray(doc.dayList)) doc.dayList = [];
      if (!Array.isArray(doc.itinerary)) doc.itinerary = [];
      doc.notices = Object.assign({ tips: [], gear: [], refund: [] }, doc.notices || {});
      if (doc.type === undefined) doc.type = '私家团';
      if (doc.departure === undefined) doc.departure = '海拉尔集合';
      if (doc.originalPrice === undefined) doc.originalPrice = 0;
      if (doc.online === undefined) doc.online = true;
      if (doc.sort === undefined) doc.sort = 0;
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id } };
    }
    if (action === 'update') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '记录不存在' };
      const d = clean(data); delete d.id;
      await db.collection(COLL).doc(f._id).update({ data: d });
      return { code: 200, msg: '更新成功' };
    }
    if (action === 'remove') {
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) { const f = await findBiz(bid); if (f) { await db.collection(COLL).doc(f._id).remove(); n++; } }
      return { code: 200, msg: '删除成功', data: { removed: n } };
    }
    if (action === 'reorder') {
      const list = Array.isArray(orderedIds) ? orderedIds : [];
      const fl = field || 'sort';
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const f = await findBiz(list[i]);
        if (f) { const val = fl === 'weight' ? (list.length - i) : (i + 1); await db.collection(COLL).doc(f._id).update({ data: { [fl]: val } }); n++; }
      }
      return { code: 200, msg: '排序更新成功', data: { updated: n } };
    }
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
