const cloud = require('wx-server-sdk');

/**
 * 云函数：userCRUD
 * 功能：小程序游客用户档案（头像 / 昵称）
 *   - me          ：按 WX openid 取/建用户文档（新建时分配随机默认头像）
 *   - saveProfile ：更新当前用户昵称 / 头像（云存储 fileID），按 openid 隔离
 *   - list        ：管理员读取用户列表（供 PC 后台用户管理合并展示）
 * 集合：user  字段：{ id, openid, nickname, avatarUrl, avatarType, createTime, updateTime }
 * 权限：me / saveProfile 需微信登录态（openid）；list 需管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'user';

const DEFAULT_AVATARS = 8;

function genId() { return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* 按 openid 稳定哈希分配 1..DEFAULT_AVATARS 的默认头像 */
function defaultAvatar(openid) {
  const s = String(openid || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  const n = (h % DEFAULT_AVATARS) + 1;
  return '/images/avatars/a' + n + '.png';
}

function publicUser(u) {
  if (!u) return null;
  return {
    openid: u.openid || '',
    nickname: u.nickname || '',
    avatarUrl: u.avatarUrl || '',
    avatarType: u.avatarType || 'default',
    createTime: u.createTime || '',
    updateTime: u.updateTime || ''
  };
}

async function findByOpenid(openid) {
  if (!openid) return null;
  const r = await db.collection(COLL).where({ openid }).limit(1).get();
  return (r.data && r.data[0]) || null;
}

exports.main = async (event) => {
  const { action, token, data } = event || {};
  const wxCtx = cloud.getWXContext();
  const openid = wxCtx && wxCtx.OPENID;

  try {
    /* ---------- 当前用户档案（取或建） ---------- */
    if (!action || action === 'me') {
      if (!openid) return { code: 401, msg: '未获取到微信登录态' };
      let u = await findByOpenid(openid);
      if (!u) {
        const now = Date.now();
        const doc = {
          id: genId(),
          openid,
          nickname: '',
          avatarUrl: defaultAvatar(openid),
          avatarType: 'default',
          createTime: now,
          updateTime: now
        };
        await db.collection(COLL).add({ data: doc });
        return { code: 200, data: Object.assign(publicUser(doc), { isNew: true }) };
      }
      return { code: 200, data: Object.assign(publicUser(u), { isNew: false }) };
    }

    /* ---------- 保存昵称 / 头像 ---------- */
    if (action === 'saveProfile') {
      if (!openid) return { code: 401, msg: '未获取到微信登录态' };
      const d = data || {};
      const patch = { updateTime: Date.now() };
      if (d.nickname !== undefined) {
        const nick = String(d.nickname || '').trim().slice(0, 30);
        if (nick) patch.nickname = nick;
      }
      if (d.avatarUrl !== undefined) {
        const url = String(d.avatarUrl || '');
        const ok = url.indexOf('cloud://') === 0 || url.indexOf('/images/avatars/') === 0;
        if (!ok) return { code: 400, msg: '头像地址不合法' };
        patch.avatarUrl = url;
        patch.avatarType = url.indexOf('cloud://') === 0 ? 'custom' : 'default';
      }
      const u = await findByOpenid(openid);
      if (!u) {
        const now = Date.now();
        const doc = Object.assign({
          id: genId(), openid, nickname: '', avatarUrl: defaultAvatar(openid), avatarType: 'default', createTime: now
        }, patch);
        await db.collection(COLL).add({ data: doc });
        return { code: 200, msg: '已保存', data: publicUser(doc) };
      }
      await db.collection(COLL).doc(u._id).update({ data: patch });
      return { code: 200, msg: '已保存', data: publicUser(Object.assign({}, u, patch)) };
    }

    /* ---------- 管理员读取 ---------- */
    if (action === 'list') {
      if (!(await verifyAdminToken(token))) return { code: 403, msg: '无权限：需管理员token' };
      const r = await db.collection(COLL).get();
      return { code: 200, data: (r.data || []).map(publicUser) };
    }

    return { code: 400, msg: '不支持的 action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
