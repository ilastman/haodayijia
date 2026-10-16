/* ============ 视图：图片素材库 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS['asset-library'] = {
  nav: true, title: '素材库', icon: '🗄',
  comp: {
    name: 'AssetLibraryView',
    data() { return { S: Store, kw: '', file: null, selected: [], view: null }; },
    computed: {
      list() {
        let l = Store.db.assets.slice();
        const k = this.kw.trim();
        if (k) l = l.filter(a => a.name.includes(k));
        return l;
      },
    },
    methods: {
      async onFile(e) {
        const sel = Array.from(e.target.files || []);
        e.target.value = '';
        if (!sel.length) return;
        let added = 0;
        for (const f of sel) {
          if (!f.type.startsWith('image/')) continue;
          const url = await window.UIz.readAsDataURL(f);
          const stored = await window.UIz.uploadImage(url);
          Store.addAsset(f.name || ('IMG_' + Math.random().toString(36).slice(2, 6)), stored);
          added++;
        }
        ElementPlus.ElMessage.success('已上传 ' + added + ' 张到素材库');
      },
      upload() { const el = this.$refs.file; if (el) el.click(); },
      openView(a) { this.view = a; },
      del(a) {
        Store.remove('assets', a.id);
        ElementPlus.ElMessage.success('已删除');
      },
      batchDel() { Store.remove('assets', this.selected); ElementPlus.ElMessage.success('已批量删除 ' + this.selected.length + ' 张'); this.selected = []; },
      fmtSize: window.UIz.fmtSize,
      shareURL(a) {
        const t = document.createElement('textarea'); t.value = a.url; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); ElementPlus.ElMessage.success('已复制图片地址'); } catch (_) { window.prompt('复制地址：', a.url); }
        document.body.removeChild(t);
      },
    },
    template: `
    <div class="card">
      <div class="toolbar">
        <el-button type="primary" @click="upload">＋ 上传图片</el-button>
        <Confirm v-if="selected.length" title="确认批量删除所选素材？" ok-text="删除" @ok="batchDel">
          <el-button type="danger" plain>🗑 批量删除（{{selected.length}}）</el-button>
        </Confirm>
        <span class="soft">所有位置上传的图片都会自动收录到此，可重复选用</span>
        <span class="spacer"></span>
        <el-input v-model="kw" placeholder="搜索文件名" style="width:220px" clearable><template #prefix>🔍</template></el-input>
      </div>
      <div class="asset-grid">
        <div class="asset-cell" v-for="a in list" :key="a.id" @click="openView(a)">
          <img :src="img(a.url)" :alt="a.name" />
          <div class="date"><span class="el-checkbox" style="visibility:hidden"></span><span class="ellipsis" style="flex:1">{{a.name}}</span><span>{{fmtSize(a.size)}}</span></div>
          <div style="position:absolute;left:8px;top:8px" @click.stop>
            <el-checkbox :model-value="selected.includes(a.id)" @change="v => (v ? selected.push(a.id) : selected.splice(selected.indexOf(a.id), 1))" />
          </div>
        </div>
        <div class="asset-cell" style="min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink-faint)" v-if="!list.length">
          暂无素材
        </div>
      </div>
      <input ref="file" type="file" accept="image/*" multiple style="display:none" @change="onFile" />

      <el-dialog v-model="view" width="560px" title="图片预览" append-to-body>
        <template #default>
          <img v-if="view" :src="img(view.url)" style="width:100%;border-radius:8px;display:block" alt=""/>
          <div class="flex gap10 mt12" v-if="view">
            <div><div class="soft">文件名</div>{{view.name}}</div>
            <div><div class="soft">大小</div>{{fmtSize(view.size)}}</div>
            <div><div class="soft">入库时间</div>{{view.time}}</div>
          </div>
        </template>
        <template #footer>
          <el-button @click="shareURL(view)">复制地址</el-button>
          <Confirm title="确认删除该素材？" ok-text="删除" @ok="del(view); view = null"><el-button type="danger" plain>删除</el-button></Confirm>
        </template>
      </el-dialog>
    </div>`,
  },
};