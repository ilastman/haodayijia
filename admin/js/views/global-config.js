/* ============ 视图：小程序全局配置 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS['global-config'] = {
  nav: true, title: '全局配置', icon: '⚙️',
  comp: {
    name: 'GlobalConfigView',
    data() { return { S: Store, sa: false }; },
    computed: {
      gc() { return Store.db.globalConfig; },
      tabs() { return Store.db.globalConfig.tabs || []; },
    },
    methods: {
      addTab() { Store.db.globalConfig.tabs.push({ id: Store.uid(), page: '/pages/index/index', text: '新标签', icon: '🏠', selectedIcon: '🏠', show: true }); Store.save(); },
      delTab(t) { const i = this.tabs.findIndex(x => x.id === t.id); if (i > -1) this.tabs.splice(i, 1); Store.save(); },
      onMoveTabs(from, to) {
        const arr = this.tabs;
        if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
        const [x] = arr.splice(from, 1);
        arr.splice(to, 0, x);
        Store.save();
      },
      save() { Store.save(); ElementPlus.ElMessage.success('全局配置已保存（本地）'); },
      reset() {
        ElementPlus.ElMessageBox.confirm('将恢复全局配置默认值，确认？', '重置配置', { type: 'warning' }).then(() => {
          const fresh = JSON.parse(JSON.stringify(window.SEED)).globalConfig;
          Store.db.globalConfig = fresh;
          Store.save();
          ElementPlus.ElMessage.success('已重置');
        }).catch(() => {});
      },
      previewApi() { this.sa = true; },
    },
    template: `
    <div>
      <div class="card">
        <div class="toolbar">
          <el-button type="primary" @click="save">💾 保存全部配置</el-button>
          <el-button @click="reset">↺ 恢复默认</el-button>
          <span class="spacer"></span>
          <span class="soft">改动即时生效，保存仅落盘本地存储</span>
        </div>
        <el-form label-width="110px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
            <el-form-item label="顶部公告">
              <el-input v-model="gc.notice" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="品牌 Slogan"><el-input v-model="gc.slogan" /></el-form-item>
          </div>
          <el-divider content-position="left" style="color:var(--ink-soft)">首页文案</el-divider>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
            <el-form-item label="热卖标题"><el-input v-model="gc.homeCopy.offerTitle" /><span class="faint">副标题</span><el-input v-model="gc.homeCopy.offerSub" /></el-form-item>
            <el-form-item label="秘境标题"><el-input v-model="gc.homeCopy.destTitle" /><span class="faint">副标题</span><el-input v-model="gc.homeCopy.destSub" /></el-form-item>
            <el-form-item label="灵感广场标题"><el-input v-model="gc.homeCopy.inspirationTitle" /><span class="faint">副标题</span><el-input v-model="gc.homeCopy.inspirationSub" /></el-form-item>
            <el-form-item label="咨询标题"><el-input v-model="gc.homeCopy.contactTitle" /><span class="faint">副标题</span><el-input v-model="gc.homeCopy.contactSub" /></el-form-item>
          </div>
          <el-divider content-position="left" style="color:var(--ink-soft)">底部 Tab（{{tabs.filter(t => t.show).length}} 个展示中）</el-divider>
          <ul class="sortable" v-sort="onMoveTabs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">
            <li v-for="t in tabs" :key="t.id" draggable="true" style="display:flex;align-items:center;gap:10px;margin-bottom:0;flex-direction:column">
              <div style="width:100%;display:flex;align-items:center;gap:10px">
                <div class="drag-handle">⠿</div>
                <div class="flex gap10" style="flex:1">
                  <span style="font-size:22px" v-if="t.icon">{{t.icon}}</span>
                  <div style="flex:1;min-width:0">
                    <el-input v-model="t.text" size="small" style="margin-bottom:6px" placeholder="文字" />
                    <el-input v-model="t.page" size="small" placeholder="/pages/...路径" />
                  </div>
                  <div style="flex:1;min-width:0">
                    <el-input v-model="t.icon" size="small" placeholder="图标(emoji)" />
                    <el-input v-model="t.selectedIcon" size="small" style="margin-top:6px" placeholder="选中图标" />
                  </div>
                </div>
                <el-switch v-model="t.show" size="small" title="显示隐藏" />
                <el-button size="small" type="danger" plain @click="delTab(t)">✕</el-button>
              </div>
            </li>
            <li class="tac" :draggable="false" style="cursor:pointer;justify-content:center;color:var(--accent);margin-bottom:0" @click="addTab">＋ 添加 Tab</li>
          </ul>
          <el-divider content-position="left" style="color:var(--ink-soft)">联系方式与介绍</el-divider>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
            <el-form-item label="客服电话"><el-input v-model="gc.contact.phone" /></el-form-item>
            <el-form-item label="官方微信"><el-input v-model="gc.contact.wechat" /></el-form-item>
            <el-form-item label="邮箱"><el-input v-model="gc.contact.email" /></el-form-item>
            <el-form-item label="公司地址"><el-input v-model="gc.contact.address" /></el-form-item>
          </div>
          <el-form-item label="公司介绍"><el-input v-model="gc.companyIntro" type="textarea" :rows="3" /></el-form-item>
        </el-form>
      </div>
    </div>`,
  },
};