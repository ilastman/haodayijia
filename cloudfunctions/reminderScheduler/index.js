const cloud = require('wx-server-sdk');

/**
 * 云函数：reminderScheduler
 * 功能：全局智能提醒「消息端」——定时扫描到期/临近/逾期订单，推送订阅消息给订单归属销售本人
 * 运行环境：nodejs16
 * 触发：定时触发器（见 config.json，每日一次）
 * 说明：模板ID从 globalConfig.alert.msgTemplates 读取；未配置则跳过对应推送（先做页面标红，后接消息）。
 *       同一订单同一场景同一天不重复推送（记录在 order.notify）。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function dayIndex(s) { const t = Date.parse(String(s || '').replace(/-/g, '/')); return isNaN(t) ? null : Math.floor(t / 86400000); }
function todayIndex() { return Math.floor(Date.now() / 86400000); }

async function getAlert() {
  try {
    const r = await db.collection('globalConfig').doc('global').get();
    return (r && r.data && r.data.alert) || {};
  } catch (e) { return {}; }
}

async function fetchAll(name, size) {
  const MAX = 100; const out = [];
  const first = await db.collection(name).limit(MAX).get();
  let data = first.data || [];
  const total = (await db.collection(name).count()).total || data.length;
  const times = Math.ceil(total / MAX);
  out.push(...data);
  for (let i = 1; i < times; i++) {
    const r = await db.collection(name).skip(i * MAX).limit(MAX).get();
    out.push(...(r.data || []));
  }
  return size ? out.slice(0, size) : out;
}

function buildData(scene, order, title, timeText) {
  // 通用占位字段（模板确定后可在后台 templateFields 覆盖映射）
  return {
    thing1: { value: String(title).slice(0, 20) },
    thing2: { value: String((order.customer && order.customer.name) || '客户').slice(0, 20) },
    time3: { value: String(timeText || '').slice(0, 20) },
    thing4: { value: String(order.dest || '行程').slice(0, 20) }
  };
}

exports.main = async () => {
  const alert = await getAlert();
  const templates = alert.msgTemplates || {};
  const departWarnDays = num(alert.departWarnDays) || 7;
  const payOverdueDays = num(alert.payOverdueDays) || 0;
  const ti = todayIndex();

  const report = { scanned: 0, candidates: [], sent: [], skipped: [], errors: [] };

  try {
    const orders = (await fetchAll('order')).filter(o => !o.archived);
    const staffList = await fetchAll('staff');
    const staffMap = {};
    staffList.forEach(s => { staffMap[s.id] = s; });

    for (const o of orders) {
      report.scanned++;
      const notify = Object.assign({}, o.notify || {});
      const dayKey = String(ti);
      const tasks = [];

      // 团期临近出团
      const di = dayIndex(o.departDate);
      if (di != null) {
        const delta = di - ti;
        if (delta >= 0 && delta <= departWarnDays) {
          tasks.push({ scene: 'depart', templateId: templates.depart, title: '团期临近出团', time: o.departDate, key: 'depart' });
        }
      }
      // 款项到期/逾期
      (o.payments || []).forEach((p, idx) => {
        const pi = dayIndex(p.dueDate);
        if (pi == null) return;
        const overdue = (ti - pi) > payOverdueDays;
        const due = ti >= pi;
        if (overdue || due) {
          tasks.push({
            scene: 'pay', templateId: templates[p.type === '尾款' ? 'balance' : (p.type === '补款' ? 'balance' : 'deposit')],
            title: (p.type || '款项') + (overdue ? '已逾期' : '已到期'),
            time: p.dueDate, key: 'pay_' + idx
          });
        }
      });

      for (const t of tasks) {
        report.candidates.push({ orderId: o.id, scene: t.scene, staffId: o.staffId, title: t.title });
        const nkey = t.key + ':' + dayKey;
        if (notify[nkey]) { report.skipped.push({ orderId: o.id, scene: t.scene, reason: 'already-notified' }); continue; }
        const staff = staffMap[o.staffId];
        if (!staff || !staff.openid || staff.status !== 'enabled') { report.skipped.push({ orderId: o.id, scene: t.scene, reason: 'no-staff-openid' }); continue; }
        if (!t.templateId) { report.skipped.push({ orderId: o.id, scene: t.scene, reason: 'no-template-id' }); continue; }

        try {
          await cloud.openapi.subscribeMessage.send({
            touser: staff.openid,
            templateId: t.templateId,
            page: 'pages/workbench-detail/workbench-detail?id=' + o.id,
            data: buildData(t.scene, o, t.title, t.time)
          });
          notify[nkey] = true;
          report.sent.push({ orderId: o.id, scene: t.scene, to: staff.name });
        } catch (e) {
          report.errors.push({ orderId: o.id, scene: t.scene, msg: (e && e.errMsg) || String(e) });
        }
      }

      if (Object.keys(notify).length !== Object.keys(o.notify || {}).length) {
        try { await db.collection('order').doc(o._id).update({ data: { notify } }); } catch (e) {}
      }
    }

    try { await db.collection('globalConfig').doc('global').update({ data: { alert: Object.assign({}, alert, { lastRunAt: Date.now() }) } }); } catch (e) {}

    return { code: 200, msg: '提醒任务完成', data: report };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '任务失败', error: err };
  }
};
