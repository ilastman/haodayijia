/* 私人定制：选中景区后列出游玩项目，点选后写入当天 playItemSelections。 */
const path = require('path');
const { JSDOM } = require('jsdom');

const results = [];
function ok(cond, msg) {
  results.push((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const file = path.resolve(__dirname, '..', 'preview.html');
  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.scrollTo = () => {};
  const doc = window.document;
  await new Promise(res => {
    if (doc.readyState === 'complete') res();
    else window.addEventListener('load', res);
  });
  await sleep(250);

  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  window.__preview.pushPage('/pages/custom/custom');
  await sleep(120);
  ok($('#screen').textContent.includes('私人定制行程'), '进入私人定制');

  click($('#screen .add-btn'));
  await sleep(40);
  const opt = $$('#screen .opt').find(e => /呼伦贝尔大草原/.test(e.textContent));
  ok(!!opt, '景区列表里有呼伦贝尔大草原');
  click(opt);
  await sleep(20);
  click($('#screen .sheet-confirm'));
  await sleep(40);

  const text = $('#screen').textContent;
  ok(text.includes('游玩项目'), '选中景区后出现游玩项目');
  ok(text.includes('骑马') && text.includes('10元'), '列出项目名称和文字价格');
  ok(text.includes('蒙古包午宴') && text.includes('68元'), '第二个项目也带价格');

  const ride = $$('#screen .play-item').find(e => /骑马/.test(e.textContent));
  ok(!!ride, '骑马可点');
  click(ride);
  await sleep(30);
  ok(ride.className.indexOf('on') >= 0 || $$('#screen .play-item.on').some(e => /骑马/.test(e.textContent)), '点选后骑马处于选中');

  const page = window.__preview.getStack().slice(-1)[0].inst;
  page.savePlan();
  const saved = window.__preview.wx.getStorageSync('lastCustomPlan');
  const day = (saved.plans || [])[0] || {};
  const row = (day.playItemSelections || []).filter(r => r.scenicId === 's1')[0];
  ok(!!row && row.items.some(it => it.name === '骑马' && it.price === '10元'), '当天选择写成 playItemSelections，价格仍是「10元」');
  ok(row.items.every(it => typeof it.price === 'string'), '保存的价格是字符串');

  click($$('#screen .play-item').find(e => /蒙古包午宴/.test(e.textContent)));
  await sleep(20);
  click($$('#screen .op-btn.del').find(e => e.textContent.trim() === '移除'));
  await sleep(30);
  page.savePlan();
  const saved2 = window.__preview.wx.getStorageSync('lastCustomPlan');
  const left = ((saved2.plans || [])[0] || {}).playItemSelections || [];
  ok(!left.some(r => r.scenicId === 's1'), '移除景区后当天不再保留它的游玩项目');
  ok(!$('#screen').textContent.includes('骑马'), '移除后列表里不再显示该景区的项目');

  console.log(results.join('\n'));
  console.log('\n通过 ' + results.filter(r => r.indexOf('PASS') === 0).length + '，失败 ' + results.filter(r => r.indexOf('FAIL') === 0).length);
})().catch(err => {
  console.error(err);
  process.exit(1);
});