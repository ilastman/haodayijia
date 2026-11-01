/* ============================================================
 * 云开发数据通道（浏览器后台）
 * 通过云函数 HTTP 访问网关 httpGateway 调用各 CRUD 云函数。
 * 仅在 window.ADMIN_CONFIG.mode === 'cloud' 时启用；否则后台走本地数据桥。
 * 请求体：{ name: 云函数名, data: { action, token, ... } }
 * 网关返回：{ result: { code, data, msg } }
 * ============================================================ */
(function () {
  const CFG = window.ADMIN_CONFIG || {};
  const TOKEN_KEY = 'admin_cloud_token';
  const ADMIN_KEY = 'admin_cloud_admin';

  // 集合名 -> 云函数名
  const FN = {
    homeModule: 'homeModuleCRUD',
    banner: 'bannerCRUD',
    scenic: 'scenicCRUD',
    hotel: 'hotelCRUD',
    privateGroup: 'privateGroupCRUD',
    inspirationPost: 'inspirationPostCRUD',
    userTrip: 'userTripCRUD',
    assets: 'assetCRUD',
    globalConfig: 'homeConfigCRUD',
    staff: 'staffCRUD',
    order: 'orderCRUD',
    opLog: 'opLogCRUD',
    user: 'userCRUD',
    category: 'categoryCRUD',
    adminUser: 'adminUserCRUD',
    gallery: 'galleryCRUD',
    clauseTemplate: 'clauseCRUD'
  };

  function enabled() {
    return CFG.mode === 'cloud' && !!CFG.gateway;
  }
  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ADMIN_KEY); }
  function admin() { try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null'); } catch (e) { return null; } }
  function setAdmin(a) { try { if (a) localStorage.setItem(ADMIN_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ } }

  async function raw(name, data) {
    const body = { name, data: data || {} };
    const res = await fetch(CFG.gateway, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    let json = await res.json().catch(() => null);
    if (!json) return { code: res.status || 500, msg: res.ok ? '网关返回空响应' : ('网关请求失败 HTTP ' + res.status) };
    // 兼容两种网关响应：
    // 1) 已带 CORS 头结构：{ statusCode, headers, body: '{"result":...}' }
    // 2) 直接返回：{ result: {...} } 或云函数结果本身
    if (json && typeof json.body === 'string') {
      const inner = JSON.parse(json.body || '{}');
      if (inner && inner.result !== undefined) return inner.result;
      return inner;
    }
    if (json && json.result !== undefined) return json.result;
    return json;
  }

  // 统一带 token 调用，返回 {code,data,msg}
  async function call(name, data) {
    const payload = Object.assign({}, data || {});
    const t = token();
    if (t && payload.token === undefined) payload.token = t;
    return raw(name, payload);
  }

  const Cloud = {
    enabled,
    token, setToken, clearToken,
    admin, setAdmin,
    raw, call,
    fnOf(coll) { return FN[coll] || coll; },

    /* ---------- 登录 ---------- */
    async login(username, password) {
      const res = await raw('login', { username, password });
      if (res && res.code === 200 && res.data && res.data.token) {
        setToken(res.data.token);
        setAdmin(res.data.admin);
        return { ok: true, admin: res.data.admin };
      }
      return { ok: false, msg: (res && res.msg) || '登录失败' };
    },
    async logout() {
      try { await call('login', { action: 'logout' }); } catch (e) { /* ignore */ }
      clearToken();
    },

    /* ---------- 集合 CRUD ---------- */
    async list(coll) {
      const fn = FN[coll];
      if (!fn) return null;
      const res = await call(fn, { action: 'list' });
      return res && res.code === 200 ? (res.data || []) : null;
    },
    async add(coll, doc) {
      const res = await call(FN[coll], { action: 'add', data: doc });
      return !!(res && res.code === 200);
    },
    async update(coll, id, patch) {
      const res = await call(FN[coll], { action: 'update', id, data: patch });
      return !!(res && res.code === 200);
    },
    async remove(coll, ids) {
      ids = Array.isArray(ids) ? ids : [ids];
      const res = await call(FN[coll], { action: 'remove', ids, id: ids[0] });
      return !!(res && res.code === 200);
    },
    async reorder(coll, orderedIds, field) {
      const res = await call(FN[coll], { action: 'reorder', orderedIds, field });
      return !!(res && res.code === 200);
    },

    /* ---------- 全局配置 ---------- */
    async getConfig() {
      const res = await call('homeConfigCRUD', {});
      return res && res.code === 200 ? res.data : null;
    },
    async saveConfig(gc) {
      const res = await call('homeConfigCRUD', { action: 'save', data: gc });
      return !!(res && res.code === 200);
    },

    /* ---------- 图片上传 / 解析 ---------- */
    async upload(fileBase64, ext) {
      const res = await call('fileUpload', { action: 'upload', fileBase64, ext: ext || 'jpg' });
      return res && res.code === 200 ? res.data : null; // { fileID, url }
    },

    // fileID 批量解析为临时链接，返回 { [fileID]: url }
    _urlCache: {},
    async resolveUrls(fileIDs) {
      const need = [];
      const map = {};
      (fileIDs || []).forEach(id => {
        if (!id || typeof id !== 'string' || id.indexOf('cloud://') !== 0) return;
        if (Cloud._urlCache[id]) { map[id] = Cloud._urlCache[id]; return; }
        if (need.indexOf(id) < 0) need.push(id);
      });
      if (need.length) {
        const res = await call('fileUpload', { action: 'getURL', fileIDs: need });
        if (res && res.code === 200 && res.data) {
          Object.keys(res.data).forEach(k => {
            Cloud._urlCache[k] = res.data[k];
            map[k] = res.data[k];
          });
        }
      }
      return map;
    },

    // 同步解析：命中缓存则返回链接，否则原样返回（并触发后台异步解析）
    resolveText(v) {
      if (!v || typeof v !== 'string') return v;
      if (v.indexOf('cloud://') !== 0) return v;
      const hit = Cloud._urlCache[v];
      if (hit) return hit;
      Cloud.resolveUrls([v]);
      return v;
    }
  };

  window.Cloud = Cloud;
})();
