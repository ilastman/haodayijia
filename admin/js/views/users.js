/* ============ 视图：用户管理（只读聚合） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.users = {
  nav: true, title: '用户管理', icon: '👥',
  comp: {
    name: 'UsersView',
    data() { return { S: Store, kw: '', onlyNamed: false, dlg: false, cur: null, boundTrips: [], boundPosts: [] }; },
    computed: {
      list() {
        let l = Store.users();
        const k = this.kw.trim().toLowerCase();
        if (k) l = l.filter(u => (u.nickname || '').toLowerCase().includes(k) || (u.openid || '').toLowerCase().includes(k));
        if (this.onlyNamed) l = l.filter(u => !u.anon && u.nickname);
        return l;
      },
      stats() {
        const all = Store.users();
        return {
          total: all.length,
          named: all.filter(u => !u.anon).length,
          anon: all.filter(u => u.anon).length
        };
      },
    },
    methods: {
      fmt(u) { return u.nickname || (u.anon ? '匿名用户' : '未命名用户'); },
      mask(id) { if (!id) return '—'; return id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id; },
      open(u) {
        this.cur = u;
        this.boundTrips = (Store.db.userTrip || []).filter(t => (t.openid || '') === u.openid && (!u.anon || !t.openid));
        this.boundPosts = (Store.db.inspirationPost || []).filter(p => (p.openid || '') === u.openid && (!u.anon || !p.openid));
        this.dlg = true;
      },
      copyId(id) {
        if (!id) return;
        const t = document.createElement('textarea'); t.value = id; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); ElementPlus.ElMessage.success('已复制 openid'); } catch (_) { window.prompt('openid：', id); }
        document.body.removeChild(t);
      },
      exportCSV() {
        const rows = [['昵称', 'openid', '行程数', '发帖数', '首次活跃', '最近活跃']];
        this.list.forEach(u => rows.push([u.nickname || (u.anon ? '匿名用户' : ''), u.openid || '', u.trips, u.posts, u.firstSeen, u.lastSeen]));
        const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'users_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        ElementPlus.ElMessage.success('已导出 ' + this.list.length + ' 位用户');
      },
      async refresh() {
        ElementPlus.ElMessage.info('正在从数据源刷新…');
        if (window.Cloud && Cloud.enabled()) {
          await syncFromCloudSafe();
          ElementPlus.ElMessage.success('已从云端刷新');
        } else {
          Store.syncFromServer();
          ElementPlus.ElMessage.success('已请求本地数据桥刷新');
        }
      },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <span class="soft">共 {{stats.total}} 位用户 · 有 openid {{stats.named}} · 匿名聚合 {{stats.anon}}</span>
          <el-checkbox v-model="onlyNamed">仅显示已登录用户</el-checkbox>
          <span class="spacer"></span>
          <el-button @click="refresh">🔄 刷新</el-button>
          <el-button @click="exportCSV">⬇ 导出 CSV</el-button>
          <el-input v-model="kw" placeholder="搜索昵称 / openid" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:14px"
          title="用户数据由「定制行程」与「灵感广场」的投稿作者信息聚合而来（只读）。小程序端用户资料仅存本机，故此处按 openid / 昵称聚合展示。" />
        <el-table :data="list" stripe height="calc(100vh - 260px)">
          <el-table-column label="用户" min-width="200">
            <template #default="{row}">
              <div class="flex gap10">
                <img class="avatar-sm" :src="img(row.avatar)" alt=""/>
                <div>
                  <div>{{fmt(row)}}</div>
                  <div class="faint" style="font-size:11px">{{mask(row.openid)}}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="行程数" width="90" align="center"><template #default="{row}">{{row.trips}}</template></el-table-column>
          <el-table-column label="发帖数" width="90" align="center"><template #default="{row}">{{row.posts}}</template></el-table-column>
          <el-table-column prop="firstSeen" label="首次活跃" width="170" />
          <el-table-column prop="lastSeen" label="最近活跃" width="170" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{row}"><el-button size="small" @click="open(row)">查看详情</el-button></template>
          </el-table-column>
          <template #empty><div class="faint" style="padding:24px">暂无用户数据</div></template>
        </el-table>
      </div>

      <el-drawer v-model="dlg" size="480px" :title="'用户详情 · ' + (cur ? fmt(cur) : '')" append-to-body>
        <div v-if="cur" style="padding:0 20px 20px">
          <div class="flex gap10" style="margin-bottom:16px">
            <img class="avatar-sm" style="width:56px;height:56px;border-radius:50%" :src="img(cur.avatar)" alt=""/>
            <div style="flex:1">
              <div style="font-size:16px;font-weight:600">{{fmt(cur)}}</div>
              <div class="faint" style="font-size:12px;word-break:break-all">openid：{{cur.openid || '（匿名/无）'}}</div>
              <el-button size="small" style="margin-top:6px" @click="copyId(cur.openid)" :disabled="!cur.openid">复制 openid</el-button>
            </div>
          </div>
          <div class="card" style="margin-bottom:14px;padding:12px 14px">
            <div class="flex gap10" style="justify-content:space-between">
              <div><div class="soft">定制行程</div><b>{{cur.trips}} 条</b></div>
              <div><div class="soft">灵感投稿</div><b>{{cur.posts}} 条</b></div>
              <div><div class="soft">首次活跃</div><b style="font-size:13px">{{cur.firstSeen || '—'}}</b></div>
              <div><div class="soft">最近活跃</div><b style="font-size:13px">{{cur.lastSeen || '—'}}</b></div>
            </div>
          </div>

          <div class="card" style="margin-bottom:14px">
            <div class="card-title">该用户的定制行程（{{boundTrips.length}}）</div>
            <div v-for="t in boundTrips" :key="t.id" style="border-bottom:1px dashed var(--line);padding:8px 0">
              <div style="font-weight:600">{{t.title}}</div>
              <div class="faint" style="font-size:12px">{{t.days}} 天 · {{t.createTime}}</div>
            </div>
            <div v-if="!boundTrips.length" class="faint" style="padding:8px 0">暂无关联行程</div>
          </div>

          <div class="card">
            <div class="card-title">该用户的灵感投稿（{{boundPosts.length}}）</div>
            <div v-for="p in boundPosts" :key="p.id" style="border-bottom:1px dashed var(--line);padding:8px 0">
              <div style="font-weight:600">{{p.title}}</div>
              <div class="faint" style="font-size:12px">{{p.type === 'note' ? '旅行笔记' : '行程分享'}} · 👍 {{p.like || 0}} · {{p.createTime}}</div>
            </div>
            <div v-if="!boundPosts.length" class="faint" style="padding:8px 0">暂无关联投稿</div>
          </div>
        </div>
      </el-drawer>
    </div>`,
  },
};

/* 云模式下重新拉取集合（供刷新用）：复用 store 的内部逻辑不可直接访问，这里走 Cloud.list */
async function syncFromCloudSafe() {
  if (!(window.Cloud && Cloud.enabled())) return;
  const colls = ['userTrip', 'inspirationPost'];
  for (const c of colls) {
    const list = await Cloud.list(c);
    if (Array.isArray(list) && list.length) Store.db[c] = list;
  }
}
