const { JSDOM } = require('jsdom');

const results = [];
function ok(cond, msg) {
  results.push((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const path = require('path');
  const previewFile = path.join(__dirname, '..', 'preview.html');
  const dom = await JSDOM.fromFile(previewFile, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.scrollTo = () => {};
  const doc = window.document;

  await new Promise(res => window.addEventListener('load', res));
  await sleep(300);

  const $ = s => doc.querySelector(s);
  const $$ = s => Array.from(doc.querySelectorAll(s));
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const input = (el, val) => {
    el.value = val;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  // 1. 首页
  ok($('#screen .pv-swiper-wrap'), '首页轮播渲染');
  ok($('#screen').textContent.includes('私家团'), '首页导航文案');
  ok($('#screen').textContent.includes('热门'), '首页热门板块');
  ok($$('.pv-tab').length === 4, 'tabbar 4 项');
  ok($('#nav-title').textContent.length > 0, '首页标题: ' + $('#nav-title').textContent);
  ok($('#nav-back').style.visibility === 'hidden', '首页隐藏返回键');

  // 2. 首页 -> 线路详情
  const card = $('#screen .rc');
  ok(!!card, '首页线路卡片存在');
  if (card) {
    click(card);
    await sleep(50);
    ok($('#screen').textContent.includes('每日行程安排'), '进入线路详情(每日行程)');
    ok($('#nav-title').textContent.includes('私家团'), '详情标题: ' + $('#nav-title').textContent);
    ok($('#nav-back').style.visibility === 'visible', '详情显示返回键');

    // 2a. 杂志种草区 + 基础信息 + 页尾商业化
    ok(!!$('#screen .hero-img') && !!$('#screen .hero-title') && $('#screen .hero-title').textContent.includes('私家团'), '首屏 16:9 主视觉+居中标题');
    ok($('#screen .hero-slogan').textContent.length > 0, '首屏 slogan 存在');
    const storyNote = $('#screen .story-note');
    ok(!!storyNote, '叙事文案存在');
    ok(storyNote.textContent.length <= 200, '叙事文案 200 字内: ' + storyNote.textContent.length);
    ok($$('#screen .story-label').length === 3, '叙事标签 3 个');
    ok($$('#screen .perk').length === 4 && $$('#screen .perk-img').length === 4, '权益图 4 张 + 文案 4 条');
    ok($$('#screen .info-item').length === 4 && $('#screen').textContent.includes('适宜人群'), '基础信息栏 4 项');
    ok(!$('#screen .story-zone').textContent.includes('¥'), '上部杂志区无价格');
    ok($('#screen .commercial').textContent.includes('¥') && !!$('#screen .ref-price'), '价格仅出现在页尾商业区');
    ['热销', '爆款', '特价', '一价全含', '限时特惠'].forEach(m => {
      ok(!$('#screen').textContent.includes(m), '本页无营销标签: ' + m);
    });
    ok(!$('#screen .fav-btn') && !$('#screen .bottom-bar'), '已取消悬浮栏与收藏按钮');
    ok(!!$('#screen .consult-line-btn'), '页尾细描边预约按钮存在');
  }

  // 2b. 每日行程沉浸式模块
  const rdTabs = $$('#screen .rd-tab');
  ok(rdTabs.length === 6, '每日行程 tab 数 6: ' + rdTabs.length);
  ok($$('#screen .rd-tab.on')[0].textContent.trim() === '第1天', '默认展开第1天');
  ok(!$('#screen .rd-cover') && !!$('#screen .rd-scene-line'), '无首屏大图，保留纤细场景小标题');
  ok($('#screen .rd-scene-line').textContent.indexOf('第1天') === 0, '场景小标题含第N天: ' + $('#screen .rd-scene-line').textContent);
  ok(!!$('#screen .rd-swiper'), 'swiper 翻页容器存在');
  ok($$('#screen .rd-swiper .pv-slide').length >= 6, 'swiper 每页一天: ' + $$('#screen .rd-swiper .pv-slide').length);
  ok($('#screen').textContent.includes('今日专属体验') && $('#screen').textContent.includes('当日住宿') && $('#screen').textContent.includes('当日美食') && $('#screen').textContent.includes('贴心提示'), '当日四模块标题齐全');
  ok($('#screen').textContent.includes('08:30'), '时间线含时间节点');
  ok($$('#screen .rd-link').length > 0, '景区/酒店名可点击链接存在');
  const scenicLink = $$('#screen .rd-link').find(e => e.textContent.trim() === '成吉思汗广场');
  ok(!!scenicLink, '行程时间线含景区名链接(成吉思汗广场)');
  if (scenicLink) {
    click(scenicLink);
    await sleep(100);
    ok($('#nav-title').textContent.trim() === '成吉思汗广场', '景区链接跳景区详情: ' + $('#nav-title').textContent);
    click($('#nav-back'));
    await sleep(80);
    ok($('#screen').textContent.includes('每日行程安排'), '景区返回私家团详情原位置');
  }
  const hotelName = $$('#screen .rd-s-name')[0];
  ok(!!hotelName && hotelName.textContent.trim() === '海拉尔草原天际酒店', '当日住宿酒店卡: ' + (hotelName ? hotelName.textContent.trim() : ''));
  if (hotelName) {
    click(hotelName);
    await sleep(100);
    ok($('#screen').textContent.includes('酒店环境'), '酒店链接跳酒店详情');
    click($('#nav-back'));
    await sleep(80);
    ok($('#screen').textContent.includes('每日行程安排'), '酒店返回私家团详情原位置');
  }
  const day3 = $$('#screen .rd-tab').find(e => e.textContent.trim() === '第3天');
  click(day3);
  await sleep(60);
  ok($$('#screen .rd-tab.on')[0].textContent.trim() === '第3天', '点击切到第3天');
  const arrows = $$('#screen .rd-arrow');
  click(arrows[1]);
  await sleep(60);
  ok($$('#screen .rd-tab.on')[0].textContent.trim() === '第4天', '右箭头切到第4天');
  click(arrows[1]);
  await sleep(60);
  ok($$('#screen .rd-tab.on')[0].textContent.trim() === '第5天', '右箭头续切第5天');
  click(arrows[0]);
  await sleep(60);
  ok($$('#screen .rd-tab.on')[0].textContent.trim() === '第4天', '左箭头回退第4天');

  // 3. 详情页 -> 咨询弹窗：先校验，后提交
  const consultBtn = $('#screen .consult-line-btn') || $$('#screen button').find(b => b.textContent.includes('咨询'));
  ok(!!consultBtn, '详情咨询按钮');
  if (consultBtn) {
    click(consultBtn);
    await sleep(50);
    ok(!!$('#screen .mask'), '咨询弹窗打开');
    const nameIn = $$('#screen .mask input').find(i => i.placeholder && i.placeholder.includes('姓'));
    const phoneIn = $$('#screen .mask input').find(i => i.placeholder && i.placeholder.includes('手'));
    ok(!!nameIn && !!phoneIn, '弹窗表单字段存在');
    if (nameIn && phoneIn) {
      input(phoneIn, '13800138000');
      click($('#screen .mask .submit'));
      await sleep(50);
      const err1 = $('#screen .error');
      ok(!!err1 && err1.textContent.trim().length > 0, '姓名必填校验触发: ' + (err1 ? err1.textContent.trim() : ''));
      input(nameIn, '张三');
      click($('#screen .mask .submit'));
      await sleep(50);
      let recs = [];
      try { recs = JSON.parse(window.localStorage.getItem('consultRecords') || '[]'); }
      catch (e) { recs = window.__preview.wx.getStorageSync('consultRecords') || []; }
      ok(recs.length === 1 && recs[0].name === '张三', '留资入库 records=' + recs.length);
      ok(!$('#screen .mask'), '提交后弹窗关闭');
    }
  }

  // 4. 返回首页
  click($('#nav-back'));
  await sleep(50);
  ok($('#screen').textContent.includes('热门'), '返回首页');

  // 5. 线路 tab -> 页头/分类/卡片/更多筛选/底部引导
  click($$('.pv-tab')[1]);
  await sleep(80);
  ok(!!$('#screen .header-title') && $('#screen .header-title').textContent === '呼伦贝尔私享线路', '页头标题');
  ok($('#screen .header-slogan').textContent.includes('随走随停'), '页头 slogan');
  ok($$('#screen .cat').length === 6, '分类标签 6 个: ' + $$('#screen .cat').length);
  const fc = $$('#screen .route-card')[0];
  ok(!!fc, '大封面纵向卡片存在');
  ok(fc.textContent.includes('阿尔山'), '季节推荐首卡为秋线: ' + fc.textContent.slice(0, 26));
  ok(fc.querySelector('.rc-cover'), '卡片大封面图(文字在下方)');
  ok(fc.textContent.includes('天') && fc.textContent.includes('晚'), '卡片含行程天数');
  ok(!$('#screen').textContent.includes('¥'), '页面不展示任何价格');
  ['热销', '爆款', '特惠', '推荐', '限时'].forEach(m => {
    ok(!$('#screen').textContent.includes(m), '页面无营销角标: ' + m);
  });
  ok(!$('#screen .tag') && !$('#screen .type-badge'), '无营销标签元素');
  ok(!!$('#screen .more-toggle') && !$('#screen .more-panel'), '更多筛选默认收起');
  click($('#screen .more-toggle'));
  await sleep(50);
  ok(!!$('#screen .more-panel'), '更多筛选展开');
  const dayChip = $$('#screen .mg-chip').find(e => e.textContent.trim() === '1-3天');
  ok(!!dayChip, '更多筛选含天数选项');
  if (dayChip) {
    click(dayChip);
    await sleep(50);
    ok($$('#screen .route-card').length === 2, '天数筛选 1-3天 生效: ' + $$('#screen .route-card').length);
  }
  click($$('#screen .mg-chip').find(e => e.textContent.trim() === '全部'));
  await sleep(50);
  ok($$('#screen .route-card').length === 8, '重置天数后全部线路: ' + $$('#screen .route-card').length);
  click($$('#screen .route-card')[0]);
  await sleep(80);
  ok($('#screen').textContent.includes('每日行程安排'), '卡片点击进入私家团详情');
  click($('#nav-back'));
  await sleep(80);
  ok(!!$('#screen .route-card'), '详情返回线路列表');
  click($('#screen .outline-btn'));
  await sleep(80);
  ok($('#screen').textContent.includes('私人定制'), '底部按钮跳转私人定制');
  click($('#nav-back'));
  await sleep(80);
  ok(!!$('#screen .journal-link'), '灵感广场引导存在');
  click($('#screen .journal-link'));
  await sleep(80);
  ok($('#screen').textContent.includes('灵感广场'), '灵感广场引导跳转 Tab');

  // 6. 灵感广场 tab -> 双列瀑布流 -> 分类 -> 点赞 -> 详情
  click($$('.pv-tab')[2]);
  await sleep(80);
  ok($('#screen').textContent.includes('灵感广场'), '切到灵感广场页');
  ok($$('#screen .col').length === 2, '双列瀑布流(左右两列)');
  ok($$('#screen .card').length === 16, '全部 16 条(10方案+6笔记): ' + $$('#screen .card').length);
  ok($$('#screen .card-type').length === 16, '每张卡片带类型标签');
  ok($$('#screen .cat').length === 7, '分类标签(全部+6): ' + $$('#screen .cat').length);
  const planCat = $$('#screen .cat').find(e => e.textContent.trim() === '行程方案');
  const noteCat = $$('#screen .cat').find(e => e.textContent.trim() === '旅行笔记');
  ok(!!planCat && !!noteCat, '含行程方案/旅行笔记分类');
  click(planCat);
  await sleep(50);
  ok($$('#screen .card').length === 10, '行程方案筛选 10 条: ' + $$('#screen .card').length);
  ok($$('#screen .card-type.note').length === 0, '行程方案列表无笔记');
  click(noteCat);
  await sleep(50);
  ok($$('#screen .card').length === 6, '旅行笔记筛选 6 条: ' + $$('#screen .card').length);
  ok($$('#screen .card-type.note').length === 6, '笔记卡片全部标记旅行笔记');
  click($$('#screen .cat').find(e => e.textContent.trim() === '私家团'));
  await sleep(50);
  ok($$('#screen .card').length === 2, '私家团筛选 2 条(私家团方案映射): ' + $$('#screen .card').length);
  click($$('#screen .cat')[0]);
  await sleep(50);
  ok($$('#screen .card').length === 16, '广场切回全部: ' + $$('#screen .card').length);
  const firstCard = $('#screen .card');
  const likeNum0 = parseInt(firstCard.querySelector('.card-num').textContent, 10);
  click(firstCard.querySelector('.card-like'));
  await sleep(40);
  const freshCard = $('#screen .card');
  ok(freshCard.querySelector('.card-heart').className.indexOf('on') > -1, '卡片点赞点亮');
  ok(parseInt(freshCard.querySelector('.card-num').textContent, 10) === likeNum0 + 1, '卡片点赞数 +1');
  ok($$('#screen .card-avatar').length === 16, '卡片带发布人头像');
  click(freshCard);
  await sleep(80);
  ok($('#screen').textContent.includes('行程亮点'), '进入行程详情(行程亮点)');
  ok($('#screen').textContent.includes('每日行程'), '行程详情含每日行程');
  ok($$('#screen .comment').length === 3, '行程详情预置评论 3 条: ' + $$('#screen .comment').length);
  const actBtns = $$('#screen .bar .act');
  ok(actBtns.length === 2, '底部互动栏 2 个操作');
  click(actBtns[0]);
  await sleep(40);
  ok($$('#screen .bar .act')[0].className.indexOf('on') > -1, '详情点赞点亮');
  const ci = $('#screen .bar-input');
  ci.value = '太棒了，直接抄作业！';
  ci.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(30);
  ci.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(40);
  ok($$('#screen .comment').length === 4, '评论发送 3->4: ' + $$('#screen .comment').length);

  // 6b. 照此方案定制 -> 预填
  ok(!!$('#screen .cta'), '详情悬浮定制按钮存在');
  click($('#screen .cta'));
  await sleep(80);
  ok($('#screen').textContent.includes('私人定制行程'), '照此方案定制进入定制页');
  ok($$('#screen .day-chip').length === 5, '分享 5 天预填定制天数: ' + $$('#screen .day-chip').length);
  ok($$('#screen .sel-item').length === 1, '第1天预填景区 1 项');
  click($('#nav-back'));
  await sleep(60);
  ok($('#screen').textContent.includes('行程亮点'), '定制返回行程详情');
  click($('#nav-back'));
  await sleep(60);

  // 6b2. 旅行笔记卡片 -> 笔记详情
  ok($('#screen').textContent.includes('灵感广场'), '行程详情返回灵感广场');
  const noteCard = $$('#screen .card').find(e => e.querySelector('.card-type') && e.querySelector('.card-type').textContent.trim() === '旅行笔记');
  ok(!!noteCard, '存在旅行笔记卡片');
  click(noteCard);
  await sleep(80);
  ok($('#screen').textContent.includes('游记'), '进入笔记详情(游记)');
  ok($$('#screen .gallery-img').length === 3, '笔记随拍轮播 3 张: ' + $$('#screen .gallery-img').length);
  ok($$('#screen .para').length >= 3, '笔记正文分段展示');
  ok($('#nav-back').style.visibility === 'visible', '笔记详情显示返回');
  const nAct = $$('#screen .bar .act');
  ok(nAct.length === 2, '笔记底部互动 2 个操作');
  click(nAct[0]);
  await sleep(40);
  ok($$('#screen .bar .act')[0].className.indexOf('on') > -1, '笔记点赞点亮');
  click($('#nav-back'));
  await sleep(60);
  ok($('#screen').textContent.includes('灵感广场'), '笔记详情返回广场');

  // 6c. 首页 -> 旅行攻略（攻略已移出 tab）
  click($$('.pv-tab')[0]);
  await sleep(80);
  const guideNav = $$('#screen .nav-item').find(e => /旅行攻略/.test(e.textContent));
  ok(!!guideNav, '首页旅行攻略导航存在');
  click(guideNav);
  await sleep(80);
  ok($('#screen').textContent.includes('攻略'), '进入攻略列表');
  const article = $('#screen .article');
  ok(!!article, '攻略文章卡片');
  if (article) {
    click(article);
    await sleep(60);
    ok(!!$('#screen .body'), '进入攻略详情(.body), 标题=' + $('#nav-title').textContent);
    click($('#nav-back'));
    await sleep(50);
    ok(!!$('#screen .article'), '攻略详情返回列表');
  }
  click($('#nav-back'));
  await sleep(50);
  ok($('#screen').textContent.includes('热门'), '攻略返回首页');

  // 7. 我的 -> 订单
  click($$('.pv-tab')[3]);
  await sleep(80);
  ok($('#screen').textContent.includes('我的') || $('#screen .profile'), '切到我的页');
  const orderRow = $$('#screen .menu-item').find(e => /订单/.test(e.textContent));
  ok(!!orderRow, '我的订单入口存在');
  if (orderRow) {
    click(orderRow);
    await sleep(60);
    ok($('#screen').textContent.includes('订单') && $('#nav-back').style.visibility === 'visible', '进入订单页');
    click($('#nav-back'));
    await sleep(50);
  }

  // 8. 我的行程入口
  const tripRow = $$('#screen .menu-item').find(e => /我的行程/.test(e.textContent));
  ok(!!tripRow, '我的行程入口存在(原我的收藏)');
  ok(!$$('#screen .menu-item').find(e => /我的收藏/.test(e.textContent)), '菜单已无我的收藏');
  if (tripRow) {
    click(tripRow);
    await sleep(60);
    ok($('#nav-back').style.visibility === 'visible', '进入我的行程页');
    ok($('#screen').textContent.indexOf('还没有保存的定制行程') > -1, '我的行程空状态');
    click($('#nav-back'));
    await sleep(50);
  }

  // 9. 刷新
  click($('#btn-refresh'));
  await sleep(80);
  ok($('#screen').textContent.length > 20, '刷新当前页正常');

  // 10. 回首页
  click($$('.pv-tab')[0]);
  await sleep(80);
  ok($('#screen').textContent.includes('热门'), '切回首页');

  // 11. 首页导航 6 项顺序
  const navLabels = $$('#screen .nav-item .nav-label').map(e => e.textContent.trim());
  ok(navLabels.length === 6, '首页导航 6 项: got ' + navLabels.join(','));
  ok(navLabels.join(',') === '私家团,拼团,景区,酒店,旅行攻略,私人定制', '导航顺序正确');

  // 12. 景区列表 -> 筛选 -> 详情
  const scenicNav = $$('#screen .nav-item').find(e => /景区/.test(e.textContent));
  click(scenicNav);
  await sleep(80);
  ok($('#screen').textContent.includes('呼伦贝尔景区'), '进入景区列表');
  ok($$('#screen .cat').length === 10, '景区分类标签(全部+9): ' + $$('#screen .cat').length);
  ok($$('#screen .scenic').length === 21, '景区列表全部 21 项');
  click($$('#screen .cat').find(e => e.textContent.trim() === '满洲里'));
  await sleep(50);
  ok($$('#screen .scenic').length === 5 && $('#screen').textContent.includes('套娃广场'), '筛选满洲里生效(5项): ' + $$('#screen .scenic').length);
  click($$('#screen .cat')[0]);
  await sleep(50);
  ok($$('#screen .scenic').length === 21, '切回全部');
  const sItem = $('#screen .scenic');
  click(sItem);
  await sleep(80);
  ok($('#screen').textContent.includes('景区介绍'), '进入景区详情');
  ok($$('#screen .gallery-img').length === 3, '景区轮播 3 张');
  ok($('#nav-back').style.visibility === 'visible', '景区详情显示返回');
  click($('#nav-back'));
  await sleep(50);
  click($('#nav-back'));
  await sleep(50);
  ok($('#screen').textContent.includes('热门'), '返回首页');

  // 12b. 酒店列表 -> 查看详情（进该酒店详细介绍，不出咨询弹窗）-> 详情咨询定制仍可用
  const hotelNav = $$('#screen .nav-item').find(e => /酒店/.test(e.textContent));
  ok(!!hotelNav, '首页酒店导航存在');
  click(hotelNav);
  await sleep(80);
  ok($('#screen').textContent.includes('精选草原沿线住宿'), '进入酒店列表');
  ok($$('#screen .hotel').length === 8, '酒店列表 8 项');
  const bookBtns = $$('#screen .book-btn');
  ok(bookBtns.length === 8, '酒店列表查看详情 8 个');
  ok(bookBtns.every(b => b.textContent.trim() === '查看详情'), '按钮文案为查看详情');
  ok(!$('#screen').textContent.includes('预订咨询'), '列表不再出现预订咨询');
  ok($('#screen').textContent.indexOf('¥') === -1, '列表不展示金额');
  ok(!$('#screen').textContent.includes('起 / 晚'), '列表不展示每晚价格');
  const places = $$('#screen .hotel-place').map(e => e.textContent.trim());
  ok(places.length === 8 && places[0] === '海拉尔' && places.indexOf('满洲里') >= 0, '原价位展示地区: ' + places.join(','));
  click(bookBtns[0]);
  await sleep(80);
  ok(!$('#screen .mask'), '查看详情不打开咨询弹窗');
  ok($('#screen').textContent.includes('酒店环境'), '查看详情进入酒店详情');
  ok($('#screen').textContent.includes('酒店位于海拉尔市区北端高地'), '详情展示该酒店详细介绍');
  ok($('#screen').textContent.includes('房型特色') && $('#screen').textContent.includes('周边位置'), '详情含房型/位置板块');
  ok($$('#screen .gallery-img').length === 3, '酒店轮播 3 张');
  ok($('#nav-back').style.visibility === 'visible', '酒店详情显示返回');
  ok($('#screen').textContent.indexOf('¥') === -1, '详情页不展示价格');
  const consultBtn2 = $('#screen .bottom-bar .consult-btn');
  ok(!!consultBtn2, '详情咨询定制按钮');
  click(consultBtn2);
  await sleep(50);
  ok(!!$('#screen .mask'), '酒店详情咨询弹窗打开');
  const nameIn2 = $$('#screen .mask input').find(i => i.placeholder && i.placeholder.includes('姓'));
  const phoneIn2 = $$('#screen .mask input').find(i => i.placeholder && i.placeholder.includes('手'));
  ok(!!nameIn2 && !!phoneIn2, '酒店弹窗表单字段存在');
  if (nameIn2 && phoneIn2) {
    input(nameIn2, '王五');
    input(phoneIn2, '13700137000');
    click($('#screen .mask .submit'));
    await sleep(50);
    let recs3 = [];
    try { recs3 = JSON.parse(window.localStorage.getItem('consultRecords') || '[]'); }
    catch (e) { recs3 = window.__preview.wx.getStorageSync('consultRecords') || []; }
    const rh = recs3.find(r => r.name === '王五' && (r.routeTitle || '').indexOf('酒店：') === 0);
    ok(!!rh, '酒店留资入库 routeTitle 含"酒店："');
    ok(!$('#screen .mask'), '酒店提交后弹窗关闭');
  }
  click($('#nav-back'));
  await sleep(50);
  ok($('#screen').textContent.includes('精选草原沿线住宿'), '酒店详情返回列表');
  click($('#nav-back'));
  await sleep(50);
  ok($('#screen').textContent.includes('热门'), '返回首页');

  // 13. 私人定制导航
  const customNav = $$('#screen .nav-item').find(e => /私人定制/.test(e.textContent));
  ok(!!customNav, '私人定制导航存在');
  click(customNav);
  await sleep(80);
  ok($('#screen').textContent.includes('私人定制行程'), '进入私人定制页');
  ok($$('#screen .day-chip').length === 3, '默认 3 天标签');

  // 14. 天数切换
  click($$('#screen .chip').find(e => e.textContent.trim() === '5天'));
  await sleep(50);
  ok($$('#screen .day-chip').length === 5, '切换 5 天 -> 5 个标签');
  click($$('#screen .chip').find(e => /自定义/.test(e.textContent)));
  await sleep(30);
  const daysIn = $('#screen .days-input');
  ok(!!daysIn, '自定义天数输入框出现');
  input(daysIn, '4');
  await sleep(50);
  ok($$('#screen .day-chip').length === 4, '自定义 4 天生效');

  // 15. 第2天选择景区
  click($$('#screen .day-chip')[1]);
  await sleep(30);
  click($('#screen .add-btn'));
  await sleep(50);
  ok(!!$('#screen .sheet'), '景区选择面板打开');
  ok($('#screen .sheet-title').textContent.includes('选择景区'), '面板标题为景区');
  click($$('#screen .opt').find(e => /呼伦贝尔大草原/.test(e.textContent)));
  await sleep(40);
  click($$('#screen .opt').find(e => /莫日格勒河/.test(e.textContent)));
  await sleep(40);
  ok($$('#screen .opt.on').length === 2, '已选中 2 个景区');
  click($('#screen .sheet-confirm'));
  await sleep(50);
  ok(!$('#screen .sheet'), '面板关闭');
  ok($$('#screen .sel-item').length === 2, '第2天已选列表 2 项');
  const sum0 = $('#screen .summary').textContent;
  ok(/已选景区\s*2/.test(sum0) && /已选酒店\s*0/.test(sum0), '汇总计数: ' + sum0.trim());

  // 16. 拖动排序（鼠标模拟：mousedown+mousemove+mouseup）
  let selItems = $$('#screen .sel-item');
  const name0 = selItems[0].querySelector('.sel-name').textContent;
  selItems[0].dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  doc.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 72 }));
  await sleep(30);
  doc.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 72 }));
  await sleep(40);
  selItems = $$('#screen .sel-item');
  ok(selItems.length === 2 && selItems[0].querySelector('.sel-name').textContent !== name0,
    '拖动后顺序变化: ' + name0 + ' -> ' + selItems[0].querySelector('.sel-name').textContent);

  // 17. 上移/下移按钮 + 大数据集边界
  const namesBefore = $$('#screen .sel-item .sel-name').map(e => e.textContent.trim());
  click($$('#screen .op-btn').find(e => e.textContent.trim() === '下移'));
  await sleep(40);
  const namesAfter = $$('#screen .sel-item .sel-name').map(e => e.textContent.trim());
  ok(namesBefore.join(',') !== namesAfter.join(','), '下移按钮调序: ' + namesBefore.join(',') + ' => ' + namesAfter.join(','));

  // 18. 当日酒店单选（可选/取消）
  click($$('#screen .add-btn')[1]);
  await sleep(50);
  ok(!!$('#screen .sheet') && $('#screen .sheet-title').textContent.includes('酒店'), '酒店面板打开');
  click($$('#screen .opt')[0]);
  await sleep(40);
  ok($$('#screen .opt.on').length === 1, '酒店单选已选');
  click($$('#screen .opt')[0]);
  await sleep(40);
  ok($$('#screen .opt.on').length === 0, '再点取消酒店');
  click($$('#screen .opt')[0]);
  await sleep(40);
  click($('#screen .sheet-confirm'));
  await sleep(50);
  ok(!!$('#screen .hotel-sel'), '当日酒店已展示');
  const sum1 = $('#screen .summary').textContent;
  ok(/已选酒店\s*1/.test(sum1), '汇总酒店计数: ' + sum1.trim());

  // 19. 备注 + 日期
  const note = $('#screen textarea.note');
  input(note, '想看日落');
  await sleep(30);
  const di = $('#screen .pv-date-input');
  ok(!!di, '日期 input 存在');
  di.value = '2026-08-01';
  di.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(30);
  ok($('#screen').textContent.includes('2026-08-01'), '日期已选并展示');

  // 20. 生成我的专属行程 -> 专属行程预览页
  click($('#screen .bottom-bar .submit-btn'));
  await sleep(120);
  ok($('#nav-title').textContent.includes('你的专属行程'), '进入专属行程预览页: ' + $('#nav-title').textContent);
  const heroTitle = $('#screen .cp-hero-title').textContent;
  ok(heroTitle.includes('你的专属呼伦贝尔') && heroTitle.includes('4天行程'), '首屏标题正确: ' + heroTitle);
  ok($('#screen .cp-hero-slogan').textContent.trim().length > 0, '首屏 slogan 存在');
  ok($$('#screen .cp-hero-img').length >= 1, '首屏拼合景区图 >= 1');
  ok($$('#screen .cp-day').length === 4, '预览按天 4 天模块');
  ok($$('#screen .cp-day')[0].textContent.indexOf('自由安排') > -1, '空的一天显示自由安排');
  const d1 = $$('#screen .cp-day')[1].textContent;
  ok(d1.indexOf('呼伦贝尔大草原') > -1 && d1.indexOf('莫日格勒河') > -1, '第2天景区展示');
  ok(d1.indexOf('海拉尔草原天际酒店') > -1, '第2天酒店展示');
  ok(d1.indexOf('想看日落') > -1, '第2天备注展示');
  ok(!$('#screen .mask'), '预览页未自动弹出留资');
  ok($('#screen').textContent.indexOf('¥') === -1, '预览页无价格信息');
  ok($('#screen').textContent.indexOf('游客评价') === -1, '预览页无游客评价板块');

  // 20.1. 基础信息标签区（按天数与出行月份自动匹配）
  const infoItems = $$('#screen .info-item');
  ok(infoItems.length === 4, '基础信息标签 4 项');
  const infoVals = $$('#screen .info-item').map(e => e.textContent.trim());
  ok(infoVals[0].indexOf('总天数') > -1 && infoVals[1].indexOf('适宜人群') > -1 && infoVals[2].indexOf('行程节奏') > -1 && infoVals[3].indexOf('出行季节') > -1, '标签四项名称: ' + infoVals.join('|'));
  const infoV = $$('#screen .info-v').map(e => e.textContent.trim());
  ok(infoV[0] === '4天' && infoV[1].indexOf('亲子家庭') > -1 && infoV[2].indexOf('松紧有度') > -1 && infoV[3] === '盛夏草原',
    '标签内容自动匹配: ' + infoV.join('|'));

  // 20.2. 总体温馨提示 + 出行说明
  ok($('#screen').textContent.indexOf('温馨提示') > -1, '总体温馨提示板块存在');
  ok($$('#screen .cp-tips .rd-note-line').length >= 4, '温馨提示内容 >= 4 条');
  ok($('#screen').textContent.indexOf('自助行程规划') > -1, '出行说明顶部小字说明');
  ['费用包含', '费用不含', '出行须知', '退改政策'].forEach(t => ok($('#screen').textContent.indexOf(t) > -1, '出行说明含' + t));
  ok($$('#screen .cp-travel .chip').length >= 1, '出行须知装备建议 chips');
  ok($$('#screen .cp-travel .sec-item').length >= 6, '出行说明条款项 >= 6');

  // 20a. 景区/酒店可点跳详情并返回预览页
  click($$('#screen .cp-spot')[0]);
  await sleep(80);
  ok($('#screen').textContent.includes('呼伦贝尔大草原'), '点景区进入详情页');
  click($('#nav-back'));
  await sleep(80);
  ok($('#nav-title').textContent.includes('你的专属行程'), '景区详情返回预览页');
  click($('#screen .cp-hotel'));
  await sleep(80);
  ok($('#screen').textContent.includes('海拉尔草原天际酒店'), '点酒店进入详情页');
  click($('#nav-back'));
  await sleep(80);
  ok($('#nav-title').textContent.includes('你的专属行程'), '酒店详情返回预览页');

  // 20b. 保存到我的行程
  const saveBtn = $$('#screen .cp-btn').find(e => /保存到我的行程/.test(e.textContent));
  ok(!!saveBtn, '预览页含【保存到我的行程】按钮');
  ok(!$$('#screen .cp-btn').find(e => /和顾问聊聊细节/.test(e.textContent)), '预览页已无【和顾问聊聊细节】按钮');
  click(saveBtn);
  await sleep(60);
  const myTrips = window.__preview.wx.getStorageSync('myTrips') || [];
  ok(myTrips.length === 1, 'myTrips 保存 1 条');
  ok(myTrips[0].title === '我的专属呼伦贝尔4日行程', '保存行程标题: ' + myTrips[0].title);
  ok(myTrips[0].plans.length === 4, '保存行程 4 天');
  ok(myTrips[0].plans[1].scenicIds.length === 2 && myTrips[0].plans[1].hotelId === 'h1' && myTrips[0].plans[1].note === '想看日落',
    '第2天景区/酒店/备注已保存');
  ok(!!myTrips[0].cover, '保存行程封面已带入');

  // 20c. 发布到灵感广场 -> 广场顶部展示
  click($$('#screen .cp-btn').find(e => /发布到灵感广场/.test(e.textContent)));
  await sleep(150);
  ok($('#screen').textContent.includes('灵感广场'), '发布后切回灵感广场');
  const pubTitles = $$('#screen .card .card-title').map(e => e.textContent);
  ok(pubTitles.indexOf('我的专属呼伦贝尔4日行程') > -1, '广场顶部展示专属行程');
  ok(window.__preview.wx.getStorageSync('pendingToast') === '', '专属行程发布 pendingToast 已消费');

  // 20d. 定制页发布灵感 -> 发布 -> 广场顶部展示
  click($$('.pv-tab')[0]);
  await sleep(80);
  const customNav2 = $$('#screen .nav-item').find(e => /私人定制/.test(e.textContent));
  ok(!!customNav2, '首页私人定制入口再次存在');
  click(customNav2);
  await sleep(80);
  ok($('#screen').textContent.includes('私人定制行程'), '再次进入私人定制页');
  click($$('#screen .chip').find(e => /自定义/.test(e.textContent)));
  await sleep(30);
  input($('#screen .days-input'), '4');
  await sleep(50);
  click($('#screen .bottom-bar .publish-btn'));
  ok($('#nav-title').textContent.includes('发布灵感'), '进入发布灵感页: ' + $('#nav-title').textContent);
  ok($('#screen').textContent.includes('行程标题'), '发布页表单渲染');
  ok($$('#screen .day-tab').length === 4, '发布页预填上次定制 4 天: ' + $$('#screen .day-tab').length);
  const titleIn = $$('#screen input').find(i => i.placeholder && i.placeholder.indexOf('比如') > -1);
  ok(!!titleIn, '行程标题输入框存在');
  input(titleIn, '我的呼伦贝尔私家小团');
  await sleep(30);
  click($('#screen .publish-btn'));
  await sleep(120);
  ok($('#screen').textContent.includes('灵感广场'), '发布后切回灵感广场');
  const firstTitle = $('#screen .card .card-title');
  ok(!!firstTitle && firstTitle.textContent.indexOf('我的呼伦贝尔私家小团') > -1, '广场顶部展示新发布');
  ok(window.__preview.wx.getStorageSync('pendingToast') === '', 'pendingToast 已消费');

  // 20c. 发布旅行笔记（二选一切换 -> 表单 -> 发布 -> 广场顶部展示）
  click($('#screen .publish-circle'));
  await sleep(80);
  ok($('#screen').textContent.includes('发布行程方案'), '进入发布页(默认行程方案)');
  const noteMode = $$('#screen .mode-item').find(e => e.textContent.trim() === '发布旅行笔记');
  ok(!!noteMode, '发布页含旅行笔记选项');
  click(noteMode);
  await sleep(50);
  ok($('#screen').textContent.includes('游记正文'), '切到旅行笔记表单');
  ok(!!$('#screen .img-add'), '笔记多图上传入口存在');
  click($('#screen .img-add'));
  await sleep(50);
  ok($$('#screen .img-item').length === 1, '已添加 1 张随拍图');
  const noteTitleI = $$('#screen input').find(i => i.placeholder && i.placeholder.indexOf('一句话说主题') > -1);
  ok(!!noteTitleI, '笔记标题输入框存在');
  input(noteTitleI, '草原落日手记');
  const noteBody = $('#screen textarea.note-content');
  ok(!!noteBody, '游记正文输入框存在');
  input(noteBody, '傍晚的草原被镀成金色，风里都是草籽的味道。\n日落很快，但余晖会多留十分钟。');
  click($$('#screen .chips.wrap .chip').find(e => e.textContent.trim() === '呼伦贝尔草原'));
  await sleep(30);
  click($('#screen .publish-btn'));
  await sleep(120);
  ok($('#screen').textContent.includes('灵感广场'), '笔记发布后切回灵感广场');
  ok($$('#screen .card').length === 19, '全部 19 条(16+专属+方案+笔记): ' + $$('#screen .card').length);
  const noteCardTop = $$('#screen .card-title').map(e => e.textContent);
  ok(noteCardTop.indexOf('草原落日手记') > -1, '笔记发布后广场顶部可见');
  click($$('#screen .cat').find(e => e.textContent.trim() === '旅行笔记'));
  await sleep(50);
  ok($$('#screen .card').length === 7, '旅行笔记筛选 7 条(6静态+1新发布)');
  ok($('#screen').textContent.indexOf('草原落日手记') > -1, '新笔记归入旅行笔记');
  click($$('#screen .cat')[0]);
  await sleep(50);
  ok(window.__preview.wx.getStorageSync('pendingToast') === '', '笔记发布 pendingToast 已消费');

  // 21. 回首页
  click($$('.pv-tab')[0]);
  await sleep(80);
  ok($('#screen').textContent.includes('热门'), '发布后回首页');

  // 22. 我的行程：收藏卡片 -> 重新打开专属预览(场景2) -> 修改行程回填编辑 -> 覆盖保存
  click($$('.pv-tab')[3]);
  await sleep(80);
  const tripRow2 = $$('#screen .menu-item').find(e => /我的行程/.test(e.textContent));
  ok(!!tripRow2, '我的页含我的行程入口');
  click(tripRow2);
  await sleep(80);
  ok($$('#screen .mt-card').length === 1, '我的行程列表 1 条');
  const mtName = $$('#screen .mt-card .mt-name').map(e => e.textContent);
  ok(mtName.indexOf('我的专属呼伦贝尔4日行程') > -1, '行程卡片标题正确');
  ok($$('#screen .mt-card img').length >= 1, '行程卡片大图在上');
  ok($$('#screen .mt-card .mt-days')[0].textContent.includes('4天'), '卡片天数展示');
  click($('#screen .mt-card'));
  await sleep(120);
  const prevId = window.__preview.wx.getStorageSync('myTrips')[0].id;
  ok($('#screen .cp-hero-title').textContent.includes('你的专属呼伦贝尔4天行程'), '卡片重新打开专属预览');
  ok($$('#screen .cp-day').length === 4, '预览恢复 4 天模块');
  const rDay = $$('#screen .cp-day')[1].textContent;
  ok(rDay.indexOf('呼伦贝尔大草原') > -1 && rDay.indexOf('想看日落') > -1, '预览恢复第2天景区与备注');
  ok(!$('#screen .mask'), '重新打开的预览无留资弹窗');
  ok($$('#screen .info-item').length === 4, '场景2预览基础信息标签 4 项');
  ok($('#screen').textContent.indexOf('盛夏草原') > -1, '场景2预览季节按存期月份');
  ok($('#screen').textContent.indexOf('温馨提示') > -1, '场景2预览含总体温馨提示');
  ok($('#screen').textContent.indexOf('自助行程规划') > -1 && $('#screen').textContent.indexOf('费用包含') > -1, '场景2预览含出行说明');
  ok(!!$$('#screen .cp-btn').find(e => /发布到灵感广场/.test(e.textContent)), '场景2保留【发布到灵感广场】');
  const editBtn = $$('#screen .cp-btn').find(e => /修改行程/.test(e.textContent));
  ok(!!editBtn, '场景2右侧为【修改行程】');
  ok(!$$('#screen .cp-btn').find(e => /保存到我的行程/.test(e.textContent)), '场景2无【保存到我的行程】');

  // 22a. 修改行程 -> 定制页自动回填
  click(editBtn);
  await sleep(120);
  ok($('#screen').textContent.includes('私人定制行程'), '修改行程进入定制页');
  ok($$('#screen .day-chip').length === 4, '回填 4 天标签');
  ok($('#screen').textContent.includes('2026-08-01'), '回填出行日期');
  ok($$('#screen .stepper-num')[0].textContent.indexOf('2') === 0, '回填成人 2 人: ' + $$('#screen .stepper-num')[0].textContent);
  click($$('#screen .day-chip')[1]);
  await sleep(30);
  const day2Names = $$('#screen .sel-item .sel-name').map(e => e.textContent.trim());
  ok(day2Names.indexOf('呼伦贝尔大草原') > -1 && day2Names.indexOf('莫日格勒河') > -1, '回填第2天景区: ' + day2Names.join(','));
  ok(!!$('#screen .hotel-sel') && $('#screen .hotel-sel').textContent.indexOf('海拉尔草原天际酒店') > -1, '回填第2天酒店');
  ok(/已选景区\s*2/.test($('#screen .summary').textContent), '回填汇总景区 2 项');
  ok($('#screen textarea.note').value === '想看日落', '回填第2天备注');
  input($('#screen textarea.note'), '想看日落·再改一下');
  await sleep(30);
  click($$('#screen .day-chip')[0]);
  await sleep(20);
  click($$('#screen .day-chip')[1]);
  await sleep(20);
  ok($('#screen textarea.note').value.indexOf('再改一下') > -1, '备注可编辑');

  // 22b. 重新生成 -> 预览(场景1) -> 覆盖保存不新增条目
  click($('#screen .bottom-bar .submit-btn'));
  await sleep(120);
  ok($('#nav-title').textContent.includes('你的专属行程'), '编辑后重新生成进入预览');
  ok($('#screen .cp-hero-title').textContent.includes('你的专属呼伦贝尔4天行程'), '重新生成预览标题 4 天');
  const eDay = $$('#screen .cp-day')[1].textContent;
  ok(eDay.indexOf('想看日落·再改一下') > -1, '编辑后预览第2天备注更新');
  ok(!!$$('#screen .cp-btn').find(e => /保存到我的行程/.test(e.textContent)), '重新生成预览右侧为【保存到我的行程】');
  ok(!$$('#screen .cp-btn').find(e => /修改行程/.test(e.textContent)), '重新生成预览无【修改行程】');
  click($$('#screen .cp-btn').find(e => /保存到我的行程/.test(e.textContent)));
  await sleep(60);
  const trips2 = window.__preview.wx.getStorageSync('myTrips') || [];
  ok(trips2.length === 1, '覆盖保存不新增条目(仍 1 条)');
  ok(trips2[0].id === prevId, '覆盖后行程 id 不变: ' + trips2[0].id);
  ok(trips2[0].days === 4 && trips2[0].plans[1].note.indexOf('再改一下') > -1, '覆盖保存内容为修改后行程');
  ok($('#screen').textContent.includes('你的专属呼伦贝尔4天行程'), '保存后仍停留预览页');

  // 22c. 返回我的行程 -> 左滑删除（二次确认）-> 灵感广场已发布内容不受影响
  click($('#nav-back')); await sleep(60);
  click($('#nav-back')); await sleep(60);
  click($('#nav-back')); await sleep(60);
  ok($$('#screen .mt-card').length === 1, '返回我的行程列表');
  ok($$('#screen .mt-row').length === 1, '行程卡片含滑动容器');
  const delRow = $('#screen .mt-row');
  delRow.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
  doc.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 190, clientY: 202 }));
  await sleep(30);
  doc.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, clientX: 190, clientY: 202 }));
  await sleep(60);
  ok($('#screen .mt-card').classList.contains('on'), '左滑露出删除按钮');
  click($('#screen .mt-del'));
  await sleep(60);
  ok($('#screen').textContent.indexOf('确定要删除这条行程方案吗？') > -1, '删除二次确认文案');
  ok($$('#screen .mt-dialog-btn').some(e => /取消/.test(e.textContent)), '确认弹窗含取消按钮');
  click($$('#screen .mt-dialog-btn').find(e => /取消/.test(e.textContent)));
  await sleep(60);
  ok(!$('#screen .mt-mask'), '取消后弹窗关闭');
  ok($$('#screen .mt-card').length === 1, '取消后行程保留');
  ok(!$('#screen .mt-card').classList.contains('on'), '取消后滑动复位');

  delRow.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
  doc.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 170, clientY: 200 }));
  await sleep(30);
  doc.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, clientX: 170, clientY: 200 }));
  await sleep(60);
  click($('#screen .mt-del'));
  await sleep(60);
  click($$('#screen .mt-dialog-btn').find(e => /确认/.test(e.textContent)));
  await sleep(80);
  ok($$('#screen .mt-card').length === 0, '确认后行程被删除');
  ok($('#screen').textContent.includes('还没有保存的定制行程'), '删除后进入空状态');
  ok((window.__preview.wx.getStorageSync('myTrips') || []).length === 0, '删除后 myTrips 清空');
  const sharesLeft = window.__preview.wx.getStorageSync('myShares') || [];
  ok(sharesLeft.some(s => (s.title || '').indexOf('我的专属呼伦贝尔4日行程') > -1), '灵感广场已发布行程不受影响');

  results.forEach(r => console.log(r));
  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
