/**
 * 首页定制名片点击。基线是 Windows 真实首页（4 主包 + 23 分包）。
 * 运行：node tools/test-home-custom-tap.js
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}
function eq(actual, expected, label) {
  const good = JSON.stringify(actual) === JSON.stringify(expected);
  if (good) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       expected ' + JSON.stringify(expected) + '\n       actual   ' + JSON.stringify(actual)); }
}

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8');
const wxml = fs.readFileSync(path.join(root, 'tools/fixtures/windows-home/index.wxml'), 'utf8');
const app = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/windows-home/app.json'), 'utf8'));

function registered(conf) {
  const out = (conf.pages || []).slice();
  (conf.subPackages || conf.subpackages || []).forEach(pkg => {
    const base = String(pkg.root || '').replace(/\/$/, '');
    (pkg.pages || []).forEach(page => out.push(base + '/' + page));
  });
  return out;
}

function bindtaps(src) {
  const names = [];
  const re = /bindtap="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) names.push(m[1]);
  return names.filter((n, i, a) => a.indexOf(n) === i);
}

console.log('== 真实首页 WXML 与 JS ==');
const taps = bindtaps(wxml);
ok(taps.indexOf('goCustom') >= 0, '名片 bindtap 是 goCustom');
ok(wxml.indexOf('class="custom-card"') >= 0, '定制名片还在');
taps.forEach(name => {
  ok(new RegExp('\\n\\s*' + name + '\\s*\\(').test('\n' + js), 'index.js 实现 ' + name);
});
const go = /goCustom\s*\(\)\s*\{[\s\S]*?\}/.exec(js);
ok(!!go, 'goCustom 是页面方法');
ok(go && go[0].indexOf("navigateTo") >= 0, 'goCustom 使用 navigateTo');
ok(go && go[0].indexOf("'/pages/custom/custom'") >= 0, '目标是注册路由 pages/custom/custom');
ok(go && go[0].indexOf('switchTab') < 0, '定制页不是 tab，不用 switchTab');
ok(js.indexOf('share.install(') >= 0, '分享安装仍在');
ok(js.indexOf('onNav') >= 0 && js.indexOf('openUrl') >= 0, '金刚区 onNav 仍在');

console.log('== 4 主包，协议页只多一个分包 ==');
const routes = registered(app);
const subCount = (app.subPackages || []).length;
const hasLegal = (app.subPackages || []).some(p => p && p.root === 'pages/legal');
eq(app.pages.length, 4, '主包 4 页');
ok(subCount === 23 || (subCount === 24 && hasLegal), '分包是补丁前 23 个，或已含 pages/legal 的 24 个');
ok(routes.indexOf('pages/custom/custom') >= 0, '定制仍注册为 pages/custom/custom');
ok(routes.indexOf('pages/custom-preview/custom-preview') >= 0, '预览仍注册为 pages/custom-preview/custom-preview');
ok(app.pages.indexOf('pages/custom/custom') < 0, '定制在分包，不在主包 pages 数组');
const customPkg = (app.subPackages || []).filter(p => p.root === 'pages/custom')[0];
eq(customPkg && customPkg.pages, ['custom'], '分包根 pages/custom，页面名 custom');
ok(go && go[0].indexOf("'/pages/custom/custom'") >= 0 && routes.indexOf('pages/custom/custom') >= 0, '点击地址与注册路由一致，不另造分包前缀');

console.log('== 分享回跳仍用同一注册路由 ==');
const shareSrc = fs.readFileSync(path.join(root, 'utils/share.js'), 'utf8');
ok(shareSrc.indexOf("const CUSTOM = '/pages/custom/custom'") >= 0, '未落库分享回跳 pages/custom/custom');
ok(shareSrc.indexOf("'/pages/custom-preview/custom-preview?trip='") >= 0, '已落库预览仍带 trip');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
