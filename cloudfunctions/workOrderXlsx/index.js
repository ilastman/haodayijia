const cloud = require('wx-server-sdk');
const { verifyAdminToken, resolveStaff } = require('./auth');
const { buildWorkbook } = require('./sheet');

/**
 * 云函数：workOrderXlsx
 * 功能：把单个客户的 v3 对账明细导出为 xlsx，上传云存储并返回 fileID
 * 运行环境：nodejs16
 * 权限：员工（按 openid 归属）或管理员 token
 *
 * 部署（新函数，不能直接覆盖 workOrderPdf）：
 *   tcb fn copy workOrderPdf workOrderXlsx -e cloudbase-d3gptvn88e6a4d78a
 *   node tools/deploy-fn.js workOrderXlsx --timeout 30 --memory 256
 *   node tools/deploy-fn.js httpGateway
 *   node tools/deploy-fn.js orderCRUD
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action, token, id } = event || {};
  try {
    if (action && action !== 'export') return { code: 400, msg: '不支持的action' };
    if (!id) return { code: 400, msg: '参数缺失：id' };

    const admin = await verifyAdminToken(token);
    let staff = null;
    if (!admin) {
      const { OPENID } = cloud.getWXContext();
      staff = await resolveStaff(OPENID);
      if (!staff) return { code: 403, msg: '无权限：需管理员token或员工身份' };
    }

    const r = await db.collection('order').where({ id }).limit(1).get();
    if (!r.data || !r.data.length) return { code: 404, msg: '订单不存在' };
    const order = r.data[0];
    if (!admin && order.staffId !== staff.id) return { code: 403, msg: '无权导出该订单' };

    const xlsx = buildWorkbook(order);
    const up = await cloud.uploadFile({
      cloudPath: 'work-orders/' + id + '_' + Date.now() + '.xlsx',
      fileContent: xlsx
    });
    let url = '';
    try {
      const urlRes = await cloud.getTempFileURL({ fileList: [up.fileID] });
      url = (urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL) || '';
    } catch (e) { url = ''; }
    return { code: 200, msg: '导出成功', data: { fileID: up.fileID, url, fileName: '对账明细.xlsx' } };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '导出失败', error: err };
  }
};
