const ScenicView = {
  template: `
    <div>
      <div class="card"><el-button type="primary" @click="openAdd">新增景区</el-button></div>
      <div class="card" v-for="item in list" :key="item._id">
        <div>{{item.name}} | 上架：{{item.enable}}</div>
        <div class="mt12 flex"><el-button size="small" @click="openEdit(item)">编辑</el-button><el-button size="small" type="danger" @click="del(item)">删除</el-button></div>
      </div>
      <el-dialog v-model="dlg" title="景区编辑" width="760px">
        <el-form label-width="100px">
          <el-form-item label="景区名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="封面图">
            <div class="flex">
              <el-input v-model="form.coverImg" placeholder="可粘贴URL或上传" />
              <input type="file" accept="image/*" @change="onCoverUpload" />
            </div>
          </el-form-item>
          <el-form-item label="相册">
            <div class="mt12"><el-input v-model="imgStr" placeholder="逗号分隔多图URL" /></div>
          </el-form-item>
          <el-form-item label="简短简介"><el-input v-model="form.intro" type="textarea" :rows="2" /></el-form-item>
          <el-form-item label="详情"><el-input v-model="form.detail" type="textarea" :rows="4" /></el-form-item>
          <el-form-item label="标签"><el-input v-model="tagStr" placeholder="逗号分隔标签" /></el-form-item>
          <el-form-item label="经度"><el-input-number v-model="form.longitude" :precision="6" /></el-form-item>
          <el-form-item label="纬度"><el-input-number v-model="form.latitude" :precision="6" /></el-form-item>
          <el-form-item label="上架"><el-switch v-model="form.enable" /></el-form-item>
        </el-form>
        <template #footer><el-button @click="dlg=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
      </el-dialog>
    </div>
  `,
  data(){return{list:[],dlg:false,editing:null,form:{name:'',coverImg:'',imgList:[],intro:'',detail:'',tags:[],longitude:0,latitude:0,enable:true},imgStr:'',tagStr:''}},
  async mounted(){await this.load()},
  methods:{
    async load(){const res=await API.call('scenicCRUD',{action:'list',token:API.getToken()});this.list=(res.result&&res.result.data)||[]},
    openAdd(){this.editing=null;this.form={name:'',coverImg:'',imgList:[],intro:'',detail:'',tags:[],longitude:0,latitude:0,enable:true};this.imgStr='';this.tagStr='';this.dlg=true},
    openEdit(item){this.editing=item;this.form={name:item.name||'',coverImg:item.coverImg||'',imgList:Array.isArray(item.imgList)?[...item.imgList]:[],intro:item.intro||'',detail:item.detail||'',tags:Array.isArray(item.tags)?[...item.tags]:[],longitude:item.longitude||0,latitude:item.latitude||0,enable:item.enable!==false};this.imgStr=(this.form.imgList||[]).join(',');this.tagStr=(this.form.tags||[]).join(',');this.dlg=true},
    async onCoverUpload(e){
      const file = e.target.files&&e.target.files[0]
      if(!file){return}
      try{
        const ext = (file.name.split('.').pop()||'png')
        const url = await API.uploadImage(file, ext)
        if(url){this.form.coverImg=url}
      }catch(err){}
    },
    async save(){
      this.form.imgList = this.imgStr?this.imgStr.split(',').map(s=>s.trim()).filter(Boolean):[]
      this.form.tags = this.tagStr?this.tagStr.split(',').map(s=>s.trim()).filter(Boolean):[]
      if(this.editing){await API.call('scenicCRUD',{action:'update',token:API.getToken(),id:this.editing._id,data:this.form})}
      else{await API.call('scenicCRUD',{action:'add',token:API.getToken(),data:this.form})}
      this.dlg=false;await this.load()
    },
    async del(item){if(!confirm('删除景区？'))return;await API.call('scenicCRUD',{action:'delete',token:API.getToken(),id:item._id});await this.load()}
  }
}
