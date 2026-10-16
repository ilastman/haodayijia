/* ============ 视图：操作日志（只读） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.oplog = {
  nav: true, title: '操作日志', icon: '📝',
  comp: {
    name: 'OpLogView',
    data() { return { S: Store, kw: '', action: '' }; },
    computed: {
      actions() {
        const set = {};
        (Store.db.opLog || []).forEach(l => { if (l.action) set[l.action] = 1; });
        return Object.keys(set);
      },
      list() {
        let l = (Store.db.opLog || []).slice().sort((a, b) => (b.time || 0) - (a.time || 0));
        if (this.action) l = l.filter(x => x.action === this.action);
        const k = this.kw.trim();
        if (k) l = l.filter(x => (x.staffName || '').includes(k) || (x.summary || '').includes(k) || (x.targetId || '').includes(k));
        return l;
      },
    },
    methods: {
      fmt(t) { if (!t) return ''; const d = new Date(t); const p = n => (n < 10 ? '0' + n : n); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); },
      tagType(a) {
        if (['delete'].includes(a)) return 'danger';
        if (['archive', 'disable'].includes(a)) return 'warning';
        if (['add', 'enable', 'bind'].includes(a)) return 'success';
        return 'info';
      },
      async refresh() {
        if (window.Cloud && Cloud.enabled()) {
          const r = await Cloud.call('opLogCRUD', { action: 'list' });
          if (r && r.code === 200) { Store.db.opLog = r.data || []; ElementPlus.ElMessage.success('已刷新'); return; }
          ElementPlus.ElMessage.error((r && r.msg) || '刷新失败');
        } else { ElementPlus.ElMessage.info('本地模式无云端日志'); }
      },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <b>操作日志</b>
          <span class="soft" style="margin-left:10px">共 {{list.length}} 条</span>
          <span class="spacer"></span>
          <el-select v-model="action" style="width:150px" placeholder="全部动作">
            <el-option label="全部动作" value="" /><el-option v-for="a in actions" :key="a" :label="a" :value="a" />
          </el-select>
          <el-button @click="refresh">🔄 刷新</el-button>
          <el-input v-model="kw" placeholder="搜索员工 / 摘要 / ID" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-table :data="list" stripe height="calc(100vh - 240px)">
          <el-table-column label="时间" width="180"><template #default="{row}">{{fmt(row.time)}}</template></el-table-column>
          <el-table-column label="操作人" width="120"><template #default="{row}">{{row.staffName || '—'}}</template></el-table-column>
          <el-table-column label="动作" width="130"><template #default="{row}"><el-tag size="small" :type="tagType(row.action)">{{row.action}}</el-tag></template></el-table-column>
          <el-table-column label="目标" width="150"><template #default="{row}">{{row.targetType}} · {{row.targetId}}</template></el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="240" />
          <template #empty><div class="faint" style="padding:24px">暂无操作日志</div></template>
        </el-table>
      </div>
    </div>`,
  },
};
