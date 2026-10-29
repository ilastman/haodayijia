const cloud = require('wx-server-sdk');

/**
 * 云函数：login
 * 功能：管理员登录（密码校验 + 生成登录 token 落库）
 * 运行环境：nodejs16
 * 字段（对齐本地 admin SEED.admin）：{ id, username, password, nickname, avatar, role, lastLogin }
 * 权限：公共调用（登录接口），仅与管理员表 adminUser 交互
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { hashPassword, generateToken, verifyAdminToken } = require('./auth');

const TOKEN_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7天有效期

exports.main = async (event, context) => {
  const { action, username, password, token } = event || {};

  /* ---------- 退出登录：清除 token ---------- */
  if (action === 'logout') {
    try {
      const admin = await verifyAdminToken(token);
      if (admin) {
        const extend = Object.assign({}, admin.extend || {});
        delete extend.token; delete extend.tokenExpire;
        await db.collection('adminUser').doc(admin._id).update({ data: { extend } });
      }
    } catch (e) { /* ignore */ }
    return { code: 200, msg: '已退出登录' };
  }

  if (!username || !password) {
    return { code: 400, msg: '参数缺失：username、password必填' };
  }

  try {
    const res = await db.collection('adminUser').where({ username }).limit(1).get();
    if (!res.data || res.data.length === 0) {
      return { code: 401, msg: '账号或密码错误' };
    }

    const admin = res.data[0];
    if (admin.status === 'disabled') return { code: 403, msg: '账号已停用，请联系超级管理员' };
    // 兼容：已加密的按 hash 比对；历史明文则直接比对并升级为加密
    const inputHash = hashPassword(password);
    const ok = admin.password === inputHash || admin.password === password;
    if (!ok) return { code: 401, msg: '账号或密码错误' };

    const now = Date.now();
    const newToken = generateToken(admin.username);
    const expire = now + TOKEN_EXPIRE_MS;
    const lastLogin = new Date(now).toISOString().slice(0, 19).replace('T', ' ');

    const extend = Object.assign({}, admin.extend || {}, { token: newToken, tokenExpire: expire, lastLogin: now });
    const upd = { password: inputHash, lastLogin, extend };
    if (admin.username === 'admin') upd.role = 'super';
    await db.collection('adminUser').doc(admin._id).update({ data: upd });

    return {
      code: 200,
      msg: '登录成功',
      data: {
        token: newToken,
        expiresAt: expire,
        admin: { id: admin.id || admin._id, username: admin.username, nickname: admin.nickname || admin.username, role: (admin.username === 'admin' || admin.role === 'super') ? 'super' : 'admin' }
      }
    };
  } catch (err) {
    return { code: 500, msg: '登录失败', error: err };
  }
};
