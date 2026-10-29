/* 私人定制：封面、人数、总价、生成后可再改。依赖 jsdom（NODE_PATH 或本机已安装）。 */
const { JSDOM } = require('jsdom');

const results = [];
function ok(cond, msg) {
  results.push((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const dom = await JSDOM.fromFile('C:/xiaochengxu/preview.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.scrollTo = () => {};
  const doc = window.document;
  await new Promise(res => window.addEventListener('load', res));
  await sleep(200);

  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const input = (el, val) => {
    el.value = val;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  window.__preview.pushPage('/pages/custom/custom');
  await sleep(80);
  ok($('#screen').textContent.includes('私人定制行程'), '进入私人定制');
  ok($('#screen').textContent.includes('成人') && $('#screen').textContent.includes('儿童'), '编辑页有成人和儿童');

  click($$('#screen .chip').find(e => /自定义/.test(e.textContent)));
  await sleep(30);
  input($('#screen .days-input'), '4');
  await sleep(40);
  click($$('#screen .day-chip')[1]);
  await sleep(30);
  click($('#screen .add-btn'));
  await sleep(40);
  click($$('#screen .opt').find(e => /呼伦贝尔大草原/.test(e.textContent)));
  await sleep(20);
  click($$('#screen .opt').find(e => /莫日格勒河/.test(e.textContent)));
  await sleep(20);
  click($('#screen .sheet-confirm'));
  await sleep(30);
  click($$('#screen .add-btn')[1]);
  await sleep(40);
  click($$('#screen .opt')[0]);
  await sleep(20);
  click($('#screen .sheet-confirm'));
  await sleep(30);
  const di = $('#screen .pv-date-input');
  di.value = '2026-08-01';
  di.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(20);

  click($('#screen .bottom-bar .submit-btn'));
  await sleep(80);
  ok($('#nav-title').textContent.includes('私人定制行程'), '未上传封面不能生成');

  click($('#screen .cover-upload'));
  await sleep(30);
  ok(!!$('#screen .cover-preview'), '封面上传入口可用');

  click($('#screen .promo-upload'));
  await sleep(20);
  click($('#screen .promo-upload'));
  await sleep(20);
  click($('#screen .promo-upload'));
  await sleep(20);
  ok($$('#screen .promo-img').length === 2, '每天最多 2 张宣传图: ' + $$('#screen .promo-img').length);

  click($('#screen .stepper .stepper-btn[data-d="+"]'));
  await sleep(20);
  ok($$('#screen .stepper-num')[0].textContent.trim() === '3', '成人可改为 3');

  click($('#screen .bottom-bar .submit-btn'));
  await sleep(120);
  ok($('#nav-title').textContent.includes('你的专属行程'), '生成进入详情');
  ok($('#screen').textContent.indexOf('行程总价') > -1, '详情页标注行程总价');
  ok($('#screen').textContent.indexOf('¥688') > -1, '总价 ¥688');
  ok($('#screen').textContent.indexOf('3 成人') > -1 && $('#screen').textContent.indexOf('0 儿童') > -1, '总价标注人数');
  ok($$('#screen .cp-day')[1].querySelectorAll('.cp-promo-img').length === 2, '第2天展示 2 张宣传图');
  ok(!!$('#screen .cp-hero-cover'), '封面作为详情首图');

  const editNow = $$('#screen .cp-btn').find(e => /修改行程/.test(e.textContent));
  ok(!!editNow, '生成后可再编辑');
  click(editNow);
  await sleep(100);
  ok($('#nav-title').textContent.includes('私人定制行程'), '回到编辑页');
  ok($$('#screen .stepper-num')[0].textContent.trim() === '3', '再编辑仍是 3 位成人');
  ok(!!$('#screen .cover-preview'), '再编辑封面还在');
  click($$('#screen .day-chip')[1]);
  await sleep(30);
  ok($$('#screen .promo-img').length === 2, '再编辑当天宣传图还在');

  results.forEach(line => console.log(line));
  const failed = results.filter(r => r.indexOf('FAIL') === 0).length;
  console.log('\n' + (results.length - failed) + '/' + results.length);
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
