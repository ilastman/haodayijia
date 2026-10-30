/* 游玩项目：价格保持字符串，选择按景区归拢。 */
const play = require('../utils/play-items.js');
const fs = require('fs');
const path = require('path');

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

const items = play.normalizePlayItems([
  { id: 'p1', name: ' 骑马 ', price: '10元' },
  { id: 'p2', name: '篝火', price: 0 },
  { name: '  ', price: '1元' },
  { id: 'p1', name: '重复', price: '3元' },
  { name: '观景台', price: '免费' }
]);
eq(items[0], { id: 'p1', name: '骑马', price: '10元' }, '名称去空白，价格保持「10元」');
eq(items[1].price, '0', '数字价格收成字符串');
eq(items.length, 4, '空名称丢掉，重复 id 另起一个');
ok(items[2].id !== 'p1' && items[2].name === '重复', '重复 id 会换新 id');
eq(items[3].price, '免费', '免费原样保留');

const parsed = play.parsePlayItems('骑马|10元; 篝火|免费\n观景台');
eq(parsed.map(it => it.name + '=' + it.price), ['骑马=10元', '篝火=免费', '观景台='], '分号和换行都能拆');
eq(play.parsePlayItems('热气球/199元').map(it => it.price), ['199元'], '斜杠也能拆价格');

const sel = play.normalizeSelections([
  { scenicId: 's1', items: [{ id: 'p1', name: '骑马', price: '10元' }] },
  { scenicId: 's2', items: [{ id: 'p9', name: '热气球', price: '199元' }] },
  { scenicId: 's1', items: [{ id: 'p2', name: '不应出现', price: '1元' }] },
  { scenicId: 's3', items: [] }
], ['s1']);
eq(sel, [{ scenicId: 's1', items: [{ id: 'p1', name: '骑马', price: '10元' }] }], '只保留当天景区，同景区取第一条');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'utils/play-items.js'), 'utf8');
['cloudfunctions/scenicCRUD/play-items.js', 'cloudfunctions/userTripCRUD/play-items.js'].forEach(rel => {
  const got = fs.readFileSync(path.join(root, rel), 'utf8');
  ok(got === src, rel + ' 与 utils/play-items.js 一致');
});

const vm = require('vm');
const scenicSrc = fs.readFileSync(path.join(root, 'admin/js/views/scenic.js'), 'utf8');
const admin = {
  window: {},
  ElementPlus: { ElMessage: { warning() {}, success() {}, error() {} } },
  Store: {
    db: { scenic: [], category: [] },
    added: null,
    updated: null,
    add(name, doc) { this.added = JSON.parse(JSON.stringify(doc)); },
    update(name, id, doc) { this.updated = JSON.parse(JSON.stringify(doc)); }
  }
};
vm.createContext(admin);
vm.runInContext(scenicSrc, admin);
const methods = admin.window.VIEWS.scenic.comp.methods;
const view = Object.assign({ form: {}, dlg: false }, methods);
view.openAdd();
view.addPlay();
view.form.name = '测试景区';
view.form.regionLevel1 = '呼伦贝尔';
view.form.typeName = '景区';
view.form.dest = '海拉尔';
view.form.playItems[0].name = '骑马';
view.form.playItems[0].price = '10元';
view.addPlay();
view.form.playItems[1].name = '篝火';
view.form.playItems[1].price = 12;
view.save();
const saved = admin.Store.added.playItems;
eq(saved.map(it => it.name + '=' + it.price), ['骑马=10元', '篝火=12'], '后台保存后价格仍是字符串');
ok(saved.every(it => typeof it.price === 'string' && it.id), '后台每条游玩项目都有 id');

view.openEdit({
  id: 's9', name: '旧景区', dest: '海拉尔', area: '海拉尔', regionLevel1: '呼伦贝尔',
  typeName: '景区', subType: 'scenic', album: [],
  playItems: [{ id: 'old', name: '观景台', price: '免费' }, { name: '', price: '1元' }]
});
eq(view.form.playItems, [{ id: 'old', name: '观景台', price: '免费' }], '编辑时丢掉空名称，免费原样保留');
view.form.playItems[0].price = '20元';
view.save();
eq(admin.Store.updated.playItems[0].price, '20元', '更新景区时游玩项目价格原样回写');
ok(admin.window.VIEWS.scenic.comp.template.indexOf('添加游玩项目') > 0, '景区表单有游玩项目编辑');

const seedBox = { window: {} };
vm.createContext(seedBox);
vm.runInContext(fs.readFileSync(path.join(root, 'admin/js/data.js'), 'utf8'), seedBox);
const s1 = seedBox.window.SEED.scenic.filter(s => s.id === 's1')[0];
eq(s1.playItems[0], { id: 's1p1', name: '骑马', price: '10元' }, '本地景区种子带文字价格');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
