/* ============ 视图：专属行程四段条款模板 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.clause = {
  nav: true, title: '行程条款模板', icon: '📜',
  comp: {
    name: 'ClauseView',
    data() {
      return {
        kinds: [
          { kind: 'include', title: '费用包含' },
          { kind: 'exclude', title: '费用不含' },
          { kind: 'notice', title: '出行须知' },
          { kind: 'refund', title: '退改政策' }
        ],
        kind: 'include',
        list: [],
        busy: false,
        dlg: false,
        form: this.blank()
      };
    },
    computed: {
      rows() { return this.list.filter(t => t.kind === this.kind); },
      isNotice() { return this.kind === 'notice' || this.form.kind === 'notice'; }
    },
    created() { this.reload(); },
    methods: {
      blank() {
        return { id: '', kind: this.kind || 'include', name: '', enabled: true, sort: 1, linesText: '', tipsText: '', gearText: '' };
      },
      textOf(arr) { return (arr || []).join('\n'); },
      split(text) { return String(text || '').split(/\n/).map(s => s.trim()).filter(Boolean); },
      async reload() {
        this.busy = true;
        try {
          const res = await Store.cloudCall('clauseCRUD', { action: 'list' });
          this.list = (res && res.code === 200 && Array.isArray(res.data)) ? res.data : [];
          if (!this.list.length) {
            ElementPlus.ElMessage.warning('还没有读到模板。请先部署云函数 clauseCRUD，并确认网关白名单已包含它。');
          }
        } catch (e) {
          this.list = [];
          ElementPlus.ElMessage.error('读取条款模板失败');
        } finally { this.busy = false; }
      },
      openAdd() {
        this.form = this.blank();
        this.form.kind = this.kind;
        this.dlg = true;
      },
      openEdit(row) {
        this.form = {
          id: row.id,
          kind: row.kind,
          name: row.name,
          enabled: row.enabled !== false,
          sort: row.sort || 1,
          linesText: this.textOf(row.lines),
          tipsText: this.textOf(row.tips),
          gearText: this.textOf(row.gear)
        };
        this.dlg = true;
      },
      payload() {
        const f = this.form;
        const doc = { id: f.id, kind: f.kind, name: f.name, enabled: !!f.enabled, sort: Number(f.sort) || 0 };
        if (f.kind === 'notice') {
          doc.tips = this.split(f.tipsText);
          doc.gear = this.split(f.gearText);
          doc.lines = [];
        } else {
          doc.lines = this.split(f.linesText);
        }
        return doc;
      },
      async save() {
        const doc = this.payload();
        const action = doc.id ? 'update' : 'add';
        const res = await Store.cloudCall('clauseCRUD', { action, id: doc.id, data: doc });
        if (!res || res.code !== 200) {
          ElementPlus.ElMessage.error((res && res.msg) || '保存失败');
          return;
        }
        this.dlg = false;
        ElementPlus.ElMessage.success('已保存');
        this.reload();
      },
      async remove(row) {
        try {
          await ElementPlus.ElMessageBox.confirm('删除模板「' + row.name + '」？已生成的行程仍保留当时的快照。', '删除模板', { type: 'warning' });
        } catch (e) { return; }
        const res = await Store.cloudCall('clauseCRUD', { action: 'remove', id: row.id });
        if (!res || res.code !== 200) {
          ElementPlus.ElMessage.error((res && res.msg) || '删除失败');
          return;
        }
        this.reload();
      },
      async toggle(row) {
        const res = await Store.cloudCall('clauseCRUD', {
          action: 'update', id: row.id,
          data: Object.assign({}, row, { enabled: row.enabled === false })
        });
        if (!res || res.code !== 200) {
          ElementPlus.ElMessage.error((res && res.msg) || '更新失败');
          return;
        }
        this.reload();
      }
    },
    template: `
    <div v-loading="busy">
      <div class="flex gap10" style="margin-bottom:12px">
        <el-radio-group v-model="kind">
          <el-radio-button v-for="k in kinds" :key="k.kind" :value="k.kind">{{k.title}}</el-radio-button>
        </el-radio-group>
        <span class="spacer"></span>
        <el-button type="primary" @click="openAdd">新增模板</el-button>
      </div>
      <el-table :data="rows" border>
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column label="内容">
          <template #default="{row}">
            <div class="faint" v-if="row.kind==='notice'">注意事项 {{(row.tips||[]).length}} 条 · 装备 {{(row.gear||[]).length}} 条</div>
            <div class="faint" v-else>{{(row.lines||[]).slice(0,2).join('；')}}</div>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{row}"><el-tag :type="row.enabled===false?'info':'success'">{{row.enabled===false?'停用':'启用'}}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{row}">
            <el-button link @click="openEdit(row)">编辑</el-button>
            <el-button link @click="toggle(row)">{{row.enabled===false?'启用':'停用'}}</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-dialog v-model="dlg" :title="form.id ? '编辑模板' : '新增模板'" width="640px">
        <el-form label-width="100px">
          <el-form-item label="类型">
            <el-select v-model="form.kind" :disabled="!!form.id" style="width:100%">
              <el-option v-for="k in kinds" :key="k.kind" :label="k.title" :value="k.kind" />
            </el-select>
          </el-form-item>
          <el-form-item label="名称"><el-input v-model="form.name" maxlength="40" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
          <template v-if="form.kind==='notice'">
            <el-form-item label="注意事项"><el-input v-model="form.tipsText" type="textarea" :rows="6" placeholder="一行一条" /></el-form-item>
            <el-form-item label="装备建议"><el-input v-model="form.gearText" type="textarea" :rows="4" placeholder="一行一条，预览页显示为标签" /></el-form-item>
          </template>
          <el-form-item v-else label="条款"><el-input v-model="form.linesText" type="textarea" :rows="8" placeholder="一行一条" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dlg=false">取消</el-button>
          <el-button type="primary" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>`
  }
};
