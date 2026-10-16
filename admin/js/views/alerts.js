/* ============ 视图：预警设置（页面标红参数 + 订阅消息模板） ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.alerts = {
  nav: true, title: '预警设置', icon: '🔔',
  comp: {
    name: 'AlertsView',
    data() {
      return {
        S: Store,
        form: {
          departWarnDays: 7, payOverdueDays: 0,
          msgTemplates: { deposit: '', balance: '', ticket: '', depart: '' },
          pdfFontFileID: '', pdfFontUrl: ''
        },
        saving: false
      };
    },
    methods: {
      load() {
        const gc = Store.db.globalConfig || {};
        const a = gc.alert || {};
        this.form = {
          departWarnDays: a.departWarnDays != null ? a.departWarnDays : 7,
          payOverdueDays: a.payOverdueDays != null ? a.payOverdueDays : 0,
          msgTemplates: Object.assign({ deposit: '', balance: '', ticket: '', depart: '' }, a.msgTemplates || {}),
          pdfFontFileID: a.pdfFontFileID || '',
          pdfFontUrl: a.pdfFontUrl || ''
        };
      },
      save() {
        this.saving = true;
        Store.db.globalConfig = Store.db.globalConfig || {};
        Store.db.globalConfig.alert = Object.assign({}, Store.db.globalConfig.alert || {}, {
          departWarnDays: Number(this.form.departWarnDays) || 0,
          payOverdueDays: Number(this.form.payOverdueDays) || 0,
          msgTemplates: this.form.msgTemplates,
          pdfFontFileID: this.form.pdfFontFileID,
          pdfFontUrl: this.form.pdfFontUrl
        });
        Store.save();
        this.saving = false;
        ElementPlus.ElMessage.success('已保存预警设置');
      },
      async runNow() {
        if (!(window.Cloud && Cloud.enabled())) { ElementPlus.ElMessage.info('需云环境才能立即执行提醒任务'); return; }
        const r = await Cloud.call('reminderScheduler', {});
        if (r && r.code === 200) {
          const d = r.data || {};
          ElementPlus.ElMessage.success('提醒任务已执行：扫描 ' + (d.scanned || 0) + ' 单，发送 ' + ((d.sent || []).length) + ' 条');
        } else {
          ElementPlus.ElMessage.warning((r && r.msg) || '无法从后台触发（定时任务每日自动运行，也可在云开发控制台手动运行 reminderScheduler）');
        }
      },
    },
    mounted() { this.load(); },
    template: `
    <div>
      <div class="card" style="max-width:780px">
        <div class="card-title">预警参数（工作台页面标红）</div>
        <el-form label-width="190px">
          <el-form-item label="出团预警提前天数">
            <el-input-number v-model="form.departWarnDays" :min="0" :max="60" />
            <span class="soft" style="margin-left:10px">离出团 ≤ 该天数时，订单标黄</span>
          </el-form-item>
          <el-form-item label="款项逾期宽限天数">
            <el-input-number v-model="form.payOverdueDays" :min="0" :max="60" />
            <span class="soft" style="margin-left:10px">应付截止后超过该天数视为逾期（标红）</span>
          </el-form-item>
        </el-form>

        <el-divider content-position="left">订阅消息模板（消息端提醒）</el-divider>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:14px"
          title="在微信公众平台申请「订阅消息」模板后，将模板ID填入下方；员工在小程序授权后，每日定时任务将推送对应提醒。留空则仅做页面标红，不发送消息。" />
        <el-form label-width="190px">
          <el-form-item label="定金到期模板ID"><el-input v-model="form.msgTemplates.deposit" placeholder="选填" /></el-form-item>
          <el-form-item label="尾款/补款模板ID"><el-input v-model="form.msgTemplates.balance" placeholder="选填" /></el-form-item>
          <el-form-item label="订票临近模板ID"><el-input v-model="form.msgTemplates.ticket" placeholder="选填" /></el-form-item>
          <el-form-item label="出团临近模板ID"><el-input v-model="form.msgTemplates.depart" placeholder="选填" /></el-form-item>
        </el-form>

        <el-divider content-position="left">PDF 中文字体（导出行程单）</el-divider>
        <el-form label-width="190px">
          <el-form-item label="字体文件 fileID"><el-input v-model="form.pdfFontFileID" placeholder="cloud:// 开头；留空则用内置字体" /></el-form-item>
          <el-form-item label="字体下载直链"><el-input v-model="form.pdfFontUrl" placeholder="可公开访问的 .otf / .ttf 直链" /></el-form-item>
        </el-form>

        <div class="flex gap10" style="margin-top:8px">
          <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
          <el-button @click="runNow">▶ 立即执行提醒任务</el-button>
          <el-button @click="load">↺ 还原</el-button>
        </div>
      </div>
    </div>`,
  },
};
