/* ============ 视图：分类图库（酒店两级 / 景区三级 / 私人定制封面层） ============ */
window.VIEWS = window.VIEWS || {};

window.VIEWS.gallery = {
  nav: true, title: '图库管理', icon: '🗂',
  comp: {
    name: 'GalleryView',
    data() {
      return { S: Store, tree: 'hotel', selectedId: '', busy: false };
    },
    computed: {
      rules() { return window.GalleryRules; },
      usingFallback() {
        if (this.tree === 'customCover') return false;
        return !(Store.db.category || []).some(c => c.tree === this.tree);
      },
      cats() {
        if (this.tree === 'customCover') return [];
        const real = (Store.db.category || []).filter(c => c.tree === this.tree);
        if (real.length) return real;
        return (this.rules ? this.rules.fallbackCategories() : []).filter(c => c.tree === this.tree);
      },
      roots() { return this.kids(''); },
      selected() {
        if (this.tree === 'customCover') return { id: this.rules.COVER_PLACE, name: '私人定制封面' };
        return this.cats.filter(c => c.id === this.selectedId)[0] || null;
      },
      images() {
        const all = Store.db.gallery || [];
        if (this.tree === 'customCover') return all.filter(g => g.tree === 'customCover' || g.role === 'cover');
        if (!this.selectedId) return [];
        return all.filter(g => g.tree === this.tree && g.categoryId === this.selectedId && g.role !== 'cover');
      }
    },
    watch: {
      tree() { this.pickDefault(); },
      cats() { this.pickDefault(); }
    },
    created() { this.reload(); },
    methods: {
      async reload() {
        this.busy = true;
        try {
          if (window.Cloud && Cloud.enabled()) {
            const cats = await Store.cloudCall('categoryCRUD', { action: 'list' });
            if (cats && cats.code === 200 && Array.isArray(cats.data)) Store.db.category = cats.data;
            const g = await Store.cloudCall('galleryCRUD', { action: 'list' });
            if (g && g.code === 200 && Array.isArray(g.data)) Store.db.gallery = g.data;
          }
          if (!Array.isArray(Store.db.gallery)) Store.db.gallery = [];
          this.pickDefault();
        } finally { this.busy = false; }
      },
      kids(parentId) {
        return this.cats.filter(c => String(c.parentId || '') === String(parentId || ''))
          .slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
      },
      countOf(id) {
        return (Store.db.gallery || []).filter(g => g.tree === this.tree && g.categoryId === id && g.role !== 'cover').length;
      },
      levelName(level) {
        if (this.tree === 'hotel') return level === 1 ? '大区' : '地点';
        return level === 1 ? '大区' : (level === 2 ? '类型' : '地点');
      },
      pickDefault() {
        if (this.tree === 'customCover') { this.selectedId = this.rules.COVER_PLACE; return; }
        const leafLevel = this.tree === 'hotel' ? 2 : 3;
        const leaves = this.cats.filter(c => c.level === leafLevel);
        const still = this.cats.some(c => c.id === this.selectedId);
        if (still) return;
        this.selectedId = (leaves[0] || this.cats[0] || {}).id || '';
      },
      select(row) { this.selectedId = row.id; },
      async onFile(e) {
        const sel = Array.from(e.target.files || []);
        e.target.value = '';
        if (!sel.length) return;
        if (this.tree !== 'customCover' && !this.selected) {
          ElementPlus.ElMessage.warning('请先选中分类节点');
          return;
        }
        let added = 0;
        for (const f of sel) {
          if (!f.type || f.type.indexOf('image/') !== 0) continue;
          const url = await window.UIz.readAsDataURL(f);
          const stored = await window.UIz.uploadImage(url);
          const draft = {
            tree: this.tree,
            categoryId: this.tree === 'customCover' ? this.rules.COVER_PLACE : this.selectedId,
            role: this.tree === 'customCover' ? 'cover' : 'image',
            url: stored,
            name: f.name || '',
            size: f.size || 0
          };
          const norm = this.rules.normalizeGalleryDoc(draft, this.cats);
          if (!norm.ok) { ElementPlus.ElMessage.warning(norm.msg); continue; }
          const ok = await this.persist(norm.doc);
          if (ok) added++;
        }
        if (added) ElementPlus.ElMessage.success('已上传 ' + added + ' 张');
      },
      async persist(doc) {
        if (window.Cloud && Cloud.enabled()) {
          const res = await Store.cloudCall('galleryCRUD', { action: 'add', data: doc });
          if (!res || res.code !== 200) {
            ElementPlus.ElMessage.error((res && res.msg) || '上传失败');
            return false;
          }
          await this.reload();
          return true;
        }
        Store.add('gallery', doc);
        return true;
      },
      upload() {
        if (this.tree !== 'customCover' && !this.selected) {
          ElementPlus.ElMessage.warning('请先选中分类节点');
          return;
        }
        const el = this.$refs.file;
        if (el) el.click();
      },
      async remove(g) {
        if (window.Cloud && Cloud.enabled()) {
          const res = await Store.cloudCall('galleryCRUD', { action: 'remove', id: g.id });
          if (!res || res.code !== 200) { ElementPlus.ElMessage.error((res && res.msg) || '删除失败'); return; }
          await this.reload();
        } else {
          Store.remove('gallery', g.id);
        }
        ElementPlus.ElMessage.success('已删除');
      },
      fmtSize: window.UIz.fmtSize
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-radio-group v-model="tree">
            <el-radio-button label="hotel">酒店图库</el-radio-button>
            <el-radio-button label="scenic">景区图库</el-radio-button>
            <el-radio-button label="customCover">私人定制封面</el-radio-button>
          </el-radio-group>
          <el-button type="primary" :disabled="tree !== 'customCover' && !selected" @click="upload">＋ 上传图片</el-button>
          <span class="spacer"></span>
          <span class="faint" v-if="tree === 'hotel'">两级：大区 → 地点，例如 呼伦贝尔 → 海拉尔 / 满洲里。这里只放宣传图。</span>
          <span class="faint" v-else-if="tree === 'scenic'">三级：大区 → 类型 → 地点。这里只放宣传图。</span>
          <span class="faint" v-else>私人定制专用封面层。封面图只在这里上传，不会进入酒店或景区图库。</span>
        </div>
        <div v-if="usingFallback" class="faint" style="margin:-6px 0 12px">当前没有云端分类，先按小程序同一套默认层级管理。连上云端后会改用分类管理里的树。</div>

        <div v-if="tree === 'customCover'">
          <div class="asset-grid">
            <div class="asset-cell" v-for="g in images" :key="g.id">
              <img :src="img(g.url)" :alt="g.name" />
              <div class="date"><span class="ellipsis" style="flex:1">{{g.name}}</span><span>{{fmtSize(g.size)}}</span></div>
              <div style="position:absolute;right:8px;top:8px" @click.stop>
                <Confirm :title="'确认删除「' + (g.name || '图片') + '」？'" ok-text="删除" @ok="remove(g)">
                  <el-button size="small" type="danger" plain>删除</el-button>
                </Confirm>
              </div>
            </div>
            <div v-if="!images.length" class="asset-cell" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint)">还没有封面，点上方上传</div>
          </div>
        </div>

        <div v-else style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:280px;flex:0 0 280px;border-right:1px solid var(--line);padding-right:12px;max-height:calc(100vh - 240px);overflow:auto">
            <div v-if="!roots.length" class="faint">暂无分类</div>
            <div v-for="r1 in roots" :key="r1.id" style="padding:8px 0;border-top:1px solid var(--line)">
              <div :style="{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontWeight: selectedId === r1.id ? 700 : 500}" @click="select(r1)">
                <span>{{r1.name}}</span>
                <span class="chip">{{levelName(1)}}</span>
                <span class="faint" style="margin-left:auto">{{countOf(r1.id)}}</span>
              </div>
              <div v-for="r2 in kids(r1.id)" :key="r2.id" style="margin:6px 0 0 16px">
                <div :style="{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',background: selectedId === r2.id ? 'var(--accent-soft, #f4efe4)' : 'transparent', borderRadius:'6px', padding:'2px 4px'}" @click="select(r2)">
                  <span>{{r2.name}}</span>
                  <span class="chip">{{levelName(2)}}</span>
                  <span class="faint" style="margin-left:auto">{{countOf(r2.id)}}</span>
                </div>
                <div v-for="r3 in kids(r2.id)" :key="r3.id" :style="{margin:'4px 0 0 16px',display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',background: selectedId === r3.id ? 'var(--accent-soft, #f4efe4)' : 'transparent', borderRadius:'6px', padding:'2px 4px'}" @click="select(r3)">
                  <span class="soft">{{r3.name}}</span>
                  <span class="chip">{{levelName(3)}}</span>
                  <span class="faint" style="margin-left:auto">{{countOf(r3.id)}}</span>
                </div>
              </div>
            </div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="margin-bottom:10px"><b>{{selected ? selected.name : '未选择'}}</b> <span class="faint">{{images.length}} 张</span></div>
            <div class="asset-grid">
              <div class="asset-cell" v-for="g in images" :key="g.id">
                <img :src="img(g.url)" :alt="g.name" />
                <div class="date"><span class="ellipsis" style="flex:1">{{g.name}}</span><span>{{fmtSize(g.size)}}</span></div>
                <div style="position:absolute;right:8px;top:8px" @click.stop>
                  <Confirm :title="'确认删除「' + (g.name || '图片') + '」？'" ok-text="删除" @ok="remove(g)">
                    <el-button size="small" type="danger" plain>删除</el-button>
                  </Confirm>
                </div>
              </div>
              <div v-if="!images.length" class="asset-cell" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint)">该节点还没有图片</div>
            </div>
          </div>
        </div>
        <input ref="file" type="file" accept="image/*" multiple style="display:none" @change="onFile" />
      </div>
    </div>`
  }
};
