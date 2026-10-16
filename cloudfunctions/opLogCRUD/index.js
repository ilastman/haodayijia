const cloud = require('wx-server-sdk');

/**
 * 云函数：opLogCRUD
 * 功能：全局操作日志读取（只增，写入由各业务云函数内部完成）
 * 运行环境：nodejs16
 * 权限：仅管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'opLog';

exports.main = async (event) => {
  const { action, token, staffId, targetId, limit } = event || {};
  try {
    const admin = await verifyAdminToken(token);
    if (!admin) return { code: 403, msg: '无权限：需管理员token' };

    if (!action || action === 'list') {
      let where = {};
      if (staffId) where.staffId = staffId;
      if (targetId) where.targetId = targetId;
      const cap = Math.min(Number(limit) || 500, 1000);
      const r = await db.collection(COLL).where(where).orderBy('time', 'desc').limit(cap).get();
      return { code: 200, data: (r.data || []).map(d => { const x = Object.assign({}, d); delete x._id; delete x._openid; return x; }) };
    }
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
