const q = require('../utils/scenic-query');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}

/* 与线上分类同形：哈尔滨下面只有地点「哈尔滨」，另有一级大区「雪乡」 */
const tree = [
  { id: 'r-hrb', level: 1, name: '哈尔滨', sort: 1, parentId: '' },
  { id: 'r-xx', level: 1, name: '雪乡', sort: 2, parentId: '' },
  { id: 't-jq', level: 2, name: '景区', sort: 1, parentId: 'r-hrb' },
  { id: 't-yw', level: 2, name: '远野体验', sort: 2, parentId: 'r-hrb' },
  { id: 't-xx-jq', level: 2, name: '景区', sort: 1, parentId: 'r-xx' },
  { id: 't-xx-yw', level: 2, name: '远野体验', sort: 2, parentId: 'r-xx' },
  { id: 'p-hrb', level: 3, name: '哈尔滨', sort: 1, parentId: 't-yw' },
  { id: 'p-xx', level: 3, name: '雪乡', sort: 1, parentId: 't-xx-yw' }
];

const rows = [
  { id: 'a', name: '雪韵大街', regionLevel1: '哈尔滨', dest: '雪乡', typeName: '远景体验', subType: 'entertainment', weight: 10 },
  { id: 'b', name: '马拉爬犁', regionLevel1: '哈尔滨', dest: '亚布力', typeName: '远野体验', subType: 'entertainment', weight: 90 },
  { id: 'c', name: '中央大街', regionLevel1: '哈尔滨', dest: '哈尔滨', typeName: '景区', subType: 'scenic', weight: 5 },
  { id: 'd', name: '横道滑雪场', regionLevel1: '哈尔滨', dest: '哈尔滨', typeName: '景点', subType: 'scenic', weight: 4 },
  { id: 'e', name: '呼伦湖冰上穿越', regionLevel1: '呼伦贝尔', dest: '海拉尔', typeName: '远野体验', subType: 'entertainment', weight: 80 }
];

function names(list) { return list.map(s => s.name); }

console.log('== 雪乡大区能看到挂在哈尔滨下、地点为雪乡的娱乐 ==');
const xue = q.query(rows, tree, { region: '雪乡', sub: 'all', place: '全部' });
eq(names(xue.list), ['雪韵大街'], '雪乡 / 全部 = 雪韵大街');
const xueTab = q.query(rows, tree, { region: '雪乡', sub: '远野体验', place: '全部' });
eq(names(xueTab.list), ['雪韵大街'], '雪乡 / 远野体验 仍包含 typeName=远景体验');

console.log('== 哈尔滨下亚布力娱乐可见，地点页签补上分类树里没有的地点 ==');
const hrb = q.query(rows, tree, { region: '哈尔滨', sub: '远野体验', place: '全部' });
eq(names(hrb.list), ['马拉爬犁', '雪韵大街'], '哈尔滨 / 远野体验 含亚布力和雪乡地点');
eq(hrb.places.indexOf('亚布力') >= 0, true, '地点页签含亚布力');
eq(hrb.places.indexOf('雪乡') >= 0, true, '地点页签含雪乡');
const onlyHrb = q.query(rows, tree, { region: '哈尔滨', sub: '远野体验', place: '哈尔滨' });
eq(names(onlyHrb.list), [], '点选地点哈尔滨时不把亚布力/雪乡算进去');

console.log('== 景区页签收「景点」，不收娱乐；娱乐页签收同义类型 ==');
const scenicTab = q.query(rows, tree, { region: '哈尔滨', sub: '景区', place: '全部' });
eq(names(scenicTab.list), ['中央大街', '横道滑雪场'], '景区含 typeName=景点，不含娱乐');
const entTab = q.query(rows, tree, { region: '全部', sub: '远野体验', place: '全部' });
eq(names(entTab.list), ['马拉爬犁', '呼伦湖冰上穿越', '雪韵大街'], '远野体验含远景体验，按权重排序');

console.log('== 无分类树时原野体验键仍认 subType ==');
const local = q.query(rows, null, { region: '雪乡', sub: 'entertainment', place: '全部' }, ['呼伦贝尔', '雪乡', '哈尔滨']);
eq(names(local.list), ['雪韵大街'], '无分类树：雪乡 + entertainment');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
