/**
 * 数据服务层：小程序 <-> 数据源（本地数据桥 / 微信云开发）
 * - 通过 utils/cloud.js 调用后端
 * - 字段与 CMS 后台（admin/js/data.js SEED）保持一致，在此映射为页面所需结构
 * - 返回 null 表示数据源不可用/无数据，调用方应回退本地静态数据，保证 UI 不空白
 */

const cloud = require('./cloud');
const play = require('./play-items');

async function call(name, data) {
  const res = await cloud.callFunction(name, data);
  if (res && res.code === 200) return res.data;
  return null;
}

function sortBy(arr, key) {
  return (arr || []).slice().sort((a, b) => (a[key] || 0) - (b[key] || 0));
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* 从跳转路径中提取 route-detail 的 id，如 /pages/route-detail/route-detail?id=p1 */
function routeIdOf(jump) {
  const m = /[?&]id=([^&]+)/.exec(jump || '');
  return m ? decodeURIComponent(m[1]) : '';
}

/* 将后台配置的页面路径归一化为小程序可识别形式（tab 页用 tab: 前缀） */
function toTabUrl(url) {
  if (!url) return url;
  const seg = url.split('?');
  const map = {
    '/pages/index/index': 'tab:index',
    '/pages/routes/routes': 'tab:routes',
    '/pages/square/square': 'tab:square',
    '/pages/my/my': 'tab:my'
  };
  if (map[seg[0]]) return map[seg[0]] + (seg[1] ? '?' + seg[1] : '');
  return url;
}

/* 私家团(后台 privateGroup) -> 线路卡片/详情结构 */
function toRoute(p) {
  const dayList = (p.dayList || []).map((d, i) => ({
    dayNum: d.dayNum || i + 1,
    dayTitle: d.title || d.dayTitle || '',
    dayContent: d.content || d.dayContent || '',
    scenicId: d.scenicId || '',
    hotelId: d.hotelId || '',
    imgs: d.imgs || []
  }));
  /* 富渲染所需行程骨架：优先当日 spots，兜底用正文切分 */
  const itinerary = (p.dayList || []).map((d, i) => ({
    d: d.dayNum || i + 1,
    scene: d.title || d.dayTitle || ('第' + (d.dayNum || i + 1) + '天'),
    spots: (d.spots && d.spots.length)
      ? d.spots.slice()
      : String(d.content || '').split(/[；;、，]/).filter(Boolean),
    meals: d.meals || '',
    hotel: d.hotel || ''
  }));
  const days = p.days || dayList.length || 1;
  return {
    id: p.id,
    title: p.title || '私家团',
    days,
    brief: p.brief || (p.highlights && p.highlights[0]) || stripHtml(p.detailHtml).slice(0, 40) || '私家小团，独立用车，随走随停',
    cover: p.cover || '',
    images: (p.images && p.images.length) ? p.images : (p.cover ? [p.cover] : []),
    price: p.price || 0,
    originalPrice: p.originalPrice || 0,
    tags: p.tags || [],
    type: p.type || '私家团',
    dest: p.dest || '',
    regionLevel1: p.regionLevel1 || '',
    departure: p.departure || '海拉尔集合',
    highlights: p.highlights || [],
    include: p.include || [],
    exclude: p.exclude || [],
    notices: p.notices || {},
    reviews: p.reviews || [],
    dayList,
    itinerary,
    _cloud: true
  };
}

/* 景区(后台 scenic) -> 本地 scenics 结构 */
function toScenic(s) {
  return {
    id: s.id,
    name: s.name || '',
    dest: s.dest || s.area || '',
    regionLevel1: s.regionLevel1 || '',
    regionCatId: s.regionCatId || '',
    typeName: s.typeName || '',
    typeCatId: s.typeCatId || '',
    placeCatId: s.placeCatId || '',
    subType: s.subType === 'entertainment' ? 'entertainment' : 'scenic',
    cover: s.cover || '',
    intro: s.intro || '',
    images: s.album || [],
    description: stripHtml(s.detailHtml),
    duration: s.duration || '',
    bestSeason: s.bestSeason || '',
    tips: s.tags || [],
    playItems: play.normalizePlayItems(s.playItems)
  };
}

/* 酒店(后台 hotel) -> 本地 hotels 结构 */
function toHotel(h) {
  const album = h.album || [];
  return {
    id: h.id,
    name: h.name || '',
    stars: h.stars ? (h.stars + '钻') : '',
    area: h.area || '',
    areaCatId: h.areaCatId || '',
    regionLevel1: h.regionLevel1 || '',
    regionCatId: h.regionCatId || '',
    score: h.score || 0,
    price: h.price || 0,
    tags: (h.facilities || []).slice(0, 3),
    image: h.cover || '',
    intro: h.intro || '',
    images: album,
    description: stripHtml(h.detailHtml),
    envImg: h.envImg || album[0] || '',
    roomImg: h.roomImg || album[1] || '',
    rooms: (h.rooms || []).map(r => (r && typeof r === 'object')
      ? { name: r.name || '', price: r.price || '', desc: r.desc || '' }
      : { name: String(r == null ? '' : r), price: '', desc: '' }),
    pricePeriod: (h.pricePeriod || []).map(p => ({
      start: p.start || '',
      end: p.end || '',
      rooms: (p.rooms || []).map(r => ({ name: r.name || '', price: r.price || '' }))
    })),
    location: h.location || h.area || '',
    facilities: h.facilities || []
  };
}

function mapComments(list) {
  return (Array.isArray(list) ? list : []).map(c => ({
    name: c.nickname || c.name || '旅行者',
    avatar: c.avatar || '',
    text: c.text || c.content || '',
    likes: c.likes || c.likeNum || 0
  }));
}

/* 灵感帖子(后台 inspirationPost) -> 广场卡片（kind: plan/note） */
function toFeed(p) {
  const text = (p.content || '').trim();
  return {
    id: p.id,
    kind: p.type === 'note' ? 'note' : 'plan',
    category: p.category || '',
    title: p.title || text.slice(0, 40) || '旅行分享',
    coverV: p.cover || '',
    author: { name: p.nickname || '旅行者', avatar: p.avatar || '' },
    likes: p.like || 0,
    liked: false
  };
}

/* 灵感帖子 -> 旅行笔记详情 */
function toNote(p) {
  return {
    id: p.id,
    title: p.title || '旅行笔记',
    tags: p.tags || [],
    coverV: p.cover || '',
    images: (p.imgs && p.imgs.length) ? p.imgs : (p.cover ? [p.cover] : []),
    content: (p.content || '').split('\n').filter(Boolean),
    author: { name: p.nickname || '旅行者', avatar: p.avatar || '' },
    time: p.createTime || '',
    likes: p.like || 0,
    comments: mapComments(p.comments)
  };
}

/* 灵感帖子 -> 行程分享详情 */
function toShare(p) {
  return {
    id: p.id,
    category: p.category || '',
    title: p.title || '行程分享',
    days: p.days || 0,
    season: p.season || '',
    cover: p.cover || '',
    intro: p.content || '',
    highlights: p.highlights || [],
    timeline: p.timeline || [],
    author: { name: p.nickname || '旅行者', avatar: p.avatar || '' },
    time: p.createTime || '',
    likes: p.like || 0,
    comments: mapComments(p.comments)
  };
}

const api = {
  // 首页轮播 banner -> { id, image, routeId, jumpRoute }
  async banners() {
    const list = await call('bannerCRUD', { action: 'list' });
    if (!list || !list.length) return null;
    return sortBy(list.filter(b => b.enable !== false), 'sort').map(b => ({
      id: b.id,
      image: b.img || '',
      title: b.title || '',
      routeId: routeIdOf(b.jump),
      jumpRoute: toTabUrl(b.jump)
    }));
  },

  // 首页板块 homeModule -> navIcons: { key, label, icon, url }
  async homeModules() {
    const list = await call('homeModuleCRUD', { action: 'list' });
    if (!list || !list.length) return null;
    return sortBy(list.filter(m => m.show !== false), 'sort').map(m => ({
      key: m.id,
      label: m.title || '',
      icon: m.icon || '',
      url: toTabUrl(m.url || '')
    }));
  },

  // 首页内容：热门线路 / 目的地直达 / 特惠推荐 / 关于我们
  async homeContent() {
    const gc = await call('homeConfigCRUD', {});
    if (!gc || typeof gc !== 'object') return null;
    const sec = gc.homeSections || {};
    const list = await this.privateGroups();          // 已上架线路卡（含 _cloud）
    if (!list) return null;
    const byId = {};
    list.forEach(g => { byId[g.id] = g; });
    const pick = ids => (Array.isArray(ids) ? ids : []).map(id => byId[id]).filter(Boolean);
    const homeCopy = gc.homeCopy || {};
    return {
      homeCopy,
      hot: pick(sec.hot && sec.hot.routeIds),
      offers: pick(sec.offer && sec.offer.routeIds),
      destinations: (sec.dest && Array.isArray(sec.dest.items)) ? sec.dest.items : [],
      about: {
        title: homeCopy.introTitle || '关于我们',
        content: gc.companyIntro || '',
        phone: (gc.contact && gc.contact.phone) || ''
      }
    };
  },

  // 分类图库。tree 为空返回全部（含私人定制封面层）
  async gallery(tree) {
    const list = await call('galleryCRUD', { action: 'list', tree: tree || '' });
    return Array.isArray(list) ? list : [];
  },

  // 分类树（scenic 三级 / hotel 两级）。空库时云函数会写入默认分类。
  async categories(tree) {
    const list = await call('categoryCRUD', { action: 'list', tree: tree || '' });
    return Array.isArray(list) ? list : [];
  },

  // 景区列表（仅上架）
  async scenics() {
    const list = await call('scenicCRUD', { action: 'list' });
    if (!list || !list.length) return null;
    return list.filter(s => s.online !== false).map(toScenic);
  },

  // 单个景区
  async getScenic(id) {
    if (!id) return null;
    const s = await call('scenicCRUD', { action: 'get', id });
    if (!s || !s.id) return null;
    return toScenic(s);
  },

  // 酒店列表（仅上架）
  async hotels() {
    const list = await call('hotelCRUD', { action: 'list' });
    if (!list || !list.length) return null;
    return list.filter(h => h.online !== false).map(toHotel);
  },

  // 单个酒店
  async getHotel(id) {
    if (!id) return null;
    const h = await call('hotelCRUD', { action: 'get', id });
    if (!h || !h.id) return null;
    return toHotel(h);
  },

  // 灵感广场（仅审核通过）
  async inspirationPosts() {
    const list = await call('inspirationPostCRUD', { action: 'publicList' });
    if (!list || !list.length) return null;
    return list.map(toFeed);
  },

  // 单个灵感帖子 -> 笔记详情
  async getNote(id) {
    if (!id) return null;
    const p = await call('inspirationPostCRUD', { action: 'get', id });
    if (!p || !p.id) return null;
    return toNote(p);
  },

  // 单个灵感帖子 -> 行程分享详情
  async getShare(id) {
    if (!id) return null;
    const p = await call('inspirationPostCRUD', { action: 'get', id });
    if (!p || !p.id) return null;
    return toShare(p);
  },

  // 私家团列表（仅上架）
  async privateGroups() {
    const list = await call('privateGroupCRUD', { action: 'list' });
    if (!list || !list.length) return null;
    return sortBy(list.filter(g => g.online !== false), 'sort').map(toRoute);
  },

  // 单个私家团
  async getPrivateGroup(id) {
    if (!id) return null;
    const p = await call('privateGroupCRUD', { action: 'get', id });
    if (!p || !p.id) return null;
    return toRoute(p);
  },

  // 我保存的行程（兼容本地 trip 结构）
  async myTrips() {
    const list = await call('userTripCRUD', { action: 'myTrips' });
    if (!list) return null;
    return list.map(t => ({
      id: t.id,
      title: t.title || '我的专属行程',
      days: t.days || 0,
      date: t.date || String(t.createTime || '').slice(0, 10),
      adults: t.adults,
      children: t.children,
      quote: t.quote || null,
      guestName: t.guestName || '',
      guestQuote: t.guestQuote || 0,
      cover: t.cover || '',
      plans: (Array.isArray(t.plans) && t.plans.length)
        ? t.plans.map(p => ({
          scenicIds: p.scenicIds || [],
          hotelId: p.hotelId || '',
          altHotelIds: p.altHotelIds || [],
          note: p.note || '',
          roomType: p.roomType || '',
          roomQty: p.roomQty || 1,
          promoImgs: Array.isArray(p.promoImgs) ? p.promoImgs.slice(0, 2) : [],
          playItemSelections: play.normalizeSelections(p.playItemSelections, p.scenicIds || [])
        }))
        : (t.plan ? [{ scenicIds: [], hotelId: '', altHotelIds: [], note: t.plan, roomType: '', roomQty: 1, promoImgs: [], playItemSelections: [] }] : []),
      savedAt: t.createTime || '',
      isPublish: t.status === 'published'
    }));
  },

  // 分享打开的行程。不含内部核算 quote。
  async getPublicTrip(id) {
    if (!id) return null;
    const t = await call('userTripCRUD', { action: 'getPublic', id });
    if (!t || !t.id) return null;
    if (t.quote) delete t.quote;
    return t;
  },

  // 保存/更新我的行程（尽力而为，失败不影响本地保存）
  async saveTrip(trip) {
    const res = await cloud.callFunction('userTripCRUD', { action: 'save', data: trip });
    return !!(res && res.code === 200);
  },

  // 当前用户资料（按 openid 获取/创建，返回 { id, openid, nickname, avatarUrl, avatarType }）
  async userMe() {
    return await call('userCRUD', { action: 'me' });
  },

  // 保存昵称/头像（{ nickname?, avatarUrl?, avatarType? } -> 更新后的资料）
  async saveProfile(patch) {
    const res = await cloud.callFunction('userCRUD', { action: 'saveProfile', data: patch });
    if (res && res.code === 200) return res.data;
    return null;
  }
};

module.exports = api;
