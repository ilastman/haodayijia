const cloud = require('wx-server-sdk');

/**
 * 云函数：dataSeed
 * 功能：将本地演示内容（admin SEED）导入云数据库，按业务 id 去重（存在则更新，不存在则新增）
 * 数据来源：./seed.json（由 tools/build-cloud-seed.js 从 admin/js/data.js 生成）
 * 权限：需管理员 token；或显式传 confirm:'SEED'（用于首次云端初始化）
 * 入参：{ token } 或 { confirm: 'SEED' }
 * 说明：adminUser 不在此导入，请使用 adminInit 初始化管理员。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const seed = require('./seed.json');

// seed 集合名 -> 云集合名
const MAP = { assets: 'asset' };

async function upsertByBizId(coll, doc) {
  const data = Object.assign({}, doc);
  const id = data.id;
  if (id !== undefined && id !== null && id !== '') {
    const r = await db.collection(coll).where({ id }).limit(1).get();
    if (r.data && r.data.length) {
      const u = Object.assign({}, data); delete u._id; delete u._openid;
      await db.collection(coll).doc(r.data[0]._id).update({ data: u });
      return 'updated';
    }
  }
  const add = Object.assign({}, data); delete add._id;
  await db.collection(coll).add({ data: add });
  return 'added';
}

exports.main = async (event, context) => {
  const { token, confirm } = event || {};
  const admin = token ? await verifyAdminToken(token) : null;
  if (!admin && confirm !== 'SEED') {
    return { code: 403, msg: '无权限：需管理员token，或传 confirm:"SEED"' };
  }

  try {
    const result = {};
    for (const key of Object.keys(seed)) {
      const coll = MAP[key] || key;
      const val = seed[key];
      if (Array.isArray(val)) {
        let added = 0, updated = 0;
        for (const d of val) {
          const r = await upsertByBizId(coll, d);
          if (r === 'added') added++; else updated++;
        }
        result[coll] = { added, updated };
      } else if (val && typeof val === 'object') {
        await db.collection(coll).doc('global').set({ data: val });
        result[coll] = 'ok';
      }
    }
    return { code: 200, msg: '数据导入完成', data: result };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '导入失败', error: err };
  }
};
