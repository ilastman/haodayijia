const cloud = require('wx-server-sdk');

/**
 * 云函数：clauseCRUD
 * 专属行程四段说明模板：费用包含 / 费用不含 / 出行须知 / 退改政策。
 * 集合 clauseTemplate。list 对小程序公开（只返回启用项）；增改删需管理员 token。
 * 库为空时写入与原先写死文案一致的四条标准模板。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const SEED = require('./seed');
const COLL = 'clauseTemplate';
const KINDS = ['include', 'exclude', 'notice', 'refund'];

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
function genId() { return 'clause_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function cleanList(list) {
  return (Array.isArray(list) ? list : []).map(x => String(x || '').trim()).filter(Boolean);
}

async function listAll() {
  const out = [];
  let skip = 0;
  for (;;) {
    let r;
    try { r = await db.collection(COLL).skip(skip).limit(100).get(); }
    catch (e) { return out; }
    const rows = (r && r.data) || [];
    out.push.apply(out, rows);
    if (rows.length < 100) break;
    skip += rows.length;
    if (skip > 2000) break;
  }
  return out;
}

async function findBiz(id) {
  if (!id) return null;
  const r = await db.collection(COLL).where({ id }).limit(1).get();
  return (r.data && r.data[0]) || null;
}

function normalize(data, id) {
  const src = data || {};
  const kind = String(src.kind || '').trim();
  if (KINDS.indexOf(kind) < 0) return { ok: false, msg: '类型必须是费用包含 / 费用不含 / 出行须知 / 退改政策' };
  const name = String(src.name || '').trim();
  if (!name) return { ok: false, msg: '请填写模板名称' };
  const doc = {
    id: id || src.id || genId(),
    kind,
    name: name.slice(0, 40),
    enabled: src.enabled !== false,
    sort: Number(src.sort) || 0,
    lines: kind === 'notice' ? [] : cleanList(src.lines),
    tips: kind === 'notice' ? cleanList(src.tips) : [],
    gear: kind === 'notice' ? cleanList(src.gear) : [],
    updatedAt: Date.now()
  };
  if (kind === 'notice') {
    if (!doc.tips.length && !doc.gear.length) return { ok: false, msg: '出行须知至少写一条注意事项或装备建议' };
  } else if (!doc.lines.length) {
    return { ok: false, msg: '请至少写一条内容' };
  }
  return { ok: true, doc };
}

async function ensureSeed() {
  let rows = await listAll();
  if (rows.length) return rows;
  for (const item of SEED) {
    await db.collection(COLL).add({ data: Object.assign({}, item, { updatedAt: Date.now() }) });
  }
  return listAll();
}

exports.main = async (event) => {
  const { action, token, data, id, ids, kind } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      let list = (await ensureSeed()).map(strip);
      const admin = await isAdmin(token);
      if (!admin) list = list.filter(t => t.enabled !== false);
      const want = kind || (data && data.kind);
      if (want) list = list.filter(t => t.kind === want);
      list.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
      return { code: 200, data: list };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'add' || action === 'update') {
      const exist = action === 'update' ? await findBiz(id || (data && data.id)) : null;
      if (action === 'update' && !exist) return { code: 404, msg: '模板不存在' };
      const norm = normalize(data, exist ? exist.id : (id || (data && data.id)));
      if (!norm.ok) return { code: 400, msg: norm.msg };
      if (exist) {
        await db.collection(COLL).doc(exist._id).update({ data: norm.doc });
        return { code: 200, msg: '已保存', data: { id: norm.doc.id } };
      }
      const dup = await findBiz(norm.doc.id);
      if (dup) return { code: 400, msg: '模板 id 已存在' };
      const r = await db.collection(COLL).add({ data: norm.doc });
      return { code: 200, msg: '已添加', data: { id: norm.doc.id, _id: r._id } };
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

    return { code: 400, msg: '未知 action' };
  } catch (err) {
    return { code: 500, msg: 'clauseCRUD 异常', error: String(err && err.message || err) };
  }
};
