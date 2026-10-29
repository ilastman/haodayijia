/* ============================================================
 * 数据访问层（store）
 * - 本地：localStorage 持久化 + 本地数据桥（tools/preview-server.js）
 * - 云端：写入透传各 CRUD 云函数（经 admin/js/cloud.js → httpGateway）
 * API 方法签名与微信云函数 action 对齐，视图层无需感知数据源差异。
 * ============================================================ */
(function () {
  const LS_KEY = 'admin_trip_db_v1';
  const TOKEN_KEY = 'admin_token';
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  const Cloud = window.Cloud;

  /* ---------- 线路列表页板块配置：默认值 + 归一化 ---------- */
  function defaultRoutesPage() {
    return {
      headerTitle: '呼伦贝尔私享线路',
      slogan: '随走随停，专属你的草原旅程',
      cats: ['全部线路', '夏日草原', '阿尔山秋线', '冬季雪原', '亲子私旅', '小众秘境'],
      moreGroups: { days: '行程天数', dest: '目的地', type: '行程类型' },
      customTitle: '不知道选哪条线路？',
      customDesc: '告诉我们你的时间与偏好，为你定制专属草原行程',
      customBtn: '立即定制',
      journalLink: '看看其他游客的旅途记录',
      emptyCategory: '该分类下暂无线路',
      sections: [
        { key: 'header', label: '页头标题', icon: '', show: true, text: '呼伦贝尔私享线路', sub: '随走随停，专属你的草原旅程' },
        { key: 'cats', label: '分类标签', icon: '', show: true, text: '' },
        { key: 'filter', label: '更多筛选', icon: '', show: true, text: '' },
        { key: 'custom', label: '底部定制引导', icon: '', show: true, text: '不知道选哪条线路？' },
        { key: 'journal', label: '底部灵感引导', icon: '', show: true, text: '看看其他游客的旅途记录' }
      ]
    };
  }
  function normalizeRoutesPage(rp) {
    const def = defaultRoutesPage();
    rp = Object.assign({}, def, rp || {});
    rp.moreGroups = Object.assign({}, def.moreGroups, rp.moreGroups || {});
    if (!Array.isArray(rp.cats)) rp.cats = def.cats.slice();
    if (!Array.isArray(rp.sections) || !rp.sections.length) rp.sections = def.sections.slice();
    rp.sections = rp.sections.map((s, i) => Object.assign(
      { key: 'sec' + i, label: '板块 ' + (i + 1), icon: '', show: true, text: '', sub: '' }, s));
    return rp;
  }

  function normalize(d) {
    if (!d || typeof d !== 'object') return d;
    if (d && !d.homeModule && d.moduleLayout) d.homeModule = d.moduleLayout;
    (d.scenic || []).forEach(s => { if (s.dest == null) s.dest = ''; if (s.duration == null) s.duration = ''; if (s.bestSeason == null) s.bestSeason = ''; if (!Array.isArray(s.album)) s.album = []; });
    (d.hotel || []).forEach(h => { if (h.envImg == null) h.envImg = ''; if (h.roomImg == null) h.roomImg = ''; if (!Array.isArray(h.rooms)) h.rooms = []; if (h.location == null) h.location = ''; if (!Array.isArray(h.facilities)) h.facilities = []; });
    (d.privateGroup || []).forEach(g => {
      if (g.dest == null) g.dest = '';
      if (g.type == null) g.type = '私家团';
      if (g.originalPrice == null) g.originalPrice = 0;
      if (g.departure == null) g.departure = '海拉尔集合';
      if (g.brief == null) g.brief = '';
      if (!Array.isArray(g.include)) g.include = [];
      if (!Array.isArray(g.exclude)) g.exclude = [];
      g.notices = Object.assign({ tips: [], gear: [], refund: [] }, g.notices || {});
      if (!Array.isArray(g.reviews)) g.reviews = [];
      (g.dayList || []).forEach(dd => { if (!Array.isArray(dd.spots)) dd.spots = []; if (dd.meals == null) dd.meals = ''; if (dd.hotel == null) dd.hotel = ''; });
    });
    d.globalConfig = d.globalConfig || {};
    d.globalConfig.homeCopy = Object.assign({
      hotTitle: '热门呼伦贝尔线路', destTitle: '目的地直达', offerTitle: '特惠推荐',
      introTitle: '关于我们', more: '查看全部', consult: '立即咨询'
    }, d.globalConfig.homeCopy || {});
    d.globalConfig.homeSections = Object.assign({
      hot: { routeIds: [] }, dest: { items: [] }, offer: { routeIds: [] }
    }, d.globalConfig.homeSections || {});
    d.globalConfig.homeSections.hot = Object.assign({ routeIds: [] }, d.globalConfig.homeSections.hot || {});
    d.globalConfig.homeSections.dest = Object.assign({ items: [] }, d.globalConfig.homeSections.dest || {});
    d.globalConfig.homeSections.offer = Object.assign({ routeIds: [] }, d.globalConfig.homeSections.offer || {});
    d.globalConfig.routesPage = normalizeRoutesPage(d.globalConfig.routesPage);
    if (!Array.isArray(d.staff)) d.staff = [];
    if (!Array.isArray(d.order)) d.order = [];
    if (!Array.isArray(d.opLog)) d.opLog = [];
    if (!Array.isArray(d.user)) d.user = [];
    if (!Array.isArray(d.category)) d.category = [];
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.homeModule) return normalize(d);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  const db = Vue.reactive(load() || clone(window.SEED));
  if (!Array.isArray(db.category)) db.category = [];

  /* 本地数据桥：与 tools/preview-server.js 的 /api/db 双向同步 */
  const API_DB = '/api/db';

  function applyServer(data) {
    if (!data || typeof data !== 'object') return;
    Object.keys(data).forEach(k => { db[k] = data[k]; });
  }

  function syncFromServer() {
    try {
      fetch(API_DB, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data && (data.homeModule || data.banner)) applyServer(data);
        })
        .catch(() => {});
    } catch (e) { /* fetch 不可用则仅用本地数据 */ }
  }

  function pushToServer() {
    try {
      fetch(API_DB, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(db)
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  /* ---------- 云：影像 fileID 解析（浏览器无法直读 cloud://） ---------- */
  const urlVersion = Vue.ref(0);

  function collectCloudIds() {
    const ids = [];
    const seen = {};
    const walk = v => {
      if (typeof v === 'string') {
        if (v.indexOf('cloud://') === 0 && !seen[v]) { seen[v] = 1; ids.push(v); }
      } else if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v && typeof v === 'object') {
        Object.keys(v).forEach(k => walk(v[k]));
      }
    };
    walk(db);
    return ids;
  }

  async function prefetchImages() {
    if (!Cloud || !Cloud.enabled()) return;
    const ids = collectCloudIds();
    if (!ids.length) return;
    await Cloud.resolveUrls(ids);
    urlVersion.value++;
  }

  /* 模板图片解析：cloud:// -> 临时链接；其余原样返回 */
  function img(v) {
    urlVersion.value; // 建立响应式依赖，解析完成后自动刷新
    if (!Cloud || !Cloud.enabled()) return v;
    return Cloud.resolveText(v);
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('localStorage 保存失败（可能已满）：', e);
    }
  }

  /* 常规持久化：落本地；非云模式同步本地桥 */
  function persist() {
    persistLocal();
    if (!Cloud || !Cloud.enabled()) pushToServer();
  }

  /* 视图直改 db（如 globalConfig）后调用：落本地 + 云端保存全局配置 */
  function save() {
    persistLocal();
    if (Cloud && Cloud.enabled()) {
      Cloud.saveConfig(db.globalConfig);
    } else {
      pushToServer();
    }
  }

  const Store = {
    db,
    uid,
    img,
    urlVersion,
    // 云模式下重新拉取全部集合（登录后调用，否则首次登录页面为空）
    reload: syncFromCloud,

    /* ---------- 鉴权 ---------- */
    isLogin() {
      if (Cloud && Cloud.enabled()) return !!Cloud.token();
      return localStorage.getItem(TOKEN_KEY) === '1';
    },
    async login(username, password) {
      if (Cloud && Cloud.enabled()) {
        const r = await Cloud.login(username, password);
        return r;
      }
      const admin = (db.admin || []).find(a => a.username === username && a.password === password);
      if (!admin) return { ok: false, msg: '账号或密码错误' };
      if (admin.status === 'disabled') return { ok: false, msg: '账号已停用，请联系超级管理员' };
      admin.lastLogin = new Date().toISOString().slice(0, 19).replace('T', ' ');
      save();
      localStorage.setItem(TOKEN_KEY, '1');
      const pub = { id: admin.id, username: admin.username, nickname: admin.nickname || admin.username, role: (admin.username === 'admin' || admin.role === 'super') ? 'super' : 'admin' };
      localStorage.setItem('admin_local_user', JSON.stringify(pub));
      return { ok: true, admin: pub };
    },
    logout() {
      if (Cloud && Cloud.enabled()) { Cloud.logout(); return; }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('admin_local_user');
    },

    /* ---------- 集合 ---------- */
    coll(name) { return db[name]; },

    /* 当前登录管理员（云端取自登录返回，本地取 SEED） */
    currentAdmin() {
      if (Cloud && Cloud.enabled() && Cloud.admin()) return Cloud.admin();
      try {
        const local = JSON.parse(localStorage.getItem('admin_local_user') || 'null');
        if (local && local.username) return local;
      } catch (e) { /* ignore */ }
      return (db.admin && db.admin[0]) || null;
    },
    isSuper() {
      const a = this.currentAdmin();
      return !!(a && (a.role === 'super' || a.username === 'admin'));
    },
    /* 直接调用云函数（用于批量导入等动作），非云模式返回 null */
    cloudCall(name, data) {
      return (Cloud && Cloud.enabled()) ? Cloud.call(name, data) : Promise.resolve(null);
    },

    add(name, doc) {
      doc = Object.assign({ id: uid() }, clone(doc));
      db[name].unshift(doc);
      persist();
      if (Cloud && Cloud.enabled()) Cloud.add(name, doc);
      return doc;
    },
    update(name, id, patch) {
      const it = db[name].find(x => x.id === id);
      if (it) Object.assign(it, clone(patch));
      persist();
      if (Cloud && Cloud.enabled()) Cloud.update(name, id, patch);
      return it;
    },
    remove(name, ids) {
      ids = Array.isArray(ids) ? ids : [ids];
      for (const id of ids) {
        const i = db[name].findIndex(x => x.id === id);
        if (i > -1) db[name].splice(i, 1);
      }
      persist();
      if (Cloud && Cloud.enabled()) Cloud.remove(name, ids);
    },
    move(name, from, to) {
      const arr = db[name];
      if (!arr || from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
      arr.forEach((x, i) => { x.sort = i + 1; });
      persist();
      if (Cloud && Cloud.enabled()) Cloud.reorder(name, arr.map(x => x.id), 'sort');
    },
    /* 依据当前可见顺序重排集合（支持筛选：仅重排传入的 id，其余保持原槽位）
     * orderedIds 为可见列表的 id 顺序；field 为排序字段（默认 sort，景区用 weight） */
    reorder(name, orderedIds, field) {
      const arr = db[name];
      if (!Array.isArray(arr) || !Array.isArray(orderedIds)) return;
      const idset = new Set(orderedIds);
      const byId = {};
      arr.forEach(x => { byId[x.id] = x; });
      const newListed = orderedIds.map(id => byId[id]).filter(Boolean);
      let k = 0;
      for (let i = 0; i < arr.length; i++) {
        if (idset.has(arr[i].id)) arr[i] = newListed[k++];
      }
      arr.forEach((x, i) => {
        if (field === 'weight') x.weight = arr.length - i;
        else if ('sort' in x) x.sort = i + 1;
      });
      persist();
      if (Cloud && Cloud.enabled()) Cloud.reorder(name, orderedIds, field);
    },
    toggle(name, id, field) {
      const it = db[name].find(x => x.id === id);
      if (it) {
        it[field] = !it[field];
        persist();
        if (Cloud && Cloud.enabled()) Cloud.update(name, id, { [field]: it[field] });
      }
      return it && it[field];
    },

    /* ---------- 素材库 ---------- */
    addAsset(name, dataUrl) {
      const it = { id: uid(), url: dataUrl, name, size: Math.round(String(dataUrl).length), time: new Date().toISOString().slice(0, 19).replace('T', ' ') };
      db.assets.unshift(it);
      persist();
      if (Cloud && Cloud.enabled()) Cloud.add('assets', it);
      return it;
    },

    /* ---------- 用户聚合（只读：从 userTrip + inspirationPost 聚合 openid） ---------- */
    users() {
      const map = {};
      const stamp = t => {
        if (!t) return '';
        const d = new Date(t);
        return isNaN(d.getTime()) ? String(t) : d.toISOString().slice(0, 19).replace('T', ' ');
      };
      const touch = u => {
        u = u || {};
        const key = u.openid ? ('o:' + u.openid) : ('a:' + (u.nickname || u.avatar || 'anonymous'));
        if (!map[key]) {
          map[key] = {
            key, openid: u.openid || '', nickname: u.nickname || '', avatar: u.avatar || '',
            trips: 0, posts: 0, firstSeen: '', lastSeen: '', anon: !u.openid
          };
        }
        const rec = map[key];
        if (u.nickname && !rec.nickname) rec.nickname = u.nickname;
        if (u.avatar && !rec.avatar) rec.avatar = u.avatar;
        return rec;
      };
      const bump = (rec, t) => {
        const s = stamp(t);
        if (!s) return;
        if (!rec.firstSeen || s < rec.firstSeen) rec.firstSeen = s;
        if (!rec.lastSeen || s > rec.lastSeen) rec.lastSeen = s;
      };
      (db.userTrip || []).forEach(t => { const r = touch(t); r.trips++; bump(r, t.updatedAt || t.createTime); });
      (db.inspirationPost || []).forEach(p => { const r = touch(p); r.posts++; bump(r, p.createTime); });
      (db.user || []).forEach(u => {
        const rec = touch({ openid: u.openid, nickname: u.nickname, avatar: u.avatarUrl });
        bump(rec, u.updateTime || u.createTime);
      });
      return Object.keys(map).map(k => map[k]).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
    },

    /* ---------- 统计 ---------- */
    stats() {
      const c = (name, fn) => db[name] ? db[name].filter(fn || (() => true)).length : 0;
      return {
        scenic: c('scenic'),
        scenicOn: c('scenic', x => x.online),
        hotel: c('hotel'),
        hotelOn: c('hotel', x => x.online),
        group: c('privateGroup'),
        groupOn: c('privateGroup', x => x.online),
        banner: c('banner'),
        bannerOn: c('banner', x => x.enable),
        userTrip: c('userTrip'),
        posts: c('inspirationPost'),
        postsPending: c('inspirationPost', x => x.status === 0),
        postsPass: c('inspirationPost', x => x.status === 1),
        postsReject: c('inspirationPost', x => x.status === 2),
        comments: (db.inspirationPost || []).reduce((s, x) => s + (x.comments ? x.comments.length : 0), 0),
        assets: c('assets'),
        modules: c('homeModule'),
        modulesOn: c('homeModule', x => x.show),
        users: this.users().length,
      };
    },

    /* ---------- 重置 ---------- */
    reset() {
      const fresh = clone(window.SEED);
      Object.keys(fresh).forEach(k => { db[k] = fresh[k]; });
      persist();
    },

    save,
    syncFromServer,
    pushToServer,
    LS_KEY,
  };

  /* ---------- 启动时加载数据 ---------- */
  async function syncFromCloud() {
    const colls = ['homeModule', 'banner', 'scenic', 'hotel', 'privateGroup', 'inspirationPost', 'userTrip', 'assets', 'staff', 'order', 'opLog', 'user', 'category'];
    for (const c of colls) {
      const list = await Cloud.list(c);
      if (Array.isArray(list) && list.length) db[c] = list;
    }
    const gc = await Cloud.getConfig();
    if (gc && typeof gc === 'object') {
      db.globalConfig = normalize({ globalConfig: Object.assign({}, db.globalConfig, gc) }).globalConfig;
    }
    prefetchImages();
  }

  window.Store = Store;

  if (Cloud && Cloud.enabled()) {
    // 云端模式：登录后(或已有 token)从云库加载
    syncFromCloud();
  } else {
    syncFromServer();
  }
})();
