const HotelView = {
  template: `
    <div>
      <div class="card"><el-button type="primary" @click="openAdd">新增酒店</el-button></div>
      <div class="card" v-for="item in list" :key="item._id">
        <div>{{item.name}} | 上架：{{item.enable}}</div>
        <div class="mt12 flex"><el-button size="small" @click="openEdit(item)">编辑</el-button><el-button size="small" type="danger" @click="del(item)">删除</el-button></div>
      </div>
      <el-dialog v-model="dlg" title="酒店编辑" width="760px">
        <el-form label-width="100px">
          <el-form-item label="酒店名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="封面图">
            <div class="flex"><el-input v-model="form.coverImg" /><input type="file" accept="image/*" @change="onCoverUpload" /></div>
          </el-form-item>
          <el-form-item label="相册URL"><el-input v-model="imgStr" placeholder="逗号分隔多图URL" /></el-form-item>
          <el-form-item label="简短简介"><el-input v-model="form.intro" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="酒店介绍"><el-input v-model="form.detail" type="textarea" :rows="4" /></el-form-item>
          <el-form-item label="配套设施"><el-input v-model="facStr" placeholder="逗号分隔设施" /></el-form-item>
          <el-form-item label="经度"><el-input-number v-model="form.longitude" :precision="6" /></el-form-item>
          <el-form-item label="纬度"><el-input-number v-model="form.latitude" :precision="6" /></el-form-item>
          <el-form-item label="上架"><el-switch v-model="form.enable" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="dlg=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
      </el-dialog>
    </div>
  `,
  data(){return{list:[],dlg:false,editing:null,form:{name:'',coverImg:'',imgList:[],intro:'',detail:'',facility:[],longitude:0,latitude:0,enable:true},imgStr:'',facStr:''}},
  async mounted(){await this.load()},
  methods:{
    async load(){const res=await API.call('hotelCRUD',{action:'list',token:API.getToken()});this.list=(res.result&&res.result.data)||[]},
    openAdd(){this.editing=null;this.form={name:'',coverImg:'',imgList:[],intro:'',detail:'',facility:[],longitude:0,latitude:0,enable:true};this.imgStr='';this.facStr='';this.dlg=true},
    openEdit(item){this.editing=item;this.form={name:item.name||'',coverImg:item.coverImg||'',imgList:Array.isArray(item.imgList)?[...item.imgList]:[],intro:item.intro||'',detail:item.detail||'',facility:Array.isArray(item.facility)?[...item.facility]:[],longitude:item.longitude||0,latitude:item.latitude||0,enable:item.enable!==false};this.imgStr=this.form.imgList.join(',');this.facStr=this.form.facility.join(',');this.dlg=true},
    async onCoverUpload(e){
      const file=e.target.files&&e.target.files[0];if(!file)return;
      try{const ext=(file.name.split('.').pop()||'png');const url=await API.uploadImage(file, ext);if(url)this.form.coverImg=url}catch(err){}
    },
    async save(){this.form.imgList=this.imgStr.split(',').map(s=>s.trim()).filter(Boolean);this.form.facility=this.facStr.split(',').map(s=>s.trim()).filter(Boolean);if(this.editing){await API.call('hotelCRUD',{action:'update',token:API.getToken(),id:this.editing._id,data:this.form})}else{await API.call('hotelCRUD',{action:'add',token:API.getToken(),data:this.form})}this.dlg=false;await this.load()},
    async del(item){if(!confirm('删除酒店？'))return;await API.call('hotelCRUD',{action:'delete',token:API.getToken(),id:item._id});await this.load()}
  }
}
