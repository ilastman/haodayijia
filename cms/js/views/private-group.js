const PrivateGroupView = {
  template: `
    <div>
      <div class="card"><el-button type="primary" @click="openAdd">新增私家团</el-button></div>
      <div class="card" v-for="item in list" :key="item._id">
        <div>{{item.title}} | 天数：{{item.dayCount}} | 上架：{{item.enable}}</div>
        <div class="mt12 flex">
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="del(item)">删除</el-button>
        </div>
      </div>
      <el-dialog v-model="dlg" title="私家团编辑" width="860px">
        <el-form label-width="110px">
          <el-form-item label="团名称"><el-input v-model="form.title" /></el-form-item>
          <el-form-item label="封面图">
            <div class="flex"><el-input v-model="form.coverImg" /><input type="file" accept="image/*" @change="onCoverUpload" /></div>
          </el-form-item>
          <el-form-item label="行程天数"><el-input-number v-model="form.dayCount" :min="1" /></el-form-item>
          <el-form-item label="产品亮点"><el-input v-model="form.highLight" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="产品介绍"><el-input v-model="form.detail" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="多日行程">
            <div v-for="(d, idx) in form.dayList" :key="idx" class="card">
              <div class="flex">
                <el-input-number v-model="d.dayNum" :min="1" style="width:120px" />
                <el-input v-model="d.dayTitle" placeholder="当日主题" />
              </div>
              <div class="mt12 flex">
                <el-select v-model="d.scenicId" placeholder="选择景区" clearable style="width:220px">
                  <el-option v-for="s in scenicList" :key="s._id" :label="s.name" :value="s._id" />
                </el-select>
                <el-select v-model="d.hotelId" placeholder="选择酒店" clearable style="width:220px">
                  <el-option v-for="h in hotelList" :key="h._id" :label="h.name" :value="h._id" />
                </el-select>
              </div>
              <div class="mt12"><el-input v-model="d.dayContent" type="textarea" :rows="2" placeholder="当日行程详情" /></div>
              <div class="mt12"><el-button size="small" type="danger" @click="rmDay(idx)">删除当天</el-button></div>
            </div>
            <el-button size="small" @click="addDay">新增一天</el-button>
          </el-form-item>
          <el-form-item label="上架"><el-switch v-model="form.enable" /></el-form-item>
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
      list: [], dlg: false, editing: null, scenicList: [], hotelList: [],
      form: { title: '', coverImg: '', dayCount: 1, highLight: '', detail: '', dayList: [], enable: true }
    };
  },
  async mounted() { await this.load(); await this.loadRefs(); },
  methods: {
    async load() {
      const res = await API.call('privateGroupCRUD', { action: 'list', token: API.getToken() });
      this.list = (res.result && res.result.data) || [];
    },
    async loadRefs() {
      const s = await API.call('scenicCRUD', { action: 'list', token: API.getToken() });
      this.scenicList = (s.result && s.result.data) || [];
      const h = await API.call('hotelCRUD', { action: 'list', token: API.getToken() });
      this.hotelList = (h.result && h.result.data) || [];
    },
    openAdd() {
      this.editing = null;
      this.form = { title: '', coverImg: '', dayCount: 1, highLight: '', detail: '', dayList: [{ dayNum: 1, dayTitle: '', scenicId: '', hotelId: '', dayContent: '' }], enable: true };
      this.dlg = true;
    },
    openEdit(item) {
      this.editing = item;
      this.form = {
        title: item.title || '', coverImg: item.coverImg || '', dayCount: item.dayCount || 1,
        highLight: item.highLight || '', detail: item.detail || '',
        dayList: Array.isArray(item.dayList) ? item.dayList.map(d => ({ ...d })) : [],
        enable: item.enable !== false
      };
      this.dlg = true;
    },
    addDay() { this.form.dayList.push({ dayNum: this.form.dayList.length + 1, dayTitle: '', scenicId: '', hotelId: '', dayContent: '' }); },
    rmDay(idx) { this.form.dayList.splice(idx, 1); },
    async onCoverUpload(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const ext = f.name.split('.').pop() || 'png';
        const url = await API.uploadImage(f, ext);
        if (url) this.form.coverImg = url;
      } catch (err) {}
    },
    async save() {
      if (this.editing) {
        await API.call('privateGroupCRUD', { action: 'update', token: API.getToken(), id: this.editing._id, data: this.form });
      } else {
        await API.call('privateGroupCRUD', { action: 'add', token: API.getToken(), data: this.form });
      }
      this.dlg = false;
      await this.load();
    },
    async del(item) {
      if (!confirm('删除私家团？')) return;
      await API.call('privateGroupCRUD', { action: 'delete', token: API.getToken(), id: item._id });
      await this.load();
    }
  }
};
