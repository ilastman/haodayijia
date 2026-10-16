const cloud = require('wx-server-sdk');

/**
 * 云函数：inspirationPostCRUD
 * 功能：灵感广场帖子查询 / 审核 / 删除；小程序公开发布（待审核）
 * 字段（与本地 admin SEED.inspirationPost 完全对齐）：
 *   { id, nickname, avatar, type:'note'|'plan', title, tags, cover, imgs, content,
 *     tripRef, category, days, season, highlights, timeline, intro, like, commentCount,
 *     comments, status:0待审核|1通过|2驳回, createTime, openid }
 * 权限：publicList/get 公开；list/add/update/remove 需管理员 token；publish 取 WX openid
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'inspirationPost';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

exports.main = async (event) => {
  const { action, token, data, id, ids } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'publicList') {
      const r = await db.collection(COLL).where({ status: 1 }).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }
    if (action === 'get') {
      const f = await findBiz(id);
      return f ? { code: 200, data: strip(f) } : { code: 404, msg: '记录不存在' };
    }
    if (action === 'publish') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: '无法获取openid' };
      const d = event.data || {};
      const ext = d.extend || {};
      const doc = {
        id: genId(),
        openid: OPENID,
        nickname: ext.authorName || '',
        avatar: ext.authorAvatar || '',
        type: d.postType === 'trip' ? 'plan' : 'note',
        title: ext.title || String(d.contentText || '').slice(0, 40),
        tags: Array.isArray(ext.tags) ? ext.tags : [],
        cover: d.coverImg || (ext.images && ext.images[0]) || '',
        imgs: Array.isArray(ext.images) ? ext.images : [],
        content: d.contentText || '',
        tripRef: ext.timeline || [],
        category: ext.category || '',
        days: ext.days || 0,
        season: ext.season || '',
        highlights: Array.isArray(ext.highlights) ? ext.highlights : [],
        timeline: Array.isArray(ext.timeline) ? ext.timeline : [],
        intro: ext.intro || '',
        like: 0,
        commentCount: 0,
        comments: [],
        status: 0,
        createTime: Date.now(),
        extend: ext
      };
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '发布成功，等待审核', data: { id: doc.id, _id: r._id } };
    }

    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'list') {
      const r = await db.collection(COLL).get();
      return { code: 200, data: (r.data || []).map(strip) };
    }
    if (action === 'add') {
      const doc = clean(data);
      if (!doc.id) doc.id = genId();
      if (doc.status === undefined) doc.status = 0;
      if (doc.like === undefined) doc.like = 0;
      if (!Array.isArray(doc.comments)) doc.comments = [];
      if (!doc.createTime) doc.createTime = Date.now();
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
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
