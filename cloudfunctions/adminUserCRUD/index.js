const cloud = require('wx-server-sdk');

/**
 * 云函数：adminUserCRUD
 * PC 后台管理员账号（与小程序员工 staff 完全隔离）
 * 查询/增删改仅超级管理员。分类：super=超级管理员，admin=普通后台管理员。
 * 用户名 admin 为初始超管，不可删除、停用或降级。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifySuperAdmin, hashPassword, isSuperDoc } = require('./auth');
const COLL = 'adminUser';

function genId() { return 'admin_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function isBuiltIn(doc) { return doc && String(doc.username) === 'admin'; }
function normRole(v) { return String(v || '') === 'super' ? 'super' : 'admin'; }
function normStatus(v) { return String(v || '') === 'disabled' ? 'disabled' : 'enabled'; }

function publicOf(doc) {
  if (!doc) return doc;
  return {
    id: doc.id || doc._id,
    username: doc.username,
    nickname: doc.nickname || '',
    role: isSuperDoc(doc) ? 'super' : 'admin',
    status: normStatus(doc.status),
    lastLogin: doc.lastLogin || '',
    createTime: doc.createTime || 0,
    locked: isBuiltIn(doc)
  };
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
    if (skip > 1000) break;
  }
  return out;
}

async function findBiz(id) {
  if (!id) return null;
  const r = await db.collection(COLL).where({ id }).limit(1).get();
  if (r.data && r.data[0]) return r.data[0];
  try {
    const d = await db.collection(COLL).doc(id).get();
    return d.data || null;
  } catch (e) { return null; }
}

function clearToken(extend) {
  const e = Object.assign({}, extend || {});
  delete e.token;
  delete e.tokenExpire;
  return e;
}

exports.main = async (event) => {
  const { action, token, data, id } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    const me = await verifySuperAdmin(token);
    if (!me) return { code: 403, msg: '无权限：仅超级管理员可管理后台账号' };

    if (action === 'list') {
      const raw = await listAll();
      const builtin = raw.filter(a => isBuiltIn(a) && a.role !== 'super');
      for (let i = 0; i < builtin.length; i++) {
        await db.collection(COLL).doc(builtin[i]._id).update({ data: { role: 'super', status: 'enabled' } });
        builtin[i].role = 'super';
        builtin[i].status = 'enabled';
      }
      const list = raw.map(publicOf);
      list.sort((a, b) => (a.createTime || 0) - (b.createTime || 0));
      return { code: 200, data: list };
    }

    if (action === 'add') {
      const username = String((data && data.username) || '').trim();
      const password = String((data && data.password) || '');
      const nickname = String((data && data.nickname) || '').trim();
      if (!username) return { code: 400, msg: '请填写登录账号' };
      if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) return { code: 400, msg: '账号仅限 3–32 位字母、数字或下划线' };
      if (password.length < 6) return { code: 400, msg: '密码至少 6 位' };
      const all = await listAll();
      if (all.some(a => a.username === username)) return { code: 400, msg: '账号已存在' };
      const doc = {
        id: genId(),
        username,
        password: hashPassword(password),
        nickname: nickname || username,
        avatar: '',
        role: normRole(data && data.role),
        status: 'enabled',
        lastLogin: '',
        createTime: Date.now(),
        extend: {}
      };
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '已新增后台管理员', data: { id: doc.id, _id: r._id } };
    }

    if (action === 'update') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '账号不存在' };
      const patch = {};
      if (data && data.nickname != null) patch.nickname = String(data.nickname).trim() || f.username;
      if (data && data.password) {
        if (String(data.password).length < 6) return { code: 400, msg: '密码至少 6 位' };
        patch.password = hashPassword(data.password);
        patch.extend = clearToken(f.extend);
      }
      if (data && data.role != null) {
        if (isBuiltIn(f) && normRole(data.role) !== 'super') return { code: 400, msg: '初始 admin 账号固定为超级管理员，不能降级' };
        patch.role = normRole(data.role);
      }
      if (data && data.status != null) {
        const st = normStatus(data.status);
        if (isBuiltIn(f) && st === 'disabled') return { code: 400, msg: '初始 admin 账号不能停用' };
        patch.status = st;
        if (st === 'disabled') patch.extend = clearToken(f.extend);
      }
      if (!Object.keys(patch).length) return { code: 400, msg: '没有可更新的字段' };
      await db.collection(COLL).doc(f._id).update({ data: patch });
      return { code: 200, msg: '已保存' };
    }

    if (action === 'remove') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '账号不存在' };
      if (isBuiltIn(f)) return { code: 400, msg: '初始 admin 账号不能删除' };
      if (f.id === me.id || f._id === me._id) return { code: 400, msg: '不能删除当前登录账号' };
      if (normRole(f.role) === 'super') {
        const supers = (await listAll()).filter(a => normRole(a.role) === 'super' && normStatus(a.status) !== 'disabled');
        if (supers.length <= 1) return { code: 400, msg: '至少保留一名超级管理员' };
      }
      await db.collection(COLL).doc(f._id).remove();
      return { code: 200, msg: '已删除' };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
