/* 酒店列表：查看详情、不展示金额、原价位显示地区，并进入该酒店详细介绍 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const captured = [];
global.Page = function (cfg) { captured.push(cfg); };
global.wx = {
  getStorageSync() { return ''; },
  setStorageSync() {},
  removeStorageSync() {},
  showToast() {},
  setNavigationBarTitle() {},
  previewImage() {},
  navigateTo(o) { global.__nav = o && o.url; },
  navigateBack() {},
  cloud: {
    init() {},
    callFunction() { return Promise.reject(new Error('no-cloud')); }
  }
};

require(path.join(root, 'pages/hotels/hotels.js'));
require(path.join(root, 'pages/hotel-detail/hotel-detail.js'));
const hotelsPage = captured[0];
const detailPage = captured[1];
const copy = require(path.join(root, 'utils/copy.js'));
const data = require(path.join(root, 'utils/data.js'));

assert.strictEqual(copy.hotels.book, '查看详情', '按钮文案');
assert.ok(!copy.hotels.perNight, '不再提供每晚价格文案');

const listWxml = read('pages/hotels/hotels.wxml');
assert.ok(!listWxml.includes('¥') && !listWxml.includes('item.price') && !listWxml.includes('perNight'), '列表模板无金额');
assert.ok(listWxml.includes('item.placeLabel') && listWxml.includes('catchtap="goDetail"') && listWxml.includes('{{bookLabel}}'), '原价位为地点，按钮进详情');
assert.ok(!listWxml.includes('consult-modal') && !listWxml.includes('catchtap="book"'), '该按钮不再打开咨询弹窗');

const detailWxml = read('pages/hotel-detail/hotel-detail.wxml');
assert.ok(!detailWxml.includes('¥') && !detailWxml.includes('price'), '详情模板无金额');
assert.ok(detailWxml.includes('hotel.description'), '详情展示详细介绍正文');
assert.ok(!detailWxml.includes('配套设施') && !detailWxml.includes('hotel.facilities') && !detailWxml.includes('facTitle'), '详情无配套设施板块');
assert.ok(detailWxml.includes('d.envTitle') && detailWxml.includes('d.roomTitle') && detailWxml.includes('d.locTitle'), '环境/房型/位置仍在');

function bind(cfg) {
  const inst = { data: JSON.parse(JSON.stringify(cfg.data)) };
  inst.setData = function (patch) { Object.assign(inst.data, patch); };
  Object.keys(cfg).forEach(k => {
    if (typeof cfg[k] === 'function') inst[k] = cfg[k];
  });
  return inst;
}

(async () => {
  const list = bind(hotelsPage);
  list.onLoad();
  await list.loadCloud();
  assert.strictEqual(list.data.bookLabel, '查看详情');
  assert.ok(list.data.list.length >= 8, '本地酒店列表');
  assert.deepStrictEqual(
    list.data.list.map(h => h.placeLabel),
    data.hotels.map(h => h.area),
    '有地区时原价位显示 area'
  );
  assert.ok(list.data.list.every(h => h.placeLabel && !/[¥￥]/.test(h.placeLabel)));

  list._all = [
    { id: 'ha', name: '哈尔滨店', area: '', regionLevel1: '哈尔滨', price: 1280 },
    { id: 'empty', name: '无地点', area: '  ', regionLevel1: '', price: 1 }
  ];
  list.data.activeRegion = '全部';
  list.data.activePlace = '全部';
  list.apply();
  assert.strictEqual(list.data.list[0].placeLabel, '哈尔滨', '无 area 时回退一级大区');
  assert.strictEqual(list.data.list[1].placeLabel, '', '两字段都空则不编造地点');
  assert.ok(list.data.list.every(h => !/[¥￥]/.test(h.placeLabel) && h.placeLabel !== '1280'));

  list.goDetail({ currentTarget: { dataset: { id: 'ha' } } });
  assert.strictEqual(global.__nav, '/pages/hotel-detail/hotel-detail?id=ha');

  const detail = bind(detailPage);
  await detail.onLoad({ id: 'h1' });
  assert.ok(detail.data.hotel && detail.data.hotel.name === '海拉尔草原天际酒店');
  assert.ok(
    String(detail.data.hotel.description).includes('酒店位于海拉尔市区北端高地'),
    '详情页载入该酒店详细介绍'
  );
  assert.ok(!detailWxml.includes('d.priceTitle'), '详情不渲染分时段价格标题');

  if (!process.env.SKIP_PREVIEW) await previewClick();
  console.log('hotel list ui: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

async function previewClick() {
  let JSDOM;
  try { JSDOM = require('jsdom').JSDOM; }
  catch (e) {
    console.log('skip jsdom preview click (jsdom not installed)');
    return;
  }
  let runtime = read('tools/preview-runtime.js');
  runtime = runtime.replace(
    "loadJs('app.js');",
    "wx.cloud = { init: function () {}, callFunction: function () { return Promise.reject(new Error('preview')); } };\n" +
    "wx = new Proxy(wx, { get: function (t, p, r) { if (p in t) return Reflect.get(t, p, r); if (typeof p !== 'string') return undefined; return function () { return Promise.resolve({}); }; } });\n" +
    "loadJs('app.js');"
  );
  const html = read('preview.html')
    .replace('<script src="tools/preview-data.js"></script>', '<script>' + read('tools/preview-data.js') + '</script>')
    .replace('<script src="tools/preview-runtime.js"></script>', '<script>' + runtime + '</script>');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://127.0.0.1/preview.html?p=/pages/hotels/hotels'
  });
  const { window } = dom;
  window.scrollTo = () => {};
  await new Promise(r => setTimeout(r, 400));
  const doc = window.document;
  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const screen = $('#screen');
  assert.ok(screen, '预览屏幕');
  const text = screen.textContent;
  assert.ok(text.includes('精选草原沿线住宿'), '进入酒店列表');
  const btns = $$('#screen .book-btn');
  assert.strictEqual(btns.length, 8);
  assert.ok(btns.every(b => b.textContent.trim() === '查看详情'));
  assert.ok(!text.includes('预订咨询') && !text.includes('¥') && !text.includes('起 / 晚'));
  const places = $$('#screen .hotel-place').map(e => e.textContent.trim());
  assert.deepStrictEqual(places, data.hotels.map(h => h.area));
  btns[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 80));
  const detailText = $('#screen').textContent;
  assert.ok(!$('#screen .mask'), '点击不打开咨询弹窗');
  assert.ok(detailText.includes('酒店环境'), '进入酒店详情');
  assert.ok(detailText.includes('酒店位于海拉尔市区北端高地'), '详细介绍正文');
  assert.ok(detailText.indexOf('¥') === -1, '详情无金额');
  assert.ok(!detailText.includes('配套设施') && !detailText.includes('接送机') && !detailText.includes('健身房'), '详情不展示配套设施');
  assert.ok(detailText.includes('周边位置') && detailText.includes('房型特色'), '其它详情板块仍在');
  window.close();
}
