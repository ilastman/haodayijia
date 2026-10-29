const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const DB_FILE = path.join(__dirname, 'cms-db.json');

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.wxss': 'text/plain; charset=utf-8', '.wxml': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8'
};

/* 从后台 SEED 生成初始数据（以 admin/js/data.js 为唯一数据源） */
function loadSeed() {
  const src = fs.readFileSync(path.join(root, 'admin', 'js', 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.SEED;
}

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (data && typeof data === 'object') return data;
  } catch (e) { /* 首次运行，回退到 SEED */ }
  const seed = loadSeed();
  try { fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2)); } catch (e) {}
  return seed;
}

let state = loadState();

function persist() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

function sendJson(res, obj, code) {
  const body = JSON.stringify(obj);
  res.writeHead(code || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => { buf += c; });
    req.on('end', () => resolve(buf));
    req.on('error', () => resolve(''));
  });
}

function findById(coll, id) {
  return (state[coll] || []).filter(x => x.id === id)[0] || null;
}

/* 云函数模拟：返回 { code, data }，数据为后台同构字段 */
function handleCall(payload) {
  const name = payload && payload.name;
  const body = (payload && payload.data) || {};
  const action = body.action;
  const id = body.id;

  if (name === 'bannerCRUD') return { code: 200, data: state.banner || [] };
  if (name === 'homeModuleCRUD') return { code: 200, data: state.homeModule || [] };
  if (name === 'scenicCRUD') return { code: 200, data: action === 'get' ? findById('scenic', id) : (state.scenic || []) };
  if (name === 'hotelCRUD') return { code: 200, data: action === 'get' ? findById('hotel', id) : (state.hotel || []) };
  if (name === 'privateGroupCRUD') return { code: 200, data: action === 'get' ? findById('privateGroup', id) : (state.privateGroup || []) };

  /* 首页内容（标题/版块选品/关于我们） */
  if (name === 'homeConfigCRUD') return { code: 200, data: state.globalConfig || {} };

  if (name === 'inspirationPostCRUD') {
    if (action === 'get') return { code: 200, data: findById('inspirationPost', id) };
    if (action === 'publish') {
      const doc = Object.assign({
        id: 'up_' + Date.now().toString(36),
        status: 0, like: 0, comments: [],
        createTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, body);
      state.inspirationPost = state.inspirationPost || [];
      state.inspirationPost.unshift(doc);
      persist();
      return { code: 200, data: doc };
    }
    return { code: 200, data: (state.inspirationPost || []).filter(p => p.status === 1) };
  }

  if (name === 'galleryCRUD') {
    state.gallery = state.gallery || [];
    if (action === 'add') {
      const src = body.data || {};
      const doc = Object.assign({
        id: src.id || ('gal_' + Date.now().toString(36)),
        time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }, src);
      state.gallery.unshift(doc);
      persist();
      return { code: 200, data: doc };
    }
    if (action === 'remove') {
      const ids = Array.isArray(body.ids) && body.ids.length ? body.ids : (body.id ? [body.id] : []);
      state.gallery = state.gallery.filter(x => ids.indexOf(x.id) < 0);
      persist();
      return { code: 200, data: { removed: ids.length } };
    }
    let list = state.gallery.slice();
    const tree = body.tree || (body.data && body.data.tree);
    if (tree) list = list.filter(x => x.tree === tree);
    return { code: 200, data: list };
  }

  if (name === 'categoryCRUD' && (!action || action === 'list')) {
    return { code: 200, data: state.category || [] };
  }

  if (name === 'userTripCRUD') {
    if (action === 'save') {
      const src = (body.data && typeof body.data === 'object') ? body.data : body;
      const doc = Object.assign({ id: src.id || ('ut_' + Date.now().toString(36)) }, src);
      delete doc.action;
      state.userTrip = state.userTrip || [];
      const i = state.userTrip.findIndex(x => x.id === doc.id);
      if (i > -1) state.userTrip[i] = doc; else state.userTrip.unshift(doc);
      persist();
      return { code: 200, data: doc };
    }
    return { code: 200, data: state.userTrip || [] };
  }

  return { code: 404, msg: 'unknown function: ' + name };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  /* 全量数据库读写（后台持久化 + 小程序读取） */
  if (p === '/api/db') {
    if (req.method === 'GET') return sendJson(res, state);
    if (req.method === 'POST') {
      const raw = await readBody(req);
      try {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') { state = data; persist(); }
      } catch (e) {
        return sendJson(res, { code: 400, msg: 'bad json' }, 400);
      }
      return sendJson(res, { code: 200, msg: 'saved' });
    }
  }

  /* 云函数模拟（小程序 utils/cloud.js 走此通道） */
  if (p === '/api/call' && req.method === 'POST') {
    const raw = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(raw); } catch (e) {}
    return sendJson(res, handleCall(payload));
  }

  /* 静态资源 */
  const file = path.join(root, p === '/' ? '/preview.html' : p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(buf);
  });
}).listen(8080, '127.0.0.1', () => console.log('cms server on http://127.0.0.1:8080/  (admin: /admin/index.html)'));
