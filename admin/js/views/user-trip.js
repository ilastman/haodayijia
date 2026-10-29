/* ============ 视图：定制行程管理（用户自定义行程） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS['user-trip'] = {
  nav: true, title: '定制行程管理', icon: '📋',
  comp: {
    name: 'UserTripView',
    data() { return { S: Store, dlg: false, form: {}, kw: '', status: '' }; },
    computed: {
      list() {
        let l = Store.db.userTrip.slice().sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
        const k = this.kw.trim();
        if (k) l = l.filter(t => (t.title || '').includes(k) || (t.nickname || '').includes(k));
        if (this.status !== '') l = l.filter(t => t.status === this.status);
        return l;
      },
    },
    methods: {
      openEdit(t) {
        this.form = JSON.parse(JSON.stringify(t));
        if (this.form.adults == null || this.form.adults === '') this.form.adults = 2;
        if (this.form.children == null || this.form.children === '') this.form.children = 0;
        this.dlg = true;
      },
      save() {
        if (!this.form.title.trim()) { ElementPlus.ElMessage.warning('请输入行程标题'); return; }
        this.form.adults = Math.max(1, parseInt(this.form.adults, 10) || 1);
        this.form.children = Math.max(0, parseInt(this.form.children, 10) || 0);
        Store.update('userTrip', this.form.id, this.form);
        ElementPlus.ElMessage.success('已保存');
        this.dlg = false;
      },
      del(t) { Store.remove('userTrip', t.id); ElementPlus.ElMessage.success('已删除'); },
      fmtTime(t) { return t; },
    },
    template: `
    <div class="card">
      <div class="toolbar">
        <span class="soft">共 {{list.length}} 条用户行程</span>
        <el-select v-model="status" style="width:140px" placeholder="状态">
          <el-option label="全部" value="" /><el-option label="进行中" value="active" /><el-option label="已完成" value="done" />
        </el-select>
        <span class="spacer"></span>
        <el-input v-model="kw" placeholder="搜索标题 / 用户" style="width:220px" clearable><template #prefix>🔍</template></el-input>
      </div>
      <el-table :data="list" stripe height="calc(100vh - 220px)">
        <el-table-column label="用户" width="170">
          <template #default="{row}">
            <div class="flex gap10"><img class="avatar-sm" :src="img(row.avatar)" alt=""/><div><div>{{row.nickname}}</div><div class="faint" style="font-size:11px">{{row.id}}</div></div></div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="行程标题" min-width="220" show-overflow-tooltip />
        <el-table-column label="天数" width="80"><template #default="{row}">{{row.days}} 天</template></el-table-column>
        <el-table-column label="人数" width="110"><template #default="{row}">{{row.adults || 0}} 成人 · {{row.children || 0}} 儿童</template></el-table-column>
        <el-table-column label="总价" width="100"><template #default="{row}">{{row.quote && row.quote.total ? ('¥' + row.quote.total) : '—'}}</template></el-table-column>
        <el-table-column prop="plan" label="行程概要" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{row}"><span class="st" :class="row.status === 'active' ? 'st-pending' : 'st-pass'">{{row.status === 'active' ? '进行中' : '已完成'}}</span></template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="150" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="openEdit(row)">查看/编辑</el-button>
            <Confirm title="确认删除该用户行程？" ok-text="删除" @ok="del(row)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </template>
        </el-table-column>
        <template #empty><div class="faint" style="padding:24px">暂无用户行程</div></template>
      </el-table>

      <el-dialog v-model="dlg" :title="'用户行程 · ' + form.nickname" width="640px" append-to-body>
        <div class="dlg-body">
          <el-form label-width="90px">
            <el-form-item label="用户"><div class="flex gap10"><img class="avatar-sm" :src="img(form.avatar)" alt=""/><span>{{form.nickname}}（ID: {{form.id}}）</span></div></el-form-item>
            <el-form-item label="行程标题"><el-input v-model="form.title" /></el-form-item>
            <el-form-item label="天数"><el-input-number v-model="form.days" :min="1" :max="30" /></el-form-item>
            <el-form-item label="成人"><el-input-number v-model="form.adults" :min="1" :max="99" /></el-form-item>
            <el-form-item label="儿童"><el-input-number v-model="form.children" :min="0" :max="20" /></el-form-item>
            <el-form-item label="行程总价"><span v-if="form.quote && form.quote.total">¥{{form.quote.total}} <span class="faint">酒店 ¥{{form.quote.hotel || 0}} · 门票 ¥{{form.quote.ticket || 0}}</span></span><span v-else class="faint">生成行程后显示</span></el-form-item>
            <el-form-item label="行程概要"><el-input v-model="form.plan" type="textarea" :rows="5" /></el-form-item>
            <el-form-item label="状态">
              <el-select v-model="form.status"><el-option label="进行中" value="active" /><el-option label="已完成" value="done" /></el-select>
            </el-form-item>
            <el-form-item label="创建时间"><span class="soft">{{form.createTime}}</span></el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="dlg = false">取消</el-button>
          <el-button type="primary" @click="save">保存修改</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};