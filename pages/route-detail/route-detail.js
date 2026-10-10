const copy = require('../../utils/copy');
const data = require('../../utils/data');
const daysMap = require('../../utils/days');
const routeExtra = require('../../utils/route-extra');
const { ph } = require('../../utils/util');
const { isFavorite, toggleFavorite } = require('../../utils/util');

const DAY_TAGS = ['车程约2.5h', '游玩约3h', '轻度徒步', '老少皆宜'];

// 每日行程 swiper 预留高度(rpx)，由各线路所有单日内容实际渲染高度测量得出，
// 去除贴心提示下方的固定大段留白，同时保证任意一日均不裁剪。
const SWIPER_H = {
  'r001': 2078, 'r002': 1904, 'r003': 1822, 'r004': 1678,
  'r005': 1640, 'r006': 1822, 'r007': 1822, 'r008': 1552
};

const DEFAULT_EXTRA = {
  slogan: '青草接天，风也自由',
  labels: ['小众秘境', '私家专属', '随走随停'],
  people: '不限人群',
  pace: '节奏舒缓',
  season: '6-9 月',
  imgScenics: ['s1', 's2', 's3', 's5']
};

function buildPerks(route, imgScenics) {
  return (route.highlights || []).slice(0, 4).map((text, i) => {
    const sc = data.getScenic(imgScenics[i] || '');
    return {
      text,
      spot: sc ? sc.id : '',
      img: sc ? sc.cover : ph(route.title + ' · 权益' + (i + 1), 640, 360)
    };
  });
}

// 兜底：未精编的线路也生成沉浸式结构，保证模块永不空白
function fallbackDays(route) {
  return route.itinerary.map(d => {
    const times = ['09:00', '11:00', '14:00', '16:30', '18:30'];
    const nodes = (d.spots || []).slice(0, 5).map((s, i) => {
      const sc = data.scenics.find(x => x.name.indexOf(s) > -1 || s.indexOf(x.name) > -1);
      const parts = sc
        ? [{ v: '抵达游览', spot: sc.id }, { v: s === sc.name ? '，按当日节奏慢慢走' : `${sc.name}一带，${s === sc.name ? '走走停停' : '串起' + s}` }]
        : [{ v: s + '，按当日节奏慢慢走' }];
      return { time: times[i] || '--:--', parts, thumb: sc ? sc.cover : ph(s + ' · 实拍', 260, 180) };
    });
    const hotel = data.hotels.find(h => d.hotel.indexOf(h.name.slice(0, 2)) > -1) ||
      data.hotels.find(h => d.hotel.replace(/[^\u4e00-\u9fa5]/g, '').indexOf(h.area.replace(/[^\u4e00-\u9fa5]/g, '')) > -1) || null;
    return {
      d: d.d, scene: d.scene, cover: ph(route.title + ' · 第' + d.d + '天', 750, 440),
      tags: DAY_TAGS.slice(),
      nodes,
      perks: route.type === '私家团'
        ? [{ parts: [{ v: '独立用车，随走随停，游览时间与司机协商微调' }] }, { parts: [{ v: '司机兼向导全程讲解，行程内已含首道门票' }] }]
        : [{ parts: [{ v: '持证导游全程带队，固定发班准点出发' }] }, { parts: [{ v: '景区首道门票已含，无二次收费' }] }],
      stay: hotel ? { hotelId: hotel.id, name: '', note: d.hotel + '，具体位置与房型以酒店页为准。' } : null,
      meals: d.meals || '按行程标注用餐',
      tips: (route.notices && route.notices.tips ? [route.notices.tips[0]] : ['请以当日实际安排为准。'])
    };
  });
}

Page({
  data: {
    d: copy.detail,
    route: null,
    days: [],
    activeDay: 0,
    extra: DEFAULT_EXTRA,
    perks: [],
    swCls: '',
    faved: false,
    consultVisible: false
  },

  onLoad(options) {
    const route = data.getRoute(options.id || '');
    if (!route) {
      wx.showToast({ title: '线路不存在或已下架', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    const days = (daysMap[route.id] || fallbackDays(route)).map(d => {
      const copyDay = Object.assign({}, d);
      if (copyDay.stay) {
        const ho = data.getHotel(copyDay.stay.hotelId);
        if (ho) {
          copyDay.stay = {
            hotelId: ho.id,
            name: ho.name,
            image: ho.image,
            note: copyDay.stay.note || ''
          };
        }
      }
      return copyDay;
    });
    const reviews = route.reviews.map(r => {
      const full = '★★★★★';
      return Object.assign({}, r, {
        starStr: full.substring(0, r.stars) + full.substring(r.stars).replace(/./g, '☆')
      });
    });
    const extra = Object.assign({}, DEFAULT_EXTRA, routeExtra[route.id] || {});
    const perks = buildPerks(route, extra.imgScenics);
    this.setData({
      route: Object.assign({}, route, { reviews }),
      days,
      extra,
      perks,
      swCls: SWIPER_H[route.id] ? 'rd-swiper-' + route.id : '',
      faved: isFavorite(route.id)
    });
    wx.setNavigationBarTitle({ title: route.title });
  },

  onDayChange(e) {
    this.setData({ activeDay: e.detail.current });
  },

  onDayTap(e) {
    this.setData({ activeDay: Number(e.currentTarget.dataset.idx) });
  },

  onDayPrev() {
    this.setData({ activeDay: Math.max(0, this.data.activeDay - 1) });
  },

  onDayNext() {
    const max = this.data.days.length - 1;
    this.setData({ activeDay: Math.min(max, this.data.activeDay + 1) });
  },

  goScenic(e) {
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + e.currentTarget.dataset.id });
  },

  goHotel(e) {
    wx.navigateTo({ url: '/pages/hotel-detail/hotel-detail?id=' + e.currentTarget.dataset.id });
  },

  onFavorite() {
    const faved = toggleFavorite(this.data.route.id);
    this.setData({ faved });
    wx.showToast({ title: faved ? copy.detail.favorited : '已取消收藏', icon: 'none', duration: 1200 });
  },

  openConsult() {
    this.setData({ consultVisible: true });
  },

  onConsultClose() {
    this.setData({ consultVisible: false });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.src;
    wx.previewImage({ current, urls: this.data.route.images });
  }
});