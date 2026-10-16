/* ============ 视图：全部订单（跨员工 · 管理员硬删除） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.orders = {
  nav: true, title: '全部订单', icon: '🧾',
  comp: {
    name: 'OrdersView',
    data() {
      return {
        S: Store, kw: '', staffFilter: '', statusFilter: '', archFilter: '', selected: [],
        dlg: false, cur: null, tab: 'base'
      };
    },
    computed: {
      STATUSES() { return ['意向客户', '待确认行程', '待定金', '待尾款', '待出团', '已完结', '客户流失']; },
      staffOptions() { return (Store.db.staff || []).map(s => ({ id: s.id, name: s.name })); },
      list() {
        let l = (Store.db.order || []).slice();
        const k = this.kw.trim();
        if (k) l = l.filter(o => ((o.customer && o.customer.name) || '').includes(k) || ((o.customer && o.customer.phone) || '').includes(k) || (o.dest || '').includes(k));
        if (this.staffFilter) l = l.filter(o => o.staffId === this.staffFilter);
        if (this.statusFilter) l = l.filter(o => o.status === this.statusFilter);
        if (this.archFilter !== '') l = l.filter(o => !!o.archived === (this.archFilter === '1'));
        return l.sort((a, b) => (b.updatedAt || b.createTime || 0) - (a.updatedAt || a.createTime || 0));
      },
      stats() {
        const all = Store.db.order || [];
        const sum = (fn) => all.reduce((s, o) => s + fn(o), 0);
        return {
          total: all.length,
          archived: all.filter(o => o.archived).length,
          quote: sum(o => (o.pricing && o.pricing.quote) || 0),
          profit: sum(o => (o.pricing && o.pricing.actualProfit) || 0)
        };
      },
    },
    methods: {
      cloudOn() { return window.Cloud && Cloud.enabled(); },
      n(v) { return Number(v) || 0; },
      staffName(id) { const s = (Store.db.staff || []).find(x => x.id === id); return (s && s.name) || id || '—'; },
      open(o) { this.cur = o; this.tab = 'base'; this.dlg = true; },
      async setArchived(o, val) {
        const r = this.cloudOn() ? await Cloud.call('orderCRUD', { action: val ? 'archive' : 'unarchive', id: o.id }) : null;
        if (this.cloudOn() && (!r || r.code !== 200)) { ElementPlus.ElMessage.error((r && r.msg) || '操作失败'); return; }
        o.archived = val; Store.save();
        ElementPlus.ElMessage.success(val ? '已归档' : '已取消归档');
      },
      async hardDel(o) {
        const r = this.cloudOn() ? await Cloud.call('orderCRUD', { action: 'delete', id: o.id }) : null;
        if (this.cloudOn() && (!r || r.code !== 200)) { ElementPlus.ElMessage.error((r && r.msg) || '删除失败'); return; }
        const i = (Store.db.order || []).findIndex(x => x.id === o.id);
        if (i > -1) Store.db.order.splice(i, 1);
        Store.save();
        ElementPlus.ElMessage.success('已彻底删除');
      },
      batchDel() {
        ElementPlus.ElMessageBox.confirm('将彻底删除所选 ' + this.selected.length + ' 条订单（不可恢复），确认？', '危险操作', { type: 'warning', confirmButtonText: '彻底删除' })
          .then(async () => {
            for (const id of this.selected.slice()) { const o = (Store.db.order || []).find(x => x.id === id); if (o) await this.hardDel(o); }
            this.selected = [];
          }).catch(() => {});
      },
      exportCSV() {
        const rows = [['客户', '电话', '归属员工', '人数', '目的地', '出行日期', '状态', '成交价', '总成本', '实际毛利', '归档']];
        this.list.forEach(o => rows.push([
          (o.customer && o.customer.name) || '', (o.customer && o.customer.phone) || '', this.staffName(o.staffId),
          o.people || 0, o.dest || '', o.departDate || '', o.status || '',
          (o.pricing && o.pricing.quote) || 0, o.totalCost || 0, (o.pricing && o.pricing.actualProfit) || 0, o.archived ? '是' : '否'
        ]));
        const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'orders_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click(); URL.revokeObjectURL(a.href);
        ElementPlus.ElMessage.success('已导出 ' + this.list.length + ' 条');
      },
    },
    template: `
    <div>
      <div class="card">
        <div class="kpis" style="display:flex;gap:14px;margin-bottom:14px">
          <div class="mini-stat"><span class="soft">订单总数</span><b>{{stats.total}}</b></div>
          <div class="mini-stat"><span class="soft">已归档</span><b>{{stats.archived}}</b></div>
          <div class="mini-stat"><span class="soft">成交额合计</span><b>¥{{stats.quote}}</b></div>
          <div class="mini-stat"><span class="soft">毛利合计</span><b>¥{{stats.profit}}</b></div>
        </div>
        <div class="toolbar">
          <el-select v-model="staffFilter" style="width:150px" placeholder="全部员工">
            <el-option label="全部员工" value="" /><el-option v-for="s in staffOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-select v-model="statusFilter" style="width:140px" placeholder="全部状态">
            <el-option label="全部状态" value="" /><el-option v-for="s in STATUSES" :key="s" :label="s" :value="s" />
          </el-select>
          <el-select v-model="archFilter" style="width:120px" placeholder="归档">
            <el-option label="全部" value="" /><el-option label="进行中" value="0" /><el-option label="已归档" value="1" />
          </el-select>
          <Confirm v-if="selected.length" title="确认彻底删除所选订单？此操作不可恢复" ok-text="彻底删除" @ok="batchDel">
            <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
          </Confirm>
          <span class="spacer"></span>
          <el-button @click="exportCSV">⬇ 导出 CSV</el-button>
          <el-input v-model="kw" placeholder="搜索客户 / 电话 / 目的地" style="width:240px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-table :data="list" stripe height="calc(100vh - 340px)"
          @selection-change="v => selected = v.map(x => x.id)">
          <el-table-column type="selection" width="44" />
          <el-table-column label="客户" min-width="150">
            <template #default="{row}"><div style="font-weight:600">{{(row.customer && row.customer.name) || '未命名'}}</div><div class="faint" style="font-size:12px">{{(row.customer && row.customer.phone) || '—'}}</div></template>
          </el-table-column>
          <el-table-column label="归属员工" width="110"><template #default="{row}">{{staffName(row.staffId)}}</template></el-table-column>
          <el-table-column label="行程" min-width="150"><template #default="{row}"><span>{{row.dest || '—'}}</span> <span class="faint">· {{row.people || 0}}人</span></template></el-table-column>
          <el-table-column prop="departDate" label="出行日期" width="120" />
          <el-table-column label="状态" width="110"><template #default="{row}"><span class="chip">{{row.status}}</span></template></el-table-column>
          <el-table-column label="成交/成本/毛利" width="190">
            <template #default="{row}">
              <div>¥{{(row.pricing && row.pricing.quote) || 0}}</div>
              <div class="faint" style="font-size:12px">成本 ¥{{row.totalCost || 0}} · 毛利 ¥{{(row.pricing && row.pricing.actualProfit) || 0}}</div>
            </template>
          </el-table-column>
          <el-table-column label="归档" width="80" align="center"><template #default="{row}"><span class="st" :class="row.archived ? 'st-off' : 'st-on'">{{row.archived ? '已归档' : '进行中'}}</span></template></el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="open(row)">查看</el-button>
              <el-button size="small" @click="setArchived(row, !row.archived)">{{row.archived ? '取消归档' : '归档'}}</el-button>
              <Confirm title="彻底删除该订单？不可恢复" ok-text="删除" @ok="hardDel(row)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
            </template>
          </el-table-column>
          <template #empty><div class="faint" style="padding:24px">暂无订单数据</div></template>
        </el-table>
      </div>

      <el-drawer v-model="dlg" size="620px" :title="cur ? ('订单详情 · ' + ((cur.customer && cur.customer.name) || '')) : ''" append-to-body>
        <div v-if="cur" style="padding:0 22px 24px">
          <el-tabs v-model="tab">
            <el-tab-pane label="基础 / 客户" name="base">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="客户姓名">{{(cur.customer && cur.customer.name) || '—'}}</el-descriptions-item>
                <el-descriptions-item label="联系电话">{{(cur.customer && cur.customer.phone) || '—'}}</el-descriptions-item>
                <el-descriptions-item label="微信">{{(cur.customer && cur.customer.wechat) || '—'}}</el-descriptions-item>
                <el-descriptions-item label="来源渠道">{{(cur.customer && cur.customer.source) || '—'}}</el-descriptions-item>
                <el-descriptions-item label="出行人数">{{cur.people || 0}}</el-descriptions-item>
                <el-descriptions-item label="目的地">{{cur.dest || '—'}}</el-descriptions-item>
                <el-descriptions-item label="出行 / 返程">{{cur.departDate || '—'}} ~ {{cur.returnDate || '—'}}</el-descriptions-item>
                <el-descriptions-item label="状态">{{cur.status}}</el-descriptions-item>
                <el-descriptions-item label="归属员工">{{staffName(cur.staffId)}}</el-descriptions-item>
                <el-descriptions-item label="备注">{{(cur.customer && cur.customer.remark) || '—'}}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
            <el-tab-pane :label="'跟进(' + ((cur.followUps||[]).length) + ')'" name="follow">
              <div v-for="f in cur.followUps || []" :key="f.id" class="card" style="margin-bottom:10px;padding:10px 12px">
                <div class="faint" style="font-size:12px">{{f.time}} · {{f.operator}}</div>
                <div>{{f.content}}</div>
                <div v-if="f.nextTime" class="soft" style="font-size:12px">下次：{{f.nextTime}}</div>
              </div>
              <div v-if="!(cur.followUps||[]).length" class="faint">暂无跟进记录</div>
            </el-tab-pane>
            <el-tab-pane :label="'行程(' + ((cur.itinerary && cur.itinerary.days || []).length) + ')'" name="itin">
              <div v-for="d in (cur.itinerary && cur.itinerary.days) || []" :key="d.dayNum" class="card" style="margin-bottom:10px;padding:10px 12px">
                <div style="font-weight:600">第{{d.dayNum}}天 · {{d.title}}</div>
                <div style="white-space:pre-wrap">{{d.content}}</div>
                <div class="soft" style="font-size:12px"><span v-if="d.meals">餐：{{d.meals}} </span><span v-if="d.hotel">住：{{d.hotel}}</span></div>
              </div>
              <div v-if="!(cur.itinerary && cur.itinerary.days && cur.itinerary.days.length)" class="faint">暂无行程单</div>
            </el-tab-pane>
            <el-tab-pane :label="'收款(' + ((cur.payments||[]).length) + ')'" name="pay">
              <el-table :data="cur.payments || []" size="small">
                <el-table-column prop="type" label="类型" width="80" />
                <el-table-column prop="amount" label="金额" width="100" />
                <el-table-column prop="time" label="日期" width="110" />
                <el-table-column prop="dueDate" label="应付截止" width="110" />
                <el-table-column prop="remark" label="备注" />
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="成本 / 毛利" name="profit">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="酒店">¥{{(cur.costs && cur.costs.hotel) || 0}}</el-descriptions-item>
                <el-descriptions-item label="车辆">¥{{(cur.costs && cur.costs.car) || 0}}</el-descriptions-item>
                <el-descriptions-item label="导游">¥{{(cur.costs && cur.costs.guide) || 0}}</el-descriptions-item>
                <el-descriptions-item label="门票">¥{{(cur.costs && cur.costs.ticket) || 0}}</el-descriptions-item>
                <el-descriptions-item label="餐费">¥{{(cur.costs && cur.costs.meal) || 0}}</el-descriptions-item>
                <el-descriptions-item label="杂费">¥{{(cur.costs && cur.costs.misc) || 0}}</el-descriptions-item>
                <el-descriptions-item label="总成本">¥{{cur.totalCost || 0}}</el-descriptions-item>
                <el-descriptions-item label="客户成交价">¥{{(cur.pricing && cur.pricing.quote) || 0}}</el-descriptions-item>
                <el-descriptions-item label="预估毛利">¥{{(cur.pricing && cur.pricing.estProfit) || 0}}</el-descriptions-item>
                <el-descriptions-item label="实际毛利">¥{{(cur.pricing && cur.pricing.actualProfit) || 0}}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-drawer>
    </div>`,
  },
};
