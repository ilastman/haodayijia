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

console.log('== 参考总价与标注 ==');
const pub = quote.publicHotelQuote([
  { hotelId: 'h1', roomQty: 2 },
  { hotelId: '', roomQty: 1 },
  { hotelId: 'missing', roomQty: 1 }
], hotelsById);
eq(pub.total, 1000, '公开价 500 × 2 间 = 1000');
const note = quote.annotateQuote({ hotel: 688, ticket: 120, total: 808 }, 2, 1);
eq(note.total, 808, '标注总价 808');
eq(note.pending, false, '有总价则不是待核算');
eq(note.note, '酒店 ¥688 · 门票 ¥120 · 2 成人 · 1 儿童', '标注含酒店门票与人数');
eq(quote.annotateQuote({ hotel: 0, ticket: 0, total: 0 }, 2, 0).pending, true, '零价待核算');

console.log('== 分享标题与对客报价 ==');
eq(quote.shareTitle({ days: 5, guestName: '张先生', place: '海拉尔' }), '张先生的5天4晚的海拉尔行程', '有称呼的分享标题');
eq(quote.shareTitle({ days: 4, place: '海拉尔' }), '4天3晚的海拉尔行程', '无称呼的分享标题');
eq(quote.guestQuoteText(1280), '¥1280/人', '每人报价文案');
eq(quote.guestQuoteText(0), '', '没有报价就不展示');
eq(quote.tripPlace([{ scenicIds: ['s1'] }], { s1: { dest: '海拉尔' } }, {}), '海拉尔', '地点取第一个景区');

console.log('== 游玩项目（价格是文字）==');
const r4 = quote.calcQuote({
  plans: [{
    scenicIds: ['s1'],
    playItemSelections: [{
      scenicId: 's1',
      items: [
        { id: 'a', name: '骑马', price: '10元' },
        { id: 'b', name: '篝火', price: '免费' }
      ]
    }]
  }],
  scenicsById: { s1: { id: 's1', name: '草原', ticketPrice: '120元' } },
  people: 2
});
eq(r4.ticket, 20, '选中项目按文字价×人数，不再叠加景区门票');
eq(r4.breakdown.filter(b => b.type === 'play').map(b => b.name), ['草原 · 骑马', '草原 · 篝火'], '明细带项目名');
const r5 = quote.calcQuote({
  plans: [{
    scenicIds: ['s1', 's1'],
    playItemSelections: [{ scenicId: 's1', items: [{ id: 'a', name: '骑马', price: '10元' }] }]
  }],
  scenicsById: { s1: { id: 's1', name: '草原', ticketPrice: '120元' } },
  people: 1
});
eq(r5.ticket, 10, '同一景区出现两次只计一次游玩项目');
eq(typeof r4.breakdown[0].unit, 'number', '核算单价是数字');
const r6 = quote.calcQuote({
  plans: [{ scenicIds: ['s9'], playItemSelections: [{ scenicId: 's9', items: [{ id: 'a', name: '骑马', price: 10 }] }] }],
  scenicsById: {},
  people: 1
});
eq(r6.ticket, 10, '数字价格也会按字符串规则解析');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
