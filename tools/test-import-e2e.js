/* 端到端：登录 -> 解析真实样例 -> 调用 hotelCRUD.importBatch(横向) -> 校验响应
 * 用法：node tools/test-import-e2e.js [--commit]
 * 默认 dry-run（仅解析+登录+打印将要提交的数据量，不真正写库）；
 * 传 --commit 才真正调用 importBatch 写库。 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const HI = require('../admin/js/hotel-import.js');
const { readXlsx } = require('./xlsx-read.js');

const GATEWAY = 'https://qq511601433-d9g83bbc542c7988a.service.tcloudbase.com/httpGateway';
const SAMPLE = 'C:\\Users\\51160\\AppData\\Local\\Temp\\opencode\\hotel-sample.xlsx';
const COMMIT = process.argv.indexOf('--commit') >= 0;

function post(name, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name, data: data || {} });
    const req = https.request(GATEWAY, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, res => {
      let buf = '';
      res.on('data', d => { buf += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch (e) { return reject(new Error('响应非 JSON: ' + buf.slice(0, 200))); }
        if (json && typeof json.body === 'string') {
          try { json = JSON.parse(json.body); } catch (e) { /* ignore */ }
        }
        resolve((json && json.result !== undefined) ? json.result : json);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  if (!fs.existsSync(SAMPLE)) { console.error('样例文件不存在:', SAMPLE); process.exit(2); }
  const { aoa, merges } = readXlsx(SAMPLE);
  const res = HI.parseHotelBlocks(aoa, merges, { now: new Date(2026, 9, 22) });
  console.log('解析 stats =', JSON.stringify(res.stats));
  console.log('异常 =', res.anomalies.length);
  res.anomalies.forEach(a => console.log('  -', a.hotelName, a.cell, a.msg));

  /* 组装与 admin 前端一致的入参 */
  const metaByName = {};
  (res.hotels || []).forEach(h => { if (h.name && !metaByName[h.name]) metaByName[h.name] = Object.assign({}, h); });
  const hotels = Object.keys(metaByName).map(n => metaByName[n]);
  const periods = (res.periods || []).map(p => ({
    hotelName: p.hotelName, roomType: p.roomType, bedType: p.bedType,
    start: p.start, end: p.end, fuzzy: !!p.fuzzy, remark: p.remark || '',
    priceRaw: p.priceRaw || p.price, price: p.price, cell: p.cell
  }));
  console.log('待提交：酒店', hotels.length, '档期', periods.length);

  if (!COMMIT) {
    console.log('\n[dry-run] 未写库。加 --commit 才会真正调用 importBatch。');
    console.log('样例 hotels[0] =', JSON.stringify(hotels[0]));
    return;
  }

  console.log('\n登录 admin ...');
  const login = await post('login', { username: 'admin', password: 'admin123' });
  if (!login || login.code !== 200 || !login.data || !login.data.token) {
    console.error('登录失败:', JSON.stringify(login)); process.exit(3);
  }
  const token = login.data.token;
  console.log('登录成功，管理员:', JSON.stringify(login.data.admin));

  console.log('\n调用 importBatch(横向) ...');
  const r = await post('hotelCRUD', { action: 'importBatch', token, data: { mode: 'horizontal', hotels, periods } });
  console.log('返回:', JSON.stringify(r).slice(0, 800));
  if (!r || r.code !== 200) { console.error('导入失败'); process.exit(4); }
  console.log('\n导入结果: success =', r.data.success, '| priceCount =', r.data.priceCount, '| failed =', (r.data.failed || []).length);
})();
