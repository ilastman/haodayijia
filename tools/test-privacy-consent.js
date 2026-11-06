/**
 * 收集手机号前的协议与同意。运行：node tools/test-privacy-consent.js
 */
const fs = require('fs');
const path = require('path');
const consent = require('../utils/consent');

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
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('== 同意必须是明确的 true ==');
eq(consent.allowCollect(false), false, '默认未同意');
eq(consent.allowCollect(undefined), false, '未传不算同意');
eq(consent.allowCollect('true'), false, '字符串不能当成已勾选');
eq(consent.allowCollect(true), true, '只有布尔 true 可以提交');

console.log('== 联系方式不用占位，采用传入的公示配置 ==');
const shown = consent.publicContact({
  phone: '0470-8207661',
  wechat: 'hulunbeier_trip',
  email: 'hello@hulun-tour.com',
  address: '内蒙古自治区呼伦贝尔市海拉尔区'
});
eq(shown.phone, '0470-8207661', '公示电话');
eq(shown.email, 'hello@hulun-tour.com', '公示邮箱');
const hidden = consent.publicContact({
  phone: '400-000-0000',
  wechat: 'your-wechat-id',
  address: '内蒙古呼伦贝尔市海拉尔区（办公地址可修改）'
});
eq(hidden.phone, '', '占位电话不展示');
eq(hidden.wechat, '', '占位微信不展示');
eq(hidden.address, '', '占位地址不展示');

console.log('== 正文与代码事实一致 ==');
const privacy = consent.privacyDoc(shown);
const agreement = consent.agreementDoc(shown);
const text = JSON.stringify(privacy) + JSON.stringify(agreement);
ok(text.indexOf('内蒙古好大一家旅游有限公司') >= 0, '写明法定主体');
ok(text.indexOf('好大一家冰雪旅行社') >= 0, '写明小程序名称');
ok(text.indexOf('consultRecords') >= 0, '写明咨询记录存在本机');
ok(text.indexOf('userInfo') >= 0, '写明资料存在本机');
ok(text.indexOf('昵称和头像') >= 0, '写明云端只同步昵称和头像');
ok(text.indexOf('没有「获取微信绑定手机号」') >= 0, '写明没有微信快速手机号');
ok(text.indexOf('隐私专员') < 0, '不指定隐私专员');
ok(text.indexOf('400-000-0000') < 0, '正文不出现占位电话');
ok(!/保存\s*\d+\s*[天年]/.test(text), '不写死留存天数');
ok(text.indexOf('广告平台') >= 0, '说明没有自动交给广告平台');
ok(text.indexOf('0470-8207661') >= 0, '联系电话来自传入的公示配置');

console.log('== 三个收集入口先检查同意 ==');
const consult = read('components/consult-modal/consult-modal.js');
const custom = read('pages/custom/custom.js');
const profile = read('pages/profile-edit/profile-edit.js');
ok(consult.indexOf('agreed: false') >= 0, '咨询勾选初始为否');
ok(consult.indexOf('allowCollect(this.data.agreed)') < consult.indexOf('addConsultRecord({'), '咨询先判断同意再写入');
ok(custom.indexOf('formAgreed: false') >= 0, '定制勾选初始为否');
ok(custom.indexOf('allowCollect(this.data.formAgreed)') < custom.lastIndexOf('addConsultRecord({'), '定制先判断同意再写入');
ok(profile.indexOf('agreed: false') >= 0, '资料勾选初始为否');
const saveBody = profile.slice(profile.indexOf('async onSave()'));
ok(saveBody.indexOf('ensureAgreed()') < saveBody.indexOf('saveProfile({'), '资料先判断同意再保存');
ok(profile.indexOf('ensureAgreed()') < profile.indexOf('wx.chooseMedia'), '选头像前先判断同意');
ok(read('components/consult-modal/consult-modal.wxml').indexOf('checked="true"') < 0, '咨询没有默认勾选');
ok(read('pages/custom/custom.js').indexOf('/pages/legal/legal?kind=') >= 0, '定制可以打开协议页');
ok(read('pages/mine/mine.js').indexOf('/pages/legal/legal?kind=agreement') >= 0, '我的页可以打开用户服务协议');
ok(read('pages/about/about.js').indexOf('/pages/legal/legal?kind=') >= 0, '关于页可以打开协议');
ok(read('pages/about/about.wxml').indexOf('data-kind="privacy"') >= 0, '关于页有隐私政策入口');

console.log('== 平台隐私接口扫描 ==');
function scan(dir, acc) {
  fs.readdirSync(dir).forEach(name => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) { if (name !== 'node_modules') scan(p, acc); return; }
    if (!/\.(js|wxml)$/.test(name)) return;
    const t = fs.readFileSync(p, 'utf8');
    ['getPhoneNumber', 'getLocation', 'chooseLocation', 'chooseAddress', 'getUserProfile'].forEach(api => {
      if (t.indexOf(api) >= 0) acc.push(path.relative(root, p) + ':' + api);
    });
  });
}
const hits = [];
scan(path.join(root, 'pages'), hits);
scan(path.join(root, 'components'), hits);
eq(hits, [], '页面和组件没有微信快速手机号、定位或 getUserProfile');

console.log('== Windows 分包只追加协议页 ==');
const fixture = 'tools/fixtures/windows-home/app.json';
if (fs.existsSync(path.join(root, fixture))) {
  const win = JSON.parse(read(fixture));
  const next = consent.withLegalSubpackage(win);
  eq(next.pages, win.pages, '主包 4 页不变');
  eq(next.subPackages.length, win.subPackages.length + 1, '分包加 1');
  ok(next.subPackages.some(p => p.root === 'pages/legal' && p.pages[0] === 'legal'), '协议页在 pages/legal 分包');
  ok(next.pages.indexOf('pages/custom/custom') < 0, '不把定制页挪进主包');
} else {
  console.log('  skip 没有 Windows 夹具，改为检查当前 app.json');
}
if (fs.existsSync(path.join(root, 'app.json'))) {
  const app = JSON.parse(read('app.json'));
  const subs = app.subPackages || app.subpackages || [];
  if (subs.length) {
    ok(subs.some(p => p.root === 'pages/legal' && p.pages && p.pages[0] === 'legal'), '当前 app.json 含协议分包');
    ok((app.pages || []).indexOf('pages/custom/custom') < 0, '当前主包没有把定制页摊平');
  } else {
    ok((app.pages || []).indexOf('pages/legal/legal') >= 0, '27 页主包清单含协议页');
  }
}

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
