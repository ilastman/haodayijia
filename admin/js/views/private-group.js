/* ============ 视图：线路管理（私家团多日行程） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS['private-group'] = {
  nav: true, title: '线路管理', icon: '🧭',
  comp: {
    name: 'GroupView',
    data() { return { S: Store, dlg: false, form: {}, kw: '', online: '' }; },
    computed: {
      list() {
        let l = Store.db.privateGroup.slice();
        const k = this.kw.trim();
        if (k) l = l.filter(g => g.title.includes(k));
        if (this.online !== '') l = l.filter(g => g.online === (this.online === '1'));
        return l;
      },
      scenics() { return Store.db.scenic; },
      hotels() { return Store.db.hotel; },
    },
    methods: {
      onMove(from, to) {
        const ids = this.list.map(g => g.id);
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        Store.reorder('privateGroup', ids);
      },
      openAdd() {
        this.form = {
          id: '', title: '', cover: '', images: [], tags: [], price: 5000, originalPrice: 0, days: 1, departure: '海拉尔集合',
          dest: '', type: '私家团', brief: '', highlights: ['专属管家', '越野车'], detailHtml: '',
          include: [], exclude: [], notices: { tips: [], gear: [], refund: [] }, reviews: [],
          sort: this.list.length + 1, online: true,
          dayList: [{ id: Store.uid(), dayNum: 1, title: '第 1 天', scenicId: '', hotelId: '', spots: [], meals: '', hotel: '', content: '', imgs: [] }],
        };
        this.dlg = true;
      },
      openEdit(g) {
        this.form = JSON.parse(JSON.stringify(g));
        this.form.images = (g.images || []).slice();
        this.form.tags = (g.tags || []).slice();
        this.form.dayList = (g.dayList || []).map((d, i) => ({ id: d.id || Store.uid(), ...d }));
        this.form.notices = Object.assign({ tips: [], gear: [], refund: [] }, g.notices || {});
        if (!this.form.dayList.length) this.form.dayList = [{ id: Store.uid(), dayNum: 1, title: '第 1 天', scenicId: '', hotelId: '', spots: [], meals: '', hotel: '', content: '', imgs: [] }];
        this.dlg = true;
      },
      save() {
        const f = this.form;
        if (!f.title.trim()) { ElementPlus.ElMessage.warning('请输入行程标题'); return; }
        if (!f.cover) { ElementPlus.ElMessage.warning('请上传行程封面'); return; }
        if (!f.dayList.length) { ElementPlus.ElMessage.warning('至少保留一天行程'); return; }
        f.dayList = f.dayList.map((d, i) => Object.assign(d, { dayNum: i + 1 }));
        f.days = f.dayList.length;
        if (f.id) { Store.update('privateGroup', f.id, f); ElementPlus.ElMessage.success('已保存'); }
        else { Store.add('privateGroup', f); ElementPlus.ElMessage.success('已新增，共 ' + f.days + ' 天'); }
        this.dlg = false;
      },
      addDay() {
        const n = this.form.dayList.length + 1;
        this.form.dayList.push({ id: Store.uid(), dayNum: n, title: '第 ' + n + ' 天', scenicId: '', hotelId: '', spots: [], meals: '', hotel: '', content: '', imgs: [] });
      },
      removeDay(i) { this.form.dayList.splice(i, 1); },
      reloadDays() { this.form.dayList.forEach((d, i) => { d.dayNum = i + 1; }); },
      addHighlight() { if (!this._hl) this._hl = ''; const v = prompt('输入行程亮点：', ''); if (v && v.trim()) this.form.highlights.push(v.trim()); },
      delHighlight(i) { this.form.highlights.splice(i, 1); },
      addReview() { this.form.reviews.push({ name: '', date: '', stars: 5, content: '' }); },
      delReview(i) { this.form.reviews.splice(i, 1); },
      del(g) { Store.remove('privateGroup', g.id); ElementPlus.ElMessage.success('已删除'); },
      scenicName(id) { const s = this.scenics.find(x => x.id === id); return s ? s.name : '—'; },
      hotelName(id) { const h = this.hotels.find(x => x.id === id); return h ? h.name : '—'; },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="openAdd">＋ 新增私家团</el-button>
          <el-select v-model="online" style="width:130px" placeholder="上下架">
            <el-option label="全部" value="" /><el-option label="已上架" value="1" /><el-option label="已下架" value="0" />
          </el-select>
          <span class="spacer"></span>
          <el-input v-model="kw" placeholder="搜索行程标题" style="width:220px" clearable><template #prefix>🔍</template></el-input>
        </div>

        <ul class="sortable" v-sort="onMove">
          <li v-for="g in list" :key="g.id" draggable="true" :style="{opacity: g.online ? 1 : .55}">
            <div class="drag-handle">⠿</div>
            <div class="img-wrap" style="width:88px;height:54px;flex:0 0 88px"><img :src="img(g.cover)" style="height:100%;object-fit:cover" alt="" @click="previewImg(g.cover)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">{{g.title}}
                <span class="st" style="margin-left:8px" :class="g.online ? 'st-on' : 'st-off'">{{g.online ? '已上架' : '已下架'}}</span>
              </div>
              <div class="faint" style="margin-top:4px">{{g.days}} 天行程 · 亮点：{{(g.highlights || []).slice(0,2).join(' / ')}}</div>
            </div>
            <div style="text-align:right"><b style="color:#a05a46">¥{{g.price}}</b>/人<div class="faint">{{g.dayList.length}} 天</div></div>
            <el-button size="small" type="warning" plain @click="openEdit(g)">编排行程</el-button>
            <Confirm title="确认删除该行程？" @ok="del(g)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </li>
          <li v-if="!list.length" class="tac" :draggable="false" style="cursor:default;justify-content:center;color:var(--ink-faint)">暂无私家团</li>
        </ul>
      </div>

      <el-dialog v-model="dlg" :title="form.id ? '编辑私家团行程' : '新增私家团行程'" width="860px" append-to-body top="3vh">
        <el-tabs>
          <el-tab-pane label="基本信息">
            <div class="dlg-body" style="padding-top:12px">
              <el-form label-width="88px">
                <el-form-item label="行程标题" required><el-input v-model="form.title" placeholder="如：梅里雪山 · 日照金山 5 日深访" /></el-form-item>
                <el-form-item label="封面图" required><ImgPicker v-model="form.cover" :ratio="16/9" title="上传行程封面（大图）" /></el-form-item>
                <el-form-item label="顶部相册"><ImgAlbum v-model="form.images" :max="9" title="上传顶部相册" /></el-form-item>
                <el-form-item label="一句话卖点"><el-input v-model="form.brief" placeholder="如：6天5晚贯穿呼伦贝尔经典草原腹地，独立用车、随走随停" /></el-form-item>
                <div class="form-grid-2">
                  <el-form-item label="参考价"><el-input-number v-model="form.price" :min="0" :step="100" style="width:100%" /><span class="faint"> 元/人</span></el-form-item>
                  <el-form-item label="门市价"><el-input-number v-model="form.originalPrice" :min="0" :step="100" style="width:100%" /><span class="faint"> 元/人</span></el-form-item>
                  <el-form-item label="行程类型">
                    <el-select v-model="form.type" style="width:100%"><el-option label="私家团" value="私家团" /><el-option label="拼团" value="拼团" /></el-select>
                  </el-form-item>
                  <el-form-item label="所属目的地"><el-input v-model="form.dest" placeholder="如：呼伦贝尔 / 阿尔山 / 满洲里" /></el-form-item>
                  <el-form-item label="集合地点"><el-input v-model="form.departure" placeholder="如：海拉尔集合" /></el-form-item>
                  <el-form-item label="行程天数"><el-input :model-value="form.dayList.length + ' 天'" disabled /></el-form-item>
                </div>
                <el-form-item label="行程亮点">
                  <div class="ech-tools">
                    <span class="chip" v-for="(h, i) in form.highlights" :key="h">{{h}}<span class="x" @click="delHighlight(i)">✕</span></span>
                    <el-button size="small" @click="addHighlight">＋ 添加亮点</el-button>
                  </div>
                </el-form-item>
                <el-form-item label="标签">
                  <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width:100%" placeholder="选择或输入标签，如：亲子 / 秋色 / 摄影 / 深度游" />
                </el-form-item>
                <el-form-item label="行程理念"><RichText v-model="form.detailHtml" height="130px" /></el-form-item>
                <el-form-item label="上架状态"><el-switch v-model="form.online" /><span class="soft" style="margin-left:8px">{{form.online ? '展示中' : '已隐藏'}}</span></el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="'每日行程（' + form.dayList.length + '）'">
            <ul class="sortable" v-sort="(f, t) => { const x = form.dayList; const [m] = x.splice(f, 1); x.splice(t, 0, m); }">
              <li v-for="(d, i) in form.dayList" :key="d.id" draggable="true" style="display:block;cursor:default">
                <div class="flex gap10" style="margin-bottom:10px">
                  <div class="drag-handle">⠿</div>
                  <div class="card-title" style="margin:0;flex:1"><span style="background:var(--accent);color:#fff;border-radius:6px;padding:1px 10px;font-size:13px">Day {{i + 1}}</span> {{d.title || '未命名'}}</div>
                  <el-button size="small" type="danger" plain @click="removeDay(i)">删除当天</el-button>
                </div>
                <div class="form-grid-2">
                  <el-form-item label="当日标题"><el-input v-model="d.title" placeholder="如：海拉尔 - 莫日格勒河 - 额尔古纳" /></el-form-item>
                  <el-form-item label="关联景区">
                    <el-select v-model="d.scenicId" clearable style="width:100%" placeholder="选择景区">
                      <el-option v-for="s in scenics" :key="s.id" :label="s.name" :value="s.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="当日景点">
                    <el-select v-model="d.spots" multiple filterable allow-create default-first-option style="width:100%" placeholder="选择或输入当日游玩景点">
                      <el-option v-for="s in scenics" :key="s.id" :label="s.name" :value="s.name" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="用餐说明"><el-input v-model="d.meals" placeholder="如：含早午餐 / 不含餐" /></el-form-item>
                  <el-form-item label="住宿酒店">
                    <el-select v-model="d.hotelId" clearable style="width:100%" placeholder="选择酒店">
                      <el-option v-for="h in hotels" :key="h.id" :label="h.name" :value="h.id" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="住宿名称"><el-input v-model="d.hotel" placeholder="如：海拉尔商务酒店 / 返程不含宿" /></el-form-item>
                  <el-form-item label="当日图片"><ImgAlbum v-model="d.imgs" :max="6" title="上传" /></el-form-item>
                </div>
                <el-form-item label="行程内容" style="margin-bottom:4px"><el-input v-model="d.content" type="textarea" :rows="2" placeholder="描述当日详细安排" /></el-form-item>
              </li>
              <li class="tac" :draggable="false" style="cursor:pointer;justify-content:center;color:var(--accent)" @click="addDay">
                ＋ 添加第 {{form.dayList.length + 1}} 天
              </li>
            </ul>
          </el-tab-pane>
          <el-tab-pane label="费用与说明">
            <div class="dlg-body" style="padding-top:12px">
              <el-form label-width="88px">
                <el-form-item label="费用包含">
                  <el-select v-model="form.include" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车创建，如：全程独立用车及油费过路费" />
                </el-form-item>
                <el-form-item label="费用不含">
                  <el-select v-model="form.exclude" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车创建，如：往返大交通" />
                </el-form-item>
                <el-form-item label="温馨提示"><el-input :model-value="(form.notices.tips || []).join('\n')" type="textarea" :rows="4" @update:model-value="v => (form.notices.tips = v.split('\n').filter(Boolean))" placeholder="每行一条" /></el-form-item>
                <el-form-item label="出行装备"><el-input :model-value="(form.notices.gear || []).join('\n')" type="textarea" :rows="4" @update:model-value="v => (form.notices.gear = v.split('\n').filter(Boolean))" placeholder="每行一条" /></el-form-item>
                <el-form-item label="退改规则"><el-input :model-value="(form.notices.refund || []).join('\n')" type="textarea" :rows="4" @update:model-value="v => (form.notices.refund = v.split('\n').filter(Boolean))" placeholder="每行一条" /></el-form-item>
                <el-form-item label="游客评价">
                  <div v-if="form.reviews.length">
                    <div v-for="(rv, i) in form.reviews" :key="i" style="border:1px dashed var(--line);border-radius:8px;padding:10px;margin-bottom:10px">
                      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                        <el-input v-model="rv.name" placeholder="姓名" style="width:110px" />
                        <el-input v-model="rv.date" placeholder="日期（如 2026-07-12）" style="width:160px" />
                        <el-rate v-model="rv.stars" :max="5" />
                        <span style="flex:1"></span>
                        <el-button size="small" type="danger" plain @click="delReview(i)">删除</el-button>
                      </div>
                      <el-input v-model="rv.content" type="textarea" :rows="2" placeholder="评价内容" />
                    </div>
                  </div>
                  <el-button size="small" @click="addReview">＋ 添加评价</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
        </el-tabs>
        <template #footer>
          <el-button @click="dlg = false">取消</el-button>
          <el-button type="primary" @click="save">保存行程</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};