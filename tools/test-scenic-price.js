/**
 * 景区独立价格：空和 0 不入库；门票长文案不拆成数字。
 * 云函数 price.js 与后台 scenic.js 的判定必须一致。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { classifyScenicPrice, applyScenicPrice } = require('../cloudfunctions/scenicCRUD/price.js');

const scenicSrc = fs.readFileSync(path.join(__dirname, '../admin/js/views/scenic.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(scenicSrc, sandbox);
const admin = sandbox.window.ScenicPrice;

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}

const samples = [null, undefined, '', '   ', '0', '0.0', '0.00', '298', '298.5', '298.50', '0.5',
  '免费', '门票：成人298', '成人298', '120元', '自理', '门票：免费', '-1', '01', '298元/人'];
samples.forEach(v => {
  eq(admin.classifyScenicPrice(v), classifyScenicPrice(v), '前后台一致 ' + JSON.stringify(v));
});

eq(classifyScenicPrice(null), { ok: true, value: null }, '空 null');
eq(classifyScenicPrice(''), { ok: true, value: null }, '空字符串');
eq(classifyScenicPrice('  '), { ok: true, value: null }, '空白');
eq(classifyScenicPrice('0'), { ok: false, reason: 'zero' }, '0 不入库');
eq(classifyScenicPrice(0), { ok: false, reason: 'zero' }, '数字 0 不入库');
eq(classifyScenicPrice('298'), { ok: true, value: 298 }, '整数 298');
eq(classifyScenicPrice(298), { ok: true, value: 298 }, '数字 298');
eq(classifyScenicPrice('298.50'), { ok: true, value: 298.5 }, '两位小数');
eq(classifyScenicPrice('免费'), { ok: false, reason: 'invalid' }, '免费不转成 0');
eq(classifyScenicPrice('门票：成人298\n免票：儿童'), { ok: false, reason: 'invalid' }, '门票长文案不抽数字');

eq(admin.scenicPriceText(null), '', '回显空');
eq(admin.scenicPriceText(0), '', '回显不显示 0');
eq(admin.scenicPriceText(298), '298', '回显 298');
eq(admin.scenicPriceText('免费'), '', '回显不把免费当价格');

const REMOVE = { op: 'remove' };
const fakeDb = { command: { remove() { return REMOVE; } } };

function applied(doc, existing) {
  const copy = Object.assign({}, doc);
  const err = applyScenicPrice(copy, existing, fakeDb);
  return { err, price: Object.prototype.hasOwnProperty.call(copy, 'price') ? copy.price : undefined, keys: Object.keys(copy) };
}

eq(applied({ name: 'a', price: '' }, null), { err: null, price: undefined, keys: ['name'] }, '新增空价格不写字段');
eq(applied({ name: 'a', price: null }, null), { err: null, price: undefined, keys: ['name'] }, '新增 null 不写字段');
eq(applied({ name: 'a', price: '298' }, null), { err: null, price: 298, keys: ['name', 'price'] }, '新增写入数字');
eq(applied({ name: 'a', price: '0' }, null).err, '独立价格请留空，不要填 0', '新增拒绝 0');
eq(applied({ name: 'a', price: '免费' }, { price: 120 }).err, '独立价格只填大于 0 的数字，不填请留空', '说明文字拒绝且不覆盖');
eq(applied({ name: 'a', price: '免费' }, { price: 120 }).price, '免费', '拒绝时保留本次提交里的原文字，调用方应中止保存');
eq(applied({ name: 'a', price: '' }, { price: 298 }), { err: null, price: REMOVE, keys: ['name', 'price'] }, '清空已有价格时删除字段');
eq(applied({ name: 'a', price: null }, { price: 298 }).price, REMOVE, 'null 清空已有价格');
eq(applied({ name: 'a' }, { price: 298 }), { err: null, price: undefined, keys: ['name'] }, '未带 price 时不改旧价');
eq(applied({ name: 'a', price: '88.5' }, { price: 10 }), { err: null, price: 88.5, keys: ['name', 'price'] }, '更新为新数字');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
