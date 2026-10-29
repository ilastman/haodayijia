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
eq(quote.priceOfRoom(hotel, '2027-01-16', '标准间'), 500, '01-16 无命中回退参考价 500');
eq(quote.priceOfRoom(hotel, '2026-11-20', '大床房'), 1080, '大床房 11-20 = 1080');
eq(quote.priceOfRoom(hotel, '2026-12-20', '大床房'), 1180, '大床房 12-20 = 1180');
eq(quote.priceOfRoom(hotel, '2026-11-20', '未知房型'), 880, '未知房型回退当日最低 880');

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

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
