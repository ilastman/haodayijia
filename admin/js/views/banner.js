/* ============ 视图：轮播 Banner 管理 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.banner = {
  nav: true, title: '轮播 Banner', icon: '🖼',
  comp: {
    name: 'BannerView',
    data() { return { S: Store, dlg: false, form: {}, selected: [], kw: '' }; },
    computed: {
      list() {
        let l = Store.db.banner.slice();
        const k = this.kw.trim();
        if (k) l = l.filter(b => b.title.includes(k) || (b.jump || '').includes(k));
        return l;
      },
    },
    methods: {
      onMove(from, to) {
        const ids = this.list.map(b => b.id);
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        Store.reorder('banner', ids);
      },
      openAdd() { this.form = { id: '', title: '', img: '', jump: '/pages/index/index', enable: true, sort: this.list.length + 1 }; this.dlg = true; },
      openEdit(b) { this.form = Object.assign({}, b); this.dlg = true; },
      save() {
        if (!this.form.title.trim()) { ElementPlus.ElMessage.warning('请输入标题'); return; }
        if (!this.form.img) { ElementPlus.ElMessage.warning('请上传轮播图'); return; }
        if (this.form.id) { Store.update('banner', this.form.id, this.form); ElementPlus.ElMessage.success('已保存'); }
        else { Store.add('banner', this.form); ElementPlus.ElMessage.success('已新增'); }
        this.dlg = false;
      },
      del(b) { Store.remove('banner', b.id); ElementPlus.ElMessage.success('已删除'); },
      batchDel() { Store.remove('banner', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
      jumpLabel(b) { return b.jump || '—'; },
    },
    template: `
    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="openAdd">＋ 新增 Banner</el-button>
        <Confirm v-if="selected.length" title="确认批量删除所选 Banner？" ok-text="删除" @ok="batchDel">
          <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
        </Confirm>
        <span class="spacer"></span>
        <el-input v-model="kw" placeholder="搜索标题 / 跳转" style="width:220px" clearable><template #prefix>🔍</template></el-input>
      </div>

      <ul class="sortable" v-sort="onMove">
        <li v-for="b in list" :key="b.id" draggable="true" :style="{opacity: b.enable ? 1 : .55}">
          <div class="drag-handle">⠿</div>
          <el-checkbox :model-value="selected.includes(b.id)" @change="v => (v ? selected.push(b.id) : (selected.splice(selected.indexOf(b.id), 1)))" @click.stop />
          <div class="img-wrap" style="width:120px;height:58px;flex:0 0 120px"><img :src="img(b.img)" style="height:100%;object-fit:cover" alt="" @click="previewImg(b.img)" /></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">{{b.title}}</div>
            <div class="faint ellipsis" style="margin-top:3px;font-family:monospace">跳转：{{jumpLabel(b)}}</div>
          </div>
          <span class="st" :class="b.enable ? 'st-on' : 'st-off'">{{b.enable ? '轮播中' : '已停用'}}</span>
          <el-switch v-model="b.enable" size="small" active-text="轮播" @change="S.save()" />
          <div style="display:flex;gap:4px">
            <el-button size="small" @click="openEdit(b)">编辑</el-button>
          </div>
          <Confirm title="确认删除该 Banner？" @ok="del(b)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
        </li>
        <li v-if="!list.length" class="tac" :draggable="false" style="cursor:default;justify-content:center;color:var(--ink-faint)">暂无 Banner</li>
      </ul>

      <el-dialog v-model="dlg" :title="form.id ? '编辑 Banner' : '新增 Banner'" width="560px" append-to-body>
        <div class="dlg-body">
          <el-form label-width="90px">
            <el-form-item label="轮播图片" required>
              <ImgPicker v-model="form.img" :ratio="750/360" :target-w="1600" title="上传轮播图（750×360）" />
            </el-form-item>
            <el-form-item label="标题"><el-input v-model="form.title" placeholder="如：秋季首发专线" /></el-form-item>
            <el-form-item label="跳转页面">
              <el-select v-model="form.jump" filterable allow-create style="width:100%">
                <el-option v-for="j in ['/pages/index/index','/pages/routes/routes','/pages/routes/routes?type=group','/pages/scenic/scenic','/pages/hotels/hotels','/pages/square/square','/pages/my/my']" :key="j" :label="j" :value="j" />
              </el-select>
            </el-form-item>
            <el-form-item label="启用轮播"><el-switch v-model="form.enable" /></el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="dlg = false">取消</el-button>
          <el-button type="primary" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};