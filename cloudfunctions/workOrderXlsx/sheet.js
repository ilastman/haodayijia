/**
 * 按《司机行程与财务利润一体化对账表 v3》生成 xlsx（无第三方依赖）。
 * 三张表：行程与财务对账 / 买票预警 / 填写说明。
 * 金额合计、行程天数、尾款、毛利、买票预警列为公式，打开 Excel 后重算。
 */
const recon = require('./recon');
const zlib = require('zlib');

const WIDTHS = [8, 12, 12, 10, 32, 22, 16, 9, 18, 14, 14, 28, 22, 16, 16, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 12, 14, 10, 10, 10, 10, 10, 10, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 14, 10, 10, 10, 12, 16];

function colLetter(n) {
  let s = '';
  let x = n + 1;
  while (x) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function xmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function crc32(buf) {
  if (!crc32.table) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(files) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const data = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    parts.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  });
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat(parts.concat([centralBuf, eocd]));
}

function stylesXml() {
  const fonts = [
    '<font><name val="Calibri"/><sz val="11"/></font>',
    '<font><name val="微软雅黑"/><b/><sz val="18"/><color rgb="FFFFFFFF"/></font>',
    '<font><name val="微软雅黑"/><sz val="10"/><color rgb="FF201D18"/></font>',
    '<font><name val="微软雅黑"/><b/><sz val="12"/><color rgb="FFFFFFFF"/></font>',
    '<font><name val="微软雅黑"/><b/><sz val="10"/><color rgb="FFC62828"/></font>',
    '<font><name val="微软雅黑"/><b/><sz val="10"/><color rgb="FF201D18"/></font>',
    '<font><name val="微软雅黑"/><sz val="9"/><color rgb="FF8A8478"/></font>',
    '<font><name val="微软雅黑"/><b/><sz val="12"/><color rgb="FF8A2F2F"/></font>'
  ];
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F3A33"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF3E6B57"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF8A5A2B"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8E2D6"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD7E6DD"/></patternFill></fill>'
  ];
  const border = '<border><left style="thin"><color rgb="FFD9D2C5"/></left><right style="thin"><color rgb="FFD9D2C5"/></right><top style="thin"><color rgb="FFD9D2C5"/></top><bottom style="thin"><color rgb="FFD9D2C5"/></bottom><diagonal/></border>';
  const borders = '<border><left/><right/><top/><bottom/><diagonal/></border>' + border;
  /* xf: font fill border numFmt wrap */
  const xfs = [
    [0, 0, 0, 0, 0],
    [1, 2, 0, 0, 0],
    [3, 4, 0, 0, 0],
    [3, 5, 0, 0, 0],
    [5, 6, 1, 0, 1],
    [2, 3, 1, 0, 1],
    [2, 3, 1, 164, 0],
    [2, 3, 1, 165, 0],
    [2, 3, 1, 0, 0],
    [7, 8, 1, 166, 0],
    [4, 7, 1, 0, 1],
    [6, 0, 0, 0, 1],
    [5, 8, 1, 0, 0],
    [5, 3, 0, 0, 0]
  ];
  const xfXml = xfs.map(x => {
    const align = '<alignment wrapText="' + (x[4] ? '1' : '0') + '" vertical="center"/>';
    return '<xf numFmtId="' + x[3] + '" fontId="' + x[0] + '" fillId="' + x[1] + '" borderId="' + x[2] + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"' + (x[3] ? ' applyNumberFormat="1"' : '') + '>' + align + '</xf>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>'
    + '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>'
    + '<fills count="' + fills.length + '">' + fills.join('') + '</fills>'
    + '<borders count="2">' + borders + '</borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="' + xfs.length + '">' + xfXml + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

class Grid {
  constructor() {
    this.cells = [];
    this.merges = [];
    this.heights = new Map();
  }
  put(r, c, value, style, type) {
    if (value === '' || value == null) return;
    this.cells.push({ r, c, v: value, s: style || 0, t: type || 's' });
  }
  num(r, c, value, style) {
    if (value === '' || value == null || !isFinite(Number(value))) return;
    this.cells.push({ r, c, v: Number(value), s: style == null ? 8 : style, t: 'n' });
  }
  formula(r, c, f, style) {
    this.cells.push({ r, c, v: f, s: style || 8, t: 'f' });
  }
  merge(r1, c1, r2, c2) { this.merges.push([r1, c1, r2, c2]); }
  height(r, h) { this.heights.set(r, h); }
  xml(name) {
    const byRow = new Map();
    this.cells.forEach(cell => {
      if (!byRow.has(cell.r)) byRow.set(cell.r, []);
      byRow.get(cell.r).push(cell);
    });
    const rows = Array.from(byRow.keys()).sort((a, b) => a - b);
    let maxR = rows.length ? rows[rows.length - 1] : 1;
    let maxC = 0;
    this.cells.forEach(cell => { if (cell.c > maxC) maxC = cell.c; });
    const rowXml = rows.map(r => {
      const ht = this.heights.get(r);
      const htAttr = ht ? ' ht="' + ht + '" customHeight="1"' : '';
      const inner = byRow.get(r).sort((a, b) => a.c - b.c).map(cell => {
        const ref = colLetter(cell.c) + r;
        const s = ' s="' + cell.s + '"';
        if (cell.t === 'f') return '<c r="' + ref + '"' + s + '><f>' + xmlEsc(cell.v) + '</f></c>';
        if (cell.t === 'n') return '<c r="' + ref + '"' + s + '><v>' + cell.v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"' + s + '><is><t xml:space="preserve">' + xmlEsc(cell.v) + '</t></is></c>';
      }).join('');
      return '<row r="' + r + '"' + htAttr + '>' + inner + '</row>';
    }).join('');
    const cols = WIDTHS.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('');
    const merges = this.merges.length
      ? '<mergeCells count="' + this.merges.length + '">' + this.merges.map(m => '<mergeCell ref="' + colLetter(m[1]) + m[0] + ':' + colLetter(m[3]) + m[2] + '"/>').join('') + '</mergeCells>'
      : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<dimension ref="A1:' + colLetter(Math.max(maxC, 67)) + maxR + '"/>'
      + '<sheetViews><sheetView workbookViewId="0"' + (name === 'main' ? ' tabSelected="1"' : '') + '/></sheetViews>'
      + '<sheetFormatPr defaultRowHeight="18"/>'
      + '<cols>' + cols + '</cols>'
      + '<sheetData>' + rowXml + '</sheetData>'
      + merges
      + '</worksheet>';
  }
}

function textOrNumber(grid, r, c, value, money) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return;
  if (/^-?\d+(\.\d+)?$/.test(s)) grid.num(r, c, Number(s), money ? 8 : 5);
  else grid.put(r, c, s, 5, 's');
}

function dateCell(grid, r, c, value) {
  const serial = recon.excelSerial(value);
  if (serial == null) {
    if (value) grid.put(r, c, String(value), 5, 's');
    return;
  }
  const hasTime = /[ T]\d{1,2}:\d{2}/.test(String(value));
  grid.num(r, c, serial, hasTime ? 7 : 6);
}

function headerPair(grid, c, top, sub) {
  grid.put(5, c, top, 4, 's');
  if (sub) grid.put(6, c, sub, 4, 's');
  else grid.merge(5, c, 6, c);
}

function daysForExport(order) {
  const model = recon.sanitizeRecon(order && order.recon, null);
  if (model.days.length) return model;
  const seeded = recon.fromItinerary(order || {});
  if (seeded.length) {
    model.days = seeded;
    return model;
  }
  model.days = [recon.emptyDay(1, (order && order.departDate) || '')];
  return model;
}

function buildMain(order) {
  const g = new Grid();
  const model = daysForExport(order);
  const customer = (order && order.customer) || {};
  const pricing = (order && order.pricing) || {};
  const days = model.days;
  const n = days.length;
  const first = 7;
  const last = 6 + n;
  const tot = last + 1;
  const quoteRow = last + 2;
  const profitRow = last + 3;
  const marginRow = last + 4;
  const bannerRow = last + 5;
  const noteRow = last + 6;

  g.height(1, 32);
  g.height(2, 28);
  g.height(3, 28);
  g.height(4, 26);
  g.height(5, 24);
  g.height(6, 36);
  for (let r = first; r <= last; r++) g.height(r, 78);
  g.height(bannerRow, 36);
  g.height(noteRow, 64);

  g.put(1, 0, '司机行程与财务利润一体化对账表 v3', 1, 's');
  g.merge(1, 0, 1, 67);

  const guest = [
    [0, '客人姓名', 1, customer.name || '', 1],
    [3, '联系电话', 4, customer.phone || '', 0],
    [5, '行程名称', 6, model.tripTitle || '', 2],
    [9, '所属销售', 10, (order && order.staffName) || '', 3],
    [14, '订单状态', 15, (order && order.status) || '', 3],
    [19, '微信号', 20, customer.wechat || '', 3],
    [24, '来源渠道', 25, customer.source || '', 3],
    [29, '目的地/大区', 30, (order && order.dest) || '', 4],
    [35, '用车信息', 36, model.vehicle || '', 4],
    [41, '接机时间', 42, model.pickupTime || '', 2],
    [45, '送机时间', 46, model.dropoffTime || '', 2],
    [49, '机场接机地点', 50, model.pickupPlace || '', 3],
    [54, '机场送机地点', 55, model.dropoffPlace || '', 4]
  ];
  guest.forEach(item => {
    g.put(2, item[0], item[1], 13, 's');
    if (item[0] === 41 || item[0] === 45) dateCell(g, 2, item[2], item[3]);
    else g.put(2, item[2], item[3], 5, 's');
    if (item[4]) g.merge(2, item[2], 2, item[2] + item[4]);
  });

  g.put(3, 0, '成人数', 13, 's');
  let adults = model.adults;
  let children = model.children;
  if (adults === '' && children === '' && recon.num(order && order.people)) adults = String(order.people);
  textOrNumber(g, 3, 1, adults, false);
  g.put(3, 2, '儿童数', 13, 's');
  textOrNumber(g, 3, 3, children, false);
  g.put(3, 4, '出行人数', 13, 's');
  g.formula(3, 5, 'B3+D3', 5);
  g.put(3, 6, '出行日期', 13, 's');
  dateCell(g, 3, 7, order && order.departDate);
  g.put(3, 8, '返程日期', 13, 's');
  dateCell(g, 3, 9, order && order.returnDate);
  g.put(3, 10, '行程天数', 13, 's');
  g.formula(3, 12, 'IF(AND(H3<>"",J3<>""),J3-H3+1,"")', 5);
  g.merge(3, 12, 3, 13);
  g.put(3, 14, '团费总价', 13, 's');
  g.num(3, 15, recon.num(pricing.quote), 8);
  g.merge(3, 15, 3, 18);
  g.put(3, 19, '已收款', 13, 's');
  g.num(3, 20, recon.paidTotal(order), 8);
  g.merge(3, 20, 3, 23);
  g.put(3, 24, '待收尾款', 13, 's');
  g.formula(3, 25, 'P3-U3', 8);
  g.merge(3, 25, 3, 28);
  g.put(3, 29, '备注', 13, 's');
  g.put(3, 30, customer.remark || '', 5, 's');
  g.merge(3, 30, 3, 67);

  g.put(4, 0, '司机专用·每日行程执行清单', 2, 's');
  g.merge(4, 0, 4, 14);
  g.put(4, 15, '财务专用·费用明细对账表（景区1–3 + 游玩1–3 + 保险/其他1–3）', 3, 's');
  g.merge(4, 15, 4, 67);

  const singles = [
    [0, '天数'], [1, '日期'], [2, '出发地'], [3, '目的地'], [4, '详细行程'], [5, '行车路线'],
    [6, '用车信息\n(车型/车牌/司机)'], [7, '预计路程\n(公里)'], [8, '入住酒店\n(房型×间数)'],
    [9, '酒店联系电话'], [10, '餐饮安排'], [11, '景区票种明细\n(全票×n / 半票×n / 免票×n)'],
    [12, '景区联系电话'], [13, '航班接送(当日)\n时间/地点'], [14, '其他备注'],
    [39, '当日门票合计\n(景区+游玩)'], [66, '当日总花费'], [67, '买票预警']
  ];
  singles.forEach(pair => headerPair(g, pair[0], pair[1]));

  const groups = [
    [15, '景区1', ['景区名称', '门票金额', '付款状态', '付款时间']],
    [19, '景区2', ['景区名称', '门票金额', '付款状态', '付款时间']],
    [23, '景区3', ['景区名称', '门票金额', '付款状态', '付款时间']],
    [27, '游玩1', ['游玩名称', '金额', '付款状态', '付款时间']],
    [31, '游玩2', ['游玩名称', '金额', '付款状态', '付款时间']],
    [35, '游玩3', ['游玩名称', '金额', '付款状态', '付款时间']],
    [40, '酒店住宿', ['酒店/房型', '住宿费用', '付款状态', '付款时间']],
    [44, '用车', ['用车费用', '付款状态', '付款时间']],
    [47, '餐饮', ['餐饮费用', '付款状态', '付款时间']],
    [50, '保险/其他1', ['明细', '金额', '付款状态', '付款时间']],
    [54, '保险/其他2', ['明细', '金额', '付款状态', '付款时间']],
    [58, '保险/其他3', ['明细', '金额', '付款状态', '付款时间']],
    [62, '司机报账', ['报账项目/明细', '金额', '付款状态', '付款时间']]
  ];
  groups.forEach(group => {
    g.put(5, group[0], group[1], 4, 's');
    g.merge(5, group[0], 5, group[0] + group[2].length - 1);
    group[2].forEach((label, i) => g.put(6, group[0] + i, label, 4, 's'));
  });

  days.forEach((day, i) => {
    const r = first + i;
    g.num(r, 0, day.dayNum || (i + 1), 5);
    dateCell(g, r, 1, day.date);
    g.put(r, 2, day.from, 5, 's');
    g.put(r, 3, day.to, 5, 's');
    g.put(r, 4, day.itinerary, 5, 's');
    g.put(r, 5, day.route, 5, 's');
    g.put(r, 6, day.vehicle, 5, 's');
    textOrNumber(g, r, 7, day.km, false);
    g.put(r, 8, day.hotel, 5, 's');
    g.put(r, 9, day.hotelPhone, 5, 's');
    g.put(r, 10, day.meals, 5, 's');
    g.put(r, 11, day.tickets, 5, 's');
    g.put(r, 12, day.scenicPhones, 5, 's');
    g.put(r, 13, day.flight, 5, 's');
    g.put(r, 14, day.remark, 5, 's');

    const lines = [
      [15, day.scenics[0], true],
      [19, day.scenics[1], true],
      [23, day.scenics[2], true],
      [27, day.plays[0], true],
      [31, day.plays[1], true],
      [35, day.plays[2], true]
    ];
    lines.forEach(line => {
      g.put(r, line[0], line[1].name, 5, 's');
      textOrNumber(g, r, line[0] + 1, line[1].amount, true);
      g.put(r, line[0] + 2, line[1].payStatus || '未付', 5, 's');
      dateCell(g, r, line[0] + 3, line[1].payTime);
    });
    g.formula(r, 39, 'SUM(Q' + r + ',U' + r + ',Y' + r + ',AC' + r + ',AG' + r + ',AK' + r + ')', 8);

    g.put(r, 40, day.hotelCost.name, 5, 's');
    textOrNumber(g, r, 41, day.hotelCost.amount, true);
    g.put(r, 42, day.hotelCost.payStatus || '未付', 5, 's');
    dateCell(g, r, 43, day.hotelCost.payTime);

    textOrNumber(g, r, 44, day.vehicleCost.amount, true);
    g.put(r, 45, day.vehicleCost.payStatus || '未付', 5, 's');
    dateCell(g, r, 46, day.vehicleCost.payTime);

    textOrNumber(g, r, 47, day.mealCost.amount, true);
    g.put(r, 48, day.mealCost.payStatus || '未付', 5, 's');
    dateCell(g, r, 49, day.mealCost.payTime);

    day.extras.forEach((ex, idx) => {
      const c0 = 50 + idx * 4;
      g.put(r, c0, ex.detail, 5, 's');
      textOrNumber(g, r, c0 + 1, ex.amount, true);
      g.put(r, c0 + 2, ex.payStatus || '未付', 5, 's');
      dateCell(g, r, c0 + 3, ex.payTime);
    });

    g.put(r, 62, day.driverClaim.detail, 5, 's');
    textOrNumber(g, r, 63, day.driverClaim.amount, true);
    g.put(r, 64, day.driverClaim.payStatus || '未付', 5, 's');
    dateCell(g, r, 65, day.driverClaim.payTime);

    g.formula(r, 66, 'SUM(AN' + r + ',AP' + r + ',AS' + r + ',AV' + r + ',AZ' + r + ',BD' + r + ',BH' + r + ',BL' + r + ')', 8);
    g.formula(r, 67, recon.alertFormula(r), 10);
  });

  g.put(tot, 0, '费用合计（各项小计）', 12, 's');
  g.merge(tot, 0, tot, 6);
  const sumCols = [7, 16, 20, 24, 28, 32, 36, 39, 41, 44, 47, 51, 55, 59, 63, 66];
  sumCols.forEach(c => {
    const letter = colLetter(c);
    g.formula(tot, c, 'SUM(' + letter + first + ':' + letter + last + ')', 12);
  });

  g.put(quoteRow, 0, '团费总价（取自信息栏）', 12, 's');
  g.merge(quoteRow, 0, quoteRow, 65);
  g.formula(quoteRow, 66, 'P3', 8);

  g.put(profitRow, 0, '本次行程总利润（团费总价 − 费用合计）', 12, 's');
  g.merge(profitRow, 0, profitRow, 65);
  g.formula(profitRow, 66, 'BO' + quoteRow + '-BO' + tot, 8);

  g.put(marginRow, 0, '毛利率', 12, 's');
  g.merge(marginRow, 0, marginRow, 65);
  g.formula(marginRow, 66, 'IF(BO' + quoteRow + '=0,"",BO' + profitRow + '/BO' + quoteRow + ')', 9);

  g.put(bannerRow, 0, recon.ruleBanner(), 10, 's');
  g.merge(bannerRow, 0, bannerRow, 67);

  g.put(noteRow, 0, '说明：1) 信息栏字段对应小程序「员工工作台·客户详情」，含航班接/送时间与机场地点；2) 票种业务规则：儿童半价优先——有半价用半价，否则可免则免，否则全票；司机栏「景区票种明细」填写 全票×n / 半票×n / 免票×n；3) 财务：景区1–3为门票入口，游玩1–3为付费体验/项目；当日门票合计=景区+游玩金额之和；当日总花费=门票合计+住宿+用车+餐饮+保险/其他1–3+司机报账（只计金额列）；4) 买票预警：见「买票预警」工作表红名单；当日「买票预警」列按（出行日期−TODAY）自动提示，并同时检索当天详细行程、票种明细、备注和财务名称；5) 团费总价、已收款分别取工作台成交价与收款台账；6) 本表为内部经营资料，请勿对客展示。', 11, 's');
  g.merge(noteRow, 0, noteRow, 67);
  return g;
}

function buildAlertSheet() {
  const g = new Grid();
  g.height(1, 28);
  g.height(2, 36);
  g.put(1, 0, '买票红色预警规则（按出行日期提前天数）', 1, 's');
  g.merge(1, 0, 1, 5);
  g.put(2, 0, '用法：主表「买票预警」列根据 出行日期(H3)−TODAY 与当日景区/游玩名称、详细行程、票种明细、备注自动判断；名称包含关键词即触发。名单与员工工作台红字预警一致。', 11, 's');
  g.merge(2, 0, 2, 5);
  ['提前天数', '预警级别', '景区/项目关键词（命中即红）', '示例说明', '名单（每行一个，供查阅）', '备注'].forEach((h, i) => g.put(4, i, h, 4, 's'));
  let row = 5;
  recon.TICKET_RULES.forEach(rule => {
    const start = row;
    rule.names.forEach((name, idx) => {
      if (idx === 0) {
        g.num(row, 0, rule.days, 5);
        g.put(row, 1, '红色·' + rule.label, 10, 's');
        g.put(row, 2, rule.names.join('、'), 5, 's');
        g.put(row, 3, rule.note, 5, 's');
        g.put(row, 5, '≤' + rule.days + '天触发', 5, 's');
      }
      g.put(row, 4, name, 10, 's');
      g.height(row, 22);
      row++;
    });
    if (rule.names.length > 1) {
      g.merge(start, 0, start + rule.names.length - 1, 0);
      g.merge(start, 1, start + rule.names.length - 1, 1);
      g.merge(start, 2, start + rule.names.length - 1, 2);
      g.merge(start, 3, start + rule.names.length - 1, 3);
      g.merge(start, 5, start + rule.names.length - 1, 5);
    }
    row++;
  });
  g.put(row, 0, '票种业务规则（司机/财务共用）：儿童半价优先——有半价用半价；否则可免则免；否则全票。填写示例：全票×2 / 半票×1 / 免票×0', 11, 's');
  g.merge(row, 0, row, 5);
  row += 2;
  g.put(row, 0, '维护提示：新增预警景区时，请同时改 utils/recon.js 的 TICKET_RULES（并同步云函数副本）后重新部署 workOrderXlsx。关键词按包含匹配，须与红名单写法一致，例如「哈尔滨东北虎林园」不会被简称「东北虎林园」命中。', 11, 's');
  g.merge(row, 0, row, 5);
  return g;
}

function buildHelp() {
  const g = new Grid();
  const lines = [
    '司机行程与财务利润一体化对账表 v3 — 填写说明',
    '',
    '【司机板块 · 左侧 A–O】',
    '• 天数/日期/出发地/目的地/详细行程/行车路线/用车信息/预计路程：按天填写，一天一行。',
    '• 入住酒店 + 酒店联系电话：方便司机当日联络。',
    '• 餐饮安排：早午晚。',
    '• 景区票种明细：每个景区一行「景区名：全票×n / 半票×n / 免票×n」；儿童半价优先（有半价用半价，否则可免则免，否则全票）。',
    '• 景区联系电话：可写多个，换行分隔。',
    '• 航班接送(当日)：接机/送机当天填写时间与机场地点；其余天可留空。',
    '• 其他备注：司机手写自由备注。',
    '',
    '【信息栏航班】第2行：接机时间、送机时间、机场接机地点、机场送机地点（整团共用）。',
    '',
    '【财务板块 · 右侧 P–BO】',
    '• 景区1–3：门票入口（名称、金额、付款状态、付款时间）。',
    '• 游玩1–3：付费体验/项目（非单纯门票），字段同景区。',
    '• 当日门票合计：自动 = 景区1–3金额 + 游玩1–3金额。',
    '• 酒店住宿 / 用车 / 餐饮：金额、付款状态、付款时间；酒店另有房型名称。',
    '• 保险/其他1–3：各含 明细、金额、付款状态、付款时间。',
    '• 司机报账：报账项目/明细、金额、付款状态、付款时间。',
    '• 当日总花费：自动汇总以上金额列（不含付款状态）。',
    '• 买票预警：自动根据出行日期与景区/游玩名称、行程、票种、备注提示红名单。',
    '',
    '【买票预警红名单】见「买票预警」表',
    '提前1天：哈尔滨东北虎林园，大秃顶子山，伏尔加庄园，雪乡，森林小伙车',
    '提前3天：冰雪大世界，雪博会，极地公园，滑雪，旅拍，镜泊湖景区',
    '提前7天：哈工大，七三一',
    '提前15天：长白山',
    '',
    '【与小程序字段的对应】团费总价 = 客户成交价；已收款 = 收款台账合计；待收尾款 = 团费 − 已收。旧版「分项成本」仍保留在工作台，不自动并进本表，避免和按天财务重复计算。导游、杂费没有单独列，可记在保险/其他或司机报账。'
  ];
  lines.forEach((line, i) => {
    g.put(i + 1, 0, line, i === 0 ? 1 : 11, 's');
    g.merge(i + 1, 0, i + 1, 5);
    g.height(i + 1, line ? 22 : 10);
  });
  return g;
}

function workbookXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>'
    + '<sheet name="行程与财务对账" sheetId="1" r:id="rId1"/>'
    + '<sheet name="买票预警" sheetId="2" r:id="rId2"/>'
    + '<sheet name="填写说明" sheetId="3" r:id="rId3"/>'
    + '</sheets>'
    + '<calcPr calcId="191029" fullCalcOnLoad="1"/>'
    + '</workbook>';
}

function buildWorkbook(order) {
  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>' },
    { name: 'xl/workbook.xml', data: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'
      + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>' },
    { name: 'xl/styles.xml', data: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', data: buildMain(order).xml('main') },
    { name: 'xl/worksheets/sheet2.xml', data: buildAlertSheet().xml('alert') },
    { name: 'xl/worksheets/sheet3.xml', data: buildHelp().xml('help') }
  ];
  return zipStore(files);
}

module.exports = { buildWorkbook, buildMain, colLetter };
