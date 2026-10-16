const HomeModuleView = {
  template: `
    <div>
      <div class="card"><el-button type="primary" @click="openAdd">新增板块</el-button></div>
      <div class="card" v-for="item in list" :key="item._id">
        <div>标题：{{item.title}} | 排序：{{item.sort}} | 启用：{{item.enable}}</div>
        <div class="mt12 flex">
          <el-button size="small" @click="up(item)">上移</el-button>
          <el-button size="small" @click="down(item)">下移</el-button>
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="del(item)">删除</el-button>
        </div>
      </div>
      <el-dialog v-model="dlg" title="板块编辑">
        <el-form label-width="90px">
          <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
          <el-form-item label="图标">
            <div class="flex"><el-input v-model="form.iconUrl" /><input type="file" accept="image/*" @change="onIconUpload" /></div>
          </el-form-item>
          <el-form-item label="描述"><el-input v-model="form.desc" /></el-form-item>
          <el-form-item label="跳转路由"><el-input v-model="form.pageRoute" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="form.enable" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dlg=false">取消</el-button>
          <el-button type="primary" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>
  `,
  data() {
    return {
      list: [],
      dlg: false,
      editing: null,
      form: { title: '', iconUrl: '', desc: '', pageRoute: '', sort: 0, enable: true }
    };
  },
  async mounted() { await this.load(); },
  methods: {
    async load() {
      const res = await API.call('homeModuleCRUD', { action: 'list', token: API.getToken() });
      this.list = (res.result && res.result.data) || [];
    },
    openAdd() {
      this.editing = null;
      this.form = { title: '', iconUrl: '', desc: '', pageRoute: '', sort: 0, enable: true };
      this.dlg = true;
    },
    openEdit(item) {
      this.editing = item;
      this.form = {
        title: item.title || '', iconUrl: item.iconUrl || '', desc: item.desc || '',
        pageRoute: item.pageRoute || '', sort: item.sort || 0, enable: item.enable !== false
      };
      this.dlg = true;
    },
    async onIconUpload(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const ext = f.name.split('.').pop() || 'png';
        const url = await API.uploadImage(f, ext);
        if (url) this.form.iconUrl = url;
      } catch (err) {}
    },
    async save() {
      if (this.editing) {
        await API.call('homeModuleCRUD', { action: 'update', token: API.getToken(), id: this.editing._id, data: this.form });
      } else {
        await API.call('homeModuleCRUD', { action: 'add', token: API.getToken(), data: this.form });
      }
      this.dlg = false;
      await this.load();
    },
    async del(item) {
      if (!confirm('删除该板块？')) return;
      await API.call('homeModuleCRUD', { action: 'delete', token: API.getToken(), id: item._id });
      await this.load();
    },
    async up(item) {
      const idx = this.list.findIndex(x => x._id === item._id);
      if (idx <= 0) return;
      const a = this.list[idx - 1], b = item;
      await API.call('homeModuleCRUD', { action: 'sort', token: API.getToken(), sortList: [{ id: a._id, sort: b.sort }, { id: b._id, sort: a.sort }] });
      await this.load();
    },
    async down(item) {
      const idx = this.list.findIndex(x => x._id === item._id);
      if (idx < 0 || idx >= this.list.length - 1) return;
      const a = item, b = this.list[idx + 1];
      await API.call('homeModuleCRUD', { action: 'sort', token: API.getToken(), sortList: [{ id: a._id, sort: b.sort }, { id: b._id, sort: a.sort }] });
      await this.load();
    }
  }
};
