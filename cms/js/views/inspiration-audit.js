const InspAuditView = {
  template: `
    <div>
      <div class="card">
        <el-button @click="load('all')">全部</el-button>
        <el-button @click="load('pending')">待审核</el-button>
        <el-button @click="load('pass')">已通过</el-button>
        <el-button @click="load('reject')">已驳回</el-button>
      </div>
      <div class="card" v-for="(item, idx) in list" :key="item._id">
        <div>类型：{{item.postType}} | 审核状态：{{item.auditStatus}} | openid：{{item.openid}}</div>
        <div class="mt12">内容：{{item.content}}</div>
        <div class="mt12 flex">
          <el-button size="small" type="success" @click="audit(item, 1)">审核通过</el-button>
          <el-button size="small" @click="audit(item, 2)">驳回</el-button>
          <el-button size="small" type="danger" @click="del(item)">删除帖子</el-button>
          <el-button size="small" @click="toggle(item, idx)">查看评论</el-button>
        </div>
        <div v-if="item._show" class="mt12">
          <div v-for="(c, cidx) in (item.commentList || [])" :key="cidx" class="card">
            <div>{{c}}</div>
            <div class="mt12"><el-button size="small" type="danger" @click="delComment(item, cidx)">删除评论</el-button></div>
          </div>
          <div v-if="!(item.commentList && item.commentList.length)">暂无评论</div>
        </div>
      </div>
    </div>
  `,
  data() { return { list: [] }; },
  async mounted() { await this.load('all'); },
  methods: {
    async load(type) {
      const token = API.getToken();
      if (type === 'all') {
        const res = await API.call('inspirationPostCRUD', { action: 'list', token });
        this.list = (res.result && res.result.data) || [];
        return;
      }
      if (type === 'pass') {
        // 小程序侧接口：仅返回审核通过
        const res = await API.call('inspirationPostCRUD', { action: 'publicList' });
        this.list = (res.result && res.result.data) || [];
        return;
      }
      // 待审核 / 驳回：拉全量后前端筛选
      const all = await API.call('inspirationPostCRUD', { action: 'list', token });
      const data = (all.result && all.result.data) || [];
      if (type === 'pending') this.list = data.filter(x => x.auditStatus === 0);
      if (type === 'reject') this.list = data.filter(x => x.auditStatus === 2);
    },
    async audit(item, status) {
      await API.call('inspirationPostCRUD', { action: 'audit', token: API.getToken(), id: item._id, auditStatus: status });
      await this.load('all');
    },
    async del(item) {
      if (!confirm('删除帖子？')) return;
      await API.call('inspirationPostCRUD', { action: 'delete', token: API.getToken(), id: item._id });
      await this.load('all');
    },
    toggle(item, idx) { this.list[idx]._show = !item._show; },
    async delComment(item, cidx) {
      await API.call('inspirationPostCRUD', { action: 'delComment', token: API.getToken(), id: item._id, commentIndex: cidx });
      await this.load('all');
    }
  }
};
