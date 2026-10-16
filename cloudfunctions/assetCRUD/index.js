const cloud = require('wx-server-sdk');

/**
 * 云函数：assetCRUD
 * 功能：图片素材库增删查（字段与本地 admin SEED.assets 完全对齐）
 * 字段：{ id, url, name, size, time }（url 可为 cloud:// fileID）
 * 权限：查询公开；新增/删除需管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'asset';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

exports.main = async (event) => {
  const { action, token, data, id, ids } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      const r = await db.collection(COLL).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'add') {
      const doc = Object.assign({}, data || {});
      delete doc._id; delete doc._openid;
      if (!doc.id) doc.id = genId();
      if (!doc.time) doc.time = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id } };
    }
    if (action === 'remove') {
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
