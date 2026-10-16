/* ============ 视图：登录 ============ */
window.VIEWS = window.VIEWS || {};
window.VIEWS.login = {
  nav: false,
  comp: {
    name: 'LoginView',
    data() {
      return {
        form: { username: 'admin', password: '' },
        loading: false,
      };
    },
    methods: {
      async submit() {
        if (!this.form.username || !this.form.password) { ElementPlus.ElMessage.warning('请输入账号和密码'); return; }
        this.loading = true;
        try {
          const r = await Promise.resolve(Store.login(this.form.username, this.form.password));
          if (r.ok) {
            if (window.Cloud && Cloud.enabled() && Store.reload) { await Store.reload(); }
            const name = (r.admin && (r.admin.nickname || r.admin.username)) || '管理员';
            ElementPlus.ElMessage.success('欢迎回来，' + name);
            location.hash = '#/dashboard';
          } else {
            ElementPlus.ElMessage.error(r.msg || '账号或密码错误');
          }
        } finally {
          this.loading = false;
        }
      },
    },
    template: `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="login-brand">
          <div class="mk">松</div>
          <h1>好大一家旅行社 · 管理后台</h1>
          <p>SONGZAN TRAVEL  CONSOLE</p>
        </div>
        <el-form @submit.prevent="submit" size="large">
          <el-form-item>
            <el-input v-model="form.username" placeholder="管理员账号" clearable>
              <template #prefix><span style="opacity:.6">👤</span></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-input v-model="form.password" type="password" placeholder="登录密码" show-password @keyup.enter="submit">
              <template #prefix><span style="opacity:.6">🔒</span></template>
            </el-input>
          </el-form-item>
          <el-button type="primary" size="large" class="w-full" :loading="loading" @click="submit" style="letter-spacing:4px">登 录</el-button>
        </el-form>
        <div class="tac faint" style="margin-top:16px">默认账号 admin / admin123（本地演示）</div>
      </div>
    </div>`,
  },
};