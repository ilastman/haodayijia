/* ============ 视图：分类管理（景区三级 / 酒店两级，两套树分开） ============ */
window.VIEWS = window.VIEWS || {};

window.VIEWS.category = {
  nav: true, title: '分类管理', icon: '🏷',
  comp: {
    name: 'CategoryView',
    data() {
      return { S: Store, tree: 'scenic', busy: false, dlg: false, form: { id: '', parentId: '', name: '' } };
    },
    computed: {
      all() { return (Store.db.category || []).slice(); },
      rows() { return this.all.filter(c => c.tree === this.tree); },
      roots() { return this.kids(''); },
      parentOptions() {
        const max = this.tree === 'hotel' ? 1 : 2;
        return this.rows.filter(c => c.level <= max).slice().sort((a, b) => (a.level - b.level) || ((a.sort || 0) - (b.sort || 0)));
      }
    },
    created() { this.reload(); },
    methods: {
      async reload() {
        this.busy = true;
        try {
          const res = await Store.cloudCall('categoryCRUD', { action: 'list' });
          if (res && res.code === 200 && Array.isArray(res.data)) Store.db.category = res.data;
          else if (!Store.db.category) Store.db.category = [];
        } finally { this.busy = false; }
      },
      kids(parentId) {
        return this.rows.filter(c => String(c.parentId || '') === String(parentId || ''))
          .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
      },
      levelName(level) {
        if (this.tree === 'hotel') return level === 1 ? '大区' : '地点';
        return level === 1 ? '大区' : (level === 2 ? '类型' : '地点');
      },
      pathOf(c) {
        const names = [];
        let cur = c;
        let guard = 0;
        while (cur && guard < 5) {
          names.unshift(cur.name);
          cur = this.rows.filter(x => x.id === cur.parentId)[0];
          guard++;
        }
        return names.join(' / ');
      },
      openAdd(parent) {
        this.form = { id: '', parentId: parent ? parent.id : '', name: '' };
        this.dlg = true;
      },
      openEdit(row) {
        this.form = { id: row.id, parentId: row.parentId || '', name: row.name };
        this.dlg = true;
      },
      async save() {
        const name = String(this.form.name || '').trim();
        if (!name) { ElementPlus.ElMessage.warning('请填写分类名称'); return; }
        this.busy = true;
        try {
          const res = this.form.id
            ? await Store.cloudCall('categoryCRUD', { action: 'update', id: this.form.id, data: { name } })
            : await Store.cloudCall('categoryCRUD', { action: 'add', data: { tree: this.tree, parentId: this.form.parentId || '', name } });
          if (!res) { ElementPlus.ElMessage.warning('分类管理需要云端模式'); return; }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '保存失败'); return; }
          ElementPlus.ElMessage.success(res.msg || '已保存');
          this.dlg = false;
          await this.reload();
        } finally { this.busy = false; }
      },
      async remove(row) {
        this.busy = true;
        try {
          const res = await Store.cloudCall('categoryCRUD', { action: 'remove', id: row.id });
          if (!res) { ElementPlus.ElMessage.warning('分类管理需要云端模式'); return; }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '不能删除'); return; }
          ElementPlus.ElMessage.success('已删除');
          await this.reload();
        } finally { this.busy = false; }
      },
      async shift(row, delta) {
        const sibs = this.kids(row.parentId);
        const i = sibs.findIndex(s => s.id === row.id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= sibs.length) return;
        const ids = sibs.map(s => s.id);
        const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
        this.busy = true;
        try {
          const res = await Store.cloudCall('categoryCRUD', { action: 'reorder', orderedIds: ids });
          if (!res || res.code !== 200) { ElementPlus.ElMessage.error((res && res.msg) || '排序失败'); return; }
          await this.reload();
        } finally { this.busy = false; }
      }
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-radio-group v-model="tree">
            <el-radio-button label="scenic">景区分类树</el-radio-button>
            <el-radio-button label="hotel">酒店分类树</el-radio-button>
          </el-radio-group>
          <el-button type="primary" @click="openAdd(null)">＋ 新增大区</el-button>
          <span class="spacer"></span>
          <span class="faint">{{ tree === 'scenic' ? '三级：大区 → 类型 → 地点' : '两级：大区 → 地点' }}。改名后，已绑定的酒店/景区名称会一起更新。</span>
        </div>

        <div v-if="!roots.length" class="tac" style="padding:28px;color:var(--ink-faint)">暂无分类</div>
        <div v-for="r1 in roots" :key="r1.id" style="border-top:1px solid var(--line);padding:12px 0">
          <div style="display:flex;align-items:center;gap:8px">
            <b>{{r1.name}}</b>
            <span class="chip">{{levelName(1)}}</span>
            <span class="spacer"></span>
            <el-button size="small" link @click="shift(r1,-1)">上移</el-button>
            <el-button size="small" link @click="shift(r1,1)">下移</el-button>
            <el-button size="small" @click="openEdit(r1)">改名</el-button>
            <el-button size="small" type="primary" plain @click="openAdd(r1)">＋ 下级</el-button>
            <Confirm :title="'确认删除「' + r1.name + '」？有下级或已被使用时会拒绝。'" @ok="remove(r1)">
              <el-button size="small" type="danger" plain>删除</el-button>
            </Confirm>
          </div>
          <div v-for="r2 in kids(r1.id)" :key="r2.id" style="margin:8px 0 0 28px">
            <div style="display:flex;align-items:center;gap:8px">
              <span>{{r2.name}}</span>
              <span class="chip">{{levelName(2)}}</span>
              <span class="spacer"></span>
              <el-button size="small" link @click="shift(r2,-1)">上移</el-button>
              <el-button size="small" link @click="shift(r2,1)">下移</el-button>
              <el-button size="small" @click="openEdit(r2)">改名</el-button>
              <el-button v-if="tree === 'scenic'" size="small" type="primary" plain @click="openAdd(r2)">＋ 地点</el-button>
              <Confirm :title="'确认删除「' + r2.name + '」？'" @ok="remove(r2)">
                <el-button size="small" type="danger" plain>删除</el-button>
              </Confirm>
            </div>
            <div v-for="r3 in kids(r2.id)" :key="r3.id" style="margin:6px 0 0 28px;display:flex;align-items:center;gap:8px">
              <span class="soft">{{r3.name}}</span>
              <span class="chip">{{levelName(3)}}</span>
              <span class="spacer"></span>
              <el-button size="small" link @click="shift(r3,-1)">上移</el-button>
              <el-button size="small" link @click="shift(r3,1)">下移</el-button>
              <el-button size="small" @click="openEdit(r3)">改名</el-button>
              <Confirm :title="'确认删除「' + r3.name + '」？'" @ok="remove(r3)">
                <el-button size="small" type="danger" plain>删除</el-button>
              </Confirm>
            </div>
          </div>
        </div>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '修改分类名称' : '新增分类'" width="460px" append-to-body>
        <el-form label-width="88px">
          <el-form-item v-if="!form.id" label="上级">
            <el-select v-model="form.parentId" clearable style="width:100%" placeholder="不选则为一级大区">
              <el-option label="（作为一级大区）" value="" />
              <el-option v-for="p in parentOptions" :key="p.id" :label="pathOf(p)" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="名称" required>
            <el-input v-model="form.name" placeholder="如：呼伦贝尔 / 景区 / 海拉尔" />
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
