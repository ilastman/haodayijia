const cloud = require('wx-server-sdk');

/**
 * 云函数：galleryCRUD
 * 分类图库：酒店两级、景区三级（与 category 树同一套节点），以及私人定制封面层。
 * 字段：{ id, url, name, size, time, tree, categoryId, role }
 *   tree: hotel | scenic | customCover
 *   role: image（宣传图，挂在酒店/景区节点）| cover（仅 customCover）
 * 权限：list 公开；新增/删除需管理员 token。封面不能写入酒店或景区节点。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const { normalizeGalleryDoc } = require('./rules');
const COLL = 'gallery';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
function genId() { return 'gal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

async function listAll(coll) {
  const out = [];
  let skip = 0;
  for (;;) {
    let r;
    try { r = await db.collection(coll).skip(skip).limit(100).get(); }
    catch (e) { return out; }
    const rows = (r && r.data) || [];
    out.push.apply(out, rows);
    if (rows.length < 100) break;
    skip += rows.length;
    if (skip > 3000) break;
  }
  return out;
}

async function findBiz(id) {
  if (!id) return null;
  const r = await db.collection(COLL).where({ id }).limit(1).get();
  return (r.data && r.data[0]) || null;
}

exports.main = async (event) => {
  const { action, token, data, id, ids, tree, categoryId } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      let list = (await listAll(COLL)).map(strip);
      const t = tree || (data && data.tree);
      const cid = categoryId || (data && data.categoryId);
      if (t) list = list.filter(g => g.tree === t);
      if (cid) list = list.filter(g => g.categoryId === cid);
      list.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
      return { code: 200, data: list };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'add') {
      const cats = await listAll('category');
      const norm = normalizeGalleryDoc(data, cats);
      if (!norm.ok) return { code: 400, msg: norm.msg };
      const doc = Object.assign({
        id: (data && data.id) || genId(),
        time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, norm.doc);
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '已上传', data: { id: doc.id, _id: r._id } };
    }

    if (action === 'remove') {
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) {
        const f = await findBiz(bid);
        if (f) { await db.collection(COLL).doc(f._id).remove(); n++; }
      }
      return { code: 200, msg: '已删除', data: { removed: n } };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
