const cloud = require('wx-server-sdk');
const {
  PDFDocument,
  buildPdf,
  chooseFontBuffer,
  readBundledFont,
  readFontCache,
  writeFontCache
} = require('./render');

/**
 * 云函数：workOrderPdf
 * 功能：将单个客户的内部工作单（行程/收款/成本/毛利）导出为 PDF，上传云存储并返回 fileID
 * 运行环境：nodejs16
 * 依赖：pdfkit。中文必须嵌入 CJK 字体，标准字体 Helvetica 没有中文字形，导出后会乱码。
 * 权限：员工（按 openid 归属）或管理员 token
 *
 * 中文字体来源（优先级，每一级失败都继续下一级，不会因为某一级抛错而直接退回 Helvetica）：
 *   1) globalConfig.alert.pdfFontFileID（云存储 fileID，可选覆盖）
 *   2) globalConfig.alert.pdfFontUrl（http(s) 直链，可选覆盖）
 *   3) /tmp/cjk-font.bin（仅当当前配置 key 与缓存一致，且文件通过 CJK 字形校验）
 *   4) 函数内置 fonts/NotoSansSC-Regular.otf（Noto Sans SC 简体区域子集，随包发布）
 *   5) Helvetica（仅当前面全部不可用；响应 fontEmbedded=false，中文会乱码）
 *
 * 未配置 fileID / url 时直接用内置字体，不读 /tmp，避免过期缓存盖住内置字体。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, resolveStaff } = require('./auth');

const FONT_CACHE_DIR = '/tmp';
let MEM = null;

function httpGetBuffer(url, redirects) {
  const n = redirects || 0;
  return new Promise((resolve, reject) => {
    if (n > 3) return reject(new Error('font redirect'));
    let lib;
    try { lib = url.indexOf('https:') === 0 ? require('https') : require('http'); }
    catch (e) { return reject(e); }
    const req = lib.get(url, { timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpGetBuffer(res.headers.location, n + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const data = [];
      res.on('data', d => data.push(d));
      res.on('end', () => resolve(Buffer.concat(data)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('font timeout')); });
  });
}

function asBuffer(fileContent) {
  if (!fileContent) return null;
  if (Buffer.isBuffer(fileContent)) return fileContent;
  if (typeof fileContent === 'string') return Buffer.from(fileContent, 'base64');
  try { return Buffer.from(fileContent); } catch (e) { return null; }
}

async function readAlert() {
  try {
    const r = await db.collection('globalConfig').doc('global').get();
    return (r && r.data && r.data.alert) || {};
  } catch (e) {
    return {};
  }
}

async function loadFont() {
  const alert = await readAlert();
  const fileID = String((alert && alert.pdfFontFileID) || '').trim();
  const url = String((alert && alert.pdfFontUrl) || '').trim();
  const key = (fileID || url) ? (fileID + '|' + url) : 'bundled';
  if (MEM && MEM.key === key && MEM.chosen && MEM.chosen.buffer) return MEM.chosen;

  const loaders = [];
  if (fileID || url) {
    loaders.push({
      source: 'tmp-cache',
      load: function () { return Promise.resolve(readFontCache(FONT_CACHE_DIR, key)); }
    });
  }
  if (fileID) {
    loaders.push({
      source: 'fileID',
      load: async function () {
        const res = await cloud.downloadFile({ fileID: fileID });
        return asBuffer(res && res.fileContent);
      }
    });
  }
  if (url) {
    loaders.push({
      source: 'url',
      load: function () { return httpGetBuffer(url, 0); }
    });
  }
  loaders.push({
    source: 'bundled',
    load: function () { return Promise.resolve(readBundledFont()); }
  });

  const chosen = await chooseFontBuffer(loaders);
  if (chosen.buffer && (chosen.source === 'fileID' || chosen.source === 'url')) {
    try { writeFontCache(FONT_CACHE_DIR, key, chosen.buffer); } catch (e) {}
  }
  if (chosen.buffer) MEM = { key: key, chosen: chosen };
  if (!chosen.buffer) {
    console.warn('[workOrderPdf] 未找到可用中文字体，PDF 中文将乱码');
  } else {
    console.log('[workOrderPdf] font source=' + chosen.source);
  }
  return chosen;
}

exports.main = async (event) => {
  const ev = event || {};
  const action = ev.action;
  const token = ev.token;
  const id = ev.id;
  try {
    if (!PDFDocument) return { code: 500, msg: '缺少 pdfkit 依赖，请在函数目录执行 npm install 后重部署' };
    if (action && action !== 'export') return { code: 400, msg: '不支持的action' };
    if (!id) return { code: 400, msg: '参数缺失：id' };

    const admin = await verifyAdminToken(token);
    let staff = null;
    if (!admin) {
      const ctx = cloud.getWXContext();
      const openid = ctx && ctx.OPENID;
      staff = await resolveStaff(openid);
      if (!staff) return { code: 403, msg: '无权限：需管理员token或员工身份' };
    }

    const r = await db.collection('order').where({ id: id }).limit(1).get();
    if (!r.data || !r.data.length) return { code: 404, msg: '订单不存在' };
    const order = r.data[0];
    if (!admin && order.staffId !== staff.id) return { code: 403, msg: '无权导出该订单' };

    const font = await loadFont();
    const built = await buildPdf(order, font);
    if (!built.fontEmbedded) {
      console.warn('[workOrderPdf] CJK font was not embedded; Chinese will be garbled');
    }

    const up = await cloud.uploadFile({
      cloudPath: 'work-orders/' + id + '_' + Date.now() + '.pdf',
      fileContent: built.pdf
    });
    const urlRes = await cloud.getTempFileURL({ fileList: [up.fileID] });
    const temp = urlRes.fileList && urlRes.fileList[0] && urlRes.fileList[0].tempFileURL;
    return {
      code: 200,
      msg: built.fontEmbedded ? '导出成功' : '导出成功，但未嵌入中文字体，PDF中文可能乱码',
      data: {
        fileID: up.fileID,
        url: temp || '',
        fontEmbedded: built.fontEmbedded,
        fontSource: built.fontSource,
        fontName: built.fontName
      }
    };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '导出失败', error: err };
  }
};
