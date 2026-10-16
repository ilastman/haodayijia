const cloud = require('wx-server-sdk');

/**
 * 云函数：workbenchInit
 * 功能：初始化员工工作台所需的集合与默认配置（幂等，可重复调用）
 *   - 创建集合：staff / order / opLog
 *   - globalConfig（_id='global'）写入默认 alert 配置（仅在缺失时）
 * 运行环境：nodejs16
 * 权限：幂等且无破坏性，可无 token 调用（部署后执行一次即可）
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = ['staff', 'order', 'opLog'];

const DEFAULT_ALERT = {
  departWarnDays: 7,          // 团期临近出团预警（提前天数）
  payOverdueDays: 0,          // 款项逾期：dueDate 之后第几天算逾期（0=到期即逾期）
  msgTemplates: {             // 订阅消息模板ID（后台配置后由 reminderScheduler 使用）
    deposit: '',
    balance: '',
    ticket: '',
    depart: ''
  },
  lastRunAt: 0
};

exports.main = async () => {
  const result = { created: [], existed: [], alertInitialized: false };
  try {
    for (const name of COLLECTIONS) {
      try {
        await db.createCollection(name);
        result.created.push(name);
      } catch (e) {
        result.existed.push(name);
      }
    }

    try {
      const r = await db.collection('globalConfig').doc('global').get();
      const gc = (r && r.data) || {};
      const alert = Object.assign({}, DEFAULT_ALERT, gc.alert || {});
      alert.msgTemplates = Object.assign({}, DEFAULT_ALERT.msgTemplates, (gc.alert && gc.alert.msgTemplates) || {});
      await db.collection('globalConfig').doc('global').update({ data: { alert } });
      result.alertInitialized = true;
    } catch (e) {
      // 文档不存在则创建
      await db.collection('globalConfig').doc('global').set({ data: { alert: DEFAULT_ALERT } });
      result.alertInitialized = true;
    }

    return { code: 200, msg: '初始化完成', data: result };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '初始化失败', error: err };
  }
};
