/**
 * 计费用车天数的云端保存链。
 * 运行：node tools/test-trip-car-use.js
 * 需部署的云函数：userTripCRUD（环境 qq511601433-d9g83bbc542c7988a）
 */
const fs = require('fs');
const path = require('path');
const quote = require('../utils/quote.js');
const { packStoredCarUse, toPublicTrip } = require('../cloudfunctions/userTripCRUD/tripFields.js');

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
  id: 'suv', name: '哈尔滨·城市SUV·长线', price: 999,
  prices: [
    { start: '2026-12-01', end: '2026-12-02', price: '550' },
    { start: '2026-12-03', end: '2026-12-20', price: '680' }
  ],
  packages: [{ id: 'pickup', name: '接机', price: '150' }]
};
function quoteOf(carUse) {
  return quote.calcQuote({
    plans: [{ scenicIds: ['ice'], hotelId: 'h1' }, { scenicIds: ['ice'], hotelId: 'h1' }, { hotelId: 'h1' }],
    hotelsById: { h1: { id: 'h1', name: '五号宾馆', prices: [{ roomType: '标准间', start: '2026-01-01', end: '2026-12-31', price: 480 }] } },
    scenicsById: { ice: { id: 'ice', name: '冰雪大世界', ticketPrice: '198元' } },
    departDate: '2026-12-01',
    adults: 2, children: 0,
    carId: 'suv',
    vehiclesById: { suv: vehicle },
    carPackageSelections: [{ vehicleId: 'suv', items: [{ id: 'pickup', name: '接机', price: '150' }] }],
    carUseCustom: carUse.carUseCustom,
    carUseOffsets: carUse.carUseOffsets
  });
}

console.log('== 云保存白名单：带上删减，旧请求不覆盖 ==');
eq(packStoredCarUse({}), null, '旧行程没字段时不写');
eq(packStoredCarUse({ title: 'x', plan: '备注' }), null, '只改标题/plan 时不碰计费日');
const kept = { carUseCustom: true, carUseOffsets: [0, 2], plan: '原备注', staffRemark: '员工备注' };
const oldClient = packStoredCarUse({ plan: '原备注' });
if (oldClient) Object.assign(kept, oldClient);
eq(kept.carUseOffsets, [0, 2], '旧客户端保存后云端删减还在');
eq(kept.plan, '原备注', 'plan 还在');
eq(kept.staffRemark, '员工备注', 'staffRemark 还在');

const dropped = packStoredCarUse({ carUseCustom: true, carUseOffsets: [0, 2, 2, -1, 99, '1'] });
eq(dropped, { carUseCustom: true, carUseOffsets: [0, 1, 2] }, '非法偏移丢掉，重复合并');
eq(packStoredCarUse({ carUseCustom: true, carUseOffsets: [] }), { carUseCustom: true, carUseOffsets: [] }, '0 天存成空数组');
eq(packStoredCarUse({ carUseCustom: false }), { carUseCustom: false, carUseOffsets: null }, '恢复每天用车写成 false，不是空数组');

console.log('== 保存 → 分享读取 → 再打开，金额不给客人 ==');
const plans = [{
  scenicIds: ['ice'], hotelId: 'h1',
  hotelBookings: [{ hotelId: 'h1', roomType: '标准间', roomQty: 1 }],
  scenicSnaps: [{ id: 'ice', name: '冰雪大世界' }],
  hotelSnaps: [{ id: 'h1', name: '五号宾馆' }]
}];
const stored = {
  id: 'trip-1', plan: '第1天备注', staffRemark: '只给员工',
  quote: { hotel: 1440, ticket: 1188, total: 99999 },
  carCostOverride: '888', internalQuote: { total: 1 }, openid: 'oid',
  plans: plans
};
Object.assign(stored, packStoredCarUse(quote.packCarUse(true, [0, 2])));
const pub = toPublicTrip(stored);
eq(pub.carUseCustom, true, '分享保留 carUseCustom');
eq(pub.carUseOffsets, [0, 2], '分享保留被删掉的天数');
eq(pub.quote, undefined, '分享没有内部 quote');
eq(pub.internalQuote, undefined, '分享没有 internalQuote');
eq(pub.staffRemark, undefined, '分享没有员工备注');
eq(pub.carCostOverride, undefined, '分享没有手填车费');
eq(pub.openid, undefined, '分享没有 openid');
eq(pub.plan, '第1天备注', 'plan 原文保留');
eq(pub.plans[0].scenicSnaps[0].id, 'ice', 'scenicSnaps 保留');
eq(pub.plans[0].hotelSnaps[0].id, 'h1', 'hotelSnaps 保留');
eq(pub.plans[0].hotelBookings[0].hotelId, 'h1', 'hotelBookings 保留');

const again = quote.pickCarUse(pub);
const priced = quoteOf(again);
eq(priced.carUseOffsets, [0, 2], '重新打开仍是第1天和第3天');
eq(priced.carDays, 550 + 680, '两天各走自己的档期');
eq(priced.carPackage, 150, '套票仍是一次');
const legacy = quoteOf(quote.pickCarUse({}));
eq(legacy.carUseCount, 3, '没有字段的旧行程仍是每天用车');

console.log('== 我的行程：云端补本地缺口，不盖掉本地新选择 ==');
const localOld = { id: 't', staffRemark: '', plans: plans };
const cloudNew = { id: 't', staffRemark: '云备注', carUseCustom: true, carUseOffsets: [0, 2], quote: { total: 9 } };
ok(quote.carryMissingCarUse(localOld, cloudNew), '本地没有计费日时从云端补上');
eq(localOld.carUseOffsets, [0, 2], '补上的是删减结果');
eq(localOld.quote, undefined, '补计费日时不写入内部 quote');
const localNew = { id: 't', carUseCustom: true, carUseOffsets: [0] };
ok(!quote.carryMissingCarUse(localNew, cloudNew), '本地已有选择不被云端覆盖');
eq(localNew.carUseOffsets, [0], '本地删减保持');
ok(!quote.carryMissingCarUse({ id: 'old' }, { id: 'old', title: '无字段' }), '云端也是旧行程时不补');

console.log('== 源码仍保留原有保存能力 ==');
const root = path.join(__dirname, '..');
const crud = fs.readFileSync(path.join(root, 'cloudfunctions/userTripCRUD/index.js'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'pages/custom-preview/custom-preview.js'), 'utf8');
const mine = fs.readFileSync(path.join(root, 'pages/my-trips/my-trips.js'), 'utf8');
['scenicSnaps', 'hotelSnaps', 'hotelBookings', 'staffRemark', 'removeMine', 'packStoredCarUse', 'toPublicTrip'].forEach(k => {
  ok(crud.indexOf(k) >= 0, 'userTripCRUD 仍包含 ' + k);
});
ok(crud.indexOf('const plan = d.plan') >= 0, 'plan 字段仍按原文保存');
ok(preview.indexOf('scenicSnaps') >= 0 && preview.indexOf('hotelBookings: quote.bookingsOf') >= 0, 'saveToMine 仍带 snaps 和 hotelBookings');
ok(preview.indexOf('if (this.data.carUseKnown)') >= 0, '预览保存会带上已知的计费日');
ok(mine.indexOf('carryMissingCarUse') >= 0, '我的行程从云端补计费日');
ok(mine.indexOf('staffRemark') >= 0, '员工备注回填还在');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
