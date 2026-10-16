const SettingsView = {
  template: `
    <div class="card" style="max-width:560px">
      <div>系统设置（极简）</div>
      <div class="mt12 flex">
        <el-button @click="seed">写入演示数据</el-button>
        <el-button @click="exportAll">导出全部数据(JSON)</el-button>
        <el-button type="warning" @click="logout">退出登录</el-button>
      </div>
      <div class="mt12" style="font-size:13px;color:#9E9886">
        导出用于迁移自建Node后端；演示数据仅在集合为空时写入。
      </div>
    </div>
  `,
  methods: {
    async seed() {
      if (!confirm('向空集合写入演示数据？')) return;
      const res = await API.call('dataSeed', { token: API.getToken() });
      const r = res.result || res;
      alert(r.msg || '完成');
    },
    async exportAll() {
      const res = await API.call('dataExport', { token: API.getToken() });
      const r = res.result || res;
      if (r.code !== 200) { alert(r.msg || '导出失败'); return; }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cloud-export-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    },
    logout() { API.clear(); window.location.reload(); }
  }
};
