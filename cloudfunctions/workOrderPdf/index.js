const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

/**
 * 云函数：workOrderPdf
 * 功能：将单个客户的内部工作单（行程/收款/成本/毛利）导出为 PDF，上传云存储并返回 fileID
 * 运行环境：nodejs16
 * 依赖：pdfkit（含中文需 CJK 字体，见下）
 * 权限：员工（按 openid 归属）或管理员 token
 *
 * 中文字体来源（优先级）：
 *   1) globalConfig.alert.pdfFontFileID（云存储 fileID，后台可上传一次）
 *   2) globalConfig.alert.pdfFontUrl（http(s) 直链）
 *   3) /tmp 缓存
 *   4) 函数内置 fonts/NotoSansSC-Regular.otf（若打包）
 *   5) 回退 Helvetica（中文可能无法显示）
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, resolveStaff } = require('./auth');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

let FONT_BUFFER = null;
let FONT_KEY = '';

function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.indexOf('https:') === 0 ? require('https') : require('http');
    const req = lib.get(url, { timeout: 20000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const data = [];
      res.on('data', d => data.push(d));
      res.on('end', () => resolve(Buffer.concat(data)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('font timeout')); });
  });
}

async function loadFontBuffer() {
  if (FONT_BUFFER) return FONT_BUFFER;
  let alert = {};
  try {
    const r = await db.collection('globalConfig').doc('global').get();
    alert = (r && r.data && r.data.alert) || {};
  } catch (e) { alert = {}; }
  FONT_KEY = (alert.pdfFontFileID || '') + '|' + (alert.pdfFontUrl || '');

  const cachePath = '/tmp/cjk-font.bin';
  try {
    if (alert.pdfFontFileID) {
      const res = await cloud.downloadFile({ fileID: alert.pdfFontFileID });
      if (res && res.fileContent) { FONT_BUFFER = res.fileContent; return FONT_BUFFER; }
    }
    if (alert.pdfFontUrl) {
      const buf = await httpGetBuffer(alert.pdfFontUrl);
      FONT_BUFFER = buf; try { fs.writeFileSync(cachePath, buf); } catch (e) {}
      return FONT_BUFFER;
    }
    if (fs.existsSync(cachePath)) { FONT_BUFFER = fs.readFileSync(cachePath); return FONT_BUFFER; }
    const local = path.join(__dirname, 'fonts', 'NotoSansSC-Regular.otf');
    if (fs.existsSync(local)) { FONT_BUFFER = fs.readFileSync(local); return FONT_BUFFER; }
  } catch (e) { /* fall through */ }
  return null;
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function buildPdf(order, fontBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let fontName = 'Helvetica';
    if (fontBuffer) {
      try { doc.registerFont('cjk', fontBuffer); fontName = 'cjk'; } catch (e) { fontName = 'Helvetica'; }
    }
    doc.font(fontName);

    const M = 42;
    const W = doc.page.width - M * 2;

    function line(y) { doc.moveTo(M, y).lineTo(M + W, y).strokeColor('#d9d2c5').lineWidth(0.6).stroke(); }
    function kv(label, value, y, col) {
      const x = M + (col === 2 ? W / 2 : 0);
      doc.fontSize(9).fillColor('#8a8478').text(label, x, y, { width: (col === 2 ? W / 2 : W / 2) - 6 });
      doc.fontSize(10).fillColor('#201d18').text(String(value == null ? '' : value), x + 60, y, { width: (col === 2 ? W / 2 : W / 2) - 66 });
    }

    // 标题
    doc.fontSize(18).fillColor('#2f3a33').text('内部工作单（仅内部存档）', M, M, { width: W });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#8a8478').text('生成时间：' + new Date().toLocaleString('zh-CN'), { width: W });
    doc.moveDown(0.6);
    line(doc.y); doc.moveDown(0.8);

    const c = order.customer || {};
    doc.fontSize(12).fillColor('#2f3a33').text('一、客户信息');
    doc.moveDown(0.3);
    kv('客户姓名', c.name, doc.y, 1); kv('联系电话', c.phone, doc.y, 2);
    doc.moveDown(1.1);
    kv('人数', order.people, doc.y, 1); kv('目的地', order.dest, doc.y, 2);
    doc.moveDown(1.1);
    kv('出行日期', order.departDate, doc.y, 1); kv('返程日期', order.returnDate, doc.y, 2);
    doc.moveDown(1.1);
    kv('状态', order.status, doc.y, 1); kv('归属销售', order.staffName, doc.y, 2);
    doc.moveDown(1.2); line(doc.y); doc.moveDown(0.8);

    // 行程单
    doc.fontSize(12).fillColor('#2f3a33').text('二、内部行程单');
    doc.moveDown(0.3);
    const days = (order.itinerary && order.itinerary.days) || [];
    if (!days.length) { doc.fontSize(10).fillColor('#8a8478').text('（暂无行程内容）'); }
    days.forEach((d, i) => {
      doc.fontSize(10).fillColor('#201d18').text('第 ' + (d.dayNum || (i + 1)) + ' 天 · ' + (d.title || ''), { width: W });
      if (d.content) doc.fontSize(9).fillColor('#4a463d').text(d.content, { width: W });
      if (d.meals || d.hotel) { doc.fontSize(9).fillColor('#8a8478').text('餐：' + (d.meals || '-') + '    宿：' + (d.hotel || '-'), { width: W }); }
      doc.moveDown(0.3);
    });
    const inc = (order.itinerary && order.itinerary.include) || [];
    const exc = (order.itinerary && order.itinerary.exclude) || [];
    if (inc.length) doc.fontSize(9).fillColor('#4a463d').text('费用包含：' + inc.join('、'), { width: W });
    if (exc.length) doc.fontSize(9).fillColor('#4a463d').text('费用不含：' + exc.join('、'), { width: W });
    doc.moveDown(1); line(doc.y); doc.moveDown(0.8);

    // 收款台账
    doc.fontSize(12).fillColor('#2f3a33').text('三、收款台账');
    doc.moveDown(0.3);
    const pays = order.payments || [];
    if (!pays.length) doc.fontSize(10).fillColor('#8a8478').text('（暂无收款记录）');
    pays.forEach(p => {
      doc.fontSize(9).fillColor('#201d18').text(
        (p.type || '-') + '    ¥' + num(p.amount) + '    收款日 ' + (p.time || '-') + '    ' + (p.remark || ''),
        { width: W }
      );
    });
    doc.moveDown(1); line(doc.y); doc.moveDown(0.8);

    // 成本 / 毛利
    doc.fontSize(12).fillColor('#2f3a33').text('四、成本与毛利');
    doc.moveDown(0.3);
    const costs = order.costs || {};
    const costLabel = { hotel: '酒店', car: '车辆', guide: '导游', ticket: '门票', meal: '餐费', misc: '杂费' };
    Object.keys(costLabel).forEach(k => {
      doc.fontSize(9).fillColor('#4a463d').text(costLabel[k] + '：¥' + num(costs[k]), { width: W / 2, continued: false });
    });
    doc.moveDown(0.3);
    const pricing = order.pricing || {};
    doc.fontSize(10).fillColor('#201d18').text('总成本：¥' + num(order.totalCost), { width: W });
    doc.fontSize(10).fillColor('#201d18').text('成交价：¥' + num(pricing.quote), { width: W });
    doc.fontSize(10).fillColor('#201d18').text('预估毛利：¥' + num(pricing.estProfit), { width: W });
    doc.fontSize(10).fillColor('#8a2f2f').text('实际毛利：¥' + num(pricing.actualProfit), { width: W });

    doc.fontSize(8).fillColor('#b3a98f').text('本单为内部经营资料，请勿对客展示。', M, doc.page.height - 40, { width: W, align: 'center' });

    doc.end();
  });
}

exports.main = async (event) => {
  const { action, token, id } = event || {};
  try {
    if (!PDFDocument) return { code: 500, msg: '缺少 pdfkit 依赖，请在函数目录执行 npm install 后重部署' };
    if (action && action !== 'export') return { code: 400, msg: '不支持的action' };
    if (!id) return { code: 400, msg: '参数缺失：id' };

    // 鉴权：管理员或归属员工
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

    const fontBuffer = await loadFontBuffer();
    const pdf = await buildPdf(order, fontBuffer);

    const up = await cloud.uploadFile({
      cloudPath: 'work-orders/' + id + '_' + Date.now() + '.pdf',
      fileContent: pdf
    });
    const urlRes = await cloud.getTempFileURL({ fileList: [up.fileID] });
    const url = urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL;
    return { code: 200, msg: '导出成功', data: { fileID: up.fileID, url: url || '', fontEmbedded: !!fontBuffer } };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '导出失败', error: err };
  }
};
