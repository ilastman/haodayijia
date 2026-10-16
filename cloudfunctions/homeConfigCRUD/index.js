const cloud = require('wx-server-sdk');

/**
 * 云函数：homeConfigCRUD
 * 功能：全局首页配置（globalConfig）读取 / 保存
 * 结构：{ notice, homeCopy, homeSections, contact, companyIntro, slogan, tabs }
 * 存储：集合 globalConfig 中固定 _id='global' 的单文档
 * 权限：读取公开；保存需管理员 token
 * 说明：无 action（或 action='get'）时返回配置，供小程序 utils/api.js homeContent() 调用
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'globalConfig';
const DOC_ID = 'global';

function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }

exports.main = async (event) => {
  const { action, token, data } = event || {};
  try {
    if (!action || action === 'get') {
      try {
        const r = await db.collection(COLL).doc(DOC_ID).get();
        return { code: 200, data: strip(r.data) || {} };
      } catch (e) {
        return { code: 200, data: {} };
      }
    }
    if (!(await verifyAdminToken(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'save') {
      const doc = Object.assign({}, data || {});
      delete doc._id; delete doc._openid;
      await db.collection(COLL).doc(DOC_ID).set({ data: doc });
      return { code: 200, msg: '保存成功', data: doc };
    }
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
