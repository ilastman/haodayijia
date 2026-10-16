/* ============ 视图：数据大盘 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.dashboard = {
  nav: true, title: '数据大盘', icon: '📊',
  comp: {
    name: 'DashboardView',
    data() { return { S: Store }; },
    computed: {
      st() { return Store.stats(); },
      pending() { return Store.db.inspirationPost.filter(p => p.status === 0); },
      recentPosts() { return Store.db.inspirationPost.slice().sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()).slice(0, 5); },
      cardList() {
        const s = this.st;
        return [
          { k: '首页板块', v: s.modules, d: s.modulesOn + ' 个正在展示', ic: '🏠', to: 'home-layout' },
          { k: '轮播 Banner', v: s.banner, d: s.bannerOn + ' 个轮播中', ic: '🖼', to: 'banner' },
          { k: '景区', v: s.scenic, d: s.scenicOn + ' 个在线', ic: '🏔', to: 'scenic' },
          { k: '酒店', v: s.hotel, d: s.hotelOn + ' 家在线', ic: '🏨', to: 'hotel' },
          { k: '私家团行程', v: s.group, d: s.groupOn + ' 条可售', ic: '🧭', to: 'private-group' },
          { k: '定制行程', v: s.userTrip, d: '用户提交的定制行程', ic: '📋', to: 'user-trip' },
          { k: '用户', v: s.users, d: '聚合活跃用户', ic: '👥', to: 'users' },
          { k: '灵感广场 UGC', v: s.posts, d: '待审核 ' + s.postsPending + ' · 评论 ' + s.comments, ic: '💡', to: 'inspiration' },
          { k: '图片素材', v: s.assets, d: s.assets + ' 张已入库', ic: '🗄', to: 'asset-library' },
        ];
      },
    },
    methods: {
      go(key) { location.hash = '#/' + key; },
      auditCount(i) {
        return ['待审核', '已通过', '已驳回'][i] || i;
      },
    },
    template: `
    <div>
      <div class="stat-row">
        <div class="stat-card" v-for="c in cardList" :key="c.k" @click="go(c.to)">
          <div class="k">{{c.k}}</div>
          <div class="v">{{c.v}}</div>
          <div class="d">{{c.d}}</div>
          <div class="ic">{{c.ic}}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div class="card">
          <div class="card-title">待审核内容（{{pending.length}}）</div>
          <el-table :data="pending" height="300">
            <el-table-column label="类型" width="90">
              <template #default="{row}"><el-tag size="small" effect="plain">{{row.type === 'note' ? '笔记' : '行程'}}</el-tag></template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
            <el-table-column label="作者" width="120">
              <template #default="{row}">
                <div class="flex gap10"><img class="avatar-sm" :src="img(row.avatar)" alt=""/> <span>{{row.nickname}}</span></div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{row}">
                <el-button size="small" type="primary" link @click="go('inspiration')">去审核</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="faint" style="padding:20px">没有待审核内容 🎉</div></template>
          </el-table>
        </div>
        <div class="card">
          <div class="card-title">最近发布动态</div>
          <el-table :data="recentPosts" height="300">
            <el-table-column label="作者" width="140">
              <template #default="{row}">
                <div class="flex gap10"><img class="avatar-sm" :src="img(row.avatar)" alt=""/> <span>{{row.nickname}}</span></div>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
            <el-table-column label="点赞" width="80"><template #default="{row}">👍 {{row.like}}</template></el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{row}">
                <span class="st" :class="['st-' + ['','pending','pass','reject'][row.status + 1]]">{{auditCount(row.status)}}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-title">快捷操作</div>
        <div class="flex gap10" style="flex-wrap:wrap">
          <el-button type="primary" @click="go('private-group')">＋ 新增私家团行程</el-button>
          <el-button @click="go('home-layout')">🎛 编辑首页板块</el-button>
          <el-button @click="go('global-config')">⚙️ 小程序全局配置</el-button>
          <el-button @click="go('asset-library')">🗄 管理素材库</el-button>
          <el-button @click="go('users')">👥 用户管理</el-button>
          <span class="spacer" style="flex:1"></span>
          <el-popconfirm title="将清空所有本地改动并恢复演示数据，确认？" confirm-button-text="重置" confirm-button-type="danger" @confirm="S.reset(); ElementPlus.ElMessage.success('已重置为演示数据')">
            <template #reference><el-button>↺ 重置演示数据</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </div>`,
  },
};
