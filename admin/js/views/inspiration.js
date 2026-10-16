/* ============ 视图：灵感广场 UGC 审核 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.inspiration = {
  nav: true, title: '灵感广场管理', icon: '✨',
  badge(vm) { return Store.stats().postsPending || ''; },
  comp: {
    name: 'InspirationView',
    data() { return { S: Store, tab: 'pending', dlg: false, cur: null, commentDlg: false, commentTarget: null, selected: [], editDlg: false, editForm: {}, isNew: false }; },
    computed: {
      st() { return Store.stats(); },
      all() { return Store.db.inspirationPost.slice().sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()); },
      list() {
        if (this.tab === 'all') return this.all;
        return this.all.filter(p => p.status === { pending: 0, pass: 1, reject: 2 }[this.tab]);
      },
      titles() {
        return [ { k: 'pending', txt: '待审核', n: this.st.postsPending }, { k: 'pass', txt: '已通过', n: this.st.postsPass }, { k: 'reject', txt: '已驳回', n: this.st.postsReject }, { k: 'all', txt: '全部', n: this.st.posts } ];
      },
    },
    methods: {
      setTab(k) { this.tab = k; this.selected = []; },
      statusTxt(s) { return ['待审核', '已通过', '已驳回'][s]; },
      audit(p, s) {
        Store.update('inspirationPost', p.id, { status: s });
        ElementPlus.ElMessage.success(s === 1 ? '已通过，内容将公开展示' : '已驳回');
        this.dlg = false;
      },
      openView(p) { this.cur = p; this.dlg = true; },
      openComments(p) { this.commentTarget = p; this.commentDlg = true; },
      delComment(c) {
        this.commentTarget.comments = this.commentTarget.comments.filter(x => x.id !== c.id);
        Store.update('inspirationPost', this.commentTarget.id, { comments: this.commentTarget.comments });
        ElementPlus.ElMessage.success('评论已删除');
      },
      del(p) { Store.remove('inspirationPost', p.id); ElementPlus.ElMessage.success('已删除'); this.dlg = false; },
      openAdd() {
        this.editForm = {
          id: '', type: 'note', nickname: '官方小编', avatar: '', title: '', tags: [],
          cover: '', imgs: [], content: '', category: '', season: '', days: 1,
          highlights: [], timeline: [], like: 0, commentCount: 0, comments: [], status: 1,
          createTime: this.now()
        };
        this.isNew = true; this.editDlg = true;
      },
      now() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); },
      openEdit(p) { this.editForm = JSON.parse(JSON.stringify(p)); this.isNew = false; this.editDlg = true; },
      saveEdit() {
        const f = this.editForm;
        if (!f.title || !f.title.trim()) { ElementPlus.ElMessage.warning('请输入标题'); return; }
        if (!Array.isArray(f.tags)) f.tags = [];
        if (!Array.isArray(f.imgs)) f.imgs = [];
        if (!Array.isArray(f.comments)) f.comments = [];
        if (!Array.isArray(f.highlights)) f.highlights = [];
        if (f.type === 'trip' && !Array.isArray(f.timeline)) f.timeline = [];
        f.commentCount = f.comments.length;
        if (f.id) Store.update('inspirationPost', f.id, f);
        else { const doc = JSON.parse(JSON.stringify(f)); delete doc.id; Store.add('inspirationPost', doc); }
        ElementPlus.ElMessage.success(f.id ? '已保存' : '已新增内容');
        this.editDlg = false;
      },
      batchDel() { Store.remove('inspirationPost', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 条'); this.selected = []; },
      previewImg(u) { const w = window.open('', '_blank'); if (w) w.document.write('<img style="max-width:100%" src="' + (window.Store ? window.Store.img(u) : u) + '" alt=""/>'); },
    },
    template: `
    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="openAdd">＋ 新增内容</el-button>
        <el-radio-group v-model="tab" @change="setTab">
          <el-radio-button v-for="t in titles" :key="t.k" :value="t.k">{{t.txt}}（{{t.n}}）</el-radio-button>
        </el-radio-group>
        <span class="spacer"></span>
        <Confirm v-if="selected.length" title="确认批量删除所选内容（含违规内容）？" ok-text="删除" @ok="batchDel">
          <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
        </Confirm>
      </div>

      <el-table :data="list" stripe height="calc(100vh - 230px)">
        <el-table-column width="46">
          <template #default="{row}"><el-checkbox :model-value="selected.includes(row.id)" @change="v => (v ? selected.push(row.id) : selected.splice(selected.indexOf(row.id), 1))" /></template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{row}"><el-tag size="small" effect="plain" :type="row.type === 'note' ? 'success' : 'warning'">{{row.type === 'note' ? '笔记' : '行程'}}</el-tag></template>
        </el-table-column>
        <el-table-column label="作者" width="150">
          <template #default="{row}"><div class="flex gap10"><img class="avatar-sm" :src="img(row.avatar)" alt=""/><span>{{row.nickname}}</span></div></template>
        </el-table-column>
        <el-table-column label="标题" min-width="210" show-overflow-tooltip>
          <template #default="{row}">
            <div class="flex gap10">
              <img v-if="row.cover" class="thum" :src="img(row.cover)" style="width:44px;height:32px" alt="" @click="previewImg(row.cover)" />
              <span>{{row.title}}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="内容预览" min-width="200" show-overflow-tooltip>
          <template #default="{row}"><span class="faint">{{row.content}}</span></template>
        </el-table-column>
        <el-table-column label="互动" width="110">
          <template #default="{row}">❤ {{row.like}} · 💬 {{row.comments ? row.comments.length : 0}}</template>
        </el-table-column>
        <el-table-column prop="createTime" label="发布时间" width="150" />
        <el-table-column label="状态" width="90">
          <template #default="{row}"><span class="st" :class="['st-pending','st-pass','st-reject'][row.status]">{{statusTxt(row.status)}}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="openView(row)">查看</el-button>
            <el-button size="small" type="primary" plain @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="primary" plain @click="openComments(row)" v-if="row.comments && row.comments.length">评论({{row.comments.length}})</el-button>
            <Confirm title="确认删除该内容？" ok-text="删除" @ok="del(row)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </template>
        </el-table-column>
        <template #empty><div class="faint" style="padding:24px">当前分类下暂无内容</div></template>
      </el-table>

      <el-dialog v-model="dlg" width="680px" append-to-body top="6vh">
        <template #header v-if="cur">
          <div class="flex gap10">
            <span style="font-weight:600">{{cur.type === 'note' ? '📝 笔记' : '🧭 行程'}} · {{statusTxt(cur.status)}}</span>
            <span class="st" :class="['st-pending','st-pass','st-reject'][cur.status]"></span>
          </div>
        </template>
        <div v-if="cur" class="dlg-body">
          <div class="flex gap16 mb12">
            <img class="avatar-sm" :src="img(cur.avatar)" style="width:44px;height:44px;border-radius:12px" alt=""/>
            <div><div style="font-weight:600">{{cur.nickname}}</div><div class="faint">{{cur.createTime}} · ❤ {{cur.like}} 点赞 · {{cur.comments ? cur.comments.length : 0}} 评论</div></div>
          </div>
          <div style="font-size:18px;font-weight:600;margin-bottom:8px">{{cur.title}}</div>
          <div v-if="cur.tags && cur.tags.length" class="flex gap10 mb12"><span class="chip" v-for="t in cur.tags" :key="t">{{t}}</span></div>
          <div style="line-height:1.8;color:var(--ink-soft)">{{cur.content}}</div>
          <div v-if="cur.imgs && cur.imgs.length" class="ech-tools mt12">
            <img v-for="(u, i) in cur.imgs" :key="i" :src="img(u)" style="width:126px;height:92px;object-fit:cover;border-radius:8px;border:1px solid var(--line)" alt="" @click="previewImg(u)" />
          </div>
          <div style="margin-top:16px;display:flex;gap:10px">
            <el-button type="success" v-if="cur.status !== 1" @click="audit(cur, 1)">✓ 通过</el-button>
            <el-button type="danger" plain v-if="cur.status !== 2" @click="audit(cur, 2)">✗ 驳回</el-button>
            <el-button v-if="cur.comments && cur.comments.length" @click="openComments(cur)">💬 管理评论（{{cur.comments.length}}）</el-button>
            <span style="flex:1"></span>
            <Confirm title="确认删除该内容？" ok-text="删除" @ok="del(cur)"><el-button type="danger">删除内容</el-button></Confirm>
          </div>
        </div>
      </el-dialog>

      <el-dialog v-model="commentDlg" title="评论管理" width="560px" append-to-body>
        <div v-if="commentTarget">
          <div v-for="c in commentTarget.comments" :key="c.id" class="flex gap10" style="padding:10px 0;border-bottom:1px dashed var(--line)">
            <img class="avatar-sm" :src="img(c.avatar)" alt=""/>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">{{c.nickname}} <span class="faint" style="font-weight:400">{{c.time}}</span></div>
              <div class="soft" style="font-size:13px">{{c.text}}</div>
            </div>
            <Confirm title="删除这条评论？" ok-text="删除" @ok="delComment(c)"><el-button size="small" type="danger" plain>删除</el-button></Confirm>
          </div>
          <div class="faint tac" v-if="!commentTarget.comments || !commentTarget.comments.length" style="padding:20px">暂无评论</div>
        </div>
      </el-dialog>

      <el-dialog v-model="editDlg" :title="(isNew ? '新增内容' : '编辑内容') + ' · ' + (editForm.type === 'note' ? '笔记' : '行程方案')" width="640px" append-to-body top="6vh">
        <div class="dlg-body" v-if="editForm.type">
          <el-form label-width="92px">
            <el-form-item label="类型">
              <el-radio-group v-model="editForm.type"><el-radio-button value="note">笔记</el-radio-button><el-radio-button value="trip">行程方案</el-radio-button></el-radio-group>
            </el-form-item>
            <el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item>
            <el-form-item label="作者昵称"><el-input v-model="editForm.nickname" style="max-width:260px" placeholder="默认：官方小编" /></el-form-item>
            <el-form-item label="作者头像"><ImgPicker v-model="editForm.avatar" :ratio="1" title="上传头像" /></el-form-item>
            <el-form-item label="封面图"><ImgPicker v-model="editForm.cover" :ratio="16 / 9" title="上传封面" /></el-form-item>
            <el-form-item label="插图"><ImgAlbum v-model="editForm.imgs" :max="9" title="上传插图" /></el-form-item>
            <template v-if="editForm.type === 'trip'">
              <el-form-item label="分类"><el-input v-model="editForm.category" placeholder="如：亲子游 / 私家团方案 / 秋季线" /></el-form-item>
              <el-form-item label="季节"><el-input v-model="editForm.season" placeholder="如：夏季草原" /></el-form-item>
              <el-form-item label="天数"><el-input-number v-model="editForm.days" :min="1" :max="30" /></el-form-item>
              <el-form-item label="亮点"><el-input :model-value="(editForm.highlights || []).join('\n')" type="textarea" :rows="3" @update:model-value="v => (editForm.highlights = v.split('\n').filter(Boolean))" placeholder="每行一条" /></el-form-item>
              <el-form-item label="行程时间轴"><el-input :model-value="JSON.stringify(editForm.timeline || [], null, 2)" type="textarea" :rows="6" @update:model-value="v => { try { editForm.timeline = JSON.parse(v); } catch (e) {} }" placeholder='[{"scenicIds":["s2"],"hotelId":"h1","note":"下午抵达海拉尔"}]' /></el-form-item>
            </template>
            <el-form-item label="标签"><el-select v-model="editForm.tags" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车创建" /></el-form-item>
            <el-form-item label="正文/简介"><el-input v-model="editForm.content" type="textarea" :rows="5" placeholder="笔记用换行分段；行程方案填一句话简介" /></el-form-item>
            <el-form-item label="状态">
              <el-radio-group v-model="editForm.status">
                <el-radio-button :value="0">待审核</el-radio-button>
                <el-radio-button :value="1">已通过</el-radio-button>
                <el-radio-button :value="2">已驳回</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="editDlg = false">取消</el-button>
          <el-button type="primary" @click="saveEdit">保存</el-button>
        </template>
      </el-dialog>
    </div>`,
  },
};