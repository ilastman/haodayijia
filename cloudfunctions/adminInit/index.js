const cloud = require('wx-server-sdk');

/**
 * 云函数：adminInit
 * 功能：初始化管理员账号（仅首次部署使用）
 * 字段（对齐本地 admin SEED.admin）：{ id, username, password, nickname, avatar, role, lastLogin, createTime, extend }
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { hashPassword } = require('./auth');

exports.main = async (event, context) => {
  const { username = 'admin', password = 'admin123', nickname = '管理员', role = 'super', avatar = '' } = event || {};
  try {
    const exists = await db.collection('adminUser').where({ username }).count();
    if (exists.total > 0) {
      return { code: 200, msg: '管理员已存在' };
    }
    await db.collection('adminUser').add({
      data: {
        id: 'admin_' + Date.now().toString(36),
        username,
        password: hashPassword(password),
        nickname,
        avatar,
        role,
        lastLogin: '',
        createTime: Date.now(),
        extend: {}
      }
    });
    return { code: 200, msg: '初始化管理员成功' };
  } catch (err) {
    return { code: 500, msg: '初始化失败', error: err };
  }
};
