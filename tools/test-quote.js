const quote = require('../utils/quote.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}

/* 同酒店两档期（闭区间） */
const hotel = {
  id: 'h1', name: '呼伦贝尔宾馆', price: 500,
  rooms: [{ name: '标准间' }, { name: '大床房' }],
  prices: [
    { roomType: '标准间', start: '2026-11-15', end: '2026-12-15', price: 880 },
    { roomType: '标准间', start: '2026-12-16', end: '2027-01-15', price: 980 },
    { roomType: '大床房', start: '2026-11-15', end: '2026-12-15', price: 1080 },
    { roomType: '大床房', start: '2026-12-16', end: '2027-01-15', price: 1180 }
  ]
};
const hotelsById = { h1: hotel };

console.log('== 日期匹配（闭区间）==');
eq(quote.priceOfRoom(hotel, '2026-11-20', '标准间'), 880, '11-20 命中第一档 880');
eq(quote.priceOfRoom(hotel, '2026-11-15', '标准间'), 880, '开始日 11-15 命中第一档 880');
eq(quote.priceOfRoom(hotel, '2026-12-15', '标准间'), 880, '结束日 12-15 命中第一档 880（闭区间）');
eq(quote.priceOfRoom(hotel, '2026-12-16', '标准间'), 980, '12-16 命中第二档 980');
eq(quote.priceOfRoom(hotel, '2027-01-15', '标准间'), 980, '01-15 命中第二档 980（闭区间）');
eq(quote.priceOfRoom(hotel, '2027-01-16', '标准间'), 0, '01-16 无精确档期不计价（不再回退参考价 500）');
eq(quote.priceOfRoom(hotel, '2026-11-20', '大床房'), 1080, '大床房 11-20 = 1080');
eq(quote.priceOfRoom(hotel, '2026-12-20', '大床房'), 1180, '大床房 12-20 = 1180');
eq(quote.priceOfRoom(hotel, '2026-11-20', '未知房型'), 0, '未知房型无精确价，不计当日最低价');

console.log('== 房型列表 ==');
eq(quote.roomTypesOf(hotel, '2026-11-20'), ['标准间', '大床房'], '当日房型 [标准间,大床房]');
eq(quote.roomTypesOf(hotel, '2027-02-01'), ['标准间', '大床房'], '无命中回退 rooms');

console.log('== 逐晚累加（跨档期）==');
const r = quote.calcQuote({
  plans: [
    { hotelId: 'h1', roomType: '标准间', roomQty: 1, checkinDate: '2026-12-14' },
    { hotelId: 'h1', roomType: '标准间', roomQty: 1, checkinDate: '2026-12-15' },
    { hotelId: 'h1', roomType: '标准间', roomQty: 1, checkinDate: '2026-12-16' }
  ],
  hotelsById,
  departDate: '2026-12-14'
});
eq(r.hotel, 880 + 880 + 980, '三晚跨档期 = 2740');
eq(r.breakdown.map(b => b.date), ['2026-12-14', '2026-12-15', '2026-12-16'], 'breakdown 每晚日期正确');

console.log('== 无 checkinDate 时按出发日 + i 推导 ==');
const r2 = quote.calcQuote({
  plans: [{ hotelId: 'h1', roomType: '标准间' }, { hotelId: 'h1', roomType: '标准间' }],
  hotelsById, departDate: '2026-12-15'
});
eq(r2.hotel, 880 + 980, '12-15(880) + 12-16(980) = 1860');

console.log('== 门票 + 人数（保留逻辑）==');
const r3 = quote.calcQuote({
  plans: [{ scenicIds: ['s1', 's1'] }],
  scenicsById: { s1: { id: 's1', name: '莫日格勒河', ticketPrice: '120元' } },
  people: 3, departDate: '2026-11-20'
});
eq(r3.ticket, 120 * 3 * 2, '同景区重复累加：120×3×2 = 720');
eq(quote.parseTicketPrice('免费'), 0, '免费 -> 0');
eq(quote.parseTicketPrice(''), 0, '空 -> 0');

console.log('== 分享标题（不含天数晚数）==');
eq(quote.shareTitle({ days: 5, guestName: '张先生', place: '海拉尔' }), '张先生的海拉尔行程', '有称呼的分享标题');
eq(quote.shareTitle({ days: 4, place: '海拉尔' }), '海拉尔行程', '无称呼的分享标题');

console.log('== 保存用的内部快照 ==');
const vehicle = {
  id: 'suv', name: '商务车', price: 0,
  prices: [{ start: '2026-12-01', end: '2026-12-20', price: '600' }],
  packages: [{ id: 'pickup', name: '接送机', price: '150' }]
};
const full = quote.calcQuote({
  plans: [{
    hotelId: 'h1', roomType: '标准间', roomQty: 1, checkinDate: '2026-12-01',
    scenicIds: ['s1'],
    packageSelections: [{ scenicId: 's1', items: [{ id: 'boat', name: '游船', price: '80' }] }]
  }],
  hotelsById,
  scenicsById: { s1: { id: 's1', name: '湿地', ticketPrice: '120元', packages: [{ id: 'boat', name: '游船', price: '80' }] } },
  departDate: '2026-12-01',
  adults: 2, children: 0,
  carId: 'suv',
  vehiclesById: { suv: vehicle },
  carPackageSelections: [{ vehicleId: 'suv', items: [{ id: 'pickup', name: '接送机', price: '150' }] }]
});
const stored = quote.toStoredQuote(full);
eq(stored.status, 'complete', '精确价保存为 complete');
eq(stored.hotel, 880, '快照带酒店合计');
eq(stored.ticket > 0, true, '快照带门票合计');
eq(stored.package, 160, '景区套餐按目录价×人数');
eq(stored.carPackage, 150, '接送机 150');
eq(stored.breakdown.filter(b => b.type === 'hotel' && b.room === '标准间' && b.unit === 880).length, 1, '酒店房费行在明细里');
eq(stored.breakdown.filter(b => b.type === 'package' && b.unit === 80).length, 1, '套餐行在明细里');
eq(stored.breakdown.filter(b => b.type === 'carPackage' && b.subtotal === 150).length, 1, '接送机行在明细里');
eq(quote.isStoredQuote(stored), true, '完整快照可入库');
eq(quote.isStoredQuote({ hotel: 0, ticket: 0, total: 0 }), false, '三个 0 不是快照');
eq(quote.toStoredQuote(null), null, '没有核算就不造快照');

const pendingCalc = quote.calcQuote({
  plans: [{ hotelId: 'hx', roomType: '标准间', roomQty: 2, checkinDate: '2026-12-01', scenicIds: ['s1'] }],
  hotelsById: { hx: { id: 'hx', name: '未定价酒店', prices: [] } },
  scenicsById: { s1: { id: 's1', name: '湿地', ticketPrice: '120元' } },
  departDate: '2026-12-01',
  adults: 1, children: 0
});
const pending = quote.toStoredQuote(pendingCalc);
eq(pending.status, 'pending', '没有精确房费时记 pending');
eq(pending.hotel, 0, '模糊房费不编造成交价');
eq(pending.breakdown.filter(b => b.type === 'hotel' && b.fuzzy && b.room === '标准间').length, 1, 'pending 仍保留房费明细');
eq(pending.ticket > 0, true, 'pending 快照保留已算出的门票');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
