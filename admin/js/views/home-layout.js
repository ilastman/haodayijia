/* ============ 手机实时预览（首页效果） ============ */
window.PhoneScreen = {
  name: 'PhoneScreen',
  data() { return { S: Store }; },
  computed: {
    mods() { return Store.db.homeModule.filter(m => m.show); },
    banners() { return Store.db.banner.filter(b => b.enable); },
    gc() { return Store.db.globalConfig; },
    copy() { return (Store.db.globalConfig && Store.db.globalConfig.homeCopy) || {}; },
    sec() { return (Store.db.globalConfig && Store.db.globalConfig.homeSections) || {}; },
    tabs() { return (Store.db.globalConfig.tabs || []).filter(t => t.show); },
    bannerImg() { return this.banners.length ? this.banners[0].img : ''; },
    byId() { const m = {}; Store.db.privateGroup.forEach(g => { m[g.id] = g; }); return m; },
    hot() { return ((this.sec.hot && this.sec.hot.routeIds) || []).map(id => this.byId[id]).filter(Boolean); },
    offers() { return ((this.sec.offer && this.sec.offer.routeIds) || []).map(id => this.byId[id]).filter(Boolean); },
    dests() { return (this.sec.dest && this.sec.dest.items) || []; },
  },
  methods: {
    bg(hex) { return hex || 'url()'; },
  },
  template: `
  <div class="phone">
    <div class="phead">{{gc.slogan || '好大一家旅行社'}}</div>
    <div class="phnotice">{{gc.notice}}</div>
    <div class="phbanner">
      <img v-if="bannerImg" :src="img(bannerImg)" alt="banner" />
      <div v-else style="height:100%;display:flex;align-items:center;justify-content:center;color:#fff">暂无启用轮播</div>
      <div class="dot"><i :class="{on: i===0}" v-for="(b,i) in banners" :key="b.id"></i></div>
    </div>
    <div class="phnav">
      <div class="it" v-for="m in mods" :key="m.id">
        <div class="ico"><img v-if="m.icon" :src="img(m.icon)" alt="icon" /><span v-else>✦</span></div>
        <div class="lb">{{m.title}}</div>
      </div>
    </div>
    <div class="phsec">
      <div class="hd"><b>{{copy.hotTitle || '热门呼伦贝尔线路'}}</b><span>{{copy.more || '查看全部'}}</span></div>
      <div class="phrow">
        <div class="phcard" v-for="g in hot" :key="g.id">
          <div class="pimg"><img :src="img(g.cover)" alt="" /></div>
          <div class="pt">{{g.title}}</div>
          <div class="pp">¥{{g.price}} 起</div>
        </div>
        <div v-if="!hot.length" class="soft" style="padding:8px 4px">未选择热门线路</div>
      </div>
    </div>
    <div class="phsec">
      <div class="hd"><b>{{copy.destTitle || '目的地直达'}}</b></div>
      <div class="phdest">
        <div class="d" v-for="(s,i) in dests" :key="i"><img :src="img(s.image)" alt="" /><em>{{s.name}}</em></div>
        <div v-if="!dests.length" class="soft" style="padding:8px 4px">暂无目的地</div>
      </div>
    </div>
    <div class="phsec">
      <div class="hd"><b>{{copy.offerTitle || '特惠推荐'}}</b><span>{{copy.more || '查看全部'}}</span></div>
      <div class="phrow">
        <div class="phcard" v-for="g in offers" :key="g.id">
          <div class="pimg"><img :src="img(g.cover)" alt="" /></div>
          <div class="pt">{{g.title}}</div>
          <div class="pp">¥{{g.price}} 起</div>
        </div>
        <div v-if="!offers.length" class="soft" style="padding:8px 4px">未选择特惠线路</div>
      </div>
    </div>
    <div class="phsec">
      <div class="hd"><b>{{copy.introTitle || '关于我们'}}</b></div>
      <div class="soft" style="padding:4px;line-height:1.7">{{gc.companyIntro}}</div>
      <div class="soft" style="padding:4px">客服电话：{{(gc.contact && gc.contact.phone) || ''}}</div>
    </div>
    <div class="phtabbar">
      <div class="tab" :class="{on: t.page.indexOf('/pages/index') > -1}" v-for="t in tabs" :key="t.id">
        <i>{{t.icon}}</i>{{t.text}}
      </div>
    </div>
  </div>`,
};

/* ============ 视图：首页可视化布局管理 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS['home-layout'] = {
  nav: true, title: '首页可视化布局', icon: '🏠',
  comp: {
    name: 'HomeLayoutView',
    data() { return { S: Store, tab: 'modules', editingId: '', zoomPhone: false }; },
    created() { this.ensure(); },
    computed: {
      mods() { return Store.db.homeModule.slice(); },
      maxSort() { return Math.max(0, ...Store.db.homeModule.map(m => m.sort)); },
      editM() { return this.mods.find(x => x.id === this.editingId) || null; },
      gc() { return Store.db.globalConfig; },
      copy() { return this.gc.homeCopy || {}; },
      sec() { return this.gc.homeSections || {}; },
      routesPage() { return this.gc.routesPage || {}; },
      routeOptions() {
        return Store.db.privateGroup.map(g => ({ id: g.id, title: g.title, online: g.online !== false }));
      },
      destOptions() {
        const set = {};
        Store.db.privateGroup.forEach(g => { if (g.dest) set[g.dest] = 1; });
        (Store.db.scenic || []).forEach(s => { if (s.dest) set[s.dest] = 1; });
        return Object.keys(set);
      },
    },
    methods: {
      ensure() {
        const gc = Store.db.globalConfig = Store.db.globalConfig || {};
        gc.homeCopy = Object.assign({ hotTitle: '热门呼伦贝尔线路', destTitle: '目的地直达', offerTitle: '特惠推荐', introTitle: '关于我们', more: '查看全部', consult: '立即咨询' }, gc.homeCopy || {});
        gc.homeSections = Object.assign({ hot: { routeIds: [] }, dest: { items: [] }, offer: { routeIds: [] } }, gc.homeSections || {});
        gc.homeSections.hot = Object.assign({ routeIds: [] }, gc.homeSections.hot);
        gc.homeSections.dest = Object.assign({ items: [] }, gc.homeSections.dest);
        gc.homeSections.offer = Object.assign({ routeIds: [] }, gc.homeSections.offer);
        if (!gc.routesPage || typeof gc.routesPage !== 'object') {
          gc.routesPage = { headerTitle: '', slogan: '', cats: [], moreGroups: { days: '', dest: '', type: '' }, customTitle: '', customDesc: '', customBtn: '', journalLink: '', emptyCategory: '', sections: [] };
        }
        if (!Array.isArray(gc.routesPage.cats)) gc.routesPage.cats = [];
        if (!Array.isArray(gc.routesPage.sections)) gc.routesPage.sections = [];
      },
      routeTitle(id) { const g = Store.db.privateGroup.find(x => x.id === id); return g ? g.title : id; },
      moveId(arr, from, delta) {
        const to = from + delta;
        if (to < 0 || to >= arr.length) return;
        const [x] = arr.splice(from, 1);
        arr.splice(to, 0, x);
      },
      addDest() { this.sec.dest.items.push({ name: '', image: '' }); },
      delDest(i) { this.sec.dest.items.splice(i, 1); },
      onMoveSection(from, to) {
        const arr = this.routesPage.sections;
        if (!arr) return;
        const [x] = arr.splice(from, 1);
        arr.splice(to, 0, x);
      },
      addSection() {
        if (!this.routesPage.sections) this.routesPage.sections = [];
        this.routesPage.sections.push({ key: 'sec' + Date.now().toString(36), label: '新板块', icon: '', show: true, text: '', sub: '' });
      },
      delSection(i) { this.routesPage.sections.splice(i, 1); },
      onMove(from, to) {
        const ids = this.mods.map(m => m.id);
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        Store.reorder('homeModule', ids);
      },
      addModule() {
        const m = Store.add('homeModule', {
          title: '新板块', sub: 'NEW SECTION', icon: '',
          desc: '请在右侧编辑描述文字', url: '/pages/index/index', show: true, sort: this.maxSort + 1,
        });
        this.editingId = m.id;
        ElementPlus.ElMessage.success('已添加板块，展开编辑');
      },
      removeModule(m) { Store.remove('homeModule', m.id); ElementPlus.ElMessage.success('板块已删除'); },
      save() { Store.save(); ElementPlus.ElMessage.success('首页布局已保存'); },
      reset() {
        ElementPlus.ElMessageBox.confirm('将恢复默认演示布局，当前改动会丢失，确认？', '重置布局', { type: 'warning', confirmButtonText: '重置', cancelButtonText: '取消' }).then(() => {
          Store.reset();
          this.editingId = '';
          ElementPlus.ElMessage.success('已重置布局');
        }).catch(() => {});
      },
      expand(m) { this.editingId = this.editingId === m.id ? '' : m.id; },
      openFull() { this.zoomPhone = true; },
    },
    template: `
    <div>
      <el-row :gutter="20">
        <el-col :span="15">
          <div class="card">
            <el-tabs v-model="tab">
              <el-tab-pane label="导航板块" name="modules">
                <div class="toolbar">
                  <el-button type="primary" @click="addModule">＋ 添加板块</el-button>
                  <el-button @click="reset">↺ 重置布局</el-button>
                  <span class="spacer"></span>
                  <span class="soft">拖动模块卡片自由排序 · 编辑即时生效</span>
                </div>
                <ul class="sortable" v-sort="onMove">
                  <li v-for="m in mods" :key="m.id" :draggable="true" :style="{opacity: m.show ? 1 : .55}">
                    <div class="drag-handle">⠿</div>
                    <div style="width:52px;height:52px;overflow:hidden;border-radius:12px;background:#efe7d7;flex:0 0 52px;display:flex;align-items:center;justify-content:center">
                      <img v-if="m.icon" :src="img(m.icon)" style="width:100%;height:100%;object-fit:cover" alt="" />
                      <span v-else>✦</span>
                    </div>
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600">{{m.title}} <span class="soft">· {{m.sub}}</span></div>
                      <div class="faint ellipsis" style="margin-top:4px">{{m.desc || '（暂无描述）'}}</div>
                      <div class="faint" style="margin-top:3px;font-family:monospace">{{m.url}}</div>
                    </div>
                    <el-switch v-model="m.show" size="small" active-text="展示" />
                    <el-button size="small" @click="expand(m)">{{editingId === m.id ? '收起 ▲' : '编辑 ▾'}}</el-button>
                    <Confirm title="确认删除该板块？" @ok="removeModule(m)">
                      <el-button size="small" type="danger" plain>删除</el-button>
                    </Confirm>
                  </li>

                  <li v-if="editM" class="sortable-edit" :draggable="false"
                      style="display:block;cursor:default;background:var(--el-color-primary-light-9);border-color:var(--accent)">
                    <div class="card-title" style="margin-bottom:14px">编辑板块 {{editM.title}}</div>
                    <el-form label-width="90px" size="default">
                      <el-form-item label="板块标题"><el-input v-model="editM.title" /></el-form-item>
                      <el-form-item label="副标题"><el-input v-model="editM.sub" placeholder="如 INSPIRATION" /></el-form-item>
                      <el-form-item label="描述文字"><el-input v-model="editM.desc" type="textarea" :rows="2" /></el-form-item>
                      <el-form-item label="跳转路径"><el-input v-model="editM.url" placeholder="/pages/index/index" /></el-form-item>
                      <el-form-item label="图标图片">
                        <ImgPicker v-model="editM.icon" :ratio="1" title="上传模块图标" />
                      </el-form-item>
                      <el-form-item label="显示状态">
                        <el-switch v-model="editM.show" /> <span class="soft" style="margin-left:8px">{{editM.show ? '展示中' : '已隐藏'}}</span>
                      </el-form-item>
                    </el-form>
                  </li>
                  <li v-if="!mods.length" class="tac" :draggable="false" style="cursor:default;justify-content:center;color:var(--ink-faint)">
                    暂无板块，点击「添加板块」开始搭建首页
                  </li>
                </ul>
              </el-tab-pane>

              <el-tab-pane label="热门呼伦贝尔路线" name="hot">
                <el-form label-width="90px">
                  <el-form-item label="板块标题"><el-input v-model="copy.hotTitle" style="max-width:320px" /></el-form-item>
                  <el-form-item label="选择线路">
                    <el-select v-model="sec.hot.routeIds" multiple filterable placeholder="从私家团线路中挑选" style="width:100%">
                      <el-option v-for="r in routeOptions" :key="r.id" :value="r.id"
                        :label="r.title + '（' + r.id + '）' + (r.online ? '' : ' · 已下架')" />
                    </el-select>
                  </el-form-item>
                </el-form>
                <div class="card-title" style="margin:6px 0 10px">展示顺序（{{sec.hot.routeIds.length}}）</div>
                <ul class="sortable" v-if="sec.hot.routeIds.length">
                  <li v-for="(id,i) in sec.hot.routeIds" :key="id" :draggable="false">
                    <div class="drag-handle">⠿</div>
                    <div style="flex:1;min-width:0"><b>{{i+1}}.</b> {{routeTitle(id)}} <span class="faint">{{id}}</span></div>
                    <el-button size="small" @click="moveId(sec.hot.routeIds,i,-1)">↑</el-button>
                    <el-button size="small" @click="moveId(sec.hot.routeIds,i,1)">↓</el-button>
                    <el-button size="small" type="danger" plain @click="sec.hot.routeIds.splice(i,1)">移除</el-button>
                  </li>
                </ul>
                <div v-else class="faint tac" style="padding:16px">尚未选择热门线路</div>
              </el-tab-pane>

              <el-tab-pane label="目的地直达" name="dest">
                <el-form label-width="90px">
                  <el-form-item label="板块标题"><el-input v-model="copy.destTitle" style="max-width:320px" /></el-form-item>
                </el-form>
                <div class="toolbar">
                  <el-button type="primary" @click="addDest">＋ 添加目的地</el-button>
                  <span class="soft">名称建议与线路「目的地」字段一致，点击才能筛选出线路</span>
                </div>
                <ul class="sortable" v-if="sec.dest.items.length">
                  <li v-for="(d,i) in sec.dest.items" :key="i" :draggable="false">
                    <div class="drag-handle">⠿</div>
                    <el-select v-model="d.name" filterable allow-create default-first-option placeholder="目的地名称" style="width:160px">
                      <el-option v-for="o in destOptions" :key="o" :value="o" :label="o" />
                    </el-select>
                    <ImgPicker v-model="d.image" :ratio="0.7" title="目的地图片" style="flex:1" />
                    <el-button size="small" @click="moveId(sec.dest.items,i,-1)">↑</el-button>
                    <el-button size="small" @click="moveId(sec.dest.items,i,1)">↓</el-button>
                    <el-button size="small" type="danger" plain @click="delDest(i)">删除</el-button>
                  </li>
                </ul>
                <div v-else class="faint tac" style="padding:16px">暂无目的地，点击「添加目的地」</div>
              </el-tab-pane>

              <el-tab-pane label="特惠推荐" name="offer">
                <el-form label-width="90px">
                  <el-form-item label="板块标题"><el-input v-model="copy.offerTitle" style="max-width:320px" /></el-form-item>
                  <el-form-item label="选择线路">
                    <el-select v-model="sec.offer.routeIds" multiple filterable placeholder="从私家团线路中挑选" style="width:100%">
                      <el-option v-for="r in routeOptions" :key="r.id" :value="r.id"
                        :label="r.title + '（' + r.id + '）' + (r.online ? '' : ' · 已下架')" />
                    </el-select>
                  </el-form-item>
                </el-form>
                <div class="card-title" style="margin:6px 0 10px">展示顺序（{{sec.offer.routeIds.length}}）</div>
                <ul class="sortable" v-if="sec.offer.routeIds.length">
                  <li v-for="(id,i) in sec.offer.routeIds" :key="id" :draggable="false">
                    <div class="drag-handle">⠿</div>
                    <div style="flex:1;min-width:0"><b>{{i+1}}.</b> {{routeTitle(id)}} <span class="faint">{{id}}</span></div>
                    <el-button size="small" @click="moveId(sec.offer.routeIds,i,-1)">↑</el-button>
                    <el-button size="small" @click="moveId(sec.offer.routeIds,i,1)">↓</el-button>
                    <el-button size="small" type="danger" plain @click="sec.offer.routeIds.splice(i,1)">移除</el-button>
                  </li>
                </ul>
                <div v-else class="faint tac" style="padding:16px">尚未选择特惠线路</div>
              </el-tab-pane>

              <el-tab-pane label="关于我们" name="about">
                <el-form label-width="90px">
                  <el-form-item label="板块标题"><el-input v-model="copy.introTitle" style="max-width:320px" /></el-form-item>
                  <el-form-item label="公司介绍"><el-input v-model="gc.companyIntro" type="textarea" :rows="4" /></el-form-item>
                  <el-form-item label="客服电话"><el-input v-model="gc.contact.phone" style="max-width:320px" /></el-form-item>
                </el-form>
                <el-alert type="info" :closable="false" show-icon
                  title="与「全局配置」共用同一份内容，两处修改内容一致。" />
              </el-tab-pane>

              <el-tab-pane label="线路页板块" name="routes">
                <el-alert type="warning" :closable="false" show-icon style="margin-bottom:14px"
                  title="用于小程序「线路列表页」的板块顺序与文案配置。当前前端页面尚未接入读取，此处仅保存配置备用，不影响现有页面。" />
                <el-form label-width="96px">
                  <el-form-item label="页头标题"><el-input v-model="routesPage.headerTitle" style="max-width:340px" /></el-form-item>
                  <el-form-item label="页头标语"><el-input v-model="routesPage.slogan" style="max-width:460px" /></el-form-item>
                  <el-form-item label="空状态文案"><el-input v-model="routesPage.emptyCategory" style="max-width:340px" /></el-form-item>
                  <el-form-item label="分类标签">
                    <el-select v-model="routesPage.cats" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入分类后回车，如：夏日草原 / 阿尔山秋线" />
                  </el-form-item>
                  <el-form-item label="底部定制标题"><el-input v-model="routesPage.customTitle" style="max-width:340px" /></el-form-item>
                  <el-form-item label="底部定制说明"><el-input v-model="routesPage.customDesc" type="textarea" :rows="2" style="max-width:460px" /></el-form-item>
                  <el-form-item label="定制按钮文字"><el-input v-model="routesPage.customBtn" style="max-width:220px" /></el-form-item>
                  <el-form-item label="灵感引导语"><el-input v-model="routesPage.journalLink" style="max-width:340px" /></el-form-item>
                </el-form>

                <div class="card-title" style="margin:10px 0">板块顺序与显隐（拖动排序 · 可改文字 / 图标）</div>
                <ul class="sortable" v-sort="onMoveSection">
                  <li v-for="(s,i) in (routesPage.sections || [])" :key="s.key" draggable="true" :style="{opacity: s.show ? 1 : .55}">
                    <div class="drag-handle">⠿</div>
                    <div style="width:44px;height:44px;border-radius:10px;background:#efe7d7;display:flex;align-items:center;justify-content:center;flex:0 0 44px;overflow:hidden">
                      <img v-if="s.icon && s.icon.indexOf('/') > -1" :src="img(s.icon)" style="width:100%;height:100%;object-fit:cover" alt="" />
                      <span v-else>{{ s.icon || '◇' }}</span>
                    </div>
                    <div style="flex:0 0 130px">
                      <div style="font-weight:600">{{ s.label }}</div>
                      <div class="faint" style="font-family:monospace;font-size:11px">{{ s.key }}</div>
                    </div>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
                      <el-input v-model="s.text" size="small" placeholder="板块文字（如标题 / 引导语）" />
                      <el-input v-model="s.sub" size="small" placeholder="副文案（可选）" />
                    </div>
                    <el-input v-model="s.icon" size="small" placeholder="图标（emoji 或图片URL）" style="width:170px" />
                    <el-switch v-model="s.show" size="small" active-text="显示" />
                    <el-button size="small" @click="moveId(routesPage.sections,i,-1)">↑</el-button>
                    <el-button size="small" @click="moveId(routesPage.sections,i,1)">↓</el-button>
                    <Confirm title="确认删除该板块？" @ok="delSection(i)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
                  </li>
                </ul>
                <div class="toolbar" style="margin-top:10px">
                  <el-button size="small" @click="addSection">＋ 添加板块</el-button>
                  <span class="soft">默认含 5 个板块：页头 / 分类标签 / 更多筛选 / 底部定制引导 / 底部灵感引导</span>
                </div>
              </el-tab-pane>
            </el-tabs>

            <div class="toolbar" style="margin-top:14px">
              <el-button type="primary" @click="save">💾 保存首页布局</el-button>
              <span class="soft">改动会同步到本地数据桥，小程序预览即时生效</span>
            </div>
          </div>
        </el-col>

        <el-col :span="9">
          <div class="card">
            <div class="card-title">实时预览 · 小程序首页</div>
            <div class="toolbar" style="margin-bottom:14px">
              <span class="soft">所有改动即时反映</span>
              <span class="spacer"></span>
              <el-button size="small" type="primary" plain @click="openFull">↗ 大屏预览</el-button>
            </div>
            <phone-screen />
          </div>
        </el-col>
      </el-row>

      <el-dialog v-model="zoomPhone" title="首页大屏预览" width="420px" append-to-body>
        <phone-screen />
      </el-dialog>
    </div>`,
  },
};
