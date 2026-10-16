/* ============ 视图：景区管理 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.scenic = {
  nav: true, title: '景区管理', icon: '⛰',
  comp: {
    name: 'ScenicView',
    data() { return { S: Store, dlg: false, form: {}, kw: '', online: '', selected: [] }; },
    computed: {
      list() {
        let l = Store.db.scenic.slice().sort((a, b) => b.weight - a.weight);
        const k = this.kw.trim();
        if (k) l = l.filter(s => s.name.includes(k) || (s.tags || []).join(',').includes(k) || (s.dest || '').includes(k));
        if (this.online !== '') l = l.filter(s => s.online === (this.online === '1'));
        return l;
      },
      dests() {
        const ds = [];
        (Store.db.scenic || []).forEach(s => { if (s.dest && ds.indexOf(s.dest) < 0) ds.push(s.dest); });
        ['海拉尔', '额尔古纳', '满洲里', '黑山头', '室韦', '阿尔山', '恩和', '根河', '莫尔道嘎', '呼伦贝尔'].forEach(d => { if (ds.indexOf(d) < 0) ds.push(d); });
        return ds;
      },
    },
    methods: {
      onMove(from, to) {
        const ids = this.list.map(s => s.id);
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        Store.reorder('scenic', ids, 'weight');
      },
      openAdd() { this.form = { id: '', name: '', cover: '', album: [], intro: '', detailHtml: '', tags: [], dest: '', duration: '', bestSeason: '', lon: 100, lat: 27, weight: 1, online: true }; this.dlg = true; },
      openEdit(s) {
        this.form = JSON.parse(JSON.stringify(s));
        this.form.album = (s.album || []).slice();
        this.dlg = true;
      },
      save() {
        if (!this.form.name.trim()) { ElementPlus.ElMessage.warning('请输入景区名称'); return; }
        if (!this.form.cover) { ElementPlus.ElMessage.warning('请上传封面图'); return; }
        if (this.form.id) { Store.update('scenic', this.form.id, this.form); ElementPlus.ElMessage.success('已保存'); }
        else { Store.add('scenic', this.form); ElementPlus.ElMessage.success('已新增'); }
        this.dlg = false;
      },
      del(s) { Store.remove('scenic', s.id); ElementPlus.ElMessage.success('已删除'); },
      batchDel() { if (this.selected.length) { Store.remove('scenic', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; } },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增景区</el-button>
          <Confirm v-if="selected.length" title="确认批量删除所选景区？" ok-text="删除" @ok="batchDel">
            <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
          </Confirm>
          <el-select v-model="online" style="width:130px" placeholder="上下架">
            <el-option label="全部" value="" /><el-option label="已上架" value="1" /><el-option label="已下架" value="0" />
          </el-select>
          <span class="spacer"></span>
          <el-input v-model="kw" placeholder="搜索名称 / 标签" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>

        <ul class="sortable" v-sort="onMove">
          <li v-for="s in list" :key="s.id" draggable="true" :style="{opacity: s.online ? 1 : .55}">
            <div class="drag-handle">⠿</div>
            <el-checkbox :model-value="selected.includes(s.id)" @change="v => (v ? selected.push(s.id) : selected.splice(selected.indexOf(s.id), 1))" @click.stop />
            <div class="img-wrap" style="width:78px;height:54px;flex:0 0 78px"><img :src="img(s.cover)" style="height:100%;object-fit:cover" alt="" @click="previewImg(s.cover)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{{s.name}} <span class="st" style="margin-left:8px" :class="s.online ? 'st-on' : 'st-off'">{{s.online ? '已上架' : '已下架'}}</span></div>
              <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">
                <span class="chip" v-for="t in (s.tags || [])" :key="t">{{t}}</span>
                <span class="faint" v-if="!(s.tags || []).length">（无标签）</span>
              </div>
            </div>
            <div class="soft" style="text-align:right">权重 <b style="color:var(--accent)">{{s.weight}}</b><div class="faint">{{s.lon}},{{s.lat}}</div></div>
            <el-switch v-model="s.online" size="small" active-text="上架" @change="S.save()" />
            <el-button size="small" @click="openEdit(s)">编辑</el-button>
            <Confirm title="确认删除该景区？" @ok="del(s)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </li>
          <li v-if="!list.length" class="tac" :draggable="false" style="cursor:default;justify-content:center;color:var(--ink-faint)">暂无景区</li>
        </ul>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑景区' : '新增景区'" width="760px" append-to-body top="4vh">
        <div class="dlg-body">
          <el-form label-width="88px">
            <el-form-item label="景区名称" required><el-input v-model="form.name" placeholder="如：梅里雪山 · 日照金山" /></el-form-item>
            <el-form-item label="封面图" required><ImgPicker v-model="form.cover" :ratio="16/9" title="上传景区封面（大图）" /></el-form-item>
            <el-form-item label="相册图"><ImgAlbum v-model="form.album" :max="9" title="上传景区相册" /></el-form-item>
            <el-form-item label="所属目的地"><el-select v-model="form.dest" filterable allow-create default-first-option style="width:100%" placeholder="选择或输入目的地"><el-option v-for="t in dests" :key="t" :label="t" :value="t" /></el-select></el-form-item>
            <el-form-item label="景区标签">
              <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车创建">
                <el-option v-for="t in ['雪山','湖泊','峡谷','徒步','观景','摄影','观鸟','亲子','极限','古镇']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="景区简介"><el-input v-model="form.intro" type="textarea" :rows="2" placeholder="一句话介绍，用于列表展示" /></el-form-item>
            <el-form-item label="游玩时长"><el-input v-model="form.duration" placeholder="如：建议 2-3 小时" /></el-form-item>
            <el-form-item label="最佳季节"><el-input v-model="form.bestSeason" placeholder="如：6月-9月" /></el-form-item>
            <el-form-item label="详细介绍"><RichText v-model="form.detailHtml" /></el-form-item>
            <el-form-item label="坐标">
              <div class="flex gap10">
                <el-input-number v-model="form.lon" :precision="3" :step="0.001" controls-position="right" style="width:160px" /> <span class="soft">经度</span>
                <el-input-number v-model="form.lat" :precision="3" :step="0.001" controls-position="right" style="width:160px" /> <span class="soft">纬度</span>
              </div>
            </el-form-item>
            <el-form-item label="权重排序"><el-slider v-model="form.weight" :min="1" :max="100" show-input /></el-form-item>
            <el-form-item label="上架状态"><el-switch v-model="form.online" /><span class="soft" style="margin-left:8px">{{form.online ? '展示中' : '已隐藏'}}</span></el-form-item>
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