/* ============================================================
 * 应用外壳：路由 / 登录守卫 / 左侧菜单 / 顶栏 / 视图挂载
 * ============================================================ */
(function () {
  const app = Vue.createApp({
    data() {
      return {
        Views: window.VIEWS,
        route: 'dashboard',
        menu: [
          ['dashboard', '数据大盘', '📊'],
          ['private-group', '线路管理', '🧭'],
          ['hotel', '酒店管理', '🏨'],
          ['scenic', '景区管理', '⛰'],
          ['category', '分类管理', '🏷'],
          ['gallery', '图库管理', '🗂'],
          ['user-trip', '定制行程管理', '📋'],
          ['clause', '行程条款模板', '📜'],
          ['inspiration', '灵感广场管理', '✨'],
          ['users', '用户管理', '👥'],
          ['staff', '员工账号', '🧑💼'],
          ['admin-users', '后台管理员', '🔐'],
          ['orders', '全部订单', '🧾'],
          ['customers', '客户管理', '👤'],
          ['ledger', '全员台账', '📈'],
          ['oplog', '操作日志', '📝'],
          ['alerts', '预警设置', '🔔'],
          ['home-layout', '首页布局', '🏠'],
          ['banner', '轮播 Banner', '🖼'],
          ['global-config', '全局配置', '⚙️'],
          ['asset-library', '素材库', '🗄'],
        ],
        user: null,
        sessionOn: false,
        zoomPhone: false,
      };
    },
    computed: {
      isLogin() { return this.sessionOn; },
      isSuper() { return Store.isSuper(); },
      visibleMenu() {
        return this.menu.filter(([k]) => k !== 'admin-users' || this.isSuper);
      },
      view() { return this.Views[this.route] || this.Views.dashboard; },
      title() { return (this.Views[this.route] && this.Views[this.route].title) || '数据大盘'; },
      badgeOf() {
        return key => {
          const v = this.Views[key];
          return v && typeof v.badge === 'function' ? v.badge(this) : (v && v.badge) || '';
        };
      },
    },
    methods: {
      parse() {
        const logged = Store.isLogin();
        this.sessionOn = logged;
        const key = (location.hash.replace(/^#\//, '') || 'dashboard');
        this.route = this.Views[key] ? key : 'dashboard';
        if (this.route !== 'login' && !logged) { location.hash = '#/login'; return; }
        if (this.route === 'login' && logged) { location.hash = '#/dashboard'; return; }
        if (this.route === 'admin-users' && !Store.isSuper()) { location.hash = '#/dashboard'; return; }
        this.user = Store.currentAdmin();
      },
      go(key) { if (key !== this.route) location.hash = '#/' + key; },
      logout() {
        Store.logout();
        ElementPlus.ElMessage.success('已退出登录');
        location.hash = '#/login';
      },
      resetAll() {
        ElementPlus.ElMessageBox.confirm('将清空所有本地数据并恢复演示数据，确认？', '重置演示数据', { type: 'warning', confirmButtonText: '重置' }).then(() => {
          Store.reset();
          ElementPlus.ElMessage.success('已恢复演示数据');
        }).catch(() => {});
      },
      openFull() { this.zoomPhone = true; },
    },
    created() {
      window.addEventListener('hashchange', () => this.parse());
      this.parse();
    },
    template: `
    <div v-if="isLogin" class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">松</div>
          <div>
            <div class="brand-name">好大一家旅行社</div>
            <div class="brand-sub">TRAVEL CONSOLE</div>
          </div>
        </div>
        <nav class="side-menu">
          <div v-for="[k, t, ic] in visibleMenu" :key="k" class="menu-item" :class="{on: route === k}" @click="go(k)">
            <span class="t-i">{{ic}}</span>{{t}}
            <span class="badge" v-if="badgeOf(k)">{{badgeOf(k)}}</span>
          </div>
        </nav>
      </aside>
      <div class="main">
        <div class="topbar">
          <div class="flex gap16">
            <span class="page-title">{{title}}</span>
            <span class="crumb">好大一家旅行社 · {{route}}</span>
          </div>
          <span class="spacer"></span>
          <div class="tb-action" @click="openFull">📱 预览首页</div>
          <el-dropdown trigger="click" @command="c => c === 'out' ? logout() : resetAll()">
            <div class="flex gap10" style="cursor:pointer">
              <div class="avatar-chip">{{user ? ((user.nickname || user.username || 'A').slice(0, 1)) : 'A'}}</div>
              <span class="soft">{{user ? (user.nickname || user.username) : ''}}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="reset">↺ 重置演示数据</el-dropdown-item>
                <el-dropdown-item command="out" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="content">
          <component :is="view.comp" />
        </div>
      </div>
      <CropDialog />
      <AssetDialog />
      <el-dialog v-model="zoomPhone" title="小程序首页 · 实时预览" width="420px" append-to-body>
        <phone-screen />
      </el-dialog>
    </div>
    <component v-else :is="Views.login.comp" />
    `,
  });

  if (globalThis.ElementPlusIconsVue) {
    for (const [name, comp] of Object.entries(globalThis.ElementPlusIconsVue)) app.component(name, comp);
  }
  app.use(ElementPlus, {
    locale: {
      name: 'zh-cn',
      el: {
        pagination: { goto: '前往', pagesize: '条/页', total: '共 {total} 条', pageClassifier: '页' },
        datepicker: {
          now: '此刻', today: '今天', cancel: '取消', clear: '清空', confirm: '确定',
          selectDate: '选择日期', startDate: '开始日期', endDate: '结束日期',
          prevYear: '前一年', nextYear: '后一年', prevMonth: '上个月', nextMonth: '下个月',
          year: '年',
          month1: '1 月', month2: '2 月', month3: '3 月', month4: '4 月',
          month5: '5 月', month6: '6 月', month7: '7 月', month8: '8 月',
          month9: '9 月', month10: '10 月', month11: '11 月', month12: '12 月',
          weeks: { sun: '日', mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六' },
          months: { jan: '一月', feb: '二月', mar: '三月', apr: '四月', may: '五月', jun: '六月', jul: '七月', aug: '八月', sep: '九月', oct: '十月', nov: '十一月', dec: '十二月' }
        }
      }
    }
  });
  // 全局混入：图片地址解析（cloud:// -> 临时链接），所有视图可直接使用 img(...)
  app.mixin({ methods: { img(v) { return window.Store ? window.Store.img(v) : v; } } });
  window.UI.install(app);
  app.component('PhoneScreen', window.PhoneScreen);
  app.mount('#app');
})();