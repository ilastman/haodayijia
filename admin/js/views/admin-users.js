/* ============ 视图：后台管理员（仅超级管理员可见，与员工账号隔离） ============ */
window.VIEWS = window.VIEWS || {};

window.VIEWS['admin-users'] = {
  nav: true, title: '后台管理员', icon: '🔐',
  comp: {
    name: 'AdminUsersView',
    data() {
      return { rows: [], kw: '', busy: false, dlg: false, form: {} };
    },
    computed: {
      list() {
        const k = (this.kw || '').trim();
        let l = this.rows.slice();
        if (k) l = l.filter(a => (a.username || '').includes(k) || (a.nickname || '').includes(k));
        return l;
      }
    },
    created() { this.reload(); },
    methods: {
      roleTxt(r) { return r === 'super' ? '超级管理员' : '普通后台管理员'; },
      async reload() {
        this.busy = true;
        try {
          const res = await Store.cloudCall('adminUserCRUD', { action: 'list' });
          if (res && res.code === 200 && Array.isArray(res.data)) this.rows = res.data;
          else if (!res) this.rows = (Store.db.admin || []).map(a => ({
            id: a.id, username: a.username, nickname: a.nickname || '',
            role: a.role === 'super' || a.username === 'admin' ? 'super' : 'admin',
            status: a.status === 'disabled' ? 'disabled' : 'enabled',
            lastLogin: a.lastLogin || '', locked: a.username === 'admin'
          }));
        } finally { this.busy = false; }
      },
      openAdd() {
        this.form = { id: '', username: '', nickname: '', password: '', role: 'admin' };
        this.dlg = true;
      },
      openEdit(row) {
        this.form = { id: row.id, username: row.username, nickname: row.nickname, password: '', role: row.role, locked: row.locked };
        this.dlg = true;
      },
      async save() {
        const f = this.form;
        if (!f.id && !String(f.username || '').trim()) { ElementPlus.ElMessage.warning('请填写登录账号'); return; }
        if (!f.id && String(f.password || '').length < 6) { ElementPlus.ElMessage.warning('密码至少 6 位'); return; }
        if (f.id && f.password && String(f.password).length < 6) { ElementPlus.ElMessage.warning('密码至少 6 位'); return; }
        this.busy = true;
        try {
          const payload = f.id
            ? { action: 'update', id: f.id, data: { nickname: f.nickname, role: f.role, password: f.password || undefined } }
            : { action: 'add', data: { username: f.username, nickname: f.nickname, password: f.password, role: f.role } };
          const res = await Store.cloudCall('adminUserCRUD', payload);
          if (!res) {
            if (!Store.db.admin) Store.db.admin = [];
            if (f.id) {
              const it = Store.db.admin.find(a => a.id === f.id);
              if (it) { it.nickname = f.nickname; it.role = f.role; if (f.password) it.password = f.password; }
            } else {
              Store.db.admin.push({ id: 'admin_' + Date.now(), username: f.username, password: f.password, nickname: f.nickname || f.username, role: f.role, status: 'enabled' });
            }
            Store.save();
            ElementPlus.ElMessage.success('已保存（本地）');
            this.dlg = false;
            await this.reload();
            return;
          }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '保存失败'); return; }
          ElementPlus.ElMessage.success(res.msg || '已保存');
          this.dlg = false;
          await this.reload();
        } finally { this.busy = false; }
      },
      async setStatus(row, enable) {
        this.busy = true;
        try {
          const res = await Store.cloudCall('adminUserCRUD', { action: 'update', id: row.id, data: { status: enable ? 'enabled' : 'disabled' } });
          if (!res) { ElementPlus.ElMessage.warning('需要云端模式'); return; }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '操作失败'); return; }
          ElementPlus.ElMessage.success(enable ? '已启用' : '已停用');
          await this.reload();
        } finally { this.busy = false; }
      },
      async remove(row) {
        this.busy = true;
        try {
          const res = await Store.cloudCall('adminUserCRUD', { action: 'remove', id: row.id });
          if (!res) { ElementPlus.ElMessage.warning('需要云端模式'); return; }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '不能删除'); return; }
          ElementPlus.ElMessage.success('已删除');
          await this.reload();
        } finally { this.busy = false; }
      }
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增后台管理员</el-button>
          <span class="faint">仅超级管理员可管理。与左侧「员工账号」不是同一套，不能用来登录小程序工作台。</span>
          <span class="spacer"></span>
          <el-input v-model="kw" placeholder="搜索账号 / 昵称" style="width:200px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <el-table :data="list" stripe v-loading="busy" height="calc(100vh - 260px)">
          <el-table-column label="账号" min-width="140">
            <template #default="{row}">
              <div style="font-weight:600">{{row.username}} <span class="chip" v-if="row.locked">初始</span></div>
              <div class="faint" style="font-size:12px">{{row.nickname || '—'}}</div>
            </template>
          </el-table-column>
          <el-table-column label="角色" width="160"><template #default="{row}">{{roleTxt(row.role)}}</template></el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{row}"><span class="st" :class="row.status==='enabled' ? 'st-on' : 'st-off'">{{row.status==='enabled'?'启用':'停用'}}</span></template>
          </el-table-column>
          <el-table-column label="最近登录" min-width="160"><template #default="{row}">{{row.lastLogin || '—'}}</template></el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{row}">
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" :type="row.status==='enabled'?'warning':'success'" :disabled="row.locked" @click="setStatus(row, row.status!=='enabled')">{{row.status==='enabled'?'停用':'启用'}}</el-button>
              <Confirm v-if="!row.locked" :title="'确认删除后台账号「' + row.username + '」？'" @ok="remove(row)">
                <el-button size="small" type="danger" plain>删除</el-button>
              </Confirm>
            </template>
          </el-table-column>
          <template #empty><div class="faint" style="padding:24px">暂无账号</div></template>
        </el-table>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑后台管理员' : '新增后台管理员'" width="480px" append-to-body>
        <el-form label-width="96px">
          <el-form-item label="登录账号" required>
            <el-input v-model="form.username" :disabled="!!form.id" placeholder="3–32 位字母、数字或下划线" />
          </el-form-item>
          <el-form-item label="昵称"><el-input v-model="form.nickname" placeholder="显示名称" /></el-form-item>
          <el-form-item :label="form.id ? '新密码' : '登录密码'" :required="!form.id">
            <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '不改请留空' : '至少 6 位'" />
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="form.role" :disabled="!!form.locked" style="width:100%">
              <el-option label="普通后台管理员" value="admin" />
              <el-option label="超级管理员" value="super" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dlg = false">取消</el-button>
          <el-button type="primary" :loading="busy" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>`
  }
};
