const fs = require('fs');
const vm = require('vm');
const path = require('path');
const rules = require('../cloudfunctions/galleryCRUD/rules.js');
const gallery = require('../utils/gallery.js');
const catalog = require('../utils/catalog.js');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

const cats = [
  { id: 'h-region', tree: 'hotel', level: 1, name: '呼伦贝尔' },
  { id: 'h-hailar', tree: 'hotel', level: 2, parentId: 'h-region', name: '海拉尔' },
  { id: 'h-manzhouli', tree: 'hotel', level: 2, parentId: 'h-region', name: '满洲里' },
  { id: 's-place', tree: 'scenic', level: 3, name: '海拉尔' }
];

console.log('== 封面只能进私人定制封面层 ==');
const coverOnHotel = rules.normalizeGalleryDoc({ tree: 'hotel', categoryId: 'h-hailar', role: 'cover', url: 'a.jpg' }, cats);
ok(!coverOnHotel.ok && /私人定制封面/.test(coverOnHotel.msg), '酒店节点拒绝封面: ' + coverOnHotel.msg);
const coverOk = rules.normalizeGalleryDoc({ tree: 'customCover', url: 'cover.jpg', name: '草原' }, cats);
ok(coverOk.ok && coverOk.doc.role === 'cover' && coverOk.doc.categoryId === 'custom-cover' && coverOk.doc.tree === 'customCover', '封面层接受封面');
const promo = rules.normalizeGalleryDoc({ tree: 'hotel', categoryId: 'h-hailar', url: 'p.jpg', name: '海拉尔夜景' }, cats);
ok(promo.ok && promo.doc.role === 'image' && promo.doc.categoryId === 'h-hailar', '海拉尔节点接受宣传图');
const scenic = rules.normalizeGalleryDoc({ tree: 'scenic', categoryId: 's-place', url: 's.jpg' }, cats);
ok(scenic.ok && scenic.doc.role === 'image', '景区三级节点接受宣传图');
const missing = rules.normalizeGalleryDoc({ tree: 'hotel', categoryId: 'nope', url: 'x.jpg' }, cats);
ok(!missing.ok, '不存在的节点拒绝');

console.log('== 每天最多 2 张宣传图 ==');
ok(JSON.stringify(gallery.clipPromo(['a', 'b', 'c', 'a'])) === JSON.stringify(['a', 'b']), '截断为 2 张并去重');
ok(gallery.isCover({ tree: 'customCover', role: 'cover' }) && !gallery.isCover({ tree: 'hotel', role: 'image' }), '封面与宣传图区分');

console.log('== 后台规则与云函数规则一致 ==');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../admin/js/gallery-rules.js'), 'utf8'), sandbox);
const adminRules = sandbox.window.GalleryRules;
const samples = [
  { tree: 'hotel', categoryId: 'h-hailar', role: 'cover', url: 'a.jpg' },
  { tree: 'customCover', url: 'c.jpg', name: '封面' },
  { tree: 'scenic', categoryId: 's-place', url: 's.jpg' },
  { tree: 'hotel', url: 'x.jpg' }
];
samples.forEach((sample, i) => {
  const a = adminRules.normalizeGalleryDoc(sample, cats);
  const b = rules.normalizeGalleryDoc(sample, cats);
  ok(JSON.stringify(a) === JSON.stringify(b), '样本 ' + i + ' 前后端一致');
});

console.log('== 默认树与小程序层级一致 ==');
const tree = adminRules.fallbackCategories();
const hulun = tree.filter(c => c.tree === 'hotel' && c.level === 1 && c.name === '呼伦贝尔')[0];
const places = tree.filter(c => c.tree === 'hotel' && c.level === 2 && c.parentId === hulun.id).map(c => c.name);
ok(places.indexOf('海拉尔') > -1 && places.indexOf('满洲里') > -1, '酒店两级含 呼伦贝尔 → 海拉尔/满洲里');
const scenicRegion = tree.filter(c => c.tree === 'scenic' && c.level === 1 && c.name === '呼伦贝尔')[0];
const types = tree.filter(c => c.tree === 'scenic' && c.level === 2 && c.parentId === scenicRegion.id);
const leaves = tree.filter(c => c.tree === 'scenic' && c.level === 3 && types.some(t => t.id === c.parentId));
ok(types.length >= 2 && leaves.some(c => c.name === '海拉尔'), '景区三级：大区 → 类型 → 地点');

console.log('== 私人定制按分类筛选 ==');
const scenics = [
  { id: 's1', name: '草原', regionLevel1: '呼伦贝尔', dest: '海拉尔', subType: 'scenic' },
  { id: 's2', name: '中央大街', regionLevel1: '哈尔滨', dest: '哈尔滨', subType: 'scenic' }
];
const harbin = catalog.facet('scenic', scenics, [], { region: '哈尔滨' }, ['呼伦贝尔', '哈尔滨']);
ok(harbin.list.length === 1 && harbin.list[0].id === 's2', '选哈尔滨只剩哈尔滨景区');
const hotels = [
  { id: 'h1', name: '海拉尔宾馆', regionLevel1: '呼伦贝尔', area: '海拉尔' },
  { id: 'h2', name: '满洲里宾馆', regionLevel1: '呼伦贝尔', area: '满洲里' }
];
const hailar = catalog.facet('hotel', hotels, [], { region: '呼伦贝尔', place: '海拉尔' }, ['呼伦贝尔']);
ok(hailar.list.length === 1 && hailar.list[0].id === 'h1', '酒店二级地点海拉尔');

console.log('== 同等级备选锁在二级大区 ==');
const primary = { id: 'p', name: '喀拉峻途乐', stars: '4钻', area: '喀拉峻', areaCatId: 'cat-klj', regionLevel1: '伊犁' };
const pool = [
  primary,
  { id: 'same', name: '喀拉峻另一家', stars: '4钻', area: '喀拉峻', areaCatId: 'cat-klj', regionLevel1: '伊犁' },
  { id: 'renamed', name: '改名但仍是该分类', stars: '4钻', area: '喀拉峻草原', areaCatId: 'cat-klj', regionLevel1: '伊犁' },
  { id: 'legacy', name: '只有地点名', stars: '4钻', area: '喀拉峻', regionLevel1: '伊犁' },
  { id: 'other-place', name: '那拉提同钻', stars: '4钻', area: '那拉提', areaCatId: 'cat-nlt', regionLevel1: '伊犁' },
  { id: 'other-region', name: '海拉尔同钻', stars: '4钻', area: '海拉尔', areaCatId: 'cat-hl', regionLevel1: '呼伦贝尔' },
  { id: 'other-star', name: '喀拉峻五钻', stars: '5钻', area: '喀拉峻', areaCatId: 'cat-klj', regionLevel1: '伊犁' },
  { id: 'same-name-other-l1', name: '同名不同大区', stars: '4钻', area: '喀拉峻', regionLevel1: '阿勒泰' },
  { id: 'id-mismatch', name: '名字相同但分类不同', stars: '4钻', area: '喀拉峻', areaCatId: 'cat-other', regionLevel1: '伊犁' }
];
const altIds = pool.filter(h => catalog.sameGradeAlt(primary, h)).map(h => h.id);
ok(altIds.indexOf('p') < 0, '不含主酒店');
ok(altIds.indexOf('same') >= 0 && altIds.indexOf('renamed') >= 0, '同 areaCatId 入选（含改名）');
ok(altIds.indexOf('legacy') >= 0, '缺 areaCatId 时按地点名 + 一级大区');
ok(altIds.indexOf('other-place') < 0 && altIds.indexOf('other-region') < 0, '不同二级大区不入选');
ok(altIds.indexOf('other-star') < 0, '同区不同钻级不入选');
ok(altIds.indexOf('same-name-other-l1') < 0, '同名地点但一级大区不同不入选');
ok(altIds.indexOf('id-mismatch') < 0, 'areaCatId 不同即使地名相同也不入选');
const next = { id: 'n', name: '那拉提主酒店', stars: '4钻', area: '那拉提', areaCatId: 'cat-nlt', regionLevel1: '伊犁' };
const nextIds = pool.filter(h => catalog.sameGradeAlt(next, h)).map(h => h.id);
ok(nextIds.length === 1 && nextIds[0] === 'other-place', '更换主酒店后备选池换成新的二级大区');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
