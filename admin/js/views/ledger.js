/* ============ 视图：全员台账（毛利汇总） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.ledger = {
  nav: true, title: '全员台账', icon: '📈',
  comp: {
    name: 'LedgerView',
    data() { return { S: Store, rep: null, loading: false, from: 'cloud' }; },
    computed: {
      byStaff() { return (this.rep && this.rep.byStaff) || []; },
      byStatus() {
        const m = (this.rep && this.rep.byStatus) || {};
        return Object.keys(m).map(k => ({ status: k, count: m[k] }));
      },
    },
    methods: {
      localReport() {
        const list = Store.db.order || [];
        const byStatus = {}; const byStaff = {};
        let totalQuote = 0, totalCost = 0, totalEst = 0, totalActual = 0;
        let displayQuote = 0, displayCost = 0, displayProfit = 0;
        list.forEach(o => {
          byStatus[o.status] = (byStatus[o.status] || 0) + 1;
          const sid = o.staffId || 'unknown';
          if (!byStaff[sid]) byStaff[sid] = { staffId: sid, staffName: this.staffName(sid), count: 0, quote: 0, cost: 0, est: 0, actual: 0, displayQuote: 0, displayCost: 0, displayActual: 0 };
          const b = byStaff[sid];
          const quote = (o.pricing && o.pricing.quote) || 0;
          const cost = o.totalCost || 0;
          b.count++; b.quote += quote; b.cost += cost;
          b.est += (o.pricing && o.pricing.estProfit) || 0;
          b.actual += (o.pricing && o.pricing.actualProfit) || 0;
          totalQuote += quote; totalCost += cost;
          totalEst += (o.pricing && o.pricing.estProfit) || 0;
          totalActual += (o.pricing && o.pricing.actualProfit) || 0;
          const fin = Store.orderFinance(o);
          b.displayQuote += fin.quote;
          b.displayCost += fin.cost;
          b.displayActual += fin.profit;
          displayQuote += fin.quote;
          displayCost += fin.cost;
          displayProfit += fin.profit;
        });
        return {
          count: list.length, totalQuote, totalCost, totalEst, totalActual,
          grossProfit: totalQuote - totalCost,
          displayQuote, displayCost, displayProfit,
          byStatus, byStaff: Object.keys(byStaff).map(k => byStaff[k]),
          archived: list.filter(o => o.archived).length
        };
      },
      staffName(id) { const s = (Store.db.staff || []).find(x => x.id === id); return (s && s.name) || id || '—'; },
      async load() {
        this.loading = true;
        const local = this.localReport();
        if (window.Cloud && Cloud.enabled()) {
          const r = await Cloud.call('orderCRUD', { action: 'report' });
          if (r && r.code === 200 && r.data) {
            const rep = r.data;
            if (rep.displayQuote == null) {
              rep.displayQuote = local.displayQuote;
              rep.displayCost = local.displayCost;
              rep.displayProfit = local.displayProfit;
              const byId = {};
              local.byStaff.forEach(b => { byId[b.staffId] = b; });
              (rep.byStaff || []).forEach(b => {
                const s = byId[b.staffId];
                if (!s) return;
                b.displayQuote = s.displayQuote;
                b.displayCost = s.displayCost;
                b.displayActual = s.displayActual;
              });
            }
            this.rep = rep; this.from = 'cloud'; this.loading = false; return;
          }
        }
        this.rep = local; this.from = 'local'; this.loading = false;
      },
      exportCSV() {
        const rows = [['员工', '订单数', '成交额', '成本', '预估毛利', '实际毛利']];
        this.byStaff.forEach(b => rows.push([this.staffName(b.staffId), b.count, b.quote, b.cost, b.est, b.actual]));
        const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ledger_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click(); URL.revokeObjectURL(a.href);
        ElementPlus.ElMessage.success('已导出台账');
      },
    },
    mounted() { this.load(); },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <b>全员经营台账</b>
          <span class="faint" style="margin-left:10px">{{from === 'cloud' ? '（云端实时）' : '（本地数据）'}}</span>
          <span class="spacer"></span>
          <el-button @click="load">🔄 刷新</el-button>
          <el-button @click="exportCSV">⬇ 导出 CSV</el-button>
        </div>
        <div v-if="rep" class="kpis" style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap">
          <div class="mini-stat"><span class="soft">订单总数</span><b>{{rep.count}}</b></div>
          <div class="mini-stat"><span class="soft">成交额合计</span><b>¥{{rep.displayQuote || 0}}</b></div>
          <div class="mini-stat"><span class="soft">成本合计</span><b>¥{{rep.displayCost || 0}}</b></div>
          <div class="mini-stat"><span class="soft">毛利合计</span><b style="color:var(--accent)">¥{{rep.displayProfit || 0}}</b></div>
          <div class="mini-stat"><span class="soft">预估毛利</span><b>¥{{rep.displayProfit || 0}}</b></div>
          <div class="mini-stat"><span class="soft">已归档</span><b>{{rep.archived}}</b></div>
        </div>

        <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
          <div class="card" style="flex:2;min-width:420px">
            <div class="card-title">按员工统计</div>
            <el-table :data="byStaff" size="small" stripe>
              <el-table-column label="员工" min-width="120"><template #default="{row}">{{staffName(row.staffId)}}</template></el-table-column>
              <el-table-column prop="count" label="订单" width="70" align="center" />
              <el-table-column prop="displayQuote" label="成交额" width="100" align="right" />
              <el-table-column prop="displayCost" label="成本" width="100" align="right" />
              <el-table-column prop="displayActual" label="实际毛利" width="100" align="right" />
              <template #empty><div class="faint" style="padding:18px">暂无数据</div></template>
            </el-table>
          </div>
          <div class="card" style="flex:1;min-width:240px">
            <div class="card-title">按状态分布</div>
            <el-table :data="byStatus" size="small" stripe>
              <el-table-column prop="status" label="状态" />
              <el-table-column prop="count" label="数量" width="80" align="center" />
            </el-table>
          </div>
        </div>
      </div>
    </div>`,
  },
};
