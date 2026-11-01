const fs = require('fs');
const path = require('path');

/**
 * 行程单 PDF 绘制与中文字体选择（不依赖 wx-server-sdk，便于本地直接生成样本）。
 *
 * 字体优先级由 index.js 组好后传入。这里保证：
 *   - 只有带 CJK 字形的字体才会被写进 PDF
 *   - 某一候选 register 失败或没有「中客户…」等字形时，继续试下一个
 *   - 全部失败才回退 Helvetica（中文会乱码，调用方必须看 fontEmbedded）
 */

let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const BUNDLED_FONT_PATH = path.join(__dirname, 'fonts', 'NotoSansSC-Regular.otf');

/* 模板标题 + 呼伦贝尔常见地名用字。缺任一字形就拒绝该字体，避免「标题正常、正文方框」。 */
const CJK_SAMPLE = '中客户行程收款成本毛利酒店车辆导游门票餐费杂费呼伦贝尔嘎';

let BUNDLED_CACHE;

function isFontBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 1024) return false;
  const tag = buf.slice(0, 4).toString('binary');
  return tag === '\x00\x01\x00\x00' || tag === 'true' || tag === 'OTTO' || tag === 'ttcf';
}

function loadFontkit() {
  if (loadFontkit.mod !== undefined) return loadFontkit.mod;
  try { loadFontkit.mod = require('fontkit'); }
  catch (e) {
    try { loadFontkit.mod = require('pdfkit/node_modules/fontkit'); }
    catch (e2) { loadFontkit.mod = null; }
  }
  return loadFontkit.mod;
}

function fontHasCjk(buf) {
  if (!isFontBuffer(buf)) return false;
  const fontkit = loadFontkit();
  if (!fontkit) return true;
  try {
    const font = fontkit.create(buf);
    for (let i = 0; i < CJK_SAMPLE.length; i++) {
      const g = font.glyphForCodePoint(CJK_SAMPLE.charCodeAt(i));
      if (!g || g.id === 0) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function readBundledFont() {
  if (BUNDLED_CACHE !== undefined) return BUNDLED_CACHE;
  try {
    if (!fs.existsSync(BUNDLED_FONT_PATH)) { BUNDLED_CACHE = null; return null; }
    const buf = fs.readFileSync(BUNDLED_FONT_PATH);
    BUNDLED_CACHE = fontHasCjk(buf) ? buf : null;
  } catch (e) {
    BUNDLED_CACHE = null;
  }
  return BUNDLED_CACHE;
}

function cachePaths(dir) {
  return {
    bin: path.join(dir, 'cjk-font.bin'),
    key: path.join(dir, 'cjk-font.key')
  };
}

function readFontCache(dir, key) {
  try {
    if (!key) return null;
    const p = cachePaths(dir);
    if (!fs.existsSync(p.bin) || !fs.existsSync(p.key)) return null;
    if (fs.readFileSync(p.key, 'utf8') !== key) return null;
    const buf = fs.readFileSync(p.bin);
    if (!fontHasCjk(buf)) {
      try { fs.unlinkSync(p.bin); } catch (e) {}
      try { fs.unlinkSync(p.key); } catch (e) {}
      return null;
    }
    return buf;
  } catch (e) {
    return null;
  }
}

function writeFontCache(dir, key, buf) {
  const p = cachePaths(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p.bin, buf);
  fs.writeFileSync(p.key, String(key));
}

/**
 * 依次尝试 loaders。单个 loader 抛错、返回空、或不是可用 CJK 字体时继续下一个。
 * loaders: [{ source: string, load: () => Buffer|Promise<Buffer> }]
 */
async function chooseFontBuffer(loaders) {
  const list = loaders || [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item.load !== 'function') continue;
    try {
      const buf = await item.load();
      if (fontHasCjk(buf)) return { buffer: buf, source: item.source || 'custom' };
    } catch (e) { /* 下一个来源 */ }
  }
  return { buffer: null, source: 'fallback' };
}

function embeddedFontCoversCjk(doc) {
  const fk = doc._font && doc._font.font;
  if (fk && typeof fk.glyphForCodePoint === 'function') {
    for (let i = 0; i < CJK_SAMPLE.length; i++) {
      const g = fk.glyphForCodePoint(CJK_SAMPLE.charCodeAt(i));
      if (!g || g.id === 0) return false;
    }
    return true;
  }
  try { return doc.widthOfString(CJK_SAMPLE) > 0; }
  catch (e) { return false; }
}

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/**
 * candidates: [{ buffer, source }]，按优先级。不再自动追加字体。
 * 返回 { pdf, fontEmbedded, fontSource, fontName }
 */
function renderPdf(order, candidates) {
  if (!PDFDocument) {
    return Promise.reject(new Error('缺少 pdfkit，请在 cloudfunctions/workOrderPdf 执行 npm install'));
  }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const chunks = [];
    let fontEmbedded = false;
    let fontSource = 'fallback';
    let fontName = 'Helvetica';
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve({
      pdf: Buffer.concat(chunks),
      fontEmbedded: fontEmbedded,
      fontSource: fontSource,
      fontName: fontName
    }));
    doc.on('error', reject);
    const list = candidates || [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c || !c.buffer) continue;
      const name = 'cjk' + i;
      try {
        doc.registerFont(name, c.buffer);
        doc.font(name);
        if (!embeddedFontCoversCjk(doc)) continue;
        fontEmbedded = true;
        fontSource = c.source || 'custom';
        fontName = (doc._font && doc._font.name) || name;
        break;
      } catch (e) { /* 试下一个 */ }
    }
    if (!fontEmbedded) {
      doc.font('Helvetica');
      fontName = 'Helvetica';
      fontSource = 'fallback';
    }

    const M = 42;
    const W = doc.page.width - M * 2;

    /* 右栏 kv() 会把 doc.x 留在半页。中文字体有真实字宽后，后续正文会从右半边接着排。
       整段文字必须从左页边距重新起笔。 */
    function block(text, size, color, extra) {
      const opt = Object.assign({ width: W }, extra || {});
      doc.x = M;
      doc.fontSize(size).fillColor(color).text(text, M, doc.y, opt);
    }
    function line(y) { doc.moveTo(M, y).lineTo(M + W, y).strokeColor('#d9d2c5').lineWidth(0.6).stroke(); }
    function kv(label, value, y, col) {
      const x = M + (col === 2 ? W / 2 : 0);
      const half = W / 2;
      doc.fontSize(9).fillColor('#8a8478').text(label, x, y, { width: half - 6, lineBreak: false });
      doc.fontSize(10).fillColor('#201d18').text(String(value == null ? '' : value), x + 60, y, { width: half - 66, lineBreak: false });
    }
    function row(l1, v1, l2, v2) {
      const y = doc.y;
      kv(l1, v1, y, 1);
      kv(l2, v2, y, 2);
      doc.x = M;
      doc.y = y + 16;
    }

    doc.fontSize(18).fillColor('#2f3a33').text('内部工作单（仅内部存档）', M, M, { width: W });
    doc.moveDown(0.3);
    block('生成时间：' + new Date().toLocaleString('zh-CN'), 9, '#8a8478');
    doc.moveDown(0.6);
    line(doc.y); doc.moveDown(0.8);

    const c = order.customer || {};
    block('一、客户信息', 12, '#2f3a33');
    doc.moveDown(0.4);
    row('客户姓名', c.name, '联系电话', c.phone);
    row('人数', order.people, '目的地', order.dest);
    row('出行日期', order.departDate, '返程日期', order.returnDate);
    row('状态', order.status, '归属销售', order.staffName);
    doc.moveDown(0.4); line(doc.y); doc.moveDown(0.8);

    block('二、内部行程单', 12, '#2f3a33');
    doc.moveDown(0.3);
    const days = (order.itinerary && order.itinerary.days) || [];
    if (!days.length) block('（暂无行程内容）', 10, '#8a8478');
    days.forEach((d, i) => {
      block('第 ' + (d.dayNum || (i + 1)) + ' 天 · ' + (d.title || ''), 10, '#201d18');
      if (d.content) block(d.content, 9, '#4a463d');
      if (d.meals || d.hotel) block('餐：' + (d.meals || '-') + '    宿：' + (d.hotel || '-'), 9, '#8a8478');
      doc.moveDown(0.3);
    });
    const inc = (order.itinerary && order.itinerary.include) || [];
    const exc = (order.itinerary && order.itinerary.exclude) || [];
    if (inc.length) block('费用包含：' + inc.join('、'), 9, '#4a463d');
    if (exc.length) block('费用不含：' + exc.join('、'), 9, '#4a463d');
    doc.moveDown(0.6); line(doc.y); doc.moveDown(0.8);

    block('三、收款台账', 12, '#2f3a33');
    doc.moveDown(0.3);
    const pays = order.payments || [];
    if (!pays.length) block('（暂无收款记录）', 10, '#8a8478');
    pays.forEach(p => {
      block(
        (p.type || '-') + '    ¥' + num(p.amount) + '    收款日 ' + (p.time || '-') + '    ' + (p.remark || ''),
        9, '#201d18'
      );
    });
    doc.moveDown(0.6); line(doc.y); doc.moveDown(0.8);

    block('四、成本与毛利', 12, '#2f3a33');
    doc.moveDown(0.3);
    const costs = order.costs || {};
    const costLabel = { hotel: '酒店', car: '车辆', guide: '导游', ticket: '门票', meal: '餐费', misc: '杂费' };
    Object.keys(costLabel).forEach(k => {
      block(costLabel[k] + '：¥' + num(costs[k]), 9, '#4a463d');
    });
    doc.moveDown(0.3);
    const pricing = order.pricing || {};
    block('总成本：¥' + num(order.totalCost), 10, '#201d18');
    block('成交价：¥' + num(pricing.quote), 10, '#201d18');
    block('预估毛利：¥' + num(pricing.estProfit), 10, '#201d18');
    block('实际毛利：¥' + num(pricing.actualProfit), 10, '#8a2f2f');

    const footer = '本单为内部经营资料，请勿对客展示。';
    doc.x = M;
    if (doc.y < doc.page.height - 80) {
      doc.fontSize(8).fillColor('#b3a98f').text(footer, M, doc.page.height - 64, { width: W, align: 'center', lineBreak: false });
    } else {
      doc.moveDown(0.8);
      block(footer, 8, '#b3a98f', { align: 'center' });
    }

    doc.end();
  });
}

function buildPdf(order, font) {
  const candidates = [];
  if (font && font.buffer) candidates.push({ buffer: font.buffer, source: font.source || 'custom' });
  if (!font || font.source !== 'bundled') {
    const bundled = readBundledFont();
    if (bundled && (!font || font.buffer !== bundled)) {
      candidates.push({ buffer: bundled, source: 'bundled' });
    }
  }
  return renderPdf(order, candidates);
}

module.exports = {
  PDFDocument,
  BUNDLED_FONT_PATH,
  CJK_SAMPLE,
  isFontBuffer,
  fontHasCjk,
  readBundledFont,
  readFontCache,
  writeFontCache,
  chooseFontBuffer,
  renderPdf,
  buildPdf
};
