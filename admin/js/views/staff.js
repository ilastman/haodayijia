/* ============ 视图：员工账号管理 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.staff = {
  nav: true, title: '员工账号', icon: '🧑‍💼',
  comp: {
    name: 'StaffView',
    data() {
      return {
        S: Store, kw: '', status: '', dlg: false, form: {},
        transferDlg: false, transferFrom: null, transferTo: '', selected: []
      };
    },
    computed: {
      list() {
        let l = (Store.db.staff || []).slice().sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
        const k = this.kw.trim();
        if (k) l = l.filter(s => (s.name || '').includes(k) || (s.phone || '').includes(k));
        if (this.status !== '') l = l.filter(s => s.status === this.status);
        return l;
      },
      enabledStaff() { return (Store.db.staff || []).filter(s => s.status === 'enabled'); },
      stats() {
        const all = Store.db.staff || [];
        return { total: all.length, enabled: all.filter(s => s.status === 'enabled').length, bound: all.filter(s => s.openid).length };
      },
    },
    methods: {
      cloudOn() { return window.Cloud && Cloud.enabled(); },
      async call(action, data) {
        if (!this.cloudOn()) return null;
        return Cloud.call('staffCRUD', Object.assign({ action }, data || {}));
      },
      copy(t) {
        const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ElementPlus.ElMessage.success('已复制：' + t); } catch (_) { window.prompt('复制：', t); }
        document.body.removeChild(ta);
      },
      mask(id) { if (!id) return '未绑定'; return id.length > 16 ? id.slice(0, 8) + '…' + id.slice(-4) : id; },
      openAdd() { this.form = { id: '', name: '', phone: '', remark: '', status: 'enabled' }; this.dlg = true; },
      openEdit(s) { this.form = JSON.parse(JSON.stringify(s)); this.dlg = true; },
      async save() {
        const f = this.form;
        if (!String(f.name || '').trim()) { ElementPlus.ElMessage.warning('请输入员工姓名'); return; }
        if (f.id) { Store.update('staff', f.id, { name: f.name, phone: f.phone, remark: f.remark }); ElementPlus.ElMessage.success('已保存'); }
        else {
          Store.add('staff', { name: f.name, phone: f.phone, remark: f.remark, status: 'enabled' });
          if (this.cloudOn() && Store.reload) { await Store.reload(); }
          ElementPlus.ElMessage.success('已新增（系统已生成绑定码，可复制发给员工）');
        }
        this.dlg = false;
      },
      async setStatus(s, enable) {
        const r = await this.call(enable ? 'enable' : 'disable', { id: s.id });
        if (this.cloudOn() && (!r || r.code !== 200)) { ElementPlus.ElMessage.error((r && r.msg) || '操作失败'); return; }
        s.status = enable ? 'enabled' : 'disabled';
        Store.save();
        ElementPlus.ElMessage.success(enable ? '已启用' : '已停用');
      },
      async regen(s) {
        const r = await this.call('regenerateCode', { id: s.id });
        if (this.cloudOn()) {
          if (r && r.code === 200) { s.bindCode = (r.data && r.data.bindCode) || s.bindCode; Store.save(); ElementPlus.ElMessage.success('已重置绑定码：' + s.bindCode); }
          else ElementPlus.ElMessage.error((r && r.msg) || '操作失败');
        } else {
          s.bindCode = 'ST' + Math.random().toString(36).slice(2, 8).toUpperCase(); Store.save();
          ElementPlus.ElMessage.success('已重置绑定码：' + s.bindCode);
        }
      },
      async unbind(s) {
        const r = await this.call('unbind', { id: s.id });
        if (this.cloudOn() && (!r || r.code !== 200)) { ElementPlus.ElMessage.error((r && r.msg) || '操作失败'); return; }
        s.openid = ''; Store.save();
        ElementPlus.ElMessage.success('已解绑微信');
      },
      openTransfer(s) { this.transferFrom = s; this.transferTo = ''; this.transferDlg = true; },
      async doTransfer() {
        if (!this.transferTo) { ElementPlus.ElMessage.warning('请选择接收员工'); return; }
        const r = await this.call('transfer', { data: { fromStaffId: this.transferFrom.id, toStaffId: this.transferTo } });
        if (this.cloudOn()) {
          if (r && r.code === 200) {
            (Store.db.order || []).forEach(o => { if (o.staffId === this.transferFrom.id) { o.staffId = this.transferTo; const t = (Store.db.staff || []).find(x => x.id === this.transferTo); o.staffName = t ? t.name : o.staffName; } });
            Store.save();
            ElementPlus.ElMessage.success('已转移 ' + ((r.data && r.data.moved) || 0) + ' 单客户');
            this.transferDlg = false;
          } else ElementPlus.ElMessage.error((r && r.msg) || '转移失败');
        } else {
          (Store.db.order || []).forEach(o => { if (o.staffId === this.transferFrom.id) o.staffId = this.transferTo; });
          Store.save(); this.transferDlg = false; ElementPlus.ElMessage.success('已转移（本地）');
        }
      },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增员工</el-button>
          <span class="soft">共 {{stats.total}} 人 · 启用 {{stats.enabled}} · 已绑定 {{stats.bound}}</span>
          <span class="spacer"></span>
          <el-select v-model="status" style="width:130px" placeholder="状态">
            <el-option label="全部" value="" /><el-option label="启用" value="enabled" /><el-option label="停用" value="disabled" />
          </el-select>
          <el-input v-model="kw" placeholder="搜索姓名 / 电话" style="width:200px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:14px"
          title="员工将「绑定码」在小程序「我的 → 员工绑定」输入一次即可绑定微信；服务端据微信 openid 识别身份。离职请停用，勿删除（保留历史订单归属）。" />
        <el-table :data="list" stripe height="calc(100vh - 280px)">
          <el-table-column label="员工" min-width="140">
            <template #default="{row}"><div style="font-weight:600">{{row.name}}</div><div class="faint" style="font-size:12px">{{row.phone || '—'}}</div></template>
          </el-table-column>
          <el-table-column label="绑定码" width="150">
            <template #default="{row}">
              <span class="chip" style="cursor:pointer" @click="copy(row.bindCode)">{{row.bindCode || '—'}} ⧉</span>
            </template>
          </el-table-column>
          <el-table-column label="微信绑定" min-width="150">
            <template #default="{row}">
              <span v-if="row.openid" class="chip" style="cursor:pointer" @click="copy(row.openid)">{{mask(row.openid)}}</span>
              <span v-else class="soft">未绑定</span>
            </template>
          </el-table-column>
          <el-table-column label="客户数" width="90" align="center"><template #default="{row}">{{row.orderCount || 0}}</template></el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{row}"><span class="st" :class="row.status==='enabled' ? 'st-on' : 'st-off'">{{row.status==='enabled'?'启用':'停用'}}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="330" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" @click="regen(row)">重置码</el-button>
              <el-button size="small" :disabled="!row.openid" @click="unbind(row)">解绑</el-button>
              <el-button size="small" :type="row.status==='enabled'?'warning':'success'" @click="setStatus(row, row.status!=='enabled')">{{row.status==='enabled'?'停用':'启用'}}</el-button>
              <el-button size="small" @click="openTransfer(row)">转移</el-button>
            </template>
          </el-table-column>
          <template #empty><div class="faint" style="padding:24px">暂无员工，点击「新增员工」创建</div></template>
        </el-table>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑员工' : '新增员工'" width="480px" append-to-body>
        <el-form label-width="80px">
          <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="绑定码" v-if="form.id">
            <span class="chip" style="cursor:pointer" @click="copy(form.bindCode)">{{form.bindCode}} ⧉</span>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dlg = false">取消</el-button>
          <el-button type="primary" @click="save">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="transferDlg" title="离职客户转移" width="440px" append-to-body>
        <div v-if="transferFrom">
          <p class="soft">将「{{transferFrom.name}}」名下全部客户（订单）转移给：</p>
          <el-select v-model="transferTo" placeholder="选择接收员工" style="width:100%">
            <el-option v-for="s in enabledStaff" :key="s.id" :label="s.name" :value="s.id" :disabled="s.id===transferFrom.id" />
          </el-select>
        </div>
        <template #footer>
          <el-button @click="transferDlg = false">取消</el-button>
          <el-button type="primary" @click="doTransfer">确认转移</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};
