/**
 * 计费用车天数回归：增减/取消某天、跨档期按日计价、0 天、套票不重复、保存再打开。
 * 运行：node tools/test-car-use.js
 */
const fs = require('fs');
const path = require('path');
const quote = require('../utils/quote.js');
const api = require('../utils/api.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

const vehicle = {
  id: 'suv',
  name: '哈尔滨·城市SUV·长线',
  price: 999,
  prices: [
    { start: '2026-12-01', end: '2026-12-02', price: '550' },
    { start: '2026-12-03', end: '2026-12-20', price: '680' }
  ],
  packages: [{ id: 'pickup', name: '接机', price: '150' }]
};
const vehiclesById = { suv: vehicle };
const hotel = {
  id: 'h1', name: '五号宾馆', price: 100,
  prices: [{ roomType: '标准间', start: '2026-01-01', end: '2026-12-31', price: 480 }]
};
const scenic = { id: 'ice', name: '冰雪大世界', ticketPrice: '198元' };

function plans3() {
  return [0, 1, 2].map(() => ({
    scenicIds: ['ice'],
    hotelId: 'h1',
    roomType: '标准间',
    roomQty: 1,
    hotelBookings: [{ hotelId: 'h1', roomType: '标准间', roomQty: 1 }]
  }));
}

function baseOpts(extra) {
  return Object.assign({
    plans: plans3(),
    hotelsById: { h1: hotel },
    scenicsById: { ice: scenic },
    departDate: '2026-12-01',
    adults: 2,
    children: 0,
    people: 2,
    carId: 'suv',
    vehiclesById: vehiclesById,
    carPackageSelections: [{ vehicleId: 'suv', items: [{ id: 'pickup', name: '接机', price: '150', qty: 1 }] }]
  }, extra || {});
}

function carRows(q) { return (q.breakdown || []).filter(b => b.type === 'car'); }
function pkgRows(q) { return (q.breakdown || []).filter(b => b.type === 'carPackage'); }

/* 与 api.myTrips 相同的计费日携带规则：云端没有字段时不写成 false */
function mapTrip(t) {
  return Object.assign({
    id: t.id,
    days: t.days,
    date: t.date || '',
    plans: t.plans,
    carId: t.carId || '',
    carPackageSelections: Array.isArray(t.carPackageSelections) ? t.carPackageSelections : [],
    carCostOverride: t.carCostOverride || ''
  }, quote.hasCarUseField(t) ? quote.pickCarUse(t) : {});
}

console.log('== 旧行程：未自定义时每天都计费，按当天档期而不是起价×天数 ==');
const legacy = quote.calcQuote(baseOpts());
eq(legacy.carUseCount, 3, '默认 3 天');
eq(legacy.carUseCustom, false, '默认不是自定义');
eq(carRows(legacy).map(r => r.unit), [550, 550, 680], '12-01/02 为 550，12-03 跨到 680');
eq(legacy.carDays, 550 + 550 + 680, '日租合计 1780，不是 999×3 也不是 550×3');
eq(legacy.carPackage, 150, '套票 150');
eq(pkgRows(legacy).length, 1, '套票只有一行');
eq(legacy.car, 1780 + 150, '用车合计 = 日租 + 一次套票');
eq(legacy.hotel, 480 * 3, '三晚酒店仍按行程');
eq(legacy.ticket, 198 * 2 * 3, '门票仍按行程天数和人数');

console.log('== 取消第 2 天、加回、再增加一天 ==');
let offsets = quote.readCarUse({}, 3).offsets;
offsets = quote.stepCarUse(offsets, 3, -1);
eq(offsets, [0, 1], '减一天先去掉最晚的第 3 天');
offsets = quote.toggleCarUseOffset(offsets, 1);
eq(offsets, [0], '再点掉第 2 天，只留第 1 天');
offsets = quote.toggleCarUseOffset(offsets, 1);
eq(offsets, [0, 1], '点同一天加回第 2 天');
eq(quote.stepCarUse([0, 2], 3, 1), [0, 1, 2], '加号优先加回行程内被取消的天');
eq(quote.stepCarUse([0, 2], 3, -1), [0], '减号去掉最晚仍在计费的一天');
offsets = quote.stepCarUse([0, 1, 2], 3, 1);
eq(offsets, [0, 1, 2, 3], '行程内都在用车时，加一天落到行程外');
const cancelled = quote.calcQuote(baseOpts({ carUseCustom: true, carUseOffsets: [0, 2] }));
eq(carRows(cancelled).map(r => r.date), ['2026-12-01', '2026-12-03'], '取消的是第 2 天，不是从末尾重排');
eq(carRows(cancelled).map(r => r.unit), [550, 680], '留下的两天仍各走自己的档期');
eq(cancelled.carDays, 550 + 680, '取消后日租 1230');
eq(cancelled.carPackage, 150, '取消一天后套票仍是 150');
eq(pkgRows(cancelled).length, 1, '套票没有因为计费日变化而重复');
const added = quote.calcQuote(baseOpts({ carUseCustom: true, carUseOffsets: [0, 1, 2, 3] }));
eq(carRows(added).map(r => r.unit), [550, 550, 680, 680], '加出的第 4 天是 12-04 的 680');
eq(added.carDays, 550 + 550 + 680 + 680, '四天日租 2460');
eq(added.carPackage, 150, '加天后套票仍只收一次');
eq(added.hotel, legacy.hotel, '加用车天不改酒店合计');
eq(added.ticket, legacy.ticket, '加用车天不改门票合计');
eq(added.days === 4, false, '报价上的行程天数不跟计费天数变成 4');

console.log('== 0 天：日租为 0，套票仍在，行程还在 ==');
const plans = plans3();
const snap = JSON.stringify(plans);
const none = quote.calcQuote(baseOpts({ plans: plans, carUseCustom: true, carUseOffsets: [] }));
eq(none.carDays, 0, '0 天日租为 0');
eq(none.carUseCount, 0, '计费天数为 0');
eq(carRows(none).length, 0, '没有日租明细');
eq(none.carPackage, 150, '0 天仍收一次套票');
eq(pkgRows(none).length, 1, '0 天套票仍一行');
eq(none.car, 150, '用车合计只剩套票');
eq(none.hotel, legacy.hotel, '0 天不改酒店');
eq(none.ticket, legacy.ticket, '0 天不改门票');
eq(JSON.stringify(plans), snap, 'calcQuote 不改行程 plans');
eq(plans.map(p => p.scenicIds[0]), ['ice', 'ice', 'ice'], '景区还在');
eq(plans.map(p => p.hotelId), ['h1', 'h1', 'h1'], '酒店还在');

console.log('== 模糊档 / 无档期不用起价顶上 ==');
const fuzzyCar = {
  id: 'suv', name: '哈尔滨·城市SUV·长线', price: 999,
  prices: [
    { start: '2026-12-01', end: '2026-12-01', price: '550' },
    { start: '2026-12-02', end: '2026-12-02', price: '550-680', fuzzy: false },
    { start: '2026-12-03', end: '2026-12-03', price: '680' }
  ]
};
const fuzzyQ = quote.calcQuote(baseOpts({
  vehiclesById: { suv: fuzzyCar },
  carPackageSelections: [],
  carUseCustom: true,
  carUseOffsets: [0, 1, 2]
}));
eq(carRows(fuzzyQ).map(r => r.unit), [550, 0, 680], '区间价当天计 0，不拿 550 或起价填充');
eq(fuzzyQ.carDays, 550 + 680, '模糊天不进合计');
eq(fuzzyQ.carFuzzy, 1, '只记 1 天模糊');
const bare = quote.calcQuote(baseOpts({
  vehiclesById: { suv: { id: 'suv', name: '哈尔滨·城市SUV·长线', price: 999, prices: [] } },
  carPackageSelections: [],
  carUseCustom: true,
  carUseOffsets: [0, 1]
}));
eq(bare.carDays, 0, '没有档期时不用起价 999×2');
eq(bare.carFuzzy, 2, '两天都待确认');

console.log('== 手填覆盖只替代日租，套票不乘天数 ==');
const manual = quote.calcQuote(baseOpts({ carCost: 100, carUseCustom: true, carUseOffsets: [0, 1, 2, 3] }));
eq(manual.carDays, 100, '手填覆盖日租');
eq(manual.carPackage, 150, '手填后套票仍 150');
eq(manual.car, 250, '合计 100+150');
eq(pkgRows(manual).length, 1, '手填后套票仍一行');
eq(carRows(manual).length, 1, '手填只留一行覆盖，不按天重复');

console.log('== 旧参数 carDays 仍是连续天数，自定义偏移优先 ==');
const byCount = quote.calcQuote(baseOpts({ carDays: 2, carPackageSelections: [] }));
eq(carRows(byCount).map(r => r.date), ['2026-12-01', '2026-12-02'], 'carDays:2 为前两天');
eq(byCount.carDays, 1100, '550+550');
const prefer = quote.calcQuote(baseOpts({ carDays: 3, carUseCustom: true, carUseOffsets: [2], carPackageSelections: [] }));
eq(carRows(prefer).map(r => r.date), ['2026-12-03'], '有自定义偏移时不退回 carDays');
eq(prefer.carDays, 680, '只收第 3 天的 680');

console.log('== 改行程天数不带动已保存的计费日；未保存时跟行程 ==');
eq(quote.readCarUse({}, 5).offsets, [0, 1, 2, 3, 4], '未自定义时 5 天行程计 5 天车');
eq(quote.readCarUse(quote.packCarUse(true, [0, 2]), 5).offsets, [0, 2], '已取消第 2 天后再加行程，不会自动把新的天算进用车');
const views = quote.carUseDayViews(vehicle, '2026-12-01', 3, [0, 2]);
eq(views.map(v => v.on), [true, false, true], '三天 chips：第 2 天不用车');
eq(views.map(v => v.priceText), ['¥550', '不用车', '¥680'], 'chips 上的价格按各自日期');
eq(views.map(v => v.extra), [false, false, false], '取消的天仍属于行程，不是加天');
const extraViews = quote.carUseDayViews(vehicle, '2026-12-01', 3, [0, 1, 2, 3]);
eq(extraViews[3].extra, true, '第 4 天标记为行程外加天');
eq(extraViews[3].date, '2026-12-04', '加天日期是出发日+3');

console.log('== 保存 / 我的行程 / 重新打开 / 分享：计费日还在，内部价不带给客人 ==');
const saved = Object.assign({
  id: 'trip-1',
  days: 3,
  date: '2026-12-01',
  plans: plans3(),
  carId: 'suv',
  carPackageSelections: baseOpts().carPackageSelections,
  carCostOverride: '888',
  quote: { total: 99999, hotel: 1, car: 1 },
  internalQuote: { total: 1 }
}, quote.packCarUse(true, [0, 2]));
eq(quote.pickCarUse(saved).carUseOffsets, [0, 2], '保存包能读回偏移');
const listed = mapTrip(saved);
eq(listed.carUseOffsets, [0, 2], '我的行程映射保留自定义天数');
eq(listed.carPackageSelections.length, 1, '我的行程映射保留套票勾选');
const reopened = quote.calcQuote(baseOpts({
  carUseCustom: listed.carUseCustom,
  carUseOffsets: listed.carUseOffsets
}));
eq(reopened.carDays, cancelled.carDays, '重新打开后的日租与保存前一致');
eq(reopened.carPackage, 150, '重新打开后套票仍是一次');
const again = quote.pickCarUse(quote.packCarUse(listed.carUseCustom, listed.carUseOffsets));
eq(again.carUseOffsets, [0, 2], '再存一次不会恢复成三天');

const oldTrip = { id: 'old', days: 3, plans: plans3(), carId: 'suv' };
eq(quote.hasCarUseField(mapTrip(oldTrip)), false, '旧行程映射不伪造 carUseCustom:false');
eq(quote.readCarUse(mapTrip(oldTrip), 3).offsets, [0, 1, 2], '旧行程重新打开仍是每天用车');

const zeroSaved = Object.assign({ id: 'z', days: 3 }, quote.packCarUse(true, []));
eq(mapTrip(zeroSaved).carUseOffsets, [], '0 天会被保存成空数组，而不是丢字段');
eq(quote.readCarUse(mapTrip(zeroSaved), 3).offsets, [], '重新打开 0 天不会变回 3 天');

const share = quote.publicSharePayload(saved);
eq(share.carUseOffsets, [0, 2], '分享载入保留计费日');
eq(share.carPackageSelections.length, 1, '分享保留套票勾选');
eq(share.quote, undefined, '分享不含内部 quote');
eq(share.internalQuote, undefined, '分享不含 internalQuote');
eq(share.carCostOverride, undefined, '分享不含手填覆盖金额');
eq(share.total, undefined, '分享不含内部合计');
const fromShare = quote.calcQuote(baseOpts({
  carUseCustom: share.carUseCustom,
  carUseOffsets: share.carUseOffsets
}));
eq(fromShare.carDays, cancelled.carDays, '分享载入后日租与调整后一致');
eq(fromShare.hotel, legacy.hotel, '分享载入不改酒店');

console.log('== 客人侧不露出内部报价入口 ==');
const root = path.join(__dirname, '..');
const wxml = fs.readFileSync(path.join(root, 'pages/custom/custom.wxml'), 'utf8');
const page = fs.readFileSync(path.join(root, 'pages/custom/custom.js'), 'utf8');
ok(wxml.indexOf('class="card quote-card" wx:if="{{isStaff}}"') >= 0, '内部核算卡片仅员工');
ok(wxml.indexOf('class="car-use" wx:if="{{isStaff && curCar}}"') >= 0, '计费用车入口仅员工且已选车');
ok(page.indexOf('carDays: plans.length') < 0, '页面不再把行程天数直接当成计费天数');
ok(/onCarUseStep\(e\) \{\s*if \(!this\.data\.isStaff\) return;/.test(page), '增减天数函数拒绝非员工');
ok(/toggleCarUseDay\(e\) \{\s*if \(!this\.data\.isStaff\) return;/.test(page), '按天开关拒绝非员工');
ok(page.indexOf('this.setDays(') >= 0 && page.indexOf('onCarUseStep') >= 0, '行程天数入口还在，和用车分开');
ok(page.indexOf('carUseOffsets: carPacked.carUseOffsets') >= 0, 'savePlan 写入计费日');

console.log('== 车辆 intro：原样映射，有图才补示意声明且不重复 ==');
const rawCar = {
  id: 'v1', name: '哈尔滨·城市SUV·长线', regionLevel1: '哈尔滨', category: '城市SUV', lineType: '长线',
  seats: 5, cover: 'cloud://cover.jpg', album: ['cloud://album.jpg'],
  intro: '代表车型。车型示意图，实际以安排为准',
  remark: '内部备注', price: 550,
  prices: [{ start: '2026-12-01', end: '2026-12-02', price: '550' }],
  packages: [{ id: 'p', name: '接机', price: '150' }], packageIntro: '套票说明'
};
const mapped = api.mapVehicle(rawCar);
eq(mapped.intro, rawCar.intro, 'intro 原样保留');
eq(mapped.image, 'cloud://cover.jpg', '选中车图用 cover');
eq(mapped.cover, 'cloud://cover.jpg', 'cover 字段仍在');
eq(mapped.price, 550, '标价不被展示逻辑改写');
eq(mapped.prices[0].price, '550', '档期价不被展示逻辑改写');
eq(mapped.packageIntro, '套票说明', '套票简介仍是 packageIntro');
eq(quote.vehicleCaption(mapped), rawCar.intro, '已含示意声明时不再追加');
eq((quote.vehicleCaption(mapped).match(/实际以安排为准/g) || []).length, 1, '声明只出现一次');
const withPhoto = api.mapVehicle(Object.assign({}, rawCar, { intro: '7座商务，适合市区接送' }));
eq(withPhoto.intro, '7座商务，适合市区接送', '原简介不被改掉');
eq(quote.vehicleCaption(withPhoto), '7座商务，适合市区接送（车型示意图，实际以安排为准）', '有图且简介未声明时补一句');
const noAsset = api.mapVehicle({ id: 'lux', name: '豪华大9座', price: 1200, intro: '' });
eq(noAsset.image, '', '没挂 cover 就不显示车图');
eq(noAsset.price, 1200, '缺素材的车价保持原值');
eq(quote.vehicleCaption(noAsset), '', '没图不写示意图声明');
const textOnly = api.mapVehicle({ id: 'lux2', name: '豪华大9座B', intro: '暂无示意图', price: 1300 });
eq(quote.vehicleCaption(textOnly), '暂无示意图', '没图时只显示原简介');
const noteAt = wxml.indexOf('class="car-note"');
ok(noteAt > 0, '选中车卡有说明节点');
ok(wxml.indexOf('curCar.caption') >= 0, '说明绑定 caption');
ok(wxml.slice(Math.max(0, noteAt - 60), noteAt + 40).indexOf('isStaff') < 0, '车图说明对客可见，不包在员工条件里');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
