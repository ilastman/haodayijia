/* 对账表 v3：模型、买票预警、员工录入链路、xlsx 结构 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const recon = require(path.join(root, 'utils/recon.js'));
const { buildWorkbook } = require(path.join(root, 'cloudfunctions/workOrderXlsx/sheet.js'));

function eq(a, b, msg) {
  assert.strictEqual(a, b, (msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

const copies = [
  'utils/recon.js',
  'cloudfunctions/orderCRUD/recon.js',
  'cloudfunctions/workOrderXlsx/recon.js'
].map(p => fs.readFileSync(path.join(root, p), 'utf8'));
eq(copies[0], copies[1], 'orderCRUD recon copy');
eq(copies[0], copies[2], 'workOrderXlsx recon copy');

eq(recon.excelSerial('2026-11-04'), 46330, 'excel date');
eq(recon.excelSerial('2026-11-06'), 46332, 'excel return');
eq(recon.excelSerial('2026-11-04 14:30'), 46330 + 14.5 / 24, 'excel datetime');

const now = new Date('2026-11-03T04:00:00Z');
function orderWith(text, depart) {
  const day = recon.emptyDay(1, depart || '2026-11-04');
  day.itinerary = text;
  return { departDate: depart || '2026-11-04', recon: { days: [day] } };
}
function names(order) {
  return recon.ticketAlerts(order, now).hits.map(h => h.label + ':' + h.name).sort();
}

assert.deepStrictEqual(names(orderWith('上午去冰雪大世界，下午极地公园')), ['提前3天:冰雪大世界', '提前3天:极地公园']);
assert.deepStrictEqual(names(orderWith('哈尔滨东北虎林园')), ['提前1天:哈尔滨东北虎林园']);
assert.deepStrictEqual(names(orderWith('东北虎林园')), [], 'short name must not match');
assert.deepStrictEqual(names(orderWith('镜泊湖')), [], '镜泊湖 alone is not the keyword');
assert.deepStrictEqual(names(orderWith('镜泊湖景区')), ['提前3天:镜泊湖景区']);
assert.ok(names(orderWith('哈工大外景')).indexOf('提前7天:哈工大') >= 0);
assert.ok(names(orderWith('长白山北坡')).indexOf('提前15天:长白山') >= 0);
eq(recon.ticketAlerts(orderWith('长白山', '2026-11-18'), now).hits.length, 1, '15 days still warns');
eq(recon.ticketAlerts(orderWith('哈工大', '2026-11-18'), now).hits.length, 0, '7-day list stays quiet at 15 days out');
eq(recon.ticketAlerts(orderWith('长白山', '2026-11-20'), now).hits.length, 0, 'beyond 15 days');
eq(recon.ticketAlerts(orderWith('冰雪大世界', '2026-11-02'), now).hits.length, 0, 'departed');
eq(recon.ticketAlerts(orderWith('冰雪大世界', '2026-11-04'), new Date('2026-11-03T16:00:00Z')).left, 0, 'shanghai midnight');
eq(recon.ticketAlerts(orderWith('伏尔加庄园', '2026-11-04'), new Date('2026-11-03T16:00:00Z')).hits.length, 1, 'same-day still red');
const onlyItinerary = {
  departDate: '2026-11-04',
  itinerary: { days: [{ dayNum: 1, title: '冰雪大世界', content: '入园' }] }
};
eq(recon.ticketAlerts(onlyItinerary, now).hits.length, 1, 'itinerary-only orders still warn');

/* 录入链路：建客 → 改客人栏（不带 days）→ 记司机 → 记财务 → 再改客人栏 */
let reconDoc = recon.sanitizeRecon({
  tripTitle: '哈尔滨冰雪', adults: '2', children: '1', vehicle: '别克GL8', pickupTime: '2026-11-04 14:30', pickupPlace: 'T2'
}, null);
eq(reconDoc.days.length, 0);
eq(reconDoc.tripTitle, '哈尔滨冰雪');
reconDoc = recon.sanitizeRecon({ tripTitle: '哈尔滨冰雪3日', adults: '2', children: '1' }, reconDoc);
eq(reconDoc.vehicle, '别克GL8', 'guest patch keeps vehicle');
eq(reconDoc.days.length, 0);

let day = recon.emptyDay(1, '2026-11-04');
day.from = '哈尔滨机场';
day.to = '市区';
day.itinerary = '下午：冰雪大世界';
day.tickets = '冰雪大世界：全票×2 / 半票×1 / 免票×0';
day.km = '45';
day = recon.applyFinanceFlat(day, {
  s1name: '冰雪大世界', s1amount: '980', s1status: '未付',
  p1name: '滑雪体验', p1amount: '260', p1status: '未付',
  hname: '标准间×2', hamount: '980', hstatus: '已付', htime: '2026-10-20',
  camount: '680', cstatus: '已付',
  claimDetail: '油费', damount: '80', dstatus: '未付'
});
const money = recon.dayMoney(day);
eq(money.ticket, 1240);
eq(money.total, 1240 + 980 + 680 + 80);
const commaDay = recon.applyFinanceFlat(recon.emptyDay(1), { s1name: '冰雪大世界', s1amount: '¥1,280' });
eq(commaDay.scenics[0].amount, '1280');
eq(recon.dayMoney(commaDay).ticket, 1280);
const spotOrder = { departDate: '2026-11-04', itinerary: { days: [{ title: '第1天', spots: ['伏尔加庄园'] }] } };
eq(recon.ticketAlerts(spotOrder, now).hits[0].name, '伏尔加庄园');

reconDoc = recon.sanitizeRecon(Object.assign({}, reconDoc, { days: [day] }), null);
eq(reconDoc.days[0].scenics[0].name, '冰雪大世界');
eq(reconDoc.days[0].plays[0].name, '滑雪体验');
reconDoc = recon.sanitizeRecon({ pickupPlace: 'T2到达口' }, reconDoc);
eq(reconDoc.days.length, 1, 'guest edit must not wipe days');
eq(reconDoc.pickupPlace, 'T2到达口');
eq(reconDoc.tripTitle, '哈尔滨冰雪3日');
eq(reconDoc.days[0].hotelCost.payStatus, '已付');

const order = {
  customer: { name: '张先生', phone: '138 0000 0000', wechat: 'wx_zhang', source: '小红书', remark: '含儿童1名' },
  staffName: '王小美',
  status: '待出团',
  dest: '哈尔滨 / 黑龙江',
  people: 3,
  departDate: '2026-11-04',
  returnDate: '2026-11-06',
  pricing: { quote: 12800 },
  payments: [{ amount: 5000 }, { amount: 0 }],
  recon: reconDoc
};
const summary = recon.ticketSummary(order, now);
assert.ok(summary.hits.some(h => h.name === '冰雪大世界' && h.lead === 3));
assert.ok(summary.hits.some(h => h.name === '滑雪' && h.label === '提前3天'), '滑雪 is contained in 滑雪体验');

/* 旧单只有总人数：导出时成人数回填，不改库存 */
const legacy = { people: 4, customer: { name: '旧客户' }, departDate: '2026-12-01', returnDate: '2026-12-02' };
const legacyBook = readBook(buildWorkbook(legacy));
eq(cell(legacyBook, 'sheet1', 'B3'), '4');
eq(formula(legacyBook, 'sheet1', 'F3'), 'B3+D3');
eq(formula(legacyBook, 'sheet1', 'Z3'), 'P3-U3');

const book = readBook(buildWorkbook(order));
eq(book.names.join(','), '行程与财务对账,买票预警,填写说明');
eq(cell(book, 'sheet1', 'A1'), '司机行程与财务利润一体化对账表 v3');
eq(cell(book, 'sheet1', 'B2'), '张先生');
eq(cell(book, 'sheet1', 'G2'), '哈尔滨冰雪3日');
eq(cell(book, 'sheet1', 'K2'), '王小美');
eq(numCell(book, 'sheet1', 'H3'), 46330);
eq(numCell(book, 'sheet1', 'J3'), 46332);
eq(numCell(book, 'sheet1', 'P3'), 12800);
eq(numCell(book, 'sheet1', 'U3'), 5000);
eq(numCell(book, 'sheet1', 'B7'), 46330);
eq(cell(book, 'sheet1', 'E7'), '下午：冰雪大世界');
eq(cell(book, 'sheet1', 'P7'), '冰雪大世界');
eq(numCell(book, 'sheet1', 'Q7'), 980);
eq(cell(book, 'sheet1', 'AB7'), '滑雪体验');
eq(formula(book, 'sheet1', 'AN7'), 'SUM(Q7,U7,Y7,AC7,AG7,AK7)');
eq(formula(book, 'sheet1', 'BO7'), 'SUM(AN7,AP7,AS7,AV7,AZ7,BD7,BH7,BL7)');
const bp = formula(book, 'sheet1', 'BP7');
assert.ok(bp.indexOf('哈尔滨东北虎林园') >= 0 && bp.indexOf('长白山') >= 0 && bp.indexOf('E7&L7&O7') >= 0, bp);
eq(formula(book, 'sheet1', 'H8'), 'SUM(H7:H7)');
eq(formula(book, 'sheet1', 'BO9'), 'P3');
eq(formula(book, 'sheet1', 'BO10'), 'BO9-BO8');
assert.ok(cell(book, 'sheet2', 'E5').indexOf('哈尔滨东北虎林园') >= 0);
assert.ok(cell(book, 'sheet3', 'A1').indexOf('填写说明') >= 0);
assertNoOverlap(book.sheets.sheet1.merges);
assert.ok(buildWorkbook({}).slice(0, 2).toString() === 'PK');

/* 两天时合计行下移，且不把预警列合并成一块 */
const two = buildWorkbook({
  departDate: '2026-11-04',
  returnDate: '2026-11-05',
  recon: { days: [recon.emptyDay(1, '2026-11-04'), recon.emptyDay(2, '2026-11-05')] }
});
const twoBook = readBook(two);
eq(formula(twoBook, 'sheet1', 'H9'), 'SUM(H7:H8)');
eq(formula(twoBook, 'sheet1', 'BO11'), 'BO10-BO9');
assert.ok(!twoBook.sheets.sheet1.merges.some(m => m.indexOf('BP7:') === 0), 'per-day alert cells stay unmerged');

function readZip(buf) {
  const entries = {};
  let i = 0;
  const SIG = 0x04034b50;
  while (i + 30 <= buf.length) {
    if (buf.readUInt32LE(i) !== SIG) { i++; continue; }
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    if (!name || compSize === 0) { i = dataStart; continue; }
    const raw = buf.slice(dataStart, dataStart + compSize);
    entries[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    i = dataStart + compSize;
  }
  return entries;
}

function decode(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function colToNum(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheet(xml) {
  const cells = {};
  const formulas = {};
  const cRe = /<c\b[^>]*r="([A-Z]+\d+)"[^>]*(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = cRe.exec(xml))) {
    const ref = m[1];
    const inner = m[2] || '';
    const f = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner);
    if (f) formulas[ref] = decode(f[1]);
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
    const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
    if (t) cells[ref] = decode(t[1]);
    else if (v && !f) cells[ref] = decode(v[1]);
  }
  const merges = [];
  const mc = /<mergeCell ref="([^"]+)"/g;
  let mm;
  while ((mm = mc.exec(xml))) merges.push(mm[1]);
  return { cells, formulas, merges };
}

function readBook(buf) {
  const entries = readZip(buf);
  const wb = entries['xl/workbook.xml'].toString('utf8');
  const names = [...wb.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
  const sheets = {};
  ['sheet1', 'sheet2', 'sheet3'].forEach(id => {
    sheets[id] = readSheet(entries['xl/worksheets/' + id + '.xml'].toString('utf8'));
  });
  return { names, sheets };
}

function cell(book, sheet, ref) { return book.sheets[sheet].cells[ref] || ''; }
function formula(book, sheet, ref) { return book.sheets[sheet].formulas[ref] || ''; }
function numCell(book, sheet, ref) { return Number(cell(book, sheet, ref)); }

function assertNoOverlap(merges) {
  const boxes = merges.map(ref => {
    const [a, b] = ref.split(':');
    const box = (x) => ({ c: colToNum(x), r: parseInt(x.replace(/[A-Z]+/, ''), 10) });
    const s = box(a); const e = box(b);
    return { c1: s.c, r1: s.r, c2: e.c, r2: e.r, ref };
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      const hit = !(a.r2 < b.r1 || b.r2 < a.r1 || a.c2 < b.c1 || b.c2 < a.c1);
      assert.ok(!hit, 'merge overlap ' + a.ref + ' ' + b.ref);
    }
  }
}

eq(recon.str('a\u0000b\nc\u000bd', 20), 'ab\ncd', 'control chars stripped, newline kept');

const wbSrc = fs.readFileSync(path.join(root, 'utils/workbench.js'), 'utf8');
assert.ok(!/^const recon = require\('\.\/recon'\)/m.test(wbSrc), 'workbench must not load recon at startup');
assert.ok(wbSrc.indexOf("require('./recon')") > wbSrc.indexOf('function ticketSummaryOf'), 'recon require stays inside ticketSummaryOf');

const Module = require('module');
const origRequire = Module.prototype.require;
let reconLoads = 0;
Module.prototype.require = function (id) {
  if (String(id).indexOf('recon') >= 0) reconLoads += 1;
  return origRequire.apply(this, arguments);
};
const wbPath = require.resolve(path.join(root, 'utils/workbench.js'));
delete require.cache[wbPath];
const wb = require(wbPath);
eq(reconLoads, 0, 'requiring workbench does not load recon');
wb.warnOf({ departDate: '2099-01-01', payments: [], itinerary: { days: [] }, recon: { days: [] } }, {}, {});
assert.ok(reconLoads >= 1, 'warnOf loads recon');
Module.prototype.require = origRequire;

function wxmlBalance(file) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/\{\{[\s\S]*?\}\}/g, function (m) { return ' '.repeat(m.length); });
  const stack = [];
  const re = /<\/?\s*([A-Za-z][\w:-]*)[^>]*?>/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const name = m[1];
    if (raw.charAt(1) === '/') {
      const top = stack.pop();
      if (!top || top !== name) throw new Error(file + ' mismatch </' + name + '> top ' + top);
    } else if (!/\/\s*>$/.test(raw)) {
      stack.push(name);
    }
  }
  if (stack.length) throw new Error(file + ' unclosed ' + stack.join(','));
}
wxmlBalance(path.join(root, 'pages/workbench-detail/workbench-detail.wxml'));
wxmlBalance(path.join(root, 'pages/mine/mine.wxml'));
assert.ok(fs.readFileSync(path.join(root, 'pages/workbench-detail/workbench-detail.wxml'), 'utf8').indexOf('<textarea') >= 0);
assert.ok(!/<textarea\b[^>]*\/>/.test(fs.readFileSync(path.join(root, 'pages/workbench-detail/workbench-detail.wxml'), 'utf8')));

console.log('test-recon ok');
