/* ============ 视图：客户管理（按客户聚合，一客户一订单） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.customers = {
  nav: true, title: '客户管理', icon: '👤',
  comp: {
    name: 'CustomersView',
    data() { return { S: Store, kw: '', staffFilter: '', dlg: false, cur: null }; },
    computed: {
      staffOptions() { return (Store.db.staff || []).map(s => ({ id: s.id, name: s.name })); },
      rows() {
        const map = {};
        (Store.db.order || []).forEach(o => {
          const c = o.customer || {};
          const key = (c.phone || '') + '|' + (c.name || '');
          if (!map[key]) map[key] = { key, name: c.name || '未命名', phone: c.phone || '', wechat: c.wechat || '', source: c.source || '', staffId: o.staffId, orders: [] };
          map[key].orders.push(o);
          if (o.updatedAt > (map[key]._t || 0)) { map[key]._t = o.updatedAt || 0; map[key].status = o.status; map[key].dest = o.dest; map[key].staffId = o.staffId; }
        });
        let l = Object.keys(map).map(k => map[k]);
        const q = this.kw.trim();
        if (q) l = l.filter(r => r.name.includes(q) || r.phone.includes(q) || (r.dest || '').includes(q));
        if (this.staffFilter) l = l.filter(r => r.staffId === this.staffFilter);
        return l.sort((a, b) => (b._t || 0) - (a._t || 0));
      },
    },
    methods: {
      staffName(id) { const s = (Store.db.staff || []).find(x => x.id === id); return (s && s.name) || id || '—'; },
      amountOf(r) { return r.orders.reduce((s, o) => s + ((o.pricing && o.pricing.quote) || 0), 0); },
      followCount(r) { return r.orders.reduce((s, o) => s + ((o.followUps || []).length), 0); },
      open(r) { this.cur = r; this.dlg = true; },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <span class="soft">共 {{rows.length}} 位客户</span>
          <span class="spacer"></span>
          <el-select v-model="staffFilter" style="width:150px" placeholder="全部员工">
            <el-option label="全部员工" value="" /><el-option v-for="s in staffOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-input v-model="kw" placeholder="搜索客户 / 电话 / 目的地" style="width:240px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-table :data="rows" stripe height="calc(100vh - 240px)">
          <el-table-column label="客户" min-width="150">
            <template #default="{row}"><div style="font-weight:600">{{row.name}}</div><div class="faint" style="font-size:12px">{{row.phone || '—'}}</div></template>
          </el-table-column>
          <el-table-column label="来源" width="110"><template #default="{row}">{{row.source || '—'}}</template></el-table-column>
          <el-table-column label="当前行程" min-width="150"><template #default="{row}">{{row.dest || '—'}} <span class="chip" style="margin-left:6px">{{row.status || '—'}}</span></template></el-table-column>
          <el-table-column label="归属员工" width="110"><template #default="{row}">{{staffName(row.staffId)}}</template></el-table-column>
          <el-table-column label="跟进次数" width="100" align="center"><template #default="{row}">{{followCount(row)}}</template></el-table-column>
          <el-table-column label="成交额" width="120" align="right"><template #default="{row}">¥{{amountOf(row)}}</template></el-table-column>
          <el-table-column label="操作" width="100" fixed="right"><template #default="{row}"><el-button size="small" @click="open(row)">查看</el-button></template></el-table-column>
          <template #empty><div class="faint" style="padding:24px">暂无客户数据</div></template>
        </el-table>
      </div>

      <el-drawer v-model="dlg" size="520px" :title="cur ? ('客户详情 · ' + cur.name) : ''" append-to-body>
        <div v-if="cur" style="padding:0 22px 24px">
          <el-descriptions :column="1" border size="small" style="margin-bottom:14px">
            <el-descriptions-item label="姓名">{{cur.name}}</el-descriptions-item>
            <el-descriptions-item label="电话">{{cur.phone || '—'}}</el-descriptions-item>
            <el-descriptions-item label="微信">{{cur.wechat || '—'}}</el-descriptions-item>
            <el-descriptions-item label="来源">{{cur.source || '—'}}</el-descriptions-item>
            <el-descriptions-item label="归属员工">{{staffName(cur.staffId)}}</el-descriptions-item>
          </el-descriptions>
          <div class="card" v-for="o in cur.orders" :key="o.id" style="margin-bottom:12px;padding:12px 14px">
            <div class="flex-between"><b>{{o.dest || '行程待定'}} · {{o.people || 0}}人</b><span class="chip">{{o.status}}</span></div>
            <div class="faint" style="font-size:12px;margin-top:6px">出行：{{o.departDate || '待定'}} · 成交 ¥{{(o.pricing && o.pricing.quote) || 0}} · 跟进 {{(o.followUps||[]).length}} 次</div>
          </div>
        </div>
      </el-drawer>
    </div>`,
  },
};
