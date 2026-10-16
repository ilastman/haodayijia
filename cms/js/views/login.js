const LoginView = {
  template: `
    <div class="card" style="max-width:420px;margin:60px auto">
      <el-form label-width="80px">
        <el-form-item label="账号"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" /></el-form-item>
        <el-form-item><el-button type="primary" @click="login">登录</el-button></el-form-item>
      </el-form>
    </div>
  `,
  data(){ return { form: { username: '', password: '' } }; },
  methods: {
    async login() {
      try {
        const res = await API.call('login', this.form);
        const r = res.result || res;
        if (r.code === 200) {
          API.setToken(r.data.token);
          window.location.reload();
        } else {
          alert(r.msg || '登录失败');
        }
      } catch (e) {
        alert('无法连接服务器，请检查网络或网关地址：' + ((e && e.message) ? e.message : e));
      }
    }
  }
};
