const cloud = require('wx-server-sdk');

/**
 * 云函数：dataExport
 * 功能：导出全部（或指定）集合数据，返回JSON，供迁移到自建Node后端使用
 * 运行环境：nodejs16
 * 权限：需管理员token
 * 入参：{ token, collections?: string[] }  不传则导出全部8个集合
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');

const ALL_COLLECTIONS = [
  'homeModule', 'banner', 'scenic', 'hotel',
  'privateGroup', 'userTrip', 'inspirationPost', 'adminUser',
  'globalConfig', 'asset',
  'staff', 'order', 'opLog'
];

async function fetchAll(name) {
  const MAX = 100;
  const countRes = await db.collection(name).count();
  const total = countRes.total || 0;
  const times = Math.ceil(total / MAX);
  const tasks = [];
  for (let i = 0; i < times; i++) {
    tasks.push(db.collection(name).skip(i * MAX).limit(MAX).get());
  }
  const results = await Promise.all(tasks);
  let data = [];
  results.forEach(r => { data = data.concat(r.data || []); });
  return data;
}

exports.main = async (event, context) => {
  const { token, collections } = event || {};
  const admin = await verifyAdminToken(token);
  if (!admin) return { code: 403, msg: '无权限：需管理员登录token' };

  const targets = Array.isArray(collections) && collections.length ? collections : ALL_COLLECTIONS;

  try {
    const dump = {};
    for (const name of targets) {
      dump[name] = await fetchAll(name);
    }
    return {
      code: 200,
      msg: '导出成功',
      data: { exportTime: Date.now(), collections: dump }
    };
  } catch (err) {
    return { code: 500, msg: '导出失败', error: err };
  }
};
