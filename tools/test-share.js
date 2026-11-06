/**
 * 全页原生分享。运行：node tools/test-share.js
 * 不需要云函数。
 */
const fs = require('fs');
const path = require('path');
const share = require('../utils/share.js');

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

const root = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const appPages = app.pages || [];
const sub = [].concat(app.subPackages || [], app.subpackages || []);
sub.forEach(pkg => {
  const base = pkg.root ? pkg.root.replace(/\/$/, '') + '/' : '';
  (pkg.pages || []).forEach(p => appPages.push(base + p));
});

function dump(res) { return JSON.stringify(res); }
function leaked(res) {
  const text = dump(res);
  return /token|openid|staffRemark|carCostOverride|carUseOffsets|carUseCustom|internalQuote|1\d{10}|password/i.test(text);
}

console.log('== 路由覆盖 ==');
const rows = share.auditList(appPages);
rows.forEach(row => {
  ok(row.covered, row.route + ' 有分享策略 ' + row.type + (row.inApp ? '' : '（未挂 app.json）'));
});
const pageFiles = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(name => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js')) pageFiles.push(p);
  });
}
walk(path.join(root, 'pages'));
pageFiles.forEach(file => {
  const src = fs.readFileSync(file, 'utf8');
  if (src.indexOf('Page(') < 0) return;
  ok(src.indexOf('share.install(') >= 0, path.relative(root, file) + ' 使用 share.install');
  ok(src.indexOf('Page =') < 0, path.relative(root, file) + ' 不改写 Page');
});
ok(fs.readFileSync(path.join(root, 'utils/share.js'), 'utf8').indexOf('src.onLoad') < 0, '不包装 onLoad');
ok(fs.readFileSync(path.join(root, 'app.js'), 'utf8').indexOf('Page =') < 0, 'app.js 不猴子补丁 Page');

console.log('== install 只多调一次 onShow ==');
let loads = 0;
let shows = 0;
const calls = [];
global.wx = { showShareMenu(opt) { calls.push(opt.menus.slice()); } };
const wrapped = share.install({
  onLoad() { loads += 1; },
  onShow() { shows += 1; }
});
wrapped.onShow.call({ route: 'pages/index/index', data: {} });
wrapped.onShow.call({ route: 'pages/workbench/workbench', data: {} });
eq(loads, 0, 'onLoad 没有被多调');
eq(shows, 2, '原来的 onShow 各调用一次');
eq(calls.length, 2, '每次显示都打开分享菜单');
eq(calls[0], ['shareAppMessage', 'shareTimeline'], '好友和朋友圈菜单都打开');

console.log('== 公开页与详情 ==');
const home = share.message({ route: 'pages/index/index', data: {} });
eq(home.path, '/pages/index/index', '首页分享首页');
eq(home.title, '呼伦贝尔轻奢定制旅行', '首页标题保持原有文案');
eq(share.timeline({ route: 'pages/routes/routes', data: { keyword: '13800138000' } }).query, '', '列表不带搜索词');
const scenic = share.message({
  route: 'pages/scenic-detail/scenic-detail',
  options: { id: 's1' },
  data: { scenic: { id: 's1', name: '冰雪大世界', cover: 'https://img.example/a.jpg' } }
});
eq(scenic.path, '/pages/scenic-detail/scenic-detail?id=s1', '景区分享当前 id');
eq(scenic.title, '冰雪大世界', '景区标题');
eq(scenic.imageUrl, 'https://img.example/a.jpg', '景区封面');
eq(share.timeline({
  route: 'pages/hotel-detail/hotel-detail',
  data: { hotel: { id: 'h1', name: '五号宾馆', image: 'cloud://cover' } }
}).query, 'id=h1', '酒店朋友圈只带 id');
eq(share.message({
  route: 'pages/route-detail/route-detail',
  data: { route: { id: 'r001', title: '草原深度6日', cover: 'http://insecure/a.jpg' } }
}).path, '/pages/route-detail/route-detail?id=r001', '线路分享当前 id');
ok(!share.message({
  route: 'pages/route-detail/route-detail',
  data: { route: { id: 'r001', title: '草原深度6日', cover: 'http://insecure/a.jpg' } }
}).imageUrl, '非 https 封面不带出');
eq(share.message({
  route: 'pages/scenic-detail/scenic-detail',
  options: { id: '13800138000' },
  data: {}
}).path, '/pages/scenic-detail/scenic-detail', '手机号不能当内容 id');
eq(share.message({
  route: 'pages/note-detail/note-detail',
  data: { note: { id: '../admin', title: '笔记' } }
}).path, '/pages/note-detail/note-detail', '非法 id 不进参数');
const noteLine = share.timeline({
  route: 'pages/share-detail/share-detail',
  data: { share: { id: 'post1', title: '额尔古纳慢游', cover: 'https://img.example/n.jpg' } }
});
eq(noteLine.query, 'id=post1', '灵感详情朋友圈只带 id');
ok(!('path' in noteLine), '朋友圈结果不含 path，不假装能改页面');

console.log('== 私人定制 ==');
const draft = share.message({
  route: 'pages/custom/custom',
  options: { edit: 'trip1', draft: '1' },
  data: {
    editingTripId: 'trip1',
    date: '2026-11-16',
    carUseCustom: true,
    carUseOffsets: [0, 2],
    guestQuote: '9999',
    internalQuote: { total: 1 }
  }
});
eq(draft.path, '/pages/custom/custom', '未生成行程只分享干净定制入口');
ok(draft.path.indexOf('?') < 0, '定制入口不带草稿参数');
ok(!leaked(draft), '定制入口不带内部字段');
const unsaved = share.message({
  route: 'pages/custom-preview/custom-preview',
  data: { editingId: 'trip999', heroTitle: '张先生的呼伦贝尔行程', carUseOffsets: [0, 2], quote: { total: 1 } }
});
eq(unsaved.path, '/pages/custom/custom', '云端未确认时不使用本地 id');
const saved = share.message({
  route: 'pages/custom-preview/custom-preview',
  _shareReadyId: 'trip1',
  data: { heroTitle: '张先生的呼伦贝尔行程', cover: 'https://img.example/c.jpg', carUseOffsets: [0, 2], carCostOverride: '888', staffRemark: '内部' }
});
eq(saved.path, '/pages/custom-preview/custom-preview?trip=trip1', '已落库行程只带 trip id');
eq(saved.title, '张先生的呼伦贝尔行程', '预览标题沿用现有分享标题');
ok(saved.path.indexOf('carUse') < 0 && dump(saved).indexOf('888') < 0, '分享链接不带用车删减和手填金额');
eq(share.timeline({
  route: 'pages/custom-preview/custom-preview',
  _shareReadyId: 'trip1',
  data: { heroTitle: '你的专属行程', carUseOffsets: [1] }
}).query, 'trip=trip1', '朋友圈只白名单 trip');

console.log('== 隐私页回公开入口 ==');
const staff = share.message({
  route: 'pages/workbench-detail/workbench-detail',
  options: { id: 'order1', token: 'abc', openid: 'o1' },
  data: { phone: '13800138000', staffRemark: '备注', quote: { total: 9 } }
});
eq(staff.path, '/pages/index/index', '员工页好友分享回首页');
ok(!leaked(staff), '员工页分享不含隐私字段');
const line = share.timeline({
  route: 'pages/my-trips/my-trips',
  data: { list: [{ id: 'trip1', phone: '13800138000' }] }
});
eq(line.query, '', '我的行程朋友圈不带参数');
eq(line.title, '呼伦贝尔轻奢定制旅行', '隐私页朋友圈用公开标题');
ok(!('path' in line), '不把内部路由写进朋友圈结果');
eq(share.message({ route: 'pages/orders/orders', data: {} }).path, '/pages/index/index', '订单回首页');
eq(share.message({ route: 'pages/profile-edit/profile-edit', data: { phone: '13800138000' } }).path, '/pages/index/index', '资料编辑回首页');
eq(share.message({ route: 'pages/unknown/secret', options: { token: 'x' } }).path, '/pages/index/index', '未登记页面按隐私处理');

console.log('\n通过 ' + pass + '，失败 ' + fail);
if (fail) process.exit(1);
console.log('\n路由审计');
rows.forEach(row => {
  const where = row.inApp ? 'app.json' : '未挂路由';
  console.log('  ' + row.route + '  ' + where + '  ' + row.type);
});
