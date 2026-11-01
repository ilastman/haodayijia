#!/usr/bin/env node
/**
 * 本地验证 workOrderPdf 会嵌入 Noto Sans SC，而不是回退 Helvetica。
 *
 * 用法（在仓库根目录）：
 *   cd cloudfunctions/workOrderPdf && npm install --no-package-lock
 *   node ../../tools/test-work-order-pdf.js
 *
 * 断言（不依赖云环境）：
 *   1. 内置 fonts/NotoSansSC-Regular.otf 存在，且含模板用字（含「嘎」）。
 *   2. 坏的 fileID / 假字体不会打断后续来源，最终选中内置字体。
 *   3. 用内置字体生成的 PDF，BaseFont 含 NotoSansSC，ToUnicode 含标题与正文码点。
 *   4. 强制不传字体时 BaseFont 为 Helvetica，且没有这些中文码点（这就是线上乱码）。
 * 若本机有 poppler 的 pdftotext，会再抽取文本，确认「客户信息 / 行程 / 收款 / 成本」可读。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const fnDir = path.join(__dirname, '..', 'cloudfunctions', 'workOrderPdf');
const render = require(path.join(fnDir, 'render'));

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); return; }
  failed++;
  console.error('  FAIL ' + msg);
}

function inflateStreams(pdf) {
  const out = [];
  let i = 0;
  while (i < pdf.length) {
    const s = pdf.indexOf('stream', i);
    if (s < 0) break;
    let start = s + 6;
    if (pdf[start] === 0x0d && pdf[start + 1] === 0x0a) start += 2;
    else if (pdf[start] === 0x0a) start += 1;
    const end = pdf.indexOf('endstream', start);
    if (end < 0) break;
    let raw = pdf.slice(start, end);
    if (raw.length && raw[raw.length - 1] === 0x0a) raw = raw.slice(0, -1);
    if (raw.length && raw[raw.length - 1] === 0x0d) raw = raw.slice(0, -1);
    try { out.push(zlib.inflateSync(raw)); } catch (e) {}
    i = end + 9;
  }
  return out;
}

function baseFonts(pdf) {
  const text = pdf.toString('latin1');
  const found = [];
  const re = /\/BaseFont\s*\/([^\s/>]+)/g;
  let m;
  while ((m = re.exec(text))) found.push(m[1]);
  return found;
}

/* 只认 ToUnicode CMap。Helvetica 也会把汉字写成内容流里的 UTF-16 十六进制，
   但没有 CMap，阅读器按 WinAnsi 解释就会乱码。 */
function cmapHas(pdf, str) {
  const maps = inflateStreams(pdf).filter(function (buf) {
    const t = buf.toString('latin1');
    return t.indexOf('beginbfrange') >= 0 || t.indexOf('beginbfchar') >= 0;
  });
  if (!maps.length) return false;
  const blob = Buffer.concat(maps).toString('latin1').toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const hex = str.charCodeAt(i).toString(16);
    if (blob.indexOf(hex) < 0) return false;
  }
  return true;
}

const SAMPLE_ORDER = {
  customer: { name: '张伟', phone: '13800138000' },
  people: 4,
  dest: '呼伦贝尔',
  departDate: '2026-07-01',
  returnDate: '2026-07-05',
  status: '待出团',
  staffName: '李娜',
  itinerary: {
    days: [{
      dayNum: 1,
      title: '海拉尔接机 · 莫尔道嘎',
      content: '入住白桦林酒店，傍晚敖鲁古雅看驯鹿',
      meals: '早餐、晚餐',
      hotel: '额尔古纳度假酒店'
    }],
    include: ['住宿', '用车', '门票'],
    exclude: ['往返大交通', '个人消费']
  },
  payments: [{ type: '定金', amount: 2000, time: '2026-06-01', remark: '微信已收' }],
  costs: { hotel: 800, car: 600, guide: 300, ticket: 120, meal: 200, misc: 50 },
  totalCost: 2070,
  pricing: { quote: 6800, estProfit: 4730, actualProfit: 4730 }
};

const MUST = ['客户信息', '内部行程单', '收款台账', '成本与毛利', '张伟', '呼伦贝尔', '莫尔道嘎', '酒店', '定金', '费用包含', '实际毛利', '白桦林'];

async function main() {
  if (!render.PDFDocument) {
    console.error('缺少 pdfkit。请先执行：cd cloudfunctions/workOrderPdf && npm install --no-package-lock');
    process.exit(1);
  }

  console.log('1. 内置字体');
  assert(fs.existsSync(render.BUNDLED_FONT_PATH), 'fonts/NotoSansSC-Regular.otf 已打包');
  const bundled = render.readBundledFont();
  assert(bundled && bundled.length > 1000000, '内置字体可读且体积大于 1MB（不是空占位）');
  assert(bundled.slice(0, 4).toString() === 'OTTO', '内置字体是 OpenType (OTTO)，pdfkit 0.15 可嵌入');
  assert(render.fontHasCjk(bundled), '内置字体包含模板与「嘎」等正文用字');

  console.log('2. 字体来源失败后继续');
  const fake = Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(4096, 1)]);
  const chosen = await render.chooseFontBuffer([
    { source: 'fileID', load: async function () { throw new Error('download failed'); } },
    { source: 'url', load: async function () { return Buffer.from('<html>not a font</html>'); } },
    { source: 'url-otto', load: async function () { return fake; } },
    { source: 'bundled', load: async function () { return bundled; } }
  ]);
  assert(chosen.source === 'bundled', 'fileID 抛错、假字体被跳过，最终用内置字体（实际 source=' + chosen.source + '）');
  assert(chosen.buffer === bundled, '选中的 buffer 就是内置字体');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdffont-'));
  render.writeFontCache(dir, 'cloud://font|', bundled);
  const hit = render.readFontCache(dir, 'cloud://font|');
  assert(hit && hit.length === bundled.length, '配置 key 一致时可读 /tmp 式缓存');
  assert(render.readFontCache(dir, 'other|http://x') === null, '配置 key 不一致时不用缓存，避免盖住内置字体');
  render.writeFontCache(dir, 'bad|', fake);
  assert(render.readFontCache(dir, 'bad|') === null, '缓存不是可用 CJK 字体时丢弃');

  console.log('3. 内置字体生成的 PDF');
  const recovered = await render.buildPdf(SAMPLE_ORDER, { buffer: fake, source: 'fileID' });
  assert(recovered.fontEmbedded === true, '坏字体 register 失败后仍嵌入内置字体');
  assert(recovered.fontSource === 'bundled', '坏字体回退 source=bundled（实际 ' + recovered.fontSource + '）');

  const good = await render.buildPdf(SAMPLE_ORDER, null);
  assert(good.fontEmbedded === true, 'fontEmbedded === true');
  assert(good.fontSource === 'bundled', 'fontSource === bundled（实际 ' + good.fontSource + '）');
  assert(good.fontName && good.fontName.indexOf('NotoSansSC') >= 0, '字体名含 NotoSansSC（实际 ' + good.fontName + '）');
  const fonts = baseFonts(good.pdf);
  assert(fonts.some(function (n) { return n.indexOf('NotoSansSC') >= 0; }), 'PDF BaseFont 含 NotoSansSC：' + fonts.join(','));
  assert(!fonts.every(function (n) { return n.indexOf('Helvetica') >= 0; }), 'PDF 不是只嵌入 Helvetica');
  MUST.forEach(function (s) {
    assert(cmapHas(good.pdf, s), 'ToUnicode 含「' + s + '」');
  });

  const outPdf = path.join(os.tmpdir(), 'work-order-sample.pdf');
  fs.writeFileSync(outPdf, good.pdf);
  const pageCount = (good.pdf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
  assert(pageCount === 1, '短行程单只有 1 页，页脚不掉到空白页（实际 ' + pageCount + ' 页）');
  console.log('  pdf ' + outPdf + ' (' + good.pdf.length + ' bytes)');

  console.log('4. 无字体时就是线上乱码路径');
  const bad = await render.renderPdf(SAMPLE_ORDER, []);
  assert(bad.fontEmbedded === false, '未嵌入 CJK');
  assert(bad.fontName === 'Helvetica', '回退 Helvetica');
  const badFonts = baseFonts(bad.pdf);
  assert(badFonts.indexOf('Helvetica') >= 0, 'BaseFont 为 Helvetica：' + badFonts.join(','));
  assert(!cmapHas(bad.pdf, '客户信息'), 'Helvetica PDF 的 ToUnicode 没有「客户信息」（乱码路径）');

  const badPdf = path.join(os.tmpdir(), 'work-order-helvetica.pdf');
  fs.writeFileSync(badPdf, bad.pdf);
  try {
    const text = execFileSync('pdftotext', ['-layout', outPdf, '-'], { encoding: 'utf8' });
    MUST.forEach(function (s) {
      assert(text.indexOf(s) >= 0, 'pdftotext 读出「' + s + '」');
    });
    const garbled = execFileSync('pdftotext', ['-layout', badPdf, '-'], { encoding: 'utf8' });
    assert(garbled.indexOf('客户信息') < 0, 'Helvetica PDF 抽不出「客户信息」（这就是乱码）');
  } catch (e) {
    if (e && e.code === 'ENOENT') console.log('  skip pdftotext 未安装（ToUnicode / BaseFont 断言已覆盖）');
    else throw e;
  }

  if (failed) {
    console.error('\n' + failed + ' assertion(s) failed');
    process.exit(1);
  }
  console.log('\n全部通过。样本 PDF：' + outPdf);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
