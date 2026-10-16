/* 从 admin/js/data.js 的 window.SEED 生成云函数 dataSeed 使用的 seed.json
 * 用法：node tools/build-cloud-seed.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'admin', 'js', 'data.js');
const out = path.join(root, 'cloudfunctions', 'dataSeed', 'seed.json');

global.window = {};
// eslint-disable-next-line global-require, import/no-dynamic-require
require(src);
const seed = global.window.SEED || {};

// 需要导入内容库的集合（admin 账号由 adminInit 创建，不在此列）
const keys = ['homeModule', 'banner', 'scenic', 'hotel', 'privateGroup', 'inspirationPost', 'userTrip', 'assets'];
const dump = {};
keys.forEach(k => { if (seed[k] !== undefined) dump[k] = seed[k]; });
if (seed.globalConfig) dump.globalConfig = seed.globalConfig;

fs.writeFileSync(out, JSON.stringify(dump, null, 0), 'utf8');
const counts = {};
Object.keys(dump).forEach(k => { counts[k] = Array.isArray(dump[k]) ? dump[k].length : 'object'; });
console.log('written', out);
console.log(JSON.stringify(counts));
