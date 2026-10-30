/* 游玩项目：价格保持字符串，当天选择按景区回写。 */
const fs = require('fs');
const path = require('path');
const play = require('../utils/play-items.js');

let pass = 0;
let fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}

console.log('== 价格是字符串 ==');
const items = play.normalizePlayItems([
  { name: '草原骑马', price: 10 },
  { id: 'fire', name: '篝火晚会', price: '免费' },
  { name: '  ', price: '1元' },
  { id: 'bow', name: '射箭', price: '10元' }
]);
eq(items.map(it => it.price), ['10', '免费', '10元'], '数字价格转成字符串，空名称丢掉');
eq(items.map(it => typeof it.price), ['string', 'string', 'string'], 'price 类型都是 string');
eq(items[1], { id: 'fire', name: '篝火晚会', price: '免费' }, '已有 id 保留');
eq(items[0].id, 'pi1', '缺 id 时按顺序生成');

console.log('== 文本导入 ==');
eq(play.parsePlayItemsText('草原骑马/10元,篝火晚会/免费\n射箭/10元/人').map(it => it.name + '=' + it.price),
  ['草原骑马=10元', '篝火晚会=免费', '射箭=10元/人'], '逗号和换行拆项目，价格原文保留');
eq(play.asPlayItems(''), [], '空文本得到空数组');

console.log('== 当天选择 ==');
const scenicIds = ['s1', 's2'];
let sel = play.togglePlayItem([], scenicIds, 's1', items[2]);
sel = play.togglePlayItem(sel, scenicIds, 's1', { id: 'fire', name: '篝火晚会', price: '免费' });
eq(sel, [{
  scenicId: 's1',
  items: [
    { id: 'bow', name: '射箭', price: '10元' },
    { id: 'fire', name: '篝火晚会', price: '免费' }
  ]
}], '选中两项，price 仍是原文');
sel = play.togglePlayItem(sel, scenicIds, 's1', { id: 'fire', name: '篝火晚会', price: '免费' });
eq(sel[0].items.map(it => it.id), ['bow'], '再点一次取消');
sel = play.normalizeSelections(sel.concat([{ scenicId: 's9', items: [{ name: '不在当天', price: '9元' }] }]), scenicIds);
eq(sel.map(row => row.scenicId), ['s1'], '不在当天景区里的选择丢掉');

const view = play.decorateScenics([
  { id: 's1', name: '呼伦贝尔大草原', playItems: items },
  { id: 's2', name: '莫日格勒河', playItems: [] }
], sel);
eq(view[0].playItems.filter(it => it.sel).map(it => it.name), ['射箭'], '列表标出已选项目');
eq(view[0].playItems[2].price, '10元', '展示用的价格仍是字符串');
eq(view[1].playItems, [], '没有项目的景区给空列表');
eq(play.playLine(sel[0].items), '射箭 10元', '行程里写成名称加价格');

console.log('== 云函数副本 ==');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'utils/play-items.js'));
['cloudfunctions/scenicCRUD/play-items.js', 'cloudfunctions/userTripCRUD/play-items.js'].forEach(rel => {
  const same = fs.readFileSync(path.join(root, rel)).equals(src);
  eq(same, true, rel + ' 与 utils/play-items.js 一致');
});

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
