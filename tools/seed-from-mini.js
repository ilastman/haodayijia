/* ============================================================
 * 一次性工具：把小程序 utils/data.js 的“呼伦贝尔”内容
 * 转换为 admin/js/data.js 的 SEED（后台 schema）。
 * 用法：node tools/seed-from-mini.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* utils/util.js 顶层不依赖 wx，可在 Node 直接 require */
const data = require('../utils/data');

let seq = 0;
const uid = () => 'id_' + (++seq).toString(36);

const now = Date.now();
const day = 86400000;
function daysAgo(n) {
  return new Date(now - n * day).toISOString().slice(0, 19).replace('T', ' ');
}
function ts(date) {
  return String(date || '') + ' 00:00:00';
}

/* tab:xxx?q=... => /pages/xxx/xxx?q=... */
function normalizeUrl(url) {
  if (!url) return url;
  if (url.indexOf('tab:') === 0) {
    const seg = url.slice(4).split('?');
    const pages = {
      index: '/pages/index/index',
      routes: '/pages/routes/routes',
      square: '/pages/square/square',
      my: '/pages/my/my'
    };
    return (pages[seg[0]] || '/pages/' + seg[0] + '/' + seg[0]) + (seg[1] ? '?' + seg[1] : '');
  }
  return url;
}

/* ---------- 首页板块 ---------- */
const homeModule = data.navIcons.map((n, i) => ({
  id: 'm' + (i + 1),
  title: n.label,
  sub: '',
  icon: n.icon,
  desc: '',
  url: normalizeUrl(n.url),
  show: true,
  sort: i + 1
}));

/* ---------- 轮播 Banner ---------- */
const banner = data.banners.map((b, i) => {
  const route = data.routes.find(r => r.id === b.routeId);
  return {
    id: b.id,
    img: b.image,
    title: route ? route.title : '',
    jump: '/pages/route-detail/route-detail?id=' + b.routeId,
    enable: true,
    sort: i + 1
  };
});

/* ---------- 景区 ---------- */
const scenic = data.scenics.map((s, i) => ({
  id: s.id,
  name: s.name,
  cover: s.cover,
  album: s.images.slice(),
  intro: s.intro,
  detailHtml: '<p>' + s.description + '</p>',
  tags: s.tips.slice(),
  dest: s.dest,
  duration: s.duration,
  bestSeason: s.bestSeason,
  playItems: Array.isArray(s.playItems) ? s.playItems.map(it => ({ id: it.id, name: it.name, price: String(it.price == null ? '' : it.price) })) : [],
  lon: 0,
  lat: 0,
  weight: 100 - i,
  online: true
}));

/* ---------- 酒店 ---------- */
function starsOf(label) {
  const m = /([0-9])钻/.exec(label || '');
  if (m) return Number(m[1]);
  return 4;
}
const hotel = data.hotels.map((h, i) => ({
  id: h.id,
  name: h.name,
  cover: h.image,
  album: h.images.slice(),
  intro: h.intro,
  detailHtml: '<p>' + h.description + '</p>',
  facilities: h.facilities.slice(),
  price: h.price,
  stars: starsOf(h.stars),
  score: h.score,
  area: h.area,
  envImg: h.envImg,
  roomImg: h.roomImg,
  rooms: h.rooms.slice(),
  location: h.location,
  lon: 0,
  lat: 0,
  sort: i + 1,
  online: true
}));

/* ---------- 私家团（线路） ---------- */
function matchScenicId(spots) {
  const pool = (spots || []);
  for (const spot of pool) {
    const hit = data.scenics.find(sc =>
      spot.indexOf(sc.name) > -1 || sc.name.indexOf(spot) > -1 || (sc.dest && spot.indexOf(sc.dest) > -1)
    );
    if (hit) return hit.id;
  }
  return '';
}
function matchHotelId(hotelText) {
  if (!hotelText || /返程|不含宿/.test(hotelText)) return '';
  const hit = data.hotels.find(h => hotelText.indexOf(h.area) > -1);
  return hit ? hit.id : '';
}

const privateGroup = data.routes.map((r) => {
  const dayList = (r.itinerary || []).map(d => ({
    id: r.id + '-d' + d.d,
    dayNum: d.d,
    title: d.scene,
    content: [d.spots.join('、'), d.meals ? '用餐：' + d.meals : '', d.hotel ? '住宿：' + d.hotel : ''].filter(Boolean).join('；'),
    scenicId: matchScenicId(d.spots),
    hotelId: matchHotelId(d.hotel),
    spots: d.spots.slice(),
    meals: d.meals || '',
    hotel: d.hotel || '',
    imgs: []
  }));
  return {
    id: r.id,
    title: r.title,
    cover: r.cover,
    images: r.images.slice(),
    price: r.price,
    originalPrice: r.originalPrice,
    days: r.days,
    departure: r.departure,
    dest: r.dest,
    type: r.type,
    tags: r.tags.slice(),
    brief: r.brief,
    highlights: r.highlights.slice(),
    detailHtml: '<p>' + r.brief + '</p>',
    include: r.include.slice(),
    exclude: r.exclude.slice(),
    notices: r.notices,
    reviews: r.reviews.slice(),
    itinerary: r.itinerary.slice(),
    dayList,
    sort: 0,
    online: true
  };
});
privateGroup.forEach((g, i) => { g.sort = i + 1; });

/* ---------- 用户行程 ---------- */
const userTrip = [
  { id: 'u1', nickname: '远方的田野', avatar: privateGroup[0].cover, title: '我的草原环线行程', days: 6, plan: 'Day1 海拉尔集合 → Day2 莫日格勒河 → Day3 恩和 → Day4 黑山头 → Day5 满洲里 → Day6 返程', status: 'active', createTime: daysAgo(3), updatedAt: daysAgo(1) },
  { id: 'u2', nickname: '岚山旅人', avatar: hotel[0].cover, title: '亲子草原慢游', days: 3, plan: '黑山头牧场 + 蒙古包住宿 + 骑马', status: 'active', createTime: daysAgo(12), updatedAt: daysAgo(9) }
];

/* ---------- 灵感广场 ---------- */
function mapComments(list) {
  return (list || []).map(c => ({
    id: uid(),
    nickname: c.name || '旅行者',
    avatar: c.avatar || '',
    text: c.text || '',
    time: c.time || ''
  }));
}

const inspirationPost = []
  .concat(
    data.notes.map(n => ({
      id: n.id,
      nickname: n.author.name,
      avatar: n.author.avatar,
      type: 'note',
      title: n.title,
      tags: n.tags.slice(),
      cover: n.coverV,
      imgs: n.images.slice(),
      content: n.content.join('\n'),
      tripRef: '',
      like: n.likes,
      commentCount: n.comments.length,
      comments: mapComments(n.comments),
      status: 1,
      createTime: ts(n.time)
    }))
  )
  .concat(
    data.shares.map(s => ({
      id: s.id,
      nickname: s.author.name,
      avatar: s.author.avatar,
      type: 'trip',
      title: s.title,
      tags: [s.category],
      cover: s.coverV,
      imgs: [s.cover],
      content: s.intro,
      tripRef: '',
      like: s.likes,
      commentCount: s.comments.length,
      comments: mapComments(s.comments),
      status: 1,
      createTime: ts(s.time),
      days: s.days,
      season: s.season,
      category: s.category,
      highlights: s.highlights.slice(),
      timeline: (s.timeline || []).map(t => ({ scenicIds: (t.scenicIds || []).slice(), hotelId: t.hotelId || '', note: t.note || '' }))
    }))
  );

/* ---------- 全局配置 ---------- */
const globalConfig = {
  notice: '暑期草原旺季已至，热门线路余位有限，出行前请咨询旅行顾问',
  homeCopy: {
    tourTitle: '私家团定制',
    tourSub: '一单一团 · 专属管家',
    hotTitle: '热门呼伦贝尔线路',
    destTitle: '目的地直达',
    destSub: '按目的地快速直达',
    offerTitle: '特惠推荐',
    offerSub: '限时优享线路',
    inspirationTitle: '灵感广场',
    inspirationSub: '看看大家的旅途',
    introTitle: '关于我们',
    contactTitle: '行前咨询',
    contactSub: '1 对 1 专属顾问',
    more: '查看全部',
    consult: '立即咨询'
  },
  homeSections: {
    hot: { routeIds: data.hotRouteIds.slice() },
    dest: { items: data.destinations.map(d => ({ name: d.name, image: d.image })) },
    offer: { routeIds: data.offerIds.slice() }
  },
  contact: {
    phone: '400-000-0000',
    wechat: 'hulunbeier_trip',
    email: 'hello@hulun-tour.com',
    address: '内蒙古自治区呼伦贝尔市海拉尔区'
  },
  companyIntro: '专注呼伦贝尔草原深度旅行，坚持小车团、在地体验与品质住宿的旅行方式，让每一次出发都有温度。',
  slogan: '天边草原 · 自由出发',
  tabs: [
    { id: 't1', page: '/pages/index/index', text: '首页', icon: '🏠', selectedIcon: '🏠', show: true },
    { id: 't2', page: '/pages/routes/routes', text: '线路', icon: '🧭', selectedIcon: '🧭', show: true },
    { id: 't3', page: '/pages/square/square', text: '灵感', icon: '✨', selectedIcon: '✨', show: true },
    { id: 't4', page: '/pages/my/my', text: '我的', icon: '👤', selectedIcon: '👤', show: true }
  ]
};

/* ---------- 素材库 ---------- */
const assets = [
  { id: 'a1', url: banner[0].img, name: 'banner-草原全景', size: 180000, time: daysAgo(6) },
  { id: 'a2', url: scenic[0].cover, name: '呼伦贝尔大草原', size: 140000, time: daysAgo(6) },
  { id: 'a3', url: scenic[1].cover, name: '莫日格勒河', size: 135000, time: daysAgo(6) },
  { id: 'a4', url: hotel[0].cover, name: '海拉尔草原天际酒店', size: 170000, time: daysAgo(5) },
  { id: 'a5', url: privateGroup[0].cover, name: '草原深度6日封面', size: 150000, time: daysAgo(4) }
];

/* ---------- 输出 ---------- */
const seed = {
  admin: [
    { id: 'admin1', username: 'admin', password: 'admin123', nickname: '管理员', avatar: scenic[0].cover, role: 'super', lastLogin: daysAgo(0) }
  ],
  homeModule,
  banner,
  scenic,
  hotel,
  privateGroup,
  userTrip,
  inspirationPost,
  globalConfig,
  assets
};

const out =
  '/* ============================================================\n' +
  ' * 本地模拟数据中心（admin）\n' +
  ' * 该文件由 tools/seed-from-mini.js 从 utils/data.js 自动生成（呼伦贝尔内容）。\n' +
  ' * 如需重新生成：node tools/seed-from-mini.js\n' +
  ' * ============================================================ */\n' +
  'window.SEED = ' + JSON.stringify(seed, null, 2) + ';\n';

const target = path.join(ROOT, 'admin', 'js', 'data.js');
fs.writeFileSync(target, out);
console.log('written ' + target + ' (' + out.length + ' bytes)');
console.log('homeModule=' + homeModule.length + ' banner=' + banner.length +
  ' scenic=' + scenic.length + ' hotel=' + hotel.length +
  ' privateGroup=' + privateGroup.length + ' posts=' + inspirationPost.length +
  ' (note=' + inspirationPost.filter(p => p.type === 'note').length +
  ' trip=' + inspirationPost.filter(p => p.type === 'trip').length + ')' +
  ' homeHot=' + globalConfig.homeSections.hot.routeIds.length +
  ' homeOffer=' + globalConfig.homeSections.offer.routeIds.length +
  ' homeDest=' + globalConfig.homeSections.dest.items.length);