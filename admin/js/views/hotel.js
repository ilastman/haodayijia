/* ============ 视图：酒店管理 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.hotel = {
  nav: true, title: '酒店管理', icon: '🏨',
  comp: {
    name: 'HotelView',
    data() { return { S: Store, dlg: false, form: {}, kw: '', online: '', selected: [] }; },
    computed: {
      list() {
        let l = Store.db.hotel.slice();
        const k = this.kw.trim();
        if (k) l = l.filter(h => h.name.includes(k) || (h.facilities || []).join(',').includes(k));
        if (this.online !== '') l = l.filter(h => h.online === (this.online === '1'));
        return l;
      },
    },
    methods: {
      onMove(from, to) {
        const ids = this.list.map(h => h.id);
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        Store.reorder('hotel', ids);
      },
      openAdd() { this.form = { id: '', name: '', cover: '', album: [], envImg: '', roomImg: '', rooms: [], location: '', intro: '', detailHtml: '', facilities: [], price: 1000, stars: 5, score: 9.0, area: '', lon: 99.7, lat: 27.8, sort: this.list.length + 1, online: true }; this.dlg = true; },
      openEdit(h) {
        this.form = JSON.parse(JSON.stringify(h));
        this.form.album = (h.album || []).slice();
        this.form.rooms = (h.rooms || []).map(r => (typeof r === 'object' ? Object.assign({ name: '', price: '', desc: '' }, r) : { name: String(r), price: '', desc: '' }));
        this.dlg = true;
      },
      save() {
        if (!this.form.name.trim()) { ElementPlus.ElMessage.warning('请输入酒店名称'); return; }
        if (!this.form.cover) { ElementPlus.ElMessage.warning('请上传封面图'); return; }
        if (this.form.id) { Store.update('hotel', this.form.id, this.form); ElementPlus.ElMessage.success('已保存'); }
        else { Store.add('hotel', this.form); ElementPlus.ElMessage.success('已新增'); }
        this.dlg = false;
      },
      del(h) { Store.remove('hotel', h.id); ElementPlus.ElMessage.success('已删除'); },
      batchDel() { if (this.selected.length) { Store.remove('hotel', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; } },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
      starsTxt(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增酒店</el-button>
          <Confirm v-if="selected.length" title="确认批量删除所选酒店？" ok-text="删除" @ok="batchDel">
            <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
          </Confirm>
          <el-select v-model="online" style="width:130px" placeholder="上下架">
            <el-option label="全部" value="" /><el-option label="已上架" value="1" /><el-option label="已下架" value="0" />
          </el-select>
          <span class="spacer"></span>
          <el-input v-model="kw" placeholder="搜索名称 / 设施" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>

        <ul class="sortable" v-sort="onMove">
          <li v-for="h in list" :key="h.id" draggable="true" :style="{opacity: h.online ? 1 : .55}">
            <div class="drag-handle">⠿</div>
            <el-checkbox :model-value="selected.includes(h.id)" @change="v => (v ? selected.push(h.id) : selected.splice(selected.indexOf(h.id), 1))" @click.stop />
            <div class="img-wrap" style="width:78px;height:54px;flex:0 0 78px"><img :src="img(h.cover)" style="height:100%;object-fit:cover" alt="" @click="previewImg(h.cover)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{{h.name}}
                <span style="color:#b59a6b;margin-left:6px" title="评分">{{starsTxt(h.stars)}}</span>
                <span class="st" style="margin-left:8px" :class="h.online ? 'st-on' : 'st-off'">{{h.online ? '已上架' : '已下架'}}</span>
              </div>
              <div class="faint ellipsis" style="margin-top:4px">{{h.area}} · 评分 {{h.score}}</div>
              <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">
                <span class="chip" v-for="f in (h.facilities || []).slice(0, 4)" :key="f">{{f}}</span>
              </div>
            </div>
            <div style="text-align:right"><b style="color:#a05a46">¥{{h.price}}</b>/晚</div>
            <el-switch v-model="h.online" size="small" active-text="上架" @change="S.save()" />
            <el-button size="small" @click="openEdit(h)">编辑</el-button>
            <Confirm title="确认删除该酒店？" @ok="del(h)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </li>
          <li v-if="!list.length" class="tac" :draggable="false" style="cursor:default;justify-content:center;color:var(--ink-faint)">暂无酒店</li>
        </ul>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑酒店' : '新增酒店'" width="780px" append-to-body top="4vh">
        <div class="dlg-body">
          <el-form label-width="88px">
            <el-form-item label="酒店名称" required><el-input v-model="form.name" placeholder="如：呼伦贝尔宾馆" /></el-form-item>
            <el-form-item label="封面图" required><ImgPicker v-model="form.cover" :ratio="16/9" title="上传酒店封面（大图）" /></el-form-item>
            <el-form-item label="相册图"><ImgAlbum v-model="form.album" :max="9" title="上传实景相册" /></el-form-item>
            <div class="form-grid-2">
              <el-form-item label="环境图"><ImgPicker v-model="form.envImg" :ratio="16/9" title="上传环境图" /></el-form-item>
              <el-form-item label="房型图"><ImgPicker v-model="form.roomImg" :ratio="16/9" title="上传房型图" /></el-form-item>
            </div>
            <div class="form-grid-2">
              <el-form-item label="级别"><el-rate v-model="form.stars" :max="5" /></el-form-item>
              <el-form-item label="参考价"><el-input-number v-model="form.price" :min="0" :step="100" style="width:100%" /><span class="faint"> 元/晚</span></el-form-item>
              <el-form-item label="评分"><el-input-number v-model="form.score" :min="0" :max="10" :precision="1" :step="0.1" style="width:100%" /></el-form-item>
              <el-form-item label="所在区域"><el-input v-model="form.area" placeholder="如：香格里拉纳帕海" /></el-form-item>
              <el-form-item label="位置说明"><el-input v-model="form.location" placeholder="如：海拉尔区胜利大街 12 号" /></el-form-item>
            </div>
            <el-form-item label="房型">
              <div style="width:100%">
                <div v-for="(r,i) in form.rooms" :key="i" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                  <el-input v-model="r.name" placeholder="房型名称" style="width:180px" />
                  <el-input v-model="r.price" placeholder="价格" style="width:110px" />
                  <el-input v-model="r.desc" placeholder="说明（可选）" style="flex:1" />
                  <el-button size="small" type="danger" plain @click="form.rooms.splice(i,1)">删除</el-button>
                </div>
                <el-button size="small" @click="form.rooms.push({name:'',price:'',desc:''})">＋ 添加房型</el-button>
              </div>
            </el-form-item>
            <el-form-item label="配套设施">
              <el-select v-model="form.facilities" multiple filterable allow-create default-first-option style="width:100%" placeholder="选择或输入新增设施">
                <el-option v-for="f in ['免费早餐','观景露台','地暖','接送机','藏式下午茶','湖景','书吧','自行车','暖气','江景','咖啡','向导服务','洗衣','健身房','spa','停车场']" :key="f" :label="f" :value="f" />
              </el-select>
            </el-form-item>
            <el-form-item label="酒店简介"><el-input v-model="form.intro" type="textarea" :rows="2" /></el-form-item>
            <el-form-item label="详细介绍"><RichText v-model="form.detailHtml" /></el-form-item>
            <el-form-item label="坐标">
              <div class="flex gap10">
                <el-input-number v-model="form.lon" :precision="3" :step="0.001" controls-position="right" style="width:160px" /><span class="soft">经度</span>
                <el-input-number v-model="form.lat" :precision="3" :step="0.001" controls-position="right" style="width:160px" /><span class="soft">纬度</span>
              </div>
            </el-form-item>
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