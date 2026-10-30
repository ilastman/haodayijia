const path = require('path');
const { JSDOM } = require('jsdom');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, '../preview.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true
  });
  const { window } = dom;
  window.scrollTo = () => {};
  const errors = [];
  window.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
  await new Promise(r => window.addEventListener('load', r));
  await sleep(200);

  const pages = window.APP_JSON.pages;
  let pass = 0;
  for (const p of pages) {
    if (/route-detail|scenic-detail|share-detail|hotel-detail|note-detail/.test(p)) continue; // 需带 id，单独测
    const before = errors.length;
    try {
      window.__preview.pushPage('/' + p);
      await sleep(60);
      const len = window.document.getElementById('screen').innerHTML.length;
      const ok = len > 50 && errors.length === before;
      console.log((ok ? 'PASS ' : 'FAIL ') + p + ' (dom ' + len + 'b)');
      if (ok) pass++;
      else process.exitCode = 1;
    } catch (e) {
      console.log('FAIL ' + p + ' -> ' + e.message);
      process.exitCode = 1;
    }
  }
  // 详情页带参数
  try {
    window.__preview.pushPage('/pages/route-detail/route-detail?id=r001');
    await sleep(60);
    const ok = window.document.getElementById('screen').textContent.includes('每日行程安排');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'route-detail?id=1');
    if (ok) pass++; else process.exitCode = 1;
  } catch (e) { console.log('FAIL route-detail -> ' + e.message); process.exitCode = 1; }
  try {
    window.__preview.pushPage('/pages/scenic-detail/scenic-detail?id=s1');
    await sleep(60);
    const ok = window.document.getElementById('screen').textContent.includes('景区介绍');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'scenic-detail?id=s1');
    if (ok) pass++; else process.exitCode = 1;
  } catch (e) { console.log('FAIL scenic-detail -> ' + e.message); process.exitCode = 1; }
  try {
    window.__preview.pushPage('/pages/share-detail/share-detail?id=sh01');
    await sleep(60);
    const ok = window.document.getElementById('screen').textContent.includes('行程亮点');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'share-detail?id=sh01');
    if (ok) pass++; else process.exitCode = 1;
  } catch (e) { console.log('FAIL share-detail -> ' + e.message); process.exitCode = 1; }
  try {
    window.__preview.pushPage('/pages/hotel-detail/hotel-detail?id=h1');
    await sleep(60);
    const ok = window.document.getElementById('screen').textContent.includes('酒店环境');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'hotel-detail?id=h1');
    if (ok) pass++; else process.exitCode = 1;
  } catch (e) { console.log('FAIL hotel-detail -> ' + e.message); process.exitCode = 1; }
  try {
    window.__preview.pushPage('/pages/note-detail/note-detail?id=n01');
    await sleep(60);
    const ok = window.document.getElementById('screen').textContent.includes('游记');
    console.log((ok ? 'PASS ' : 'FAIL ') + 'note-detail?id=n01');
    if (ok) pass++; else process.exitCode = 1;
  } catch (e) { console.log('FAIL note-detail -> ' + e.message); process.exitCode = 1; }

  errors.forEach(e => console.log('  JS-ERROR: ' + e));
  console.log('\n' + pass + '/' + (pages.length) + ' pages ok (含详情单独测), ' + errors.length + ' js errors');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
