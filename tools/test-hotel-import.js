/* 单测：admin/js/hotel-import.js 横向多档期解析（以真实《测试版酒店表.xlsx》为基准）
 * 运行：node tools/test-hotel-import.js
 * 若样例文件存在则做「真实文件」断言；否则回退到内联构造断言。 */
const path = require('path');
const fs = require('fs');
const HI = require('../admin/js/hotel-import.js');
const { readXlsx } = require('./xlsx-read.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  => ' + extra : '')); }
}
function eq(name, a, b) { ok(name + ' [' + JSON.stringify(a) + ']', JSON.stringify(a) === JSON.stringify(b), 'got ' + JSON.stringify(a)); }

console.log('\n== 纯函数：区间价 ==');
eq('680-775', HI.parsePriceRange('680-775'), { price: 680, priceMin: 680, priceMax: 775, priceRaw: '680-775' });
eq('3000-3100', HI.parsePriceRange('3000 - 3100'), { price: 3000, priceMin: 3000, priceMax: 3100, priceRaw: '3000 - 3100' });
eq('单值 900', HI.parsePriceRange('900'), { price: 900, priceMin: 900, priceMax: 900, priceRaw: '900' });
ok('空 -> null', HI.parsePriceRange('') === null);
ok('非数字 -> null', HI.parsePriceRange('含早') === null);

console.log('\n== 纯函数：档期文本拆分 ==');
eq('换行两段', HI.splitPeriodText('11.16-11.30\n2.21-3.31'), ['11.16-11.30', '2.21-3.31']);
eq('空格两段', HI.splitPeriodText('2.5-2.6 2.11-2.12'), ['2.5-2.6', '2.11-2.12']);
eq('单段', HI.splitPeriodText('12.1-2.20'), ['12.1-2.20']);
eq('简写跨年+全写混合', HI.splitPeriodText('12月1日-12月10日27年2月13日-2月21日'), ['12月1日-12月10日27年2月13日-2月21日']);

console.log('\n== 纯函数：雪季年份推断 ==');
eq('明确 26年', HI.resolveSeasonYear(['26年12月11日-27年02月5日'], new Date('2026-10-22')), 2026);
eq('无明确年份 -> 当前雪季(10月导入=2026)', HI.resolveSeasonYear(['11.1-11.15', '12.1-2.20'], new Date('2026-10-22')), 2026);
eq('1月导入 -> 上一雪季(2025)', HI.resolveSeasonYear(['1.1-2.28'], new Date('2027-01-10')), 2026);

console.log('\n== 纯函数：档期补全年份 ==');
eq('12.1-2.20 -> 2026-12-01~2027-02-20', HI.completePeriod(HI.parseSinglePeriod('12.1-2.20'), 2026), { start: '2026-12-01', end: '2027-02-20', raw: '12.1-2.20' });
eq('11.1-11.15', HI.completePeriod(HI.parseSinglePeriod('11.1-11.15'), 2026), { start: '2026-11-01', end: '2026-11-15', raw: '11.1-11.15' });
eq('全写带年份', HI.completePeriod(HI.parseSinglePeriod('26年12月11日-27年02月5日'), 2026), { start: '2026-12-11', end: '2027-02-05', raw: '26年12月11日-27年02月5日' });
ok('模糊 11月中', (function () { const p = HI.completePeriod(HI.parseSinglePeriod('11月中'), 2026); return p && p.fuzzy === true; })());
ok('模糊 12月上旬', (function () { const p = HI.completePeriod(HI.parseSinglePeriod('12月上旬'), 2026); return p && p.fuzzy === true; })());

console.log('\n== 纯函数：今年/次年归属 + 跨年拆段 ==');
const nowY = new Date('2026-10-26');
eq('12.1-12.20 归 2026', HI.expandPeriodByYear(HI.parseSinglePeriod('12.1-12.20'), nowY), [
  { start: '2026-12-01', end: '2026-12-20', raw: '12.1-12.20' }
]);
eq('12.20-2.06 拆 2026+2027', HI.expandPeriodByYear(HI.parseSinglePeriod('12.20-2.06'), nowY), [
  { start: '2026-12-20', end: '2026-12-31', raw: '12.20-2.06' },
  { start: '2027-01-01', end: '2027-02-06', raw: '12.20-2.06' }
]);
eq('1.1-2.28 归 2027', HI.expandPeriodByYear(HI.parseSinglePeriod('1.1-2.28'), nowY), [
  { start: '2027-01-01', end: '2027-02-28', raw: '1.1-2.28' }
]);
eq('11.1-11.15 归 2026', HI.expandPeriodByYear(HI.parseSinglePeriod('11.1-11.15'), nowY), [
  { start: '2026-11-01', end: '2026-11-15', raw: '11.1-11.15' }
]);

console.log('\n== 真实样例文件解析 ==');
const samplePath = 'C:\\Users\\51160\\AppData\\Local\\Temp\\opencode\\hotel-sample.xlsx';
if (fs.existsSync(samplePath)) {
  const { aoa, merges } = readXlsx(samplePath);
  const res = HI.parseHotelBlocks(aoa, merges, { now: new Date('2026-10-22') });
  console.log('  seasonYear =', res.seasonYear, '| stats =', JSON.stringify(res.stats));
  ok('识别酒店数量 > 15', res.stats.hotels >= 15, 'got ' + res.stats.hotels);
  ok('识别档期数量 > 40', res.stats.periods >= 40, 'got ' + res.stats.periods);

  /* 酒店归属：第一块 */
  const h1 = res.hotels.find(h => h.name.indexOf('长白山蓝景') >= 0);
  ok('第一块酒店名归属正确', !!h1, 'not found');
  if (h1) {
    eq('第一块早餐', h1.breakfast, '含早');
    ok('第一块钻级含 5', h1.level.indexOf('5') >= 0);
    ok('第一块有房型', h1.rooms.length >= 1);
  }

  /* 一格两段拆分：11.16-11.30 & 2.21-3.31 应各成一条 */
  const seg = res.periods.filter(p => p.hotelName.indexOf('长白山蓝景') >= 0 && p.roomType === '大、双床');
  const has1130 = seg.some(p => p.start === '2026-11-16' && p.end === '2026-11-30');
  const has331 = seg.some(p => p.start === '2027-02-21' && p.end === '2027-03-31');
  ok('一格两段已拆: 11.16-11.30', has1130, JSON.stringify(seg.map(s => s.start + '~' + s.end)));
  ok('一格两段已拆: 2.21-3.31', has331);

  /* 跨年简写：12.1-2.20 拆成 2026 段 + 2027 段 */
  const cross26 = res.periods.find(p => p.start === '2026-12-01' && p.end === '2026-12-31');
  const cross27 = res.periods.find(p => p.start === '2027-01-01' && p.end === '2027-02-20');
  ok('跨年简写拆出 2026-12-01~2026-12-31', !!cross26);
  ok('跨年简写拆出 2027-01-01~2027-02-20', !!cross27);

  /* 全写跨年：26年12月11日-27年02月5日 同样拆段 */
  const full26 = res.periods.find(p => p.start === '2026-12-11' && p.end === '2026-12-31');
  const full27 = res.periods.find(p => p.start === '2027-01-01' && p.end === '2027-02-05');
  ok('全写档期拆出 2026-12-11~2026-12-31', !!full26);
  ok('全写档期拆出 2027-01-01~2027-02-05', !!full27);

  /* 模糊档期标记 */
  const fuzzy = res.periods.filter(p => p.fuzzy);
  ok('模糊档期已标记 (>=2)', fuzzy.length >= 2, 'got ' + fuzzy.length + ' ' + JSON.stringify(fuzzy.map(f => f.remark)));
  const f1 = fuzzy.find(f => String(f.remark).indexOf('11月中') >= 0);
  ok('模糊档期含「11月中」', !!f1);

  /* 区间价保存 */
  const rp = res.periods.find(p => p.priceRaw === '680-775');
  ok('区间价 680-775', rp && rp.price === 680 && rp.priceMin === 680 && rp.priceMax === 775, rp ? JSON.stringify(rp) : 'not found');
  const rp2 = res.periods.find(p => p.priceRaw === '3000-3100');
  ok('区间价 3000-3100', rp2 && rp2.price === 3000 && rp2.priceMax === 3100);

  /* 注销：每个 period 必须有酒店名与房型 */
  ok('所有档期均有酒店名', res.periods.every(p => p.hotelName));
  ok('所有档期均有房型', res.periods.every(p => p.roomType));

  console.log('\n  -- 抽样档期（前 12 条）--');
  res.periods.slice(0, 12).forEach(p => {
    console.log('    ' + [p.hotelName, p.roomType, p.fuzzy ? ('模糊:' + p.remark) : (p.start + '~' + p.end), p.priceRaw || '(无价)'].join(' | '));
  });
} else {
  console.log('  (样例文件不存在，跳过真实文件断言)  path=' + samplePath);
  ok('内联构造回退', true);
}

console.log('\n== 校验：非法日期报酒店+单元格 ==');
const aoa2 = [
  ['', '酒店名称', '早餐', '钻级', '装修', '联系', '备注', '房型', '床型', '日期'],
  ['1', '测试酒店', '', '', '', '', '', '房型', '床型', '13.40-11.99'],
  ['', '', '', '', '', '', '', '大床房', '1.8m', '999']
];
const res2 = HI.parseHotelBlocks(aoa2, [], { now: new Date('2026-10-22') });
ok('非法档期进入异常', res2.stats.anomalies >= 1, JSON.stringify(res2.anomalies));
ok('异常含酒店名', res2.anomalies.every(a => a.hotelName === '测试酒店'));
ok('异常含单元格', res2.anomalies.every(a => /[A-Z]+\d+/.test(a.cell)), JSON.stringify(res2.anomalies.map(a => a.cell)));

console.log('\n== 新版式（含一级大区 + 所在区域列）解析 ==');
const aoa3 = [
  ['序号', '酒店名称', '一级大区', '所在区域', '早餐', '钻级', '装修', '联系', '备注', '房型', '床型', '11.1-11.15', '12.1-2.20'],
  ['1', '新格式酒店', '黑龙江', '雪乡', '含早', '5钻', '2019', '138', '备注', '房型', '床型', '11.1-11.15', '12.1-2.20'],
  ['', '', '', '', '', '', '', '', '', '标准双床房', '1.2*2', '900', '1400']
];
const res3 = HI.parseHotelBlocks(aoa3, [], { now: new Date('2026-10-22') });
ok('新版式识别酒店数=1', res3.stats.hotels === 1, JSON.stringify(res3.stats));
ok('新版式区域=雪乡', res3.hotels[0] && res3.hotels[0].area === '雪乡', res3.hotels[0] && res3.hotels[0].area);
ok('新版式一级大区=黑龙江', res3.hotels[0] && res3.hotels[0].regionLevel1 === '黑龙江', res3.hotels[0] && res3.hotels[0].regionLevel1);
ok('新版式早餐=含早', res3.hotels[0] && res3.hotels[0].breakfast === '含早', res3.hotels[0] && res3.hotels[0].breakfast);
ok('新版式装修=2019', res3.hotels[0] && res3.hotels[0].decorateYear === '2019', res3.hotels[0] && res3.hotels[0].decorateYear);
ok('新版式房型=标准双床房', res3.hotels[0] && res3.hotels[0].rooms[0] && res3.hotels[0].rooms[0].name === '标准双床房');
ok('新版式档期=3（跨年拆段）', res3.stats.periods === 3, JSON.stringify(res3.stats));
ok('新版式档期1正确', res3.periods.some(p => p.start === '2026-11-01' && p.end === '2026-11-15' && p.price === 900));
ok('新版式跨年拆 2026 段', res3.periods.some(p => p.start === '2026-12-01' && p.end === '2026-12-31' && p.price === 1400));
ok('新版式跨年拆 2027 段', res3.periods.some(p => p.start === '2027-01-01' && p.end === '2027-02-20' && p.price === 1400));

console.log('\n== 旧版式（无区域列）区域留空 ==');
const aoa4 = [
  ['', '酒店名称', '早餐', '钻级', '装修', '联系', '备注', '房型', '床型', '11.1-11.15'],
  ['1', '旧格式酒店', '含早', '4钻', '2020', '139', '', '房型', '床型', '11.1-11.15'],
  ['', '', '', '', '', '', '', '大床房', '1.8', '880']
];
const res4 = HI.parseHotelBlocks(aoa4, [], { now: new Date('2026-10-22') });
ok('旧版式区域留空', res4.hotels[0] && res4.hotels[0].area === '', JSON.stringify(res4.hotels[0]));
ok('旧版式早餐=含早', res4.hotels[0] && res4.hotels[0].breakfast === '含早');
ok('旧版式档期=1', res4.stats.periods === 1);
ok('旧版式缺一级大区和地区时导入门禁跳过', HI.parseWorkbook(aoa4, [], { now: new Date('2026-10-22') }).stats.hotels === 0);

console.log('\n== 一行一酒店：多组开始/结束/售价（区间不对齐）==');
const aoaWide = [
  ['酒店名称', '酒店星级', '区域', '分类', '房型', '配套设施', '开始日期', '结束日期', '对应售价', '开始日期', '结束日期', '对应售价'],
  ['A酒店', '五星', '海拉尔', '草原线', '标准间', '地暖', '2026-11-15', '2026-12-15', '880', '', '', ''],
  ['B酒店', '金牌民宿', '额尔古纳', '边境', '大床房', '温泉SPA', '', '', '', '2026-11-20', '2026-12-20', '980']
];
const resW = HI.parseWorkbook(aoaWide, [], { now: new Date('2026-10-22') });
ok('宽表识别酒店=2', resW.stats.hotels === 2, JSON.stringify(resW.stats));
ok('宽表档期=2', resW.stats.periods === 2, JSON.stringify(resW.periods));
ok('A酒店档期 11.15-12.15 / 880', resW.periods.some(p => p.hotelName === 'A酒店' && p.start === '2026-11-15' && p.end === '2026-12-15' && p.price === 880));
ok('B酒店档期 11.20-12.20 / 980', resW.periods.some(p => p.hotelName === 'B酒店' && p.start === '2026-11-20' && p.end === '2026-12-20' && p.price === 980));
ok('非枚举星级原样', resW.hotels[1] && resW.hotels[1].level === '金牌民宿');
ok('非枚举分类原样', resW.hotels[1] && resW.hotels[1].regionLevel1 === '边境');
ok('设施原样', resW.hotels[0] && resW.hotels[0].facility === '地暖');
ok('房型原样', resW.periods[0] && resW.periods[0].roomType === '标准间');

console.log('\n== 一行一酒店：日期区间列头（空单元格=该酒店无此档期）==');
const aoaDateCol = [
  ['酒店名称', '星级', '一级大区', '区域', '11.15-12.15', '11.20-12.20'],
  ['A酒店', '5星', '呼伦贝尔', '海拉尔', '880', ''],
  ['B酒店', '四钻', '呼伦贝尔', '满洲里', '', '980']
];
const resD = HI.parseWorkbook(aoaDateCol, [], { now: new Date('2026-10-22') });
ok('列头宽表酒店=2', resD.stats.hotels === 2);
ok('列头宽表档期=2', resD.stats.periods === 2, JSON.stringify(resD.periods.map(p => p.hotelName + p.start + p.price)));
ok('A 命中 2026-11-15~2026-12-15', resD.periods.some(p => p.hotelName === 'A酒店' && p.start === '2026-11-15' && p.end === '2026-12-15' && p.price === 880));
ok('B 命中 2026-11-20~2026-12-20', resD.periods.some(p => p.hotelName === 'B酒店' && p.start === '2026-11-20' && p.end === '2026-12-20' && p.price === 980));

console.log('\n== 必填四项：酒店名称 + 钻级级别 + 一级大区 + 地区 ==');
const aoaNameOnly = [
  ['酒店名称', '开始日期', '结束日期', '对应售价'],
  ['只要名字', '2026-11-01', '2026-11-10', '500']
];
const resN = HI.parseWorkbook(aoaNameOnly, [], { now: new Date('2026-10-22') });
ok('缺一级大区和地区则跳过', resN.stats.hotels === 0 && resN.stats.periods === 0, JSON.stringify(resN.stats));
ok('缺项提示含一级大区', resN.anomalies.some(a => a.msg.indexOf('一级大区') >= 0));
ok('缺项提示含地区', resN.anomalies.some(a => a.msg.indexOf('地区') >= 0));
ok('无名称行跳过', HI.parseWorkbook([['酒店名称', '一级大区', '地区'], ['', '', ''], ['  ', '', '']], [], { now: new Date('2026-10-22') }).stats.hotels === 0);

const aoaMissLevel = [
  ['酒店名称', '一级大区', '地区', '星级'],
  ['只建档', '雪乡', '雪乡镇', '']
];
const resMissL = HI.parseWorkbook(aoaMissLevel, [], { now: new Date('2026-10-22') });
ok('缺钻级整行跳过', resMissL.stats.hotels === 0 && resMissL.stats.periods === 0, JSON.stringify(resMissL.stats));
ok('缺钻级有提示', resMissL.anomalies.some(a => a.msg.indexOf('钻级级别') >= 0), JSON.stringify(resMissL.anomalies));

const aoaBaseOnly = [
  ['酒店名称', '一级大区', '地区', '星级'],
  ['只建档', '雪乡', '雪乡镇', '五钻']
];
const resBase = HI.parseWorkbook(aoaBaseOnly, [], { now: new Date('2026-10-22') });
ok('无价格无日期仍导入酒店', resBase.stats.hotels === 1 && resBase.stats.periods === 0, JSON.stringify(resBase.stats));
ok('无日期不报日期格式错误', resBase.anomalies.every(a => a.msg.indexOf('日期') < 0), JSON.stringify(resBase.anomalies));

const aoaSameName = [
  ['酒店名称', '星级', '一级大区', '地区'],
  ['同名馆', '五钻', '呼伦贝尔', '海拉尔'],
  ['同名馆', '四钻', '呼伦贝尔', '海拉尔']
];
const resSame = HI.parseWorkbook(aoaSameName, [], { now: new Date('2026-10-22') });
ok('同名不同钻级解析为两家', resSame.stats.hotels === 2, JSON.stringify(resSame.hotels.map(h => h.level)));
ok('四项键不同', HI.hotelKey(resSame.hotels[0]) !== HI.hotelKey(resSame.hotels[1]));

const aoaBadDate = [
  ['酒店名称', '一级大区', '地区', '星级', '11.40-11.99'],
  ['坏日期酒店', '呼伦贝尔', '海拉尔', '五钻', '100']
];
const resBad = HI.parseWorkbook(aoaBadDate, [], { now: new Date('2026-10-22') });
ok('日期非法仍保留酒店', resBad.stats.hotels === 1, JSON.stringify(resBad.stats));
ok('日期非法不产生档期', resBad.stats.periods === 0);
ok('日期非法不报日期错误', resBad.anomalies.every(a => a.msg.indexOf('日期') < 0 && a.msg.indexOf('档期') < 0), JSON.stringify(resBad.anomalies));

const aoaMissRegion = [
  ['酒店名称', '地区', '开始日期', '结束日期', '对应售价'],
  ['缺大区', '海拉尔', '2026-11-01', '2026-11-10', '500']
];
const resMissR = HI.parseWorkbook(aoaMissRegion, [], { now: new Date('2026-10-22') });
ok('缺一级大区整行跳过', resMissR.stats.hotels === 0 && resMissR.stats.periods === 0);
ok('缺一级大区有提示', resMissR.anomalies.some(a => a.hotelName === '缺大区' && a.msg.indexOf('一级大区') >= 0));

const aoaMissArea = [
  ['酒店名称', '一级大区'],
  ['缺地区', '呼伦贝尔']
];
const resMissA = HI.parseWorkbook(aoaMissArea, [], { now: new Date('2026-10-22') });
ok('缺地区整行跳过', resMissA.stats.hotels === 0);
ok('缺地区有提示', resMissA.anomalies.some(a => a.msg.indexOf('地区') >= 0 && a.msg.indexOf('一级大区') < 0), JSON.stringify(resMissA.anomalies));

console.log('\n== parseWorkbook 仍走酒店块表（含房型/床型表头行）==');
const resBlock = HI.parseWorkbook(aoa3, [], { now: new Date('2026-10-22') });
ok('块表不被宽表误吃', resBlock.stats.hotels === 1 && resBlock.stats.periods === 3, JSON.stringify(resBlock.stats));

console.log('\n== 当前横向表：名称/钻级/地区/大区/房型/床型 + 日期列 ==');
const now1026 = new Date('2026-10-26');
eq('12.1-12.20 → 2026', HI.expandPeriodByYear(HI.parseSinglePeriod('12.1-12.20'), now1026), [
  { start: '2026-12-01', end: '2026-12-20', raw: '12.1-12.20' }
]);
eq('12.20-2.06 拆两段', HI.expandPeriodByYear(HI.parseSinglePeriod('12.20-2.06'), now1026), [
  { start: '2026-12-20', end: '2026-12-31', raw: '12.20-2.06' },
  { start: '2027-01-01', end: '2027-02-06', raw: '12.20-2.06' }
]);
eq('1.1-2.28 → 2027', HI.expandPeriodByYear(HI.parseSinglePeriod('1.1-2.28'), now1026), [
  { start: '2027-01-01', end: '2027-02-28', raw: '1.1-2.28' }
]);

const aoaCur = [
  ['酒店名称', '携程钻级', '地区', '一级大区', '房型', '床型', '12.1-12.20', '12.20-2.06'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '880', '1200'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '家庭房', '三床', '980', '1300']
];
const resCur = HI.parseWorkbook(aoaCur, [], { now: now1026 });
ok('同酒店两房型归一家', resCur.stats.hotels === 1, JSON.stringify(resCur.stats));
ok('两房型入库', resCur.hotels[0] && resCur.hotels[0].rooms.length === 2, JSON.stringify(resCur.hotels[0] && resCur.hotels[0].rooms));
ok('床型写入标准间', resCur.hotels[0] && resCur.hotels[0].rooms.some(r => r.name === '标准间' && r.bedType === '大床'));
ok('床型写入家庭房', resCur.hotels[0] && resCur.hotels[0].rooms.some(r => r.name === '家庭房' && r.bedType === '三床'));
ok('12.1-12.20 属2026', resCur.periods.some(p => p.roomType === '标准间' && p.start === '2026-12-01' && p.end === '2026-12-20' && p.price === 880));
ok('跨年拆成两段档期', resCur.periods.filter(p => p.roomType === '标准间' && p.price === 1200).length === 2);
ok('跨年2026段', resCur.periods.some(p => p.roomType === '标准间' && p.start === '2026-12-20' && p.end === '2026-12-31' && p.price === 1200));
ok('跨年2027段', resCur.periods.some(p => p.roomType === '标准间' && p.start === '2027-01-01' && p.end === '2027-02-06' && p.price === 1200));
ok('档期带床型', resCur.periods.every(p => p.roomType === '标准间' ? p.bedType === '大床' : p.bedType === '三床'));

const aoaInherit = [
  ['酒店名称', '携程钻级', '地区', '一级大区', '房型', '床型', '11.1-11.15'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '880'],
  ['', '', '', '', '家庭房', '三床', '980']
];
const resInh = HI.parseWorkbook(aoaInherit, [], { now: now1026 });
ok('房型行继承酒店标识仍归一家', resInh.stats.hotels === 1 && resInh.hotels[0].rooms.length === 2, JSON.stringify(resInh.stats));
ok('继承行档期挂到同酒店', resInh.periods.some(p => p.hotelName === '草原酒店' && p.roomType === '家庭房' && p.price === 980));

console.log('\n== A-D 合并单元格：先填充再匹配 ==');
const aoaMerge = [
  ['酒店名称', '携程钻级', '地区', '一级大区', '房型', '床型', '12.1-12.20'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '880'],
  ['', '', '', '', '家庭房', '三床', '980'],
  ['', '', '', '', '亲子房', '双床', '990']
];
const mergesAD = [
  { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } },
  { s: { r: 1, c: 1 }, e: { r: 3, c: 1 } },
  { s: { r: 1, c: 2 }, e: { r: 3, c: 2 } },
  { s: { r: 1, c: 3 }, e: { r: 3, c: 3 } }
];
ok('A-D 合并不误判为块表', HI.looksLikeBlockTable(aoaMerge, mergesAD) === false);
const filledAD = HI.fillDownIdentity(aoaMerge, mergesAD);
ok('填充后第3行名称', filledAD[2][0] === '草原酒店', JSON.stringify(filledAD[2]));
ok('填充后第4行四项齐全', filledAD[3][0] === '草原酒店' && filledAD[3][1] === '五钻' && filledAD[3][2] === '海拉尔' && filledAD[3][3] === '呼伦贝尔');
const resM = HI.parseWorkbook(aoaMerge, mergesAD, { now: now1026 });
ok('合并后仍是一家酒店', resM.stats.hotels === 1, JSON.stringify(resM.stats));
ok('合并后三房型归集', resM.hotels[0] && resM.hotels[0].rooms.length === 3, JSON.stringify(resM.hotels[0] && resM.hotels[0].rooms));
ok('合并后三档期', resM.stats.periods === 3, JSON.stringify(resM.periods.map(p => p.roomType + p.price)));
ok('合并后四项一致', resM.hotels[0] && resM.hotels[0].name === '草原酒店' && resM.hotels[0].level === '五钻' && resM.hotels[0].area === '海拉尔' && resM.hotels[0].regionLevel1 === '呼伦贝尔');
ok('填充后再校验不报缺项', resM.anomalies.every(a => String(a.msg).indexOf('缺少必填项') < 0), JSON.stringify(resM.anomalies));

const resFillOnly = HI.parseWorkbook(aoaMerge, [], { now: now1026 });
ok('无 merges 也能向下填充归一家', resFillOnly.stats.hotels === 1 && resFillOnly.hotels[0].rooms.length === 3, JSON.stringify(resFillOnly.stats));
ok('预览档期带齐四项', resM.periods.every(p => p.hotelName === '草原酒店' && p.level === '五钻' && p.area === '海拉尔' && p.regionLevel1 === '呼伦贝尔'), JSON.stringify(resM.periods[1]));

console.log('\n== 四项整套缓存：有新内容则整套更新，不全空不混用上一套 ==');
const cache = { name: '草原酒店', level: '五钻', area: '海拉尔', regionLevel1: '呼伦贝尔' };
const allEmpty = HI.takeIdentityCache({ name: '', level: '', area: '', regionLevel1: '' }, cache);
ok('四项全空读整套缓存', allEmpty.name === '草原酒店' && allEmpty.level === '五钻' && allEmpty.area === '海拉尔' && allEmpty.regionLevel1 === '呼伦贝尔');
const replaced = HI.takeIdentityCache({ name: '另一家', level: '', area: '', regionLevel1: '' }, cache);
ok('有新内容整套更新', replaced.name === '另一家' && replaced.level === '' && replaced.area === '' && replaced.regionLevel1 === '');
ok('缓存已被整套替换', cache.name === '另一家' && cache.level === '' && cache.area === '');

const aoaNewHotel = [
  ['酒店名称', '携程钻级', '地区', '一级大区', '房型', '床型', '11.1-11.15'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '880'],
  ['另一家', '', '', '', '家庭房', '三床', '980']
];
const filledNew = HI.fillDownIdentity(aoaNewHotel, []);
ok('新酒店行不继承上一套级别地区', filledNew[2][0] === '另一家' && filledNew[2][1] === '' && filledNew[2][2] === '' && filledNew[2][3] === '', JSON.stringify(filledNew[2]));
const resNew = HI.parseWorkbook(aoaNewHotel, [], { now: now1026 });
ok('新酒店缺三项被跳过', resNew.hotels.length === 1 && resNew.hotels[0].name === '草原酒店', JSON.stringify(resNew.hotels.map(h => h.name)));
ok('新酒店缺项在填充后校验', resNew.anomalies.some(a => String(a.msg).indexOf('缺少必填项') >= 0));

const aoaTwo = [
  ['酒店名称', '级别', '地区', '一级大区', '房型', '床型', '11.1-11.15'],
  ['草原酒店', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '880'],
  ['', '', '', '', '家庭房', '三床', '980'],
  ['湖景酒店', '四钻', '满洲里', '呼伦贝尔', '大床房', '大床', '760'],
  ['', '', '', '', '套房', '圆床', '860']
];
const resTwo = HI.parseWorkbook(aoaTwo, [], { now: now1026 });
ok('两套标识拆成两家', resTwo.stats.hotels === 2, JSON.stringify(resTwo.hotels.map(h => h.name + h.rooms.length)));
ok('第一家两房型', resTwo.hotels[0] && resTwo.hotels[0].name === '草原酒店' && resTwo.hotels[0].rooms.length === 2);
ok('第二家两房型', resTwo.hotels[1] && resTwo.hotels[1].name === '湖景酒店' && resTwo.hotels[1].level === '四钻' && resTwo.hotels[1].area === '满洲里' && resTwo.hotels[1].rooms.length === 2);
ok('第二家档期四项完整', resTwo.periods.filter(p => p.hotelName === '湖景酒店').every(p => p.level === '四钻' && p.area === '满洲里' && p.regionLevel1 === '呼伦贝尔'));

console.log('\n== 当前表夹「房型/床型」分行表头：名称走 A 列，不把级别当店名 ==');
const aoaUser = [
  ['酒店名称', '级别', '地区', '一级大区', '房型', '床型', '11.1-11.30', '12.1-12.20', '12.20-2.06', '2.06-2.13'],
  ['五号宾馆(锦江国际店)', '5钻', '哈尔滨', '哈尔滨', '标间,大床', '1.2*2.18', '24000', '30000', '48000', '58000'],
  ['', '', '', '', '', '', '', '', '', ''],
  ['哈尔滨汇智美爵酒店', '5钻', '哈尔滨', '哈尔滨', '房型', '床型', '11.1-11.30', '12.1-12.10', '12.11-12.18', ''],
  ['', '', '', '', '标间,大床', '1.35*2.18', '40000', '50000', '55000', ''],
  ['', '', '', '', '家庭房', '', '80000', '100000', '120000', '']
];
ok('当前表不误判为块表', HI.looksLikeBlockTable(aoaUser, []) === false);
const resUser = HI.parseWorkbook(aoaUser, [], { now: now1026 });
ok('酒店名不是级别', resUser.hotels.every(h => h.name !== '5钻' && h.name.indexOf('宾馆') + h.name.indexOf('美爵') > -2), JSON.stringify(resUser.hotels.map(h => h.name)));
ok('识别两家真实酒店', resUser.hotels.length === 2, JSON.stringify(resUser.hotels.map(h => h.name + '/' + (h.rooms || []).map(r => r.name).join(','))));
ok('第一家名称', resUser.hotels[0] && resUser.hotels[0].name === '五号宾馆(锦江国际店)');
ok('第二家名称', resUser.hotels[1] && resUser.hotels[1].name === '哈尔滨汇智美爵酒店');
ok('预览档期酒店名不是5钻', resUser.periods.every(p => p.hotelName !== '5钻' && p.hotelName), JSON.stringify(resUser.periods.slice(0, 3).map(p => p.hotelName)));
ok('第一家用全局日期列', resUser.periods.some(p => p.hotelName.indexOf('五号宾馆') >= 0 && p.start === '2026-11-01' && p.end === '2026-11-30' && p.price === 24000));
ok('第二家用分行日期列', resUser.periods.some(p => p.hotelName.indexOf('美爵') >= 0 && p.start === '2026-12-01' && p.end === '2026-12-10' && p.price === 50000));
ok('房型表头行不入库', resUser.hotels.every(h => (h.rooms || []).every(r => r.name !== '房型')));

console.log('\n结果：pass=' + pass + '  fail=' + fail + '\n');
process.exit(fail ? 1 : 0);
