/**
 * 右上角原生分享。不改 Page 全局，不包 onLoad。
 * 朋友圈只能打开当前页，query 只允许白名单；好友分享可以换到公开路径。
 */
const BRAND_TITLE = '呼伦贝尔轻奢定制旅行';
const HOME = '/pages/index/index';
const CUSTOM = '/pages/custom/custom';

const PRIVATE = { type: 'private', timeline: true, title: BRAND_TITLE };

/** 与 app.json pages 对齐。未登记但存在 Page 的，放在 EXTRAS。 */
const POLICIES = {
  'pages/index/index': { type: 'public', title: BRAND_TITLE },
  'pages/routes/routes': { type: 'public', title: '旅游线路' },
  'pages/strategy/strategy': { type: 'public', title: '旅行攻略' },
  'pages/scenic/scenic': { type: 'public', title: '景区' },
  'pages/hotels/hotels': { type: 'public', title: '酒店' },
  'pages/square/square': { type: 'public', title: '灵感广场' },
  'pages/cars/cars': { type: 'public', title: '用车' },
  'pages/about/about': { type: 'public', title: '关于我们' },
  'pages/share-details/share-details': { type: 'public', title: BRAND_TITLE, path: HOME },
  'pages/route-detail/route-detail': { type: 'detail', titleKeys: ['route.title', 'route.name'], imageKeys: ['route.cover', 'route.image'] },
  'pages/scenic-detail/scenic-detail': { type: 'detail', titleKeys: ['scenic.name'], imageKeys: ['scenic.cover', 'scenic.image'] },
  'pages/hotel-detail/hotel-detail': { type: 'detail', titleKeys: ['hotel.name'], imageKeys: ['hotel.cover', 'hotel.image'] },
  'pages/strategy-detail/strategy-detail': { type: 'detail', titleKeys: ['article.title'], imageKeys: ['article.cover'] },
  'pages/note-detail/note-detail': { type: 'detail', titleKeys: ['note.title'], imageKeys: ['note.cover', 'note.images.0'] },
  'pages/share-detail/share-detail': { type: 'detail', titleKeys: ['share.title'], imageKeys: ['share.cover'], idFrom: ['share.id'] },
  'pages/custom/custom': { type: 'custom-entry', title: '私人定制行程' },
  'pages/custom-preview/custom-preview': { type: 'preview' },
  'pages/mine/mine': PRIVATE,
  'pages/profile-edit/profile-edit': PRIVATE,
  'pages/avatar-crop/avatar-crop': PRIVATE,
  'pages/orders/orders': PRIVATE,
  'pages/favorites/favorites': PRIVATE,
  'pages/consult-history/consult-history': PRIVATE,
  'pages/my-trips/my-trips': PRIVATE,
  'pages/workbench/workbench': PRIVATE,
  'pages/workbench-detail/workbench-detail': PRIVATE,
  'pages/workbench-edit/workbench-edit': PRIVATE,
  'pages/workbench-bind/workbench-bind': PRIVATE,
  'pages/share-publish/share-publish': PRIVATE
};

const EXTRAS = ['pages/share-detail/share-detail', 'pages/share-publish/share-publish'];

function routeOf(page) {
  const raw = page && (page.route || page.__route__) || '';
  return String(raw).replace(/^\//, '');
}

function policyOf(route) {
  return POLICIES[route] || { type: 'private', timeline: true, title: BRAND_TITLE };
}

function safeId(v) {
  const s = String(v == null ? '' : v).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) return '';
  if (/^1\d{10}$/.test(s)) return '';
  return s;
}

function cleanTitle(v, fallback) {
  let s = String(v == null ? '' : v).replace(/1\d{10}/g, '').replace(/\s+/g, ' ').trim();
  if (!s) s = fallback || BRAND_TITLE;
  if (s.length > 32) s = s.slice(0, 32);
  return s;
}

function pick(obj, path) {
  const parts = String(path || '').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null) return '';
    const k = parts[i];
    cur = /^\d+$/.test(k) ? cur[Number(k)] : cur[k];
  }
  return cur == null ? '' : cur;
}

function safeImage(v) {
  const s = String(v || '').trim();
  if (/^https:\/\//i.test(s) || /^cloud:\/\//.test(s)) return s.slice(0, 500);
  return '';
}

function firstText(data, keys, fallback) {
  const list = keys || [];
  for (let i = 0; i < list.length; i++) {
    const t = cleanTitle(pick(data, list[i]), '');
    if (t) return t;
  }
  return fallback || BRAND_TITLE;
}

function firstImage(data, keys) {
  const list = keys || [];
  for (let i = 0; i < list.length; i++) {
    const img = safeImage(pick(data, list[i]));
    if (img) return img;
  }
  return '';
}

function pageQueryId(page, policy) {
  const data = (page && page.data) || {};
  const from = (policy && policy.idFrom) || [];
  for (let i = 0; i < from.length; i++) {
    const id = safeId(pick(data, from[i]));
    if (id) return id;
  }
  const idKeys = ['id', 'scenic.id', 'hotel.id', 'route.id', 'article.id', 'note.id', 'share.id'];
  for (let i = 0; i < idKeys.length; i++) {
    const id = safeId(pick(data, idKeys[i]));
    if (id) return id;
  }
  const opt = (page && page.options) || {};
  return safeId(opt.id);
}

function specFor(page) {
  const route = routeOf(page);
  const policy = policyOf(route);
  const data = (page && page.data) || {};
  if (policy.type === 'custom-entry') {
    return { title: policy.title, path: CUSTOM, query: '', image: '' };
  }
  if (policy.type === 'preview') {
    const id = safeId(page && page._shareReadyId);
    if (!id) return { title: '私人定制行程', path: CUSTOM, query: '', image: '' };
    return {
      title: cleanTitle(data.heroTitle, '你的专属行程'),
      path: '/pages/custom-preview/custom-preview?trip=' + encodeURIComponent(id),
      query: 'trip=' + encodeURIComponent(id),
      image: safeImage(data.cover)
    };
  }
  if (policy.type === 'detail') {
    const id = pageQueryId(page, policy);
    const path = '/' + route;
    const title = firstText(data, policy.titleKeys, BRAND_TITLE);
    const image = firstImage(data, policy.imageKeys);
    if (!id) return { title: title, path: path, query: '', image: image };
    return { title: title, path: path + '?id=' + encodeURIComponent(id), query: 'id=' + encodeURIComponent(id), image: image };
  }
  if (policy.type === 'public') {
    const path = policy.path || ('/' + route);
    return { title: policy.title || BRAND_TITLE, path: path, query: '', image: '' };
  }
  return { title: BRAND_TITLE, path: HOME, query: '', image: '' };
}

function toMessage(spec) {
  const out = { title: spec.title, path: spec.path };
  if (spec.image) out.imageUrl = spec.image;
  return out;
}

function toTimeline(spec) {
  const out = { title: spec.title, query: spec.query || '' };
  if (spec.image) out.imageUrl = spec.image;
  return out;
}

function message(page) { return toMessage(specFor(page)); }
function timeline(page) { return toTimeline(specFor(page)); }

function enable(page) {
  if (typeof wx === 'undefined' || !wx || typeof wx.showShareMenu !== 'function') return;
  try {
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
  } catch (e) { /* 基础库过旧时菜单保持默认 */ }
}

/** 包在 Page() 外层。只包 onShow，原 onLoad 原样保留、只调用一次。 */
function install(opt) {
  const src = opt || {};
  const prevShow = src.onShow;
  src.onShow = function () {
    enable(this);
    if (typeof prevShow === 'function') return prevShow.apply(this, arguments);
  };
  src.onShareAppMessage = function () { return message(this); };
  src.onShareTimeline = function () { return timeline(this); };
  return src;
}

function auditList(appPages) {
  const pages = appPages || [];
  const rows = [];
  pages.forEach(route => {
    const policy = POLICIES[route];
    rows.push({
      route: route,
      inApp: true,
      covered: !!policy,
      type: policy ? policy.type : 'missing',
      timeline: true
    });
  });
  EXTRAS.forEach(route => {
    if (pages.indexOf(route) >= 0) return;
    const policy = POLICIES[route];
    rows.push({
      route: route,
      inApp: false,
      covered: !!policy,
      type: policy ? policy.type : 'missing',
      timeline: true
    });
  });
  return rows;
}

module.exports = {
  BRAND_TITLE, HOME, CUSTOM, POLICIES, EXTRAS,
  safeId, cleanTitle, safeImage, routeOf, policyOf, specFor,
  message, timeline, enable, install, auditList
};
