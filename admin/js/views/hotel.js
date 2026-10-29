/* ============ 视图：酒店管理 ============ */
window.VIEWS = window.VIEWS || {};

const HOTEL_IMPORT_HEADERS = [
  { key: 'name', title: '酒店名称', headerText: '酒店名称【必填】', required: true, desc: '必填。与钻级级别、一级大区、地区四项全部相同才视为同一家酒店' },
  { key: 'regionLevel1', title: '一级大区', headerText: '一级大区【必填】', required: true, aliases: ['一级分类', '大区', '分类'], desc: '必填。任意文字原样入库，不跟固定大区名单比对' },
  { key: 'area', title: '地区', headerText: '地区【必填】', required: true, aliases: ['二级分类', '二级地区', '所在地区', '所在区域', '区域'], desc: '必填，二级分类。任意文字原样入库，如：海拉尔、额尔古纳' },
  { key: 'level', title: '钻级级别', headerText: '钻级级别【必填】', required: true, aliases: ['星级', '酒店星级', '钻级', '酒店级别'], desc: '必填。填了什么就原样入库，如：五钻、5钻、金牌民宿' },
  { key: 'roomTypes', title: '房型', headerText: '房型【选填】', desc: '任意文字原样入库，多个可用英文逗号分隔' },
  { key: 'facility', title: '房型基础配套设施', headerText: '房型基础配套设施【选填】', aliases: ['基础设施', '配套设施'], desc: '任意文字原样入库，多个可用英文逗号分隔' },
  { key: 'location', title: '经纬度', headerText: '经纬度【选填，经度,纬度】', aliases: ['坐标'], desc: '格式：经度,纬度，如 119.760,49.211' },
  { key: 'address', title: '详细地址', headerText: '详细地址【选填】', aliases: ['地址'], desc: '如：海拉尔区胜利大街 12 号' },
  { key: 'briefDesc', title: '简介描述', headerText: '简介描述【选填】', aliases: ['简短简介', '简介'], desc: '一句话介绍' },
  { key: 'startDate', title: '价格生效开始日期', headerText: '价格生效开始日期【选填】', aliases: ['开始日期'], desc: '选填。格式 yyyy-MM-dd，如 2026-11-15；不填或格式不对只跳过本条价格，酒店仍导入' },
  { key: 'endDate', title: '价格生效结束日期', headerText: '价格生效结束日期【选填】', aliases: ['结束日期'], desc: '选填。格式 yyyy-MM-dd，如 2026-12-15；与开始日期、售价都有效时才写入档期' },
  { key: 'price', title: '该区间售价', headerText: '该区间售价【选填】', aliases: ['价格', '对应售价', '售价'], desc: '选填。本档期每晚售价（元/晚）；不填不影响酒店入库' },
  { key: 'remark', title: '备注', headerText: '备注【选填】', desc: '内部备注，不展示给游客' }
];

const HOTEL_DATE_LOCALE = {
  name: 'zh-cn',
  el: {
    datepicker: {
      now: '此刻', today: '今天', cancel: '取消', clear: '清空', confirm: '确定',
      selectDate: '选择日期', selectTime: '选择时间',
      startDate: '开始日期', endDate: '结束日期',
      prevYear: '前一年', nextYear: '后一年', prevMonth: '上个月', nextMonth: '下个月',
      year: '年',
      month1: '1 月', month2: '2 月', month3: '3 月', month4: '4 月',
      month5: '5 月', month6: '6 月', month7: '7 月', month8: '8 月',
      month9: '9 月', month10: '10 月', month11: '11 月', month12: '12 月',
      weeks: { sun: '日', mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六' },
      months: { jan: '一月', feb: '二月', mar: '三月', apr: '四月', may: '五月', jun: '六月', jul: '七月', aug: '八月', sep: '九月', oct: '十月', nov: '十一月', dec: '十二月' }
    }
  }
};

window.VIEWS.hotel = {
  nav: true, title: '酒店管理', icon: '🏨',
  comp: {
    name: 'HotelView',
    data() {
      return {
        S: Store, dlg: false, form: {}, kw: '', areaKw: '', online: '', selected: [],
        page: 1, pageSize: 20, dateLocale: HOTEL_DATE_LOCALE,
        regions: window.REGIONS || [],
        impOpen: false, impBusy: false, impFileName: '', impRows: [], impResult: null,
        impFormat: '', impPreview: null, impProgress: ''
      };
    },
    computed: {
      canImport() { return !!Store.currentAdmin(); },
      canStartImport() {
        if (this.impResult) return false;
        if (this.impFormat === 'horizontal') return !!(this.impPreview && this.impPreview.hotels && this.impPreview.hotels.length);
        return this.impRows.length > 0;
      },
      importBtnLabel() {
        if (this.impBusy && this.impProgress) return this.impProgress;
        if (this.impFormat === 'horizontal' && this.impPreview) {
          const n = this.impPreview.hotels.length;
          const prefix = this.impPreview.anomalies.length ? '忽略异常，导入正常项' : '开始导入';
          return prefix + '（' + n + ' 家）';
        }
        return '开始导入（' + this.impRows.length + ' 条）';
      },
      list() {
        let l = Store.db.hotel.slice();
        const k = this.kw.trim();
        if (k) l = l.filter(h => h.name.includes(k) || (h.facilities || []).join(',').includes(k));
        const area = String(this.areaKw || '').trim();
        if (area) l = l.filter(h => String(h.area || '').indexOf(area) >= 0);
        if (this.online !== '') l = l.filter(h => h.online === (this.online === '1'));
        return l;
      },
      pageList() {
        const start = (this.page - 1) * this.pageSize;
        return this.list.slice(start, start + this.pageSize);
      },
      pageAll: {
        get() {
          const ids = this.pageList.map(h => h.id);
          return ids.length > 0 && ids.every(id => this.selected.includes(id));
        },
        set(v) {
          const ids = this.pageList.map(h => h.id);
          if (v) ids.forEach(id => { if (!this.selected.includes(id)) this.selected.push(id); });
          else this.selected = this.selected.filter(id => ids.indexOf(id) < 0);
        }
      },
      pageHalf() {
        const ids = this.pageList.map(h => h.id);
        const n = ids.filter(id => this.selected.includes(id)).length;
        return n > 0 && n < ids.length;
      },
      areaFilterOptions() {
        const cats = (Store.db.category || []).filter(c => c.tree === 'hotel');
        const parents = {};
        cats.filter(c => c.level === 1).forEach(c => { parents[c.id] = c; });
        const seen = {};
        const out = [];
        cats.filter(c => c.level === 2).slice().sort((a, b) => {
          const pa = parents[a.parentId] || {};
          const pb = parents[b.parentId] || {};
          return ((pa.sort || 0) - (pb.sort || 0)) || ((a.sort || 0) - (b.sort || 0));
        }).forEach(c => {
          if (seen[c.name]) return;
          seen[c.name] = 1;
          const parent = parents[c.parentId];
          out.push({ name: c.name, label: parent ? (parent.name + ' / ' + c.name) : c.name });
        });
        return out;
      },
      useHotelTree() { return (Store.db.category || []).some(c => c.tree === 'hotel' && c.level === 2); },
      hotelRegionOptions() {
        const rows = (Store.db.category || []).filter(c => c.tree === 'hotel' && c.level === 1);
        if (rows.length) return rows.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        return (window.REGIONS || []).map(name => ({ id: '', name }));
      },
      hotelPlaceOptions() {
        const pid = this.form.regionCatId;
        if (!pid) return [];
        return (Store.db.category || []).filter(c => c.tree === 'hotel' && c.parentId === pid)
          .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
      },
    },
    watch: {
      kw() { this.page = 1; },
      areaKw() { this.page = 1; },
      online() { this.page = 1; },
      pageSize() { this.page = 1; },
      list(l) {
        const max = Math.max(1, Math.ceil((l.length || 0) / this.pageSize));
        if (this.page > max) this.page = max;
      }
    },
    created() { this.loadCategories(); },
    methods: {
      onMove(from, to) {
        const ids = this.list.map(h => h.id);
        const offset = (this.page - 1) * this.pageSize;
        const [x] = ids.splice(offset + from, 1);
        ids.splice(offset + to, 0, x);
        Store.reorder('hotel', ids);
      },
      async loadCategories() {
        const res = await Store.cloudCall('categoryCRUD', { action: 'list' });
        if (res && res.code === 200 && Array.isArray(res.data)) Store.db.category = res.data;
      },
      onHotelRegion(val) {
        const cat = (Store.db.category || []).filter(c => c.id === val)[0];
        this.form.regionCatId = cat ? cat.id : '';
        this.form.regionLevel1 = cat ? cat.name : (val || '');
        this.form.areaCatId = '';
        if (this.useHotelTree) this.form.area = '';
      },
      onHotelPlace(val) {
        const cat = (Store.db.category || []).filter(c => c.id === val)[0];
        this.form.areaCatId = cat ? cat.id : '';
        this.form.area = cat ? cat.name : (val || '');
      },
      openAdd() { this.form = { id: '', name: '', cover: '', album: [], envImg: '', roomImg: '', rooms: [], location: '', regionLevel1: '', regionCatId: '', area: '', areaCatId: '', intro: '', detailHtml: '', facilities: [], price: 1000, stars: 5, levelText: '', score: 9.0, lon: 99.7, lat: 27.8, sort: this.list.length + 1, online: true, prices: [] }; this.dlg = true; },
      async openEdit(h) {
        this.form = JSON.parse(JSON.stringify(h));
        this.form.album = (h.album || []).slice();
        this.form.rooms = (h.rooms || []).map(r => (typeof r === 'object'
          ? { name: r.name || '', bedType: r.bedType || '', desc: r.desc || '', img: r.img || '' }
          : { name: String(r), bedType: '', desc: '', img: '' }));
        if (this.form.regionLevel1 == null) this.form.regionLevel1 = '';
        if (!this.form.regionCatId) this.form.regionCatId = '';
        if (!this.form.areaCatId) this.form.areaCatId = '';
        const cats = Store.db.category || [];
        if (!this.form.regionCatId && this.form.regionLevel1) {
          const r = cats.filter(c => c.tree === 'hotel' && c.level === 1 && c.name === this.form.regionLevel1)[0];
          if (r) this.form.regionCatId = r.id;
        }
        if (!this.form.areaCatId && this.form.area && this.form.regionCatId) {
          const a = cats.filter(c => c.tree === 'hotel' && c.parentId === this.form.regionCatId && c.name === this.form.area)[0];
          if (a) this.form.areaCatId = a.id;
        }
        this.form.prices = [];
        this.dlg = true;
        if (h.id) {
          try {
            const res = await Store.cloudCall('hotelCRUD', { action: 'listPrices', id: h.id });
            if (res && res.code === 200 && Array.isArray(res.data)) {
              this.form.prices = res.data.map(p => ({
                start: p.start || '', end: p.end || '', roomType: p.roomType || '',
                price: (p.priceRaw != null && p.priceRaw !== '') ? p.priceRaw : (p.price == null ? '' : p.price),
                remark: p.remark || '', fuzzy: !!p.fuzzy
              }));
            }
          } catch (e) { /* 离线模式忽略 */ }
        }
      },
      async save() {
        if (!String(this.form.name || '').trim()) { ElementPlus.ElMessage.warning('请输入酒店名称'); return; }
        if (!String(this.form.regionLevel1 || '').trim()) { ElementPlus.ElMessage.warning('请选择一级大区'); return; }
        if (!String(this.form.area || '').trim()) { ElementPlus.ElMessage.warning('请选择地点'); return; }
        this.form.rooms = (this.form.rooms || []).map(r => ({
          name: String((r && r.name) || '').trim(),
          bedType: String((r && r.bedType) || '').trim(),
          desc: String((r && r.desc) || '').trim(),
          img: (r && r.img) || ''
        }));
        const prices = (this.form.prices || []).filter(p => {
          const hasPrice = String(p.price == null ? '' : p.price).trim() !== '';
          if (p.fuzzy) return hasPrice;
          return String(p.start || '').trim() && String(p.end || '').trim() && hasPrice;
        });
        const cloudOn = !!(window.Cloud && Cloud.enabled());
        let bizId = this.form.id;
        if (cloudOn) {
          /* 云端模式：直接经云函数写入，确保价格档期在主表之后再写 */
          const res = bizId
            ? await Store.cloudCall('hotelCRUD', { action: 'update', id: bizId, data: this.form })
            : await Store.cloudCall('hotelCRUD', { action: 'add', data: this.form });
          if (!res || res.code !== 200) { ElementPlus.ElMessage.error((res && res.msg) || '保存失败'); return; }
          if (!bizId) {
            bizId = (res.data && res.data.id) || '';
            this.form.id = bizId;
            await Store.reload();
          }
          const pr = await Store.cloudCall('hotelCRUD', { action: 'savePrices', id: bizId, data: { prices } });
          if (!pr || pr.code !== 200) { ElementPlus.ElMessage.warning((pr && pr.msg) || '价格档期保存失败'); }
          else { ElementPlus.ElMessage.success('已保存 ' + (pr.data ? pr.data.count : 0) + ' 条价格档期'); await Store.reload(); }
        } else {
          /* 本地模式 */
          if (bizId) { Store.update('hotel', bizId, this.form); }
          else { const doc = Store.add('hotel', this.form); bizId = doc.id; this.form.id = bizId; }
          ElementPlus.ElMessage.success('已保存');
        }
        this.dlg = false;
      },
      del(h) { Store.remove('hotel', h.id); ElementPlus.ElMessage.success('已删除'); },
      batchDel() { if (this.selected.length) { Store.remove('hotel', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; } },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
      starsTxt(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); },

      /* ---------- 价格档期（hotelPrice 子表，一房型一档期一行） ---------- */
      addPriceRow() {
        if (!Array.isArray(this.form.prices)) this.form.prices = [];
        this.form.prices.push({ start: '', end: '', roomType: '', price: '', remark: '', fuzzy: false });
      },
      removePriceRow(i) { this.form.prices.splice(i, 1); },
      roomNameOptions() { return (this.form.rooms || []).map(r => r.name).filter(Boolean); },
      hotelArea(row) {
        const h = this.hotelMeta(row);
        return (h && h.area) ? h.area : '';
      },
      hotelRegion(row) {
        const h = this.hotelMeta(row);
        return (h && h.regionLevel1) ? h.regionLevel1 : '';
      },
      hotelMeta(row) {
        const pv = this.impPreview;
        if (!pv || !pv.hotels) return null;
        const name = typeof row === 'string' ? row : (row && (row.hotelName || row.name));
        const level = typeof row === 'string' ? '' : String((row && row.level) || '');
        const region = typeof row === 'string' ? '' : String((row && row.regionLevel1) || '');
        const area = typeof row === 'string' ? '' : String((row && row.area) || '');
        if (level || region || area) {
          const hit = pv.hotels.filter(x => x.name === name && String(x.level || '') === level && String(x.regionLevel1 || '') === region && String(x.area || '') === area)[0];
          if (hit) return hit;
        }
        return pv.hotels.filter(x => x.name === name)[0] || null;
      },
      priceMin() {
        const ps = (this.form.prices || []).filter(p => !p.fuzzy).map(p => {
          const nums = String(p.price == null ? '' : p.price).match(/\d+(?:\.\d+)?/g);
          return nums ? Math.min.apply(null, nums.map(Number)) : NaN;
        }).filter(n => !isNaN(n) && n > 0);
        return ps.length ? Math.min.apply(null, ps) : 0;
      },

      /* ---------- 批量导入 ---------- */
      openImport() { this.impOpen = true; this.impBusy = false; this.impFileName = ''; this.impRows = []; this.impResult = null; this.impFormat = ''; this.impPreview = null; },
      pickFile() { const el = this.$refs.impFile; if (el) el.click(); },
      async onFile(e) {
        const f = (e.target.files || [])[0];
        e.target.value = '';
        if (!f) return;
        if (!window.ExcelKit || !ExcelKit.available()) { ElementPlus.ElMessage.error('Excel 组件未加载，请刷新页面重试'); return; }
        try {
          const parsed = await ExcelKit.parse(f);
          this.impFileName = f.name;
          this.impResult = null;
          this.impPreview = null;
          /* 优先走统一解析：一行一酒店多档期 / 酒店块表；其余回退纵向明细 */
          if (window.HotelImport && HotelImport.parseWorkbook) {
            const res = HotelImport.parseWorkbook(parsed.aoa, parsed.merges, { now: new Date() });
            if (res && (res.hotels.length || res.periods.length || (res.anomalies && res.anomalies.length))) {
              this.applyHorizontalPreview(res);
              return;
            }
          }
          const fmt = this.detectFormat(parsed);
          this.impFormat = fmt;
          if (fmt === 'horizontal') {
            const raw = window.HotelImport.parseHotelBlocks(parsed.aoa, parsed.merges, { now: new Date() });
            const res = window.HotelImport.gateHotelImport ? window.HotelImport.gateHotelImport(raw) : raw;
            this.applyHorizontalPreview(res);
          } else {
            this.impRows = ExcelKit.toObjects(parsed, HOTEL_IMPORT_HEADERS);
            if (!this.impRows.length) ElementPlus.ElMessage.warning('未解析到数据行，请确认首行为表头');
          }
        } catch (err) {
          ElementPlus.ElMessage.error('解析失败：' + (err && err.message ? err.message : '文件格式错误'));
        }
      },
      applyHorizontalPreview(res) {
        this.impFormat = 'horizontal';
        this.impPreview = res;
        this.impRows = (res.hotels || []).slice();
        if (res.hotels.length && !res.periods.length) {
          ElementPlus.ElMessage.warning('已识别酒店但没有价格档期，将只导入基础信息');
        } else if (!res.hotels.length && res.anomalies.length) {
          ElementPlus.ElMessage.warning('没有可导入的酒店，请检查酒店名称、钻级级别、一级大区、地区');
        }
      },
      /* 判断横向块表：跨行合并（纵向合并）数量 >= 3，或首行 J 列起存在日期段文本 */
      detectFormat(parsed) {
        const merges = parsed.merges || [];
        const aoa = parsed.aoa || [];
        const vMergeCount = merges.filter(m => m.e.r > m.s.r).length;
        if (vMergeCount >= 3) return 'horizontal';
        const head = aoa[1] || [];
        const seg = String(head[9] || '');
        if (/\d/.test(seg) && /[-~～]/.test(seg)) return 'horizontal';
        /* 纵向明细表头特征：含「价格生效开始日期」列 */
        const hdrs = (parsed.headers || []).map(h => ExcelKit.normHeader(h));
        if (hdrs.some(h => h.indexOf('价格生效开始日期') >= 0)) return 'vertical';
        return 'vertical';
      },
      async doImport() {
        if (!this.impRows.length) { ElementPlus.ElMessage.warning('请先选择要导入的 Excel 文件'); return; }
        this.impBusy = true;
        this.impProgress = '';
        try {
          if (this.impFormat === 'horizontal') {
            await this.doImportHorizontal();
          } else {
            await this.doImportVertical();
          }
        } catch (err) {
          ElementPlus.ElMessage.error('导入失败：' + (err && err.message ? err.message : '网络或超时，请分批重试'));
        } finally {
          this.impBusy = false;
          this.impProgress = '';
        }
      },
      async doImportVertical() {
        const rows = this.impRows.map(r => ({
          _row: r._row, name: r.name, area: r.area, regionLevel1: r.regionLevel1,
          level: r.level, star: r.level, roomTypes: r.roomTypes, facility: r.facility,
          location: r.location, address: r.address, briefDesc: r.briefDesc, remark: r.remark,
          startDate: r.startDate, endDate: r.endDate, price: r.price
        }));
        const res = await Store.cloudCall('hotelCRUD', { action: 'importBatch', data: { rows } });
        if (!res) { ElementPlus.ElMessage.error('仅云端模式支持批量导入，请在联网后台使用'); return; }
        if (res.code !== 200) { ElementPlus.ElMessage.error(res.msg || '导入失败'); return; }
        this.impResult = res.data;
        if (res.data.success > 0) await Store.reload();
        ElementPlus.ElMessage.success(this.importDoneText(res.data));
      },
      importDoneText(d) {
        d = d || {};
        return '导入完成：新增成功 ' + (d.created || 0) + ' 家，匹配补全 ' + (d.updated || 0) + ' 家，价格档期 ' + (d.priceCount || 0) + ' 条，失败 ' + ((d.failed && d.failed.length) || 0) + ' 条';
      },
      hotelIdentKey(row) {
        const name = String((row && (row.name || row.hotelName)) || '').trim();
        const level = String((row && row.level) || '').trim();
        const region = String((row && row.regionLevel1) || '').trim();
        const area = String((row && row.area) || '').trim();
        return [name, level, region, area].join('\u0001');
      },
      async doImportHorizontal() {
        const pv = this.impPreview || {};
        const hotels = (pv.hotels || []).filter(h => h && h.name);
        const periods = (pv.periods || []).map(p => ({
          hotelName: p.hotelName, level: p.level, regionLevel1: p.regionLevel1, area: p.area,
          roomType: p.roomType, bedType: p.bedType,
          start: p.start, end: p.end, fuzzy: !!p.fuzzy, remark: p.remark || '',
          priceRaw: p.priceRaw || p.price, price: p.price, cell: p.cell
        }));
        if (!hotels.length) { ElementPlus.ElMessage.warning('没有可导入的酒店'); return; }
        const CHUNK = 3;
        let created = 0, updated = 0, priceCount = 0, success = 0;
        const failed = [], warnings = [], logs = [];
        for (let i = 0; i < hotels.length; i += CHUNK) {
          const part = hotels.slice(i, i + CHUNK);
          const keys = {};
          part.forEach(h => { keys[this.hotelIdentKey(h)] = 1; });
          const partP = periods.filter(p => keys[this.hotelIdentKey(p)]);
          this.impProgress = '正在导入 ' + (i + 1) + '-' + Math.min(i + CHUNK, hotels.length) + ' / ' + hotels.length + ' 家';
          const res = await Store.cloudCall('hotelCRUD', { action: 'importBatch', data: { mode: 'horizontal', hotels: part, periods: partP } });
          if (!res) { failed.push({ name: part.map(h => h.name).join('、'), msg: '云端无响应' }); continue; }
          if (res.code !== 200) {
            part.forEach(h => failed.push({ name: h.name, msg: res.msg || '导入失败' }));
            continue;
          }
          const d = res.data || {};
          created += d.created || 0;
          updated += d.updated || 0;
          priceCount += d.priceCount || 0;
          success += d.success || 0;
          (d.failed || []).forEach(f => failed.push(f));
          (d.warnings || []).forEach(w => warnings.push(w));
          (d.logs || []).forEach(lg => logs.push(lg));
        }
        this.impResult = { created, updated, priceCount, failed, warnings, logs, success };
        this.impPreview = null;
        if (success > 0) await Store.reload();
        ElementPlus.ElMessage.success(this.importDoneText(this.impResult));
      },
      /* 忽略异常，仅导入正常项（横向） */
      ignoreAndImport() {
        if (!this.impPreview) return;
        /* 异常对应的档期已不在 periods 中（解析期已剔除），直接导入即可 */
        this.doImport();
      },
      downloadTpl() {
        /* 默认下载横向多档期模板（主推）；另提供纵向模板按钮 */
        if (window.ExcelKit && ExcelKit.downloadHotelHorizontalTemplate) ExcelKit.downloadHotelHorizontalTemplate('酒店横向多档期导入模板.xlsx');
      },
      downloadTplVertical() {
        ExcelKit.downloadTemplate({
          fileName: '酒店批量导入模板(纵向明细).xlsx',
          headers: HOTEL_IMPORT_HEADERS,
          sample: {
            name: '呼伦贝尔宾馆', regionLevel1: '呼伦贝尔', area: '海拉尔', level: '五钻',
            roomTypes: '标准间,大床房', facility: '免费早餐,停车场,地暖',
            location: '119.760,49.211', address: '海拉尔区胜利大街 12 号', briefDesc: '草原之心，舒适之选',
            startDate: '2026-11-15', endDate: '2026-12-15', price: 880, remark: '淡季'
          },
          footNotes: [
            '1. 一行可以是一家酒店；同一酒店多个档期请分多行，重复填写酒店名称、钻级级别、一级大区、地区，只改起止日期与售价。',
            '2. 必填四项：酒店名称、钻级级别、一级大区、地区（二级地点）。缺任意一项则该行报错并跳过，不会入库。',
            '3. 四项全部相同视为同一家酒店：匹配到已有记录时只补全新信息，不覆盖、不清空旧数据；任意一项不同则新增。',
            '4. 房型、配套设施、价格、起止日期、图片都不做必填，也不做枚举拦截；填了什么就原样存什么。',
            '5. 没有档期日期和价格时，只导入酒店基础信息，不会因为日期为空而报错。',
            '6. 日期和售价都有效时才写入一条价格档期；格式不对只跳过该条价格，酒店仍然导入。',
            '7. 图片请在导入后到酒店编辑里手动上传。',
            '8. 多个值请使用英文逗号（,）分隔。表头里【】内的提示可保留。'
          ]
        });
      },
    },
    template: `
    <div>
      <input ref="impFile" type="file" accept=".xlsx,.xls" style="display:none" @change="onFile" />
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增酒店</el-button>
          <el-button v-if="canImport" type="success" plain @click="openImport">📥 批量导入</el-button>
          <el-button v-if="canImport" plain @click="downloadTpl">⬇ 下载模板</el-button>
          <Confirm v-if="selected.length" title="确认批量删除所选酒店？" ok-text="删除" @ok="batchDel">
            <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
          </Confirm>
          <el-select v-model="online" style="width:130px" placeholder="上下架">
            <el-option label="全部" value="" /><el-option label="已上架" value="1" /><el-option label="已下架" value="0" />
          </el-select>
          <span class="spacer"></span>
          <el-select v-model="areaKw" filterable allow-create default-first-option clearable style="width:200px" placeholder="按地点筛选">
            <el-option v-for="p in areaFilterOptions" :key="p.name" :label="p.label" :value="p.name" />
          </el-select>
          <el-input v-model="kw" placeholder="搜索名称 / 设施" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:0 2px 10px">
          <el-checkbox v-model="pageAll" :indeterminate="pageHalf" :disabled="!pageList.length">全选本页</el-checkbox>
          <span class="faint">本页 {{pageList.length}} 条，已选 {{selected.length}} 条</span>
        </div>

        <ul class="sortable" v-sort="onMove">
          <li v-for="h in pageList" :key="h.id" draggable="true" :style="{opacity: h.online ? 1 : .55}">
            <div class="drag-handle">⠿</div>
            <el-checkbox :model-value="selected.includes(h.id)" @change="v => (v ? selected.push(h.id) : selected.splice(selected.indexOf(h.id), 1))" @click.stop />
            <div class="img-wrap" style="width:78px;height:54px;flex:0 0 78px"><img :src="img(h.cover)" style="height:100%;object-fit:cover" alt="" @click="previewImg(h.cover)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{{h.name}}
                <span style="color:#b59a6b;margin-left:6px" title="级别">{{starsTxt(h.stars)}}</span>
                <span class="chip" v-if="h.levelText" style="margin-left:6px">{{h.levelText}}</span>
                <span class="st" style="margin-left:8px" :class="h.online ? 'st-on' : 'st-off'">{{h.online ? '已上架' : '已下架'}}</span>
                <span class="chip" v-if="h.regionLevel1" style="margin-left:8px">{{h.regionLevel1}}</span>
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

      <el-dialog v-model="dlg" :title="form.id ? '编辑酒店' : '新增酒店'" width="780px" append-to-body top="4vh">
        <div class="dlg-body">
          <el-form label-width="88px">
            <el-form-item label="酒店名称" required><el-input v-model="form.name" placeholder="如：呼伦贝尔宾馆" /></el-form-item>
            <el-form-item label="封面图"><ImgPicker v-model="form.cover" :ratio="16/9" title="上传酒店封面（大图）" /></el-form-item>
            <el-form-item label="相册图"><ImgAlbum v-model="form.album" :max="9" title="上传实景相册" /></el-form-item>
            <div class="form-grid-2">
              <el-form-item label="环境图"><ImgPicker v-model="form.envImg" :ratio="16/9" title="上传环境图" /></el-form-item>
              <el-form-item label="房型图"><ImgPicker v-model="form.roomImg" :ratio="16/9" title="上传房型图" /></el-form-item>
            </div>
            <div class="form-grid-2">
              <el-form-item label="级别"><el-rate v-model="form.stars" :max="5" /></el-form-item>
              <el-form-item label="级别原文"><el-input v-model="form.levelText" placeholder="如：五钻 / 精品民宿（选填）" /></el-form-item>
              <el-form-item label="参考价"><el-input-number v-model="form.price" :min="0" :step="100" style="width:100%" /><span class="faint"> 元/晚</span></el-form-item>
              <el-form-item label="评分"><el-input-number v-model="form.score" :min="0" :max="10" :precision="1" :step="0.1" style="width:100%" /></el-form-item>
              <el-form-item label="一级大区" required>
                <el-select :model-value="form.regionCatId || form.regionLevel1" clearable filterable style="width:100%" placeholder="选择大区" @change="onHotelRegion">
                  <el-option v-for="r in hotelRegionOptions" :key="r.id || r.name" :label="r.name" :value="r.id || r.name" />
                </el-select>
              </el-form-item>
              <el-form-item label="地点" required>
                <el-select v-if="useHotelTree" :model-value="form.areaCatId || form.area" clearable filterable style="width:100%" placeholder="先选大区，再选地点" @change="onHotelPlace">
                  <el-option v-for="p in hotelPlaceOptions" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
                <el-input v-else v-model="form.area" placeholder="如：海拉尔" />
              </el-form-item>
              <el-form-item label="位置说明"><el-input v-model="form.location" placeholder="如：海拉尔区胜利大街 12 号" /></el-form-item>
            </div>
            <el-form-item label="房型">
              <div style="width:100%">
                <div v-for="(r,i) in form.rooms" :key="i" style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
                  <ImgPicker v-model="r.img" :ratio="16/9" title="房型展示图" />
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                      <el-input v-model="r.name" placeholder="房型名称" style="width:180px" />
                      <el-input v-model="r.bedType" placeholder="床型" style="width:110px" />
                      <el-input v-model="r.desc" placeholder="说明（可选）" style="flex:1" />
                      <el-button size="small" type="danger" plain @click="form.rooms.splice(i,1)">删除</el-button>
                    </div>
                    <div class="faint">每个房型可上传一张独立展示图，选填</div>
                  </div>
                </div>
                <el-button size="small" @click="form.rooms.push({name:'',bedType:'',desc:'',img:''})">＋ 添加房型</el-button>
              </div>
            </el-form-item>
            <el-form-item label="价格档期">
              <div style="width:100%">
                <el-config-provider :locale="dateLocale">
                <div v-for="(p,pi) in form.prices" :key="pi" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                  <el-date-picker v-model="p.start" type="date" value-format="YYYY-MM-DD" placeholder="生效开始日期" style="width:150px" :disabled="!!p.fuzzy" :teleported="false" />
                  <span class="soft">至</span>
                  <el-date-picker v-model="p.end" type="date" value-format="YYYY-MM-DD" placeholder="生效结束日期" style="width:150px" :disabled="!!p.fuzzy" :teleported="false" />
                  <el-select v-model="p.roomType" filterable allow-create default-first-option clearable placeholder="房型（可输入）" style="width:130px">
                    <el-option v-for="rn in roomNameOptions()" :key="rn" :label="rn" :value="rn" />
                  </el-select>
                  <el-input v-model="p.price" placeholder="售价/区间 如 680-775" style="width:150px" />
                  <el-input v-model="p.remark" placeholder="备注/档期名" style="width:130px" />
                  <el-tooltip content="模糊档期：不参与自动核价，仅作备注记录（如 11月中/春节）">
                    <el-checkbox v-model="p.fuzzy">模糊</el-checkbox>
                  </el-tooltip>
                  <el-button size="small" type="danger" plain @click="removePriceRow(pi)">删除</el-button>
                </div>
                </el-config-provider>
                <el-button size="small" type="primary" plain @click="addPriceRow">＋ 添加价格档期</el-button>
                <div class="faint" style="margin-top:6px">闭区间：入住日期 ≥ 开始日期 且 ≤ 结束日期 时命中本档期。售价支持区间（如 680-775，核价取较低值）。模糊档期不参与核价。列表参考价自动取最低档期价（当前 ¥{{priceMin()}}）。</div>
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

      <el-dialog v-model="impOpen" title="批量导入酒店（xlsx）" width="980px" append-to-body top="5vh">
        <div class="toolbar" style="margin-bottom:12px">
          <el-button type="primary" plain @click="pickFile">选择 xlsx 文件</el-button>
          <el-button plain @click="downloadTpl">下载横向模板</el-button>
          <el-button plain @click="downloadTplVertical">下载纵向模板</el-button>
          <span class="soft" v-if="impFileName">已选：{{impFileName}}{{impFormat ? '（识别为' + (impFormat === 'horizontal' ? '横向多档期' : '纵向明细') + '表）' : ''}}</span>
        </div>

        <div v-if="!impFileName" class="faint" style="margin-bottom:10px">
          当前横向表：酒店名称、携程钻级/级别、地区、一级大区、房型、床型，后面每列一个日期区间（M.D-M.D），单元格为该房型售价。<br>
          A-D 合并或留空时：本行四项全空则沿用上一套酒店标识；任一项有新内容则整套更新为当前行。<br>
          必填四项：酒店名称、级别、地区、一级大区。填充后再校验，缺任意一项会提示并跳过该行；房型、床型、档期价格选填。<br>
          同一酒店多行（一行一房型）会归成一家；四项全同则增量补全，空字段不覆盖旧数据。<br>
          日期年份：今年剩余时段归当年；跨年如 12.20-2.06 自动拆成当年 12.20~12.31 与次年 1.1~2.06 两段档期。<br>
          一级大区、地区会按「分类管理」里的酒店分类名称匹配；对不上会提示，酒店仍然导入。
        </div>

        <!-- 横向：预览态 -->
        <div v-if="impFormat === 'horizontal' && impPreview && !impResult">
          <el-alert type="success" :closable="false" style="margin-bottom:10px">
            <template #title>
              解析完成：共 <b>{{impPreview.stats.hotels}}</b> 家酒店、<b>{{impPreview.stats.periods}}</b> 条价格档期，其中模糊档期 <b>{{impPreview.stats.fuzzy}}</b> 条（不参与核价，仅备注记录）；异常 <b style="color:#b45309">{{impPreview.anomalies.length}}</b> 条。
            </template>
          </el-alert>
          <div v-if="impPreview.anomalies.length" style="max-height:200px;overflow:auto;margin-bottom:10px">
            <div style="font-weight:600;color:#b45309;margin-bottom:4px">以下异常项将被跳过（酒店名称 + 单元格位置 + 原因）：</div>
            <ul style="margin:0;padding-left:18px">
              <li v-for="(a,i) in impPreview.anomalies" :key="i" style="color:#b45309;font-size:13px">
                「{{a.hotelName || '未命名'}}」@{{a.cell}} :: {{a.msg}}
              </li>
            </ul>
          </div>
          <div v-else class="faint" style="margin-bottom:10px">未发现异常项，可直接导入。</div>
          <div v-if="impPreview.hotels.length" style="margin-bottom:10px;line-height:1.8">
            <div class="faint" style="margin-bottom:4px">填充后酒店标识（名称 / 级别 / 地区 / 一级大区）：</div>
            <div v-for="h in impPreview.hotels" :key="(h.name||'') + '|' + (h.level||'') + '|' + (h.regionLevel1||'') + '|' + (h.area||'')">
              {{h.name || '—'}} / {{h.level || '—'}} / {{h.area || '—'}} / {{h.regionLevel1 || '—'}}
              <span class="faint">（{{(h.rooms||[]).length}} 个房型）</span>
            </div>
          </div>
          <div v-if="impPreview.hotels.length && !impPreview.periods.length" class="faint" style="margin-bottom:8px">以上酒店没有价格档期，将只导入基础信息。</div>
          <div style="max-height:280px;overflow:auto;border:1px solid #eee;border-radius:6px">
            <el-table :data="impPreview.periods.slice(0, 300)" size="small">
              <el-table-column prop="hotelName" label="酒店名称" min-width="140" show-overflow-tooltip />
              <el-table-column prop="level" label="级别" width="90" show-overflow-tooltip />
              <el-table-column prop="area" label="地区" width="90" show-overflow-tooltip />
              <el-table-column prop="regionLevel1" label="一级大区" width="100" show-overflow-tooltip />
              <el-table-column prop="roomType" label="房型" width="110" show-overflow-tooltip />
              <el-table-column prop="bedType" label="床型" width="90" show-overflow-tooltip />
              <el-table-column label="档期" width="200">
                <template #default="{ row }">
                  <span v-if="row.fuzzy" style="color:#b45309">模糊：{{row.remark}}</span>
                  <span v-else>{{row.start}} ~ {{row.end}}</span>
                </template>
              </el-table-column>
              <el-table-column prop="priceRaw" label="售价" width="100" />
              <el-table-column label="备注" show-overflow-tooltip>
                <template #default="{ row }"><span class="faint">{{row.cell}} {{row.remark}}</span></template>
              </el-table-column>
            </el-table>
            <div v-if="impPreview.periods.length > 300" class="faint" style="padding:6px">仅显示前 300 条，共 {{impPreview.periods.length}} 条。</div>
          </div>
        </div>

        <!-- 纵向/结果态 -->
        <div v-if="(impFormat === 'vertical' && !impResult) || impResult" style="max-height:280px;overflow:auto">
          <div v-if="impResult">
            <div>
              <b style="color:#2e7d32">新增成功 {{impResult.created || 0}} 家</b>
              ｜ <b style="color:#1d4ed8">匹配到已有酒店、信息已补全 {{impResult.updated || 0}} 家</b>
              （价格档期 {{impResult.priceCount || 0}} 条） ｜ 失败 {{impResult.failed.length}} 条
            </div>
            <ul v-if="impResult.logs && impResult.logs.length" style="margin:8px 0 0;padding-left:18px">
              <li v-for="(lg,i) in impResult.logs" :key="'lg'+i" :style="{color: lg.action === 'created' ? '#2e7d32' : '#1d4ed8', fontSize:'13px'}">
                「{{lg.name}}」{{lg.level ? ' / ' + lg.level : ''}}{{lg.regionLevel1 ? ' / ' + lg.regionLevel1 : ''}}{{lg.area ? ' / ' + lg.area : ''}}：{{lg.msg}}
              </li>
            </ul>
            <ul v-if="impResult.failed.length" style="margin:8px 0 0;padding-left:18px">
              <li v-for="(f,i) in impResult.failed" :key="i" style="color:#b45309;font-size:13px">
                {{f.name ? '「' + f.name + '」' : ''}}<span v-if="f.cell">@{{f.cell}}</span><span v-if="f.row">第 {{f.row}} 行</span>：{{f.msg}}
              </li>
            </ul>
            <ul v-if="impResult.warnings && impResult.warnings.length" style="margin:8px 0 0;padding-left:18px">
              <li v-for="(f,i) in impResult.warnings" :key="'w'+i" style="color:#9a6b12;font-size:13px">
                {{f.name ? '「' + f.name + '」' : ''}}：{{f.msg}}
              </li>
            </ul>
          </div>
          <div v-else class="faint">已识别为纵向明细表，共 {{impRows.length}} 行，点击下方按钮开始导入。</div>
        </div>

        <template #footer>
          <el-button @click="impOpen = false">关闭</el-button>
          <el-button v-if="impFormat === 'horizontal' && impPreview && !impResult" plain @click="impPreview = null; impRows = []; impFileName = ''">返回重选</el-button>
          <el-button type="primary" :loading="impBusy" :disabled="!canStartImport" @click="doImport">
            {{importBtnLabel}}
          </el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};
