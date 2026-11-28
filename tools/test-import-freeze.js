/**
 * 导入订单时冻结行程，以及财务读取冻结价。
 * 运行：node tools/test-import-freeze.js
 */
const quote = require('../utils/quote.js');
const { buildImportedTrip, financeOfOrder } = require('../cloudfunctions/orderCRUD/freezeTrip.js');

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

const calc = quote.calcQuote({
  plans: [{
    hotelId: 'h1', roomType: '标准间', roomQty: 1, checkinDate: '2026-12-01',
    scenicIds: ['s1'],
    packageSelections: [{ scenicId: 's1', items: [{ id: 'boat', name: '游船', price: '80' }] }]
  }],
  hotelsById: { h1: { id: 'h1', name: '五号宾馆', prices: [{ roomType: '标准间', start: '2026-01-01', end: '2026-12-31', price: 480 }] } },
  scenicsById: { s1: { id: 's1', name: '湿地', ticketPrice: '100元' } },
  departDate: '2026-12-01',
  adults: 2, children: 1,
  carId: 'suv',
  vehiclesById: { suv: { id: 'suv', name: '商务车', prices: [{ start: '2026-12-01', end: '2026-12-31', price: '600' }], packages: [{ id: 'pickup', name: '接送机', price: '150' }] } },
  carPackageSelections: [{ vehicleId: 'suv', items: [{ id: 'pickup', name: '接送机', price: '150' }] }]
});
const stored = quote.toStoredQuote(calc);
const source = {
  id: 'trip-9',
  title: '赵先生的呼伦贝尔行程',
  days: 2,
  date: '2026-12-01',
  adults: 2,
  children: 1,
  guestName: '赵先生',
  guestAdultPrice: 3000,
  guestChildPrice: 1500,
  guestQuote: 7500,
  carId: 'suv',
  carPackageSelections: [{ vehicleId: 'suv', items: [{ id: 'pickup', name: '接送机', price: '150' }] }],
  plans: [{ scenicIds: ['s1'], hotelId: 'h1', note: '看日落', packageSelections: [{ scenicId: 's1', items: [{ name: '游船', price: '80' }] }] }],
  quote: stored
};

console.log('== 导入时冻结，源行程删除后订单仍有副本 ==');
const days = [{ dayNum: 1, title: '湿地', content: '看日落', hotelId: 'h1', hotel: '五号宾馆' }];
const frozen = buildImportedTrip(source, { id: 'trip-9', title: '客户端标题', quote: { hotel: 0, ticket: 0, total: 0 } }, { tripId: 'trip-9', title: source.title, days, now: 100 });
eq(frozen.tripId, 'trip-9', '记下源行程 id');
eq(frozen.guestQuote, 7500, '对客总价一起冻上');
eq(frozen.guestAdultPrice, 3000, '成人价一起冻上');
eq(frozen.plans[0].note, '看日落', '行程正文在副本里');
eq(frozen.quote.carPackage, 150, '冻结的内部报价含接送机');
eq(frozen.quote.breakdown.some(b => b.type === 'hotel' && b.unit === 480), true, '冻结的明细含房费');
ok(frozen.quote !== source.quote, '副本不是源对象本身');
const order = {
  pricing: { quote: 0, estProfit: null, actualProfit: 0 },
  costs: { hotel: 0, car: 0, guide: 0, ticket: 0, meal: 0, misc: 0 },
  totalCost: 0,
  payments: [],
  itinerary: { source: 'mytrip', days, importedTrip: frozen }
};
delete order._sourceTrip;
eq(order.itinerary.importedTrip.quote.total, stored.total, '源行程没了，订单上的快照还在');

console.log('== 财务读冻结价，不读被清零的 pricing ==');
const fin = financeOfOrder(order);
eq(fin.frozen, true, '认出冻结快照');
eq(fin.quote, 7500, '成交额读对客价，不是 pricing.quote 的 0');
eq(fin.cost, stored.total, '成本读内部合计');
eq(fin.hotel, stored.hotel, '酒店读快照');
eq(fin.carPackage, 150, '接送机读快照');
eq(fin.profit, Math.round((7500 - stored.total) * 100) / 100, '毛利用对客价减内部合计');

const plain = financeOfOrder({
  pricing: { quote: 8800, estProfit: 1000, actualProfit: 800 },
  totalCost: 8000,
  costs: { hotel: 5000, car: 3000, guide: 0, ticket: 0, meal: 0, misc: 0 }
});
eq(plain.frozen, false, '没导入的订单仍走原报价');
eq(plain.quote, 8800, '原成交价保留');
eq(plain.cost, 8000, '原成本保留');

const clientOnly = buildImportedTrip(null, source, { tripId: 'trip-9', title: source.title, days, now: 200 });
eq(clientOnly.quote.package, stored.package, '云端行程缺失时用客户端带来的快照');
eq(clientOnly.plans.length, 1, '客户端行程正文也能冻上');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
