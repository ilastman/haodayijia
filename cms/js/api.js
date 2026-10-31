// CMS API 封装
// 三种调用方式（按优先级）：
// 1) 微信环境（wx.cloud.callFunction）——小程序/微信容器内
// 2) 浏览器 HTTP 网关（fetch）——PC 浏览器访问真实云端
//    在云开发控制台为「httpGateway」云函数开启 HTTP 触发/HTTP 访问服务，
//    把公网 URL 填入 httpGateway（例：https://<envId>.service.tcloudbase.com/httpGateway）。
//    网关内部转发到各云函数，无需为每个函数单独开 HTTP。
// 3) 本地预览模式（mock: true）——纯浏览器演示，数据存 localStorage，无需任何云端环境。
//    登录：admin / admin123；可增删改查、写演示数据、导出。
//    配置 httpGateway 后优先走真实云端；本地预览可随时设回 mock: true。
const API = {
  // 浏览器网关完整 URL（留空则不会走网关）
  httpGateway: 'https://qq511601433-d9g83bbc542c7988a.service.tcloudbase.com/httpGateway',
  // 本地预览开关（仅当非微信环境且 httpGateway 为空时生效）
  mock: true,

  async call(name, data = {}) {
    if (typeof wx !== 'undefined' && wx.cloud) {
      return await wx.cloud.callFunction({ name, data });
    }
    if (this.httpGateway) {
      const resp = await fetch(this.httpGateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data })
      });
      const json = await resp.json();
      return (json && json.result !== undefined) ? json : { result: json };
    }
    if (this.mock) {
      return { result: LOCAL_MOCK(name, data) };
    }
    return { result: { code: 500, msg: '未配置调用通道：请在微信环境打开，或设置 API.httpGateway' } };
  },

  // 上传图片：浏览器用 base64；小程序用临时文件路径
  async uploadImage(fileLike, ext = 'png') {
    if (this.mock && typeof File !== 'undefined' && fileLike instanceof File) {
      try {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(fileLike);
        });
      } catch (e) {
        return '';
      }
    }
    const token = this.getToken();
    let fileBase64 = '';
    if (typeof File !== 'undefined' && fileLike instanceof File) {
      fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(fileLike);
      });
    }
    const payload = fileBase64
      ? { token, fileBase64, ext }
      : { token, filePath: fileLike };
    const res = await this.call('fileUpload', payload);
    const r = res.result || res;
    return (r.data && r.data.url) || '';
  },

  setToken(t) { localStorage.setItem('cms_token', t); },
  getToken() { return localStorage.getItem('cms_token'); },
  clear() { localStorage.removeItem('cms_token'); }
};

/* ---------------- 本地预览模式（mock） ---------------- */

const LS_DB = 'cms_preview_db';

function mockDB() {
  try { return JSON.parse(localStorage.getItem(LS_DB)) || {}; } catch (e) { return {}; }
}
function mockSave(db) {
  try { localStorage.setItem(LS_DB, JSON.stringify(db)); } catch (e) { /* 超出容量忽略 */ }
}
function mockColl(db, name) {
  if (!Array.isArray(db[name])) db[name] = [];
  return db[name];
}
function mockId() {
  return 'mock' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function ok(data, msg) {
  return data === undefined ? { code: 200, msg: msg || '成功' } : { code: 200, msg: msg || '成功', data };
}
function svgImg(text, w, h, bg) {
  const s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w || 640) + '" height="' + (h || 360) + '">' +
    '<rect width="100%" height="100%" fill="' + (bg || '#8D9C8A') + '"/>' +
    '<rect x="18" y="18" width="' + ((w || 640) - 36) + '" height="' + ((h || 360) - 36) + '" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>' +
    '<text x="50%" y="52%" fill="#ffffff" font-size="28" text-anchor="middle">' + text + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

// 仅在集合为空时写入少量演示数据，便于预览各页面
function mockSeed(db) {
  const seeded = [];
  if (!db.homeModule || !db.homeModule.length) {
    db.homeModule = [
      { _id: mockId(), title: '私家团', iconUrl: svgImg('私家团', 160, 160, '#8D9C8A'), desc: '独立用车 随走随停', pageRoute: 'tab:routes?type=私家团', sort: 0, enable: true },
      { _id: mockId(), title: '景区', iconUrl: svgImg('景区', 160, 160, '#A8BFA0'), desc: '精选草原景区', pageRoute: '/pages/scenic/scenic', sort: 1, enable: true },
      { _id: mockId(), title: '酒店', iconUrl: svgImg('酒店', 160, 160, '#B7B0A0'), desc: '甄选住宿', pageRoute: '/pages/hotels/hotels', sort: 2, enable: true }
    ];
    seeded.push('homeModule');
  }
  if (!db.banner || !db.banner.length) {
    db.banner = [
      { _id: mockId(), imageUrl: svgImg('呼伦贝尔大草原', 750, 420, '#7C947E'), jumpRoute: '', sort: 0, enable: true },
      { _id: mockId(), imageUrl: svgImg('阿尔山秋色', 750, 420, '#B59A6B'), jumpRoute: '', sort: 1, enable: true }
    ];
    seeded.push('banner');
  }
  if (!db.scenic || !db.scenic.length) {
    db.scenic = [
      { _id: mockId(), name: '呼伦贝尔大草原', coverImg: svgImg('呼伦贝尔大草原', 640, 400, '#8D9C8A'), imgList: [svgImg('草原 1', 750, 420, '#8D9C8A')], intro: '世界著名草原，风吹草低见牛羊。', detail: '水草丰美、蓝天白云与羊群骏马相映成趣，是内蒙古最具代表性的草原风光。', tags: ['草原', '亲子'], longitude: 0, latitude: 0, enable: true },
      { _id: mockId(), name: '额尔古纳湿地', coverImg: svgImg('额尔古纳湿地', 640, 400, '#6B8E8A'), imgList: [svgImg('湿地', 750, 420, '#6B8E8A')], intro: '亚洲第一湿地，根河蜿蜒。', detail: '根河静静流淌，曲水环抱草甸与白桦林，四季景致各异。', tags: ['湿地', '观景'], longitude: 0, latitude: 0, enable: true }
    ];
    seeded.push('scenic');
  }
  if (!db.hotel || !db.hotel.length) {
    db.hotel = [
      { _id: mockId(), name: '海拉尔草原天际酒店', coverImg: svgImg('海拉尔天际酒店', 640, 400, '#8A8068'), imgList: [svgImg('客房', 750, 420, '#8A8068')], intro: '推窗即是远山与草原的交界线。', detail: '原木与暖沙色调，落地窗外就是呼伦贝尔特有的天际线。', facility: ['接送机', '餐厅', '健身房'], longitude: 0, latitude: 0, enable: true }
    ];
    seeded.push('hotel');
  }
  if (!db.privateGroup || !db.privateGroup.length) {
    db.privateGroup = [
      {
        _id: mockId(), title: '呼伦贝尔草原深度6日私家团', coverImg: svgImg('草原深度6日', 640, 400, '#7C947E'),
        dayCount: 3, highLight: '独立用车，随走随停，深入草原腹地。', detail: '一条把呼伦贝尔经典都串起来的私家团方案。',
        dayList: [
          { dayNum: 1, dayTitle: '海拉尔集合', scenicId: '', hotelId: '', dayContent: '抵达海拉尔，入住酒店自由活动' },
          { dayNum: 2, dayTitle: '莫日格勒河', scenicId: '', hotelId: '', dayContent: '俯瞰九曲十八弯，草原漫步' },
          { dayNum: 3, dayTitle: '额尔古纳湿地', scenicId: '', hotelId: '', dayContent: '湿地栈道日落' }
        ],
        enable: true
      }
    ];
    seeded.push('privateGroup');
  }
  if (!db.inspirationPost || !db.inspirationPost.length) {
    db.inspirationPost = [
      { _id: mockId(), openid: 'mock-user', coverImg: svgImg('草原日落随拍', 480, 640, '#B59A6B'), content: '傍晚把车停在草场边的土路上，看着颜色一点一点沉下去。', postType: 'note', relatedTripId: '', likeNum: 12, commentList: [{ name: '游客A', text: '机位太棒了', likes: 3 }], auditStatus: 1, createTime: Date.now() - 86400000, extend: { title: '草原腹地的一场日落', authorName: '晴天小猪' } },
      { _id: mockId(), openid: 'mock-user', coverImg: svgImg('带娃草原亲子之旅', 640, 400, '#8D9C8A'), content: '带着孩子骑小马、挤牛奶、喂羊羔，草原上的日落是孩子童年最好的礼物。', postType: 'trip', relatedTripId: '', likeNum: 0, commentList: [], auditStatus: 0, createTime: Date.now(), extend: { title: '5天4晚亲子之旅', authorName: '林夕' } }
    ];
    seeded.push('inspirationPost');
  }
  return seeded;
}

function crud(name, action, event) {
  const db = mockDB();
  const c = mockColl(db, name);
  let out;
  switch (action) {
    case 'list':
      out = ok(c.slice());
      break;
    case 'get': {
      const it = c.find(x => x._id === event.id) || null;
      out = it ? ok(it) : { code: 404, msg: '不存在' };
      break;
    }
    case 'add': {
      const doc = Object.assign({}, event.data, { _id: mockId() });
      c.unshift(doc);
      out = ok({ _id: doc._id }, '新增成功');
      break;
    }
    case 'update': {
      const it = c.find(x => x._id === event.id);
      if (it) Object.assign(it, event.data, { _id: event.id });
      out = ok(undefined, it ? '更新成功' : '记录不存在');
      break;
    }
    case 'delete': {
      const idx = c.findIndex(x => x._id === event.id);
      if (idx > -1) c.splice(idx, 1);
      out = ok(undefined, '删除成功');
      break;
    }
    case 'sort': {
      (event.sortList || []).forEach(s => {
        const it = c.find(x => x._id === s.id);
        if (it) it.sort = s.sort;
      });
      out = ok(undefined, '排序成功');
      break;
    }
    default:
      out = { code: 400, msg: '不支持的action' };
  }
  mockSave(db);
  return out;
}

// 本地预览分发：name=云函数名，event=原调用参数
function LOCAL_MOCK(name, event) {
  // 首次使用自动播种演示数据（随后目录标记，不再重复执行）
  if (!localStorage.getItem('cms_preview_seeded')) {
    const db = mockDB();
    mockSeed(db);
    mockSave(db);
    localStorage.setItem('cms_preview_seeded', '1');
  }
  const data = event && event.data;
  switch (name) {
    case 'login': {
      const u = (event && event.username) || '';
      const p = (event && event.password) || '';
      if (u === 'admin' && p === 'admin123') {
        return ok({ token: 'mock-token-' + Date.now(), extend: {} }, '登录成功');
      }
      return { code: 401, msg: '账号或密码错误（本地预览：admin / admin123）' };
    }
    case 'adminInit':
      return ok(undefined, '本地预览管理员已内置（admin / admin123）');
    case 'fileUpload':
      return ok({ fileID: 'mock://' + Date.now(), url: (data && data.fileBase64) || '' }, '上传成功');
    case 'dataSeed': {
      const db = mockDB();
      const seeded = mockSeed(db);
      mockSave(db);
      return ok(undefined, seeded.length ? ('已写入演示数据：' + seeded.join('、')) : '所有集合均已有数据，跳过');
    }
    case 'dataExport': {
      const db = mockDB();
      return ok(db);
    }
    case 'userTripCRUD': {
      const db = mockDB();
      const c = mockColl(db, 'userTrip');
      if (event.action === 'list' || event.action === 'myTrips') {
        return ok(c.slice());
      }
      if (event.action === 'save') {
        const localId = (data && data.id) || '';
        const it = c.find(x => x.extend && x.extend.localId === localId);
        const doc = { _id: it ? it._id : mockId(), openid: 'mock-user', tripName: (data && data.title) || '', dayList: (data && data.plans) || [], createTime: (data && data.savedAt) || Date.now(), isPublish: false, extend: Object.assign({ customTrip: true, localId }, (data && data.extend) || {}) };
        if (it) Object.assign(it, { tripName: doc.tripName, dayList: doc.dayList, extend: doc.extend });
        else c.unshift(doc);
        mockSave(db);
        return ok(undefined, '保存成功');
      }
      return { code: 400, msg: '不支持的action' };
    }
    case 'inspirationPostCRUD': {
      const db = mockDB();
      const c = mockColl(db, 'inspirationPost');
      switch (event.action) {
        case 'publish': {
          const doc = Object.assign({}, data, { _id: mockId(), openid: 'mock-user', likeNum: 0, commentList: [], auditStatus: 0, createTime: Date.now() });
          c.unshift(doc);
          mockSave(db);
          return ok(undefined, '发布成功，等待审核');
        }
        case 'publicList':
          return ok(c.filter(x => x.auditStatus === 1).slice());
        case 'list':
          return ok(c.slice());
        case 'get': {
          const it = c.find(x => x._id === event.id) || null;
          return it ? ok(it) : { code: 404, msg: '不存在' };
        }
        case 'audit': {
          const it = c.find(x => x._id === event.id);
          if (it) it.auditStatus = Number(event.auditStatus) || 0;
          mockSave(db);
          return ok(undefined, '审核成功');
        }
        case 'delete': {
          const idx = c.findIndex(x => x._id === event.id);
          if (idx > -1) c.splice(idx, 1);
          mockSave(db);
          return ok(undefined, '删除成功');
        }
        case 'delComment': {
          const it = c.find(x => x._id === event.id);
          if (it && Array.isArray(it.commentList) && typeof event.commentIndex === 'number') {
            it.commentList.splice(event.commentIndex, 1);
          }
          mockSave(db);
          return ok(undefined, '删除评论成功');
        }
        default:
          return { code: 400, msg: '不支持的action' };
      }
    }
    default: {
      const COLL = { homeModuleCRUD: 'homeModule', bannerCRUD: 'banner', scenicCRUD: 'scenic', hotelCRUD: 'hotel', privateGroupCRUD: 'privateGroup' };
      const collName = COLL[name];
      if (collName) return crud(collName, event.action, event);
      return { code: 400, msg: '不支持的云函数' };
    }
  }
}
