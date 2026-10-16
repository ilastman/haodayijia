const cloud = require('wx-server-sdk');

/**
 * 云函数：staffCRUD
 * 功能：员工账号管理（手机端绑定/身份识别 + 管理端增改启停转移）
 * 运行环境：nodejs16
 * 权限：
 *   - 员工端（无需 token，取 WX openid）：me / bind
 *   - 管理端（需管理员 token）：list / get / add / update / disable / enable / regenerateCode / transfer
 * 说明：员工绝对无删除能力，离职仅停用（status=disabled）。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, resolveStaff } = require('./auth');

const STAFF = 'staff';
const ORDER = 'order';
const LOG = 'opLog';

function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
function genId() { return 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function genCode() { return 'ST' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase(); }
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(STAFF).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }

async function log(actor, action, targetId, summary, before, after) {
  try {
    await db.collection(LOG).add({
      data: {
        id: 'log_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        staffId: (actor && actor.id) || '',
        staffName: (actor && actor.name) || (actor && actor.username) || 'system',
        action, targetType: 'staff', targetId: targetId || '',
        summary: summary || '', before: before || null, after: after || null,
        time: Date.now()
      }
    });
  } catch (e) { /* 日志失败不影响主流程 */ }
}

exports.main = async (event) => {
  const { action, token, data, id } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };

  try {
    /* ============ 员工端：身份识别 ============ */
    if (action === 'me') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 200, data: { isStaff: false } };
      const staff = await resolveStaff(OPENID);
      if (!staff) {
        // 是否为已停用（给出提示）
        let disabled = false;
        try {
          const r = await db.collection(STAFF).where({ openid: OPENID }).limit(1).get();
          disabled = !!(r.data && r.data[0] && r.data[0].status !== 'enabled');
        } catch (e) { /* ignore */ }
        return { code: 200, data: { isStaff: false, disabled } };
      }
      return { code: 200, data: { isStaff: true, staff: { id: staff.id, name: staff.name, phone: staff.phone || '' } } };
    }

    /* ============ 员工端：绑定码绑定 ============ */
    if (action === 'bind') {
      const { OPENID } = cloud.getWXContext();
      if (!OPENID) return { code: 403, msg: '无法获取openid' };
      const code = String((data && data.code) || event.code || '').trim();
      if (!code) return { code: 400, msg: '请输入绑定码' };
      const r = await db.collection(STAFF).where({ bindCode: code }).limit(1).get();
      if (!r.data || !r.data.length) return { code: 404, msg: '绑定码无效' };
      const staff = r.data[0];
      if (staff.status === 'disabled') return { code: 403, msg: '该员工账号已停用，请联系管理员' };
      if (staff.openid && staff.openid !== OPENID) return { code: 409, msg: '该绑定码已被其他微信绑定，请联系管理员' };
      await db.collection(STAFF).doc(staff._id).update({ data: { openid: OPENID, updatedAt: Date.now() } });
      await log({ id: staff.id, name: staff.name }, 'bind', staff.id, '员工绑定openid');
      return { code: 200, msg: '绑定成功', data: { staff: { id: staff.id, name: staff.name } } };
    }

    /* ============ 以下均需管理员 token ============ */
    const admin = await verifyAdminToken(token);
    if (!admin) return { code: 403, msg: '无权限：需管理员token' };
    const actor = { id: 'admin', name: (admin.nickname || admin.username || '管理员') };

    if (action === 'list') {
      const r = await db.collection(STAFF).orderBy('createTime', 'desc').get();
      const list = (r.data || []).map(strip);
      // 附带每人订单数（便于后台展示）
      let counts = {};
      try {
        // 逐人统计
        for (const s of list) {
          const c = await db.collection(ORDER).where({ staffId: s.id }).count();
          counts[s.id] = c.total || 0;
        }
      } catch (e) { counts = {}; }
      list.forEach(s => { s.orderCount = counts[s.id] || 0; s.bound = !!s.openid; });
      return { code: 200, data: list };
    }

    if (action === 'get') {
      const s = await findBiz(id);
      return s ? { code: 200, data: strip(s) } : { code: 404, msg: '记录不存在' };
    }

    if (action === 'add') {
      const doc = clean(data);
      if (!doc.name || !String(doc.name).trim()) return { code: 400, msg: '请输入员工姓名' };
      doc.id = doc.id || genId();
      doc.name = String(doc.name).trim();
      doc.phone = doc.phone || '';
      doc.openid = doc.openid || '';
      doc.status = doc.status === 'disabled' ? 'disabled' : 'enabled';
      doc.role = 'sales';
      doc.bindCode = doc.bindCode || genCode();
      doc.remark = doc.remark || '';
      doc.createTime = Date.now();
      doc.updatedAt = doc.createTime;
      const r = await db.collection(STAFF).add({ data: doc });
      await log(actor, 'add', doc.id, '新增员工 ' + doc.name, null, { name: doc.name, phone: doc.phone });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id, bindCode: doc.bindCode } };
    }

    if (action === 'update') {
      const s = await findBiz(id);
      if (!s) return { code: 404, msg: '记录不存在' };
      const d = clean(data);
      delete d.id; delete d.openid; delete d.status; delete d.createTime; delete d.bindCode;
      d.updatedAt = Date.now();
      await db.collection(STAFF).doc(s._id).update({ data: d });
      await log(actor, 'update', s.id, '编辑员工 ' + (d.name || s.name));
      return { code: 200, msg: '更新成功' };
    }

    if (action === 'disable' || action === 'enable') {
      const s = await findBiz(id);
      if (!s) return { code: 404, msg: '记录不存在' };
      const status = action === 'disable' ? 'disabled' : 'enabled';
      await db.collection(STAFF).doc(s._id).update({ data: { status, updatedAt: Date.now() } });
      await log(actor, action, s.id, (action === 'disable' ? '停用' : '启用') + '员工 ' + s.name);
      return { code: 200, msg: action === 'disable' ? '已停用' : '已启用' };
    }

    if (action === 'regenerateCode') {
      const s = await findBiz(id);
      if (!s) return { code: 404, msg: '记录不存在' };
      const bindCode = genCode();
      await db.collection(STAFF).doc(s._id).update({ data: { bindCode, updatedAt: Date.now() } });
      await log(actor, 'regenerateCode', s.id, '重置员工绑定码 ' + s.name);
      return { code: 200, msg: '已重置绑定码', data: { bindCode } };
    }

    if (action === 'unbind') {
      const s = await findBiz(id);
      if (!s) return { code: 404, msg: '记录不存在' };
      await db.collection(STAFF).doc(s._id).update({ data: { openid: '', updatedAt: Date.now() } });
      await log(actor, 'unbind', s.id, '解绑员工微信 ' + s.name);
      return { code: 200, msg: '已解绑' };
    }

    /* 离职：批量转移客户（订单）到指定员工 */
    if (action === 'transfer') {
      const fromId = (data && data.fromStaffId) || event.fromStaffId;
      const toId = (data && data.toStaffId) || event.toStaffId;
      if (!fromId || !toId) return { code: 400, msg: '请选择原员工与接收员工' };
      if (fromId === toId) return { code: 400, msg: '接收员工不能与原员工相同' };
      const fromS = await findBiz(fromId);
      const toS = await findBiz(toId);
      if (!fromS || !toS) return { code: 404, msg: '员工不存在' };
      const res = await db.collection(ORDER).where({ staffId: fromId }).update({
        data: { staffId: toId, staffName: toS.name, updatedAt: Date.now() }
      });
      const moved = (res && (res.stats ? res.stats.updated : res.updated)) || 0;
      await log(actor, 'transfer', fromId, '离职转移：' + fromS.name + ' → ' + toS.name + '（' + moved + ' 单）');
      return { code: 200, msg: '已转移客户', data: { moved } };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
