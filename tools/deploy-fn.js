#!/usr/bin/env node
/* ============================================================
 * deploy-fn.js — 云函数部署工具（直连腾讯云 SCF API）
 *
 * 背景：本机环境下 `tcb fn deploy` / `tcb fn code update` 会「报告成功但
 *       实际未更新代码」（疑似 CLI/网络问题），因此改用直接调用 SCF
 *       `UpdateFunctionCode`（ZipFile 直传）的方式部署。
 *
 * 用法：
 *   node tools/deploy-fn.js <函数名> [选项]
 *   node tools/deploy-fn.js staffCRUD
 *   node tools/deploy-fn.js workOrderPdf --timeout 30 --memory 512
 *   node tools/deploy-fn.js dataExport --all          # 部署 cloudfunctions 下全部函数
 *
 * 选项：
 *   --dir <path>          函数目录（默认 cloudfunctions/<函数名>）
 *   --no-install          随包上传 node_modules（默认走云端安装依赖）
 *   --timeout <秒>        同时更新函数超时时间
 *   --memory <MB>         同时更新函数内存
 *   --env <envId>         云环境 ID（默认 cloudbase-d3gptvn88e6a4d78a）
 *   --region <region>     地域（默认 ap-shanghai）
 *   --namespace <ns>      SCF 命名空间（默认取 envId）
 *
 * 凭证：优先读取 ~/.config/.cloudbase/auth.json（tcb 登录态），
 *       也可用环境变量 TCB_SECRET_ID / TCB_SECRET_KEY / TCB_TOKEN 覆盖。
 * ============================================================ */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

/* ---------------- 参数解析 ---------------- */
const argv = process.argv.slice(2);
const opts = { dir: null, install: true, timeout: null, memory: null, env: 'cloudbase-d3gptvn88e6a4d78a', region: 'ap-shanghai', namespace: null, all: false };
const names = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--no-install') opts.install = false;
  else if (a === '--all') opts.all = true;
  else if (a === '--dir') opts.dir = argv[++i];
  else if (a === '--timeout') opts.timeout = Number(argv[++i]);
  else if (a === '--memory') opts.memory = Number(argv[++i]);
  else if (a === '--env') opts.env = argv[++i];
  else if (a === '--region') opts.region = argv[++i];
  else if (a === '--namespace') opts.namespace = argv[++i];
  else if (a.startsWith('--')) { console.error('未知参数: ' + a); process.exit(1); }
  else names.push(a);
}
if (!names.length && !opts.all) {
  console.error('用法: node tools/deploy-fn.js <函数名> [--dir ..] [--no-install] [--timeout s] [--memory mb] [--all]');
  process.exit(1);
}
const NS = opts.namespace || opts.env;
const REGION = opts.region;
const HOST = 'scf.tencentcloudapi.com';
const SERVICE = 'scf';
const VERSION = '2018-04-16';

/* ---------------- 凭证 ---------------- */
function loadCred() {
  if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
    return { secretId: process.env.TCB_SECRET_ID, secretKey: process.env.TCB_SECRET_KEY, token: process.env.TCB_TOKEN || '' };
  }
  const p = path.join(os.homedir(), '.config', '.cloudbase', 'auth.json');
  const cred = JSON.parse(fs.readFileSync(p, 'utf8')).credential;
  return { secretId: cred.tmpSecretId, secretKey: cred.tmpSecretKey, token: cred.tmpToken };
}
const CRED = loadCred();

/* ---------------- TC3-HMAC-SHA256 签名并请求 ---------------- */
const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest();

function call(action, payloadObj) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(payloadObj);
    const ts = Math.floor(Date.now() / 1000);
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256hex(payload)}`;
    const stringToSign = `TC3-HMAC-SHA256\n${ts}\n${date}/${SERVICE}/tc3_request\n${sha256hex(canonicalRequest)}`;
    const kSigning = hmac(hmac(hmac('TC3' + CRED.secretKey, date), SERVICE), 'tc3_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    const headers = {
      Authorization: `TC3-HMAC-SHA256 Credential=${CRED.secretId}/${date}/${SERVICE}/tc3_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(ts),
      'X-TC-Version': VERSION,
      'X-TC-Region': REGION,
    };
    if (CRED.token) headers['X-TC-Token'] = CRED.token;
    const req = https.request({ host: HOST, method: 'POST', path: '/', headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        const r = json && json.Response;
        if (r && r.Error) reject(new Error(`${action} ${r.Error.Code}: ${r.Error.Message}`));
        else resolve(r || {});
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('请求超时')));
    req.write(payload);
    req.end();
  });
}

/* ---------------- 极简 ZIP 打包（deflate） ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(root, excludeDirs) {
  const excl = new Set(excludeDirs.map((e) => path.resolve(root, e)));
  const files = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (excl.has(path.resolve(full))) continue;
      const st = fs.lstatSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) files.push(full);
    }
  })(root);
  const now = new Date();
  const time = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1F);
  const date = (((now.getFullYear() - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0x0F) << 5) | (now.getDate() & 0x1F);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const full of files.sort()) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    const name = Buffer.from(rel, 'utf8');
    const data = fs.readFileSync(full);
    const crc = crc32(data);
    const comp = zlib.deflateRawSync(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

/* ---------------- 单个函数部署 ---------------- */
async function deployOne(name) {
  const dir = opts.dir || path.join(ROOT, 'cloudfunctions', name);
  if (!fs.existsSync(dir)) { console.error(`✗ [${name}] 目录不存在: ${dir}`); return false; }
  const install = opts.install;
  const exclude = install ? ['node_modules', '.git'] : ['.git'];
  const zip = makeZip(dir, exclude);
  const base64 = zip.toString('base64');
  if (base64.length > 1500 * 1024 * 4 / 3) { console.error(`✗ [${name}] 包过大，请改用 COS 上传`); return false; }

  let before = null;
  try { before = await call('GetFunction', { FunctionName: name, Namespace: NS }); } catch (e) { before = null; }

  await call('UpdateFunctionCode', {
    FunctionName: name, Namespace: NS, Handler: 'index.main',
    InstallDependency: install ? 'TRUE' : 'FALSE', Code: { ZipFile: base64 },
  });

  if (opts.timeout || opts.memory) {
    const p = { FunctionName: name, Namespace: NS };
    if (opts.timeout) p.Timeout = opts.timeout;
    if (opts.memory) p.MemorySize = opts.memory;
    await call('UpdateFunctionConfiguration', p);
  }

  await new Promise((r) => setTimeout(r, 6000));
  let after = null;
  try { after = await call('GetFunction', { FunctionName: name, Namespace: NS }); } catch (e) {}
  const ok = after && after.CodeResult === 'success';
  console.log(`${ok ? '✓' : '✗'} [${name}] install=${install ? 'cloud' : 'local'} size=${zip.length}B ModTime=${before && before.ModTime} -> ${after && after.ModTime} CodeResult=${after && after.CodeResult}${after && after.CodeError ? ' CodeError=' + after.CodeError : ''}`);
  return ok;
}

/* ---------------- 批量 ---------------- */
(async () => {
  let targets = names;
  if (opts.all) {
    const base = path.join(ROOT, 'cloudfunctions');
    targets = fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  }
  let fail = 0;
  for (const n of targets) {
    try { if (!(await deployOne(n))) fail++; }
    catch (e) {
      let msg = e.message;
      if (/TokenFailure|AuthFailure|Token is correct/i.test(msg)) {
        msg += '  → 登录态已过期，请先执行任意 tcb 命令刷新（如：tcb fn list -e ' + opts.env + '）后重试';
      }
      console.error(`✗ [${n}] ${msg}`); fail++;
    }
  }
  console.log(`\n完成：成功 ${targets.length - fail} / ${targets.length}`);
  process.exit(fail ? 1 : 0);
})();
