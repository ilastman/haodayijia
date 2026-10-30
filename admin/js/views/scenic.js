/* ============ 视图：景区管理 ============ */
window.VIEWS = window.VIEWS || {};

const SCENIC_IMPORT_HEADERS = [
  { key: 'name', title: '景区名称', headerText: '景区名称【必填】', required: true, desc: '必填；同名景区会自动跳过' },
  { key: 'regionLevel1', title: '一级大区', headerText: '一级大区【选填】', aliases: ['大区'], desc: '景区分类树的一级大区名称。与分类库一致时写入分类；匹配不到会提示，仍按原文入库' },
  { key: 'subType', title: '类型', headerText: '类型【选填】', aliases: ['二级分类', '子类型', '一级分类'], desc: '二级类型，如：景区、远野体验。需落在所选大区下面。旧表「一级分类」列也会读到这里' },
  { key: 'area', title: '地点', headerText: '地点【必填】', required: true, aliases: ['所在区域', '地区', '目的地', '三级分类'], desc: '必填。三级地点，如：海拉尔、额尔古纳。与分类库一致时绑定分类' },
  { key: 'ticketPrice', title: '门票参考价格', headerText: '门票参考价格【选填】', aliases: ['参考门票'], desc: '可填文字，如：免费 / 120元' },
  { key: 'duration', title: '建议游玩时长', headerText: '建议游玩时长【选填】', desc: '如：建议 2-3 小时' },
  { key: 'briefDesc', title: '景区简介', headerText: '景区简介【选填】', aliases: ['简短简介', '简介'], desc: '一句话介绍，用于列表展示' },
  { key: 'location', title: '经纬度', headerText: '经纬度【选填，经度,纬度】', aliases: ['坐标'], desc: '格式：经度,纬度，如 119.760,49.211' },
  { key: 'address', title: '详细地址', headerText: '详细地址【选填】', aliases: ['地址'], desc: '景区详细地址' },
  { key: 'openTime', title: '开放时间', headerText: '开放时间【选填】', desc: '如：08:00-18:00' },
  { key: 'feature', title: '特色看点', headerText: '特色看点【选填，多个用英文逗号分隔】', aliases: ['标签'], desc: '多个用英文逗号分隔，如：草原,骑马,摄影' },
  { key: 'playItems', title: '游玩项目', headerText: '游玩项目【选填】', aliases: ['游玩项目及价格'], desc: '多项用分号分隔，每项「名称|价格」。价格可写文字，如：骑马|10元;篝火|免费' },
  { key: 'sort', title: '排序权重', headerText: '排序权重【选填】', aliases: ['排序'], desc: '数字，越大越靠前' }
];

/* 与 utils/play-items.js 同一套规则：price 一律存成字符串 */
const PlayItems = (function () {
  function playId() {
    return 'pi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function normalize(list) {
    const src = Array.isArray(list) ? list : [];
    const out = [];
    const seen = {};
    src.forEach(it => {
      if (!it || typeof it !== 'object') return;
      const name = String(it.name == null ? '' : it.name).trim();
      if (!name) return;
      let id = String(it.id == null ? '' : it.id).trim();
      if (!id || seen[id]) id = playId();
      seen[id] = 1;
      out.push({ id: id, name: name, price: String(it.price == null ? '' : it.price).trim() });
    });
    return out;
  }
  return { normalize: normalize, id: playId };
})();

window.VIEWS.scenic = {
  nav: true, title: '景区管理', icon: '⛰',
  comp: {
    name: 'ScenicView',
    data() {
      return {
        S: Store, dlg: false, form: {}, kw: '', online: '', selected: [],
        page: 1, pageSize: 20,
        regions: window.REGIONS || [],
        subTypeOptions: [{ value: 'scenic', label: '景区' }, { value: 'entertainment', label: '原野体验' }],
        impOpen: false, impBusy: false, impFileName: '', impRows: [], impResult: null
      };
    },
    computed: {
      canImport() { return !!Store.currentAdmin(); },
      list() {
        let l = Store.db.scenic.slice().sort((a, b) => b.weight - a.weight);
        const k = this.kw.trim();
        if (k) l = l.filter(s => s.name.includes(k) || (s.tags || []).join(',').includes(k) || (s.dest || '').includes(k));
        if (this.online !== '') l = l.filter(s => s.online === (this.online === '1'));
        return l;
      },
      pageList() {
        const start = (this.page - 1) * this.pageSize;
        return this.list.slice(start, start + this.pageSize);
      },
      pageAll: {
        get() {
          const ids = this.pageList.map(s => s.id);
          return ids.length > 0 && ids.every(id => this.selected.includes(id));
        },
        set(v) {
          const ids = this.pageList.map(s => s.id);
          if (v) ids.forEach(id => { if (!this.selected.includes(id)) this.selected.push(id); });
          else this.selected = this.selected.filter(id => ids.indexOf(id) < 0);
        }
      },
      pageHalf() {
        const ids = this.pageList.map(s => s.id);
        const n = ids.filter(id => this.selected.includes(id)).length;
        return n > 0 && n < ids.length;
      },
      dests() {
        const ds = [];
        (Store.db.scenic || []).forEach(s => { if (s.dest && ds.indexOf(s.dest) < 0) ds.push(s.dest); });
        ['海拉尔', '额尔古纳', '满洲里', '黑山头', '室韦', '阿尔山', '恩和', '根河', '莫尔道嘎', '呼伦贝尔'].forEach(d => { if (ds.indexOf(d) < 0) ds.push(d); });
        return ds;
      },
      useScenicTree() { return (Store.db.category || []).some(c => c.tree === 'scenic' && c.level === 3); },
      scenicRegions() {
        const rows = (Store.db.category || []).filter(c => c.tree === 'scenic' && c.level === 1);
        if (rows.length) return rows.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        return (window.REGIONS || []).map(name => ({ id: '', name }));
      },
      scenicTypes() {
        const pid = this.form.regionCatId;
        if (this.useScenicTree) {
          if (!pid) return [];
          return (Store.db.category || []).filter(c => c.tree === 'scenic' && c.parentId === pid)
            .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        }
        return [
          { id: '', name: '景区', subType: 'scenic' },
          { id: '', name: '远野体验', subType: 'entertainment' }
        ];
      },
      scenicPlaces() {
        if (this.useScenicTree) {
          const pid = this.form.typeCatId;
          if (!pid) return [];
          return (Store.db.category || []).filter(c => c.tree === 'scenic' && c.parentId === pid)
            .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        }
        return this.dests.map(name => ({ id: '', name }));
      },
    },
    watch: {
      kw() { this.page = 1; },
      online() { this.page = 1; },
      pageSize() { this.page = 1; },
      list(l) {
        const max = Math.max(1, Math.ceil((l.length || 0) / this.pageSize));
        if (this.page > max) this.page = max;
      }
    },
    created() { this.loadCategories(); },
    methods: {
      subTypeTxt(v) { return v === 'entertainment' ? '原野体验' : '景区'; },
      onMove(from, to) {
        const ids = this.list.map(s => s.id);
        const offset = (this.page - 1) * this.pageSize;
        const [x] = ids.splice(offset + from, 1);
        ids.splice(offset + to, 0, x);
        Store.reorder('scenic', ids, 'weight');
      },
      async loadCategories() {
        const res = await Store.cloudCall('categoryCRUD', { action: 'list' });
        if (res && res.code === 200 && Array.isArray(res.data)) Store.db.category = res.data;
      },
      onScenicRegion(val) {
        const cat = (Store.db.category || []).filter(c => c.id === val)[0];
        this.form.regionCatId = cat ? cat.id : '';
        this.form.regionLevel1 = cat ? cat.name : (val || '');
        this.form.typeCatId = '';
        this.form.typeName = '';
        this.form.placeCatId = '';
        this.form.dest = '';
        this.form.area = '';
      },
      onScenicType(val) {
        const cat = (Store.db.category || []).filter(c => c.id === val)[0];
        const name = cat ? cat.name : (val || '');
        this.form.typeCatId = cat ? cat.id : '';
        this.form.typeName = name;
        this.form.subType = /体验|娱乐/.test(name) ? 'entertainment' : 'scenic';
        this.form.placeCatId = '';
        this.form.dest = '';
        this.form.area = '';
      },
      onScenicPlace(val) {
        const cat = (Store.db.category || []).filter(c => c.id === val)[0];
        const name = cat ? cat.name : (val || '');
        this.form.placeCatId = cat ? cat.id : '';
        this.form.dest = name;
        this.form.area = name;
      },
      bindScenicCats() {
        const cats = Store.db.category || [];
        if (!this.form.regionCatId && this.form.regionLevel1) {
          const r = cats.filter(c => c.tree === 'scenic' && c.level === 1 && c.name === this.form.regionLevel1)[0];
          if (r) this.form.regionCatId = r.id;
        }
        if (!this.form.typeCatId && this.form.regionCatId) {
          const types = cats.filter(c => c.parentId === this.form.regionCatId);
          const t = types.filter(c => c.name === this.form.typeName)[0]
            || types.filter(c => this.form.subType === 'entertainment' ? /体验|娱乐/.test(c.name) : c.name === '景区')[0];
          if (t) { this.form.typeCatId = t.id; this.form.typeName = t.name; }
        }
        if (!this.form.placeCatId && this.form.typeCatId) {
          const placeName = this.form.dest || this.form.area;
          const p = cats.filter(c => c.parentId === this.form.typeCatId && c.name === placeName)[0];
          if (p) this.form.placeCatId = p.id;
        }
      },
      openAdd() { this.form = { id: '', name: '', cover: '', album: [], intro: '', detailHtml: '', tags: [], dest: '', area: '', regionLevel1: '', regionCatId: '', typeName: '', typeCatId: '', placeCatId: '', subType: 'scenic', duration: '', bestSeason: '', playItems: [], lon: 100, lat: 27, weight: 1, online: true }; this.dlg = true; },
      openEdit(s) {
        this.form = JSON.parse(JSON.stringify(s));
        this.form.album = (s.album || []).slice();
        this.form.area = s.area || s.dest || '';
        if (this.form.regionLevel1 == null) this.form.regionLevel1 = '';
        if (this.form.subType == null) this.form.subType = 'scenic';
        if (!this.form.regionCatId) this.form.regionCatId = '';
        if (!this.form.typeCatId) this.form.typeCatId = '';
        if (!this.form.placeCatId) this.form.placeCatId = '';
        if (!this.form.typeName) this.form.typeName = this.form.subType === 'entertainment' ? '远野体验' : '景区';
        this.form.playItems = PlayItems.normalize(s.playItems);
        this.bindScenicCats();
        this.dlg = true;
      },
      addPlay() {
        if (!Array.isArray(this.form.playItems)) this.form.playItems = [];
        this.form.playItems.push({ id: PlayItems.id(), name: '', price: '' });
      },
      removePlay(i) {
        if (!Array.isArray(this.form.playItems)) return;
        this.form.playItems.splice(i, 1);
      },
      save() {
        if (!String(this.form.name || '').trim()) { ElementPlus.ElMessage.warning('请输入景区名称'); return; }
        if (!String(this.form.regionLevel1 || '').trim()) { ElementPlus.ElMessage.warning('请选择一级大区'); return; }
        if (!String(this.form.typeName || this.form.typeCatId || '').trim()) { ElementPlus.ElMessage.warning('请选择类型'); return; }
        if (!String(this.form.dest || this.form.area || '').trim()) { ElementPlus.ElMessage.warning('请选择地点'); return; }
        this.form.area = this.form.dest || '';
        this.form.playItems = PlayItems.normalize(this.form.playItems);
        if (this.form.id) { Store.update('scenic', this.form.id, this.form); ElementPlus.ElMessage.success('已保存'); }
        else { Store.add('scenic', this.form); ElementPlus.ElMessage.success('已新增'); }
        this.dlg = false;
      },
      del(s) { Store.remove('scenic', s.id); ElementPlus.ElMessage.success('已删除'); },
      batchDel() { if (this.selected.length) { Store.remove('scenic', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; } },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },

      /* ---------- 批量导入 ---------- */
      openImport() { this.impOpen = true; this.impBusy = false; this.impFileName = ''; this.impRows = []; this.impResult = null; },
      pickFile() { const el = this.$refs.impFile; if (el) el.click(); },
      async onFile(e) {
        const f = (e.target.files || [])[0];
        e.target.value = '';
        if (!f) return;
        if (!window.ExcelKit || !ExcelKit.available()) { ElementPlus.ElMessage.error('Excel 组件未加载，请刷新页面重试'); return; }
        try {
          const parsed = await ExcelKit.parse(f);
          this.impFileName = f.name;
          this.impRows = ExcelKit.toObjects(parsed, SCENIC_IMPORT_HEADERS);
          this.impResult = null;
          if (!this.impRows.length) ElementPlus.ElMessage.warning('未解析到数据行，请确认首行为表头');
        } catch (err) {
          ElementPlus.ElMessage.error('解析失败，请检查文件格式');
        }
      },
      async doImport() {
        if (!this.impRows.length) { ElementPlus.ElMessage.warning('请先选择要导入的文件'); return; }
        this.impBusy = true;
        try {
          const rows = this.impRows.map(r => ({
            _row: r._row, name: r.name, area: r.area, regionLevel1: r.regionLevel1, subType: r.subType,
            ticketPrice: r.ticketPrice, duration: r.duration, briefDesc: r.briefDesc, playItems: r.playItems,
            location: r.location, address: r.address, openTime: r.openTime,
            feature: r.feature, sort: r.sort
          }));
          const res = await Store.cloudCall('scenicCRUD', { action: 'importBatch', data: { rows } });
          if (!res) { ElementPlus.ElMessage.warning('批量导入需在云端模式下使用'); return; }
          if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '导入失败'); return; }
          this.impResult = res.data;
          ElementPlus.ElMessage.success('导入完成：成功 ' + res.data.success + ' 条，跳过 ' + res.data.failed.length + ' 条');
          if (res.data.success > 0) await Store.reload();
        } finally {
          this.impBusy = false;
        }
      },
      downloadTpl() {
        ExcelKit.downloadTemplate({
          fileName: '景区批量导入模板.xlsx',
          headers: SCENIC_IMPORT_HEADERS,
          sample: {
            name: '呼伦贝尔大草原', regionLevel1: '呼伦贝尔', subType: '景区', area: '海拉尔',
            ticketPrice: '免费', duration: '建议 2-3 小时', briefDesc: '一望无际的绿色海洋',
            playItems: '骑马|10元;蒙古包午宴|68元',
            location: '119.760,49.211', address: '内蒙古呼伦贝尔市',
            openTime: '08:00-18:00', feature: '草原,骑马,摄影', sort: 10
          }
        });
      },
    },
    template: `
    <div>
      <input ref="impFile" type="file" accept=".xlsx,.xls" style="display:none" @change="onFile" />
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增景区</el-button>
          <el-button v-if="canImport" type="success" plain @click="openImport">📥 批量导入</el-button>
          <el-button v-if="canImport" plain @click="downloadTpl">⬇ 下载模板</el-button>
          <Confirm v-if="selected.length" title="确认批量删除所选景区？" ok-text="删除" @ok="batchDel">
            <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
          </Confirm>
          <el-select v-model="online" style="width:130px" placeholder="上下架">
            <el-option label="全部" value="" /><el-option label="已上架" value="1" /><el-option label="已下架" value="0" />
          </el-select>
          <span class="spacer"></span>
          <el-input v-model="kw" placeholder="搜索名称 / 标签" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:0 2px 10px">
          <el-checkbox v-model="pageAll" :indeterminate="pageHalf" :disabled="!pageList.length">全选本页</el-checkbox>
          <span class="faint">本页 {{pageList.length}} 条，已选 {{selected.length}} 条</span>
        </div>

        <ul class="sortable" v-sort="onMove">
          <li v-for="s in pageList" :key="s.id" draggable="true" :style="{opacity: s.online ? 1 : .55}">
            <div class="drag-handle">⠿</div>
            <el-checkbox :model-value="selected.includes(s.id)" @change="v => (v ? selected.push(s.id) : selected.splice(selected.indexOf(s.id), 1))" @click.stop />
            <div class="img-wrap" style="width:78px;height:54px;flex:0 0 78px"><img :src="img(s.cover)" style="height:100%;object-fit:cover" alt="" @click="previewImg(s.cover)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{{s.name}}
                <span class="st" style="margin-left:8px" :class="s.online ? 'st-on' : 'st-off'">{{s.online ? '已上架' : '已下架'}}</span>
                <span class="chip" style="margin-left:8px">{{s.typeName || subTypeTxt(s.subType)}}</span>
                <span class="chip" v-if="s.regionLevel1" style="margin-left:6px">{{s.regionLevel1}}</span>
                <span class="chip" v-if="(s.playItems || []).length" style="margin-left:6px">游玩项目 {{s.playItems.length}}</span>
              </div>
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
        <div style="display:flex;justify-content:flex-end;padding-top:14px">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[20, 30, 40, 50]"
            :total="list.length"
            layout="total, sizes, prev, pager, next, jumper"
          />
        </div>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑景区' : '新增景区'" width="760px" append-to-body top="4vh">
        <div class="dlg-body">
          <el-form label-width="88px">
            <el-form-item label="景区名称" required><el-input v-model="form.name" placeholder="如：呼伦贝尔大草原" /></el-form-item>
            <el-form-item label="封面图"><ImgPicker v-model="form.cover" :ratio="16/9" title="上传景区封面（大图）" /></el-form-item>
            <el-form-item label="相册图"><ImgAlbum v-model="form.album" :max="9" title="上传景区相册" /></el-form-item>
            <div class="form-grid-2">
              <el-form-item label="一级大区" required>
                <el-select :model-value="form.regionCatId || form.regionLevel1" clearable filterable style="width:100%" placeholder="选择大区" @change="onScenicRegion">
                  <el-option v-for="r in scenicRegions" :key="r.id || r.name" :label="r.name" :value="r.id || r.name" />
                </el-select>
              </el-form-item>
              <el-form-item label="类型" required>
                <el-select :model-value="form.typeCatId || form.typeName" clearable filterable style="width:100%" placeholder="先选大区，再选类型" @change="onScenicType">
                  <el-option v-for="t in scenicTypes" :key="t.id || t.name" :label="t.name" :value="t.id || t.name" />
                </el-select>
              </el-form-item>
            </div>
            <el-form-item label="地点" required>
              <el-select :model-value="form.placeCatId || form.dest" clearable filterable :allow-create="!useScenicTree" default-first-option style="width:100%" placeholder="先选类型，再选地点" @change="onScenicPlace">
                <el-option v-for="p in scenicPlaces" :key="p.id || p.name" :label="p.name" :value="p.id || p.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="景区标签">
              <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车创建">
                <el-option v-for="t in ['雪山','湖泊','峡谷','徒步','观景','摄影','观鸟','亲子','极限','古镇']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="景区简介"><el-input v-model="form.intro" type="textarea" :rows="2" placeholder="一句话介绍，用于列表展示" /></el-form-item>
            <el-form-item label="游玩时长"><el-input v-model="form.duration" placeholder="如：建议 2-3 小时" /></el-form-item>
            <el-form-item label="游玩项目">
              <div style="width:100%">
                <div v-for="(p, i) in (form.playItems || [])" :key="p.id || i" class="flex gap10" style="margin-bottom:8px;align-items:center">
                  <el-input v-model="p.name" placeholder="项目名称，如：骑马" style="flex:1" />
                  <el-input v-model="p.price" placeholder="价格，如：10元" style="width:160px" />
                  <el-button plain @click="removePlay(i)">删除</el-button>
                </div>
                <el-button plain @click="addPlay">＋ 添加游玩项目</el-button>
                <div class="faint" style="margin-top:6px">价格按文字保存，可以写「10元」「免费」，不必只填数字。</div>
              </div>
            </el-form-item>
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

      <el-dialog v-model="impOpen" title="批量导入景区（xlsx）" width="720px" append-to-body top="5vh">
        <div class="toolbar" style="margin-bottom:12px">
          <el-button type="primary" plain @click="pickFile">选择 xlsx 文件</el-button>
          <el-button plain @click="downloadTpl">下载模板</el-button>
          <span class="soft" v-if="impFileName">已选：{{impFileName}}（{{impRows.length}} 行）</span>
        </div>
        <div class="faint" style="margin-bottom:12px">必填仍是景区名称和地点。一级大区、类型、地点会与「分类管理」里的景区分类名称匹配，对不上会提示，景区仍然导入。图片与长文详情请导入后在详情页维护。</div>
        <div v-if="impResult">
          <div>成功 <b>{{impResult.success}}</b> 条，跳过 <b>{{impResult.failed.length}}</b> 条，共 {{impResult.total}} 行。</div>
          <ul style="margin-top:8px;max-height:320px;overflow:auto">
            <li v-for="(f,i) in impResult.failed" :key="i" style="color:#a05a46">第 {{f.row}} 行：{{f.msg}}<span v-if="f.name">（{{f.name}}）</span></li>
            <li v-for="(f,i) in (impResult.warnings || [])" :key="'w'+i" style="color:#9a6b12">{{f.name ? '「' + f.name + '」' : ''}}：{{f.msg}}</li>
          </ul>
        </div>
        <template #footer>
          <el-button @click="impOpen = false">取消</el-button>
          <el-button type="primary" :loading="impBusy" :disabled="!impRows.length" @click="doImport">开始导入</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};
