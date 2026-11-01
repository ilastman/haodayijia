/* ============================================================
 * 通用 UI 组件库：拖拽排序指令 / 图片上传 / 素材库 / 裁剪 / 富文本
 * ============================================================ */
(function () {
  const { createApp, reactive, ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } = Vue;

  /* ---------------- 工具 ---------------- */
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function fmtSize(n) {
    if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n > 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  const ICO = { refresh: '🔄', trash: '🗑', eye: '👁', zoom: '🔍', edit: '✏️', up: '⬆️', down: '⬇️' };

  /* ---------------- 拖拽排序指令 v-sort ---------------- */
  function installSort(app) {
    app.directive('sort', {
      mounted(el, binding) {
        const getItems = () => Array.from(el.children).filter(c => c.getAttribute && c.getAttribute('draggable') === 'true');
        let from = -1, over = null;
        const clean = () => {
          const it = getItems();
          it.forEach(x => x.classList.remove('dragging', 'drag-over-top', 'drag-over-bot'));
          from = -1; over = null;
        };
        function onStart(e) {
          const t = e.target.closest('[draggable="true"]');
          if (!t || !el.contains(t)) return;
          from = getItems().indexOf(t);
          t.classList.add('dragging');
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', '#'); } catch (_) {} }
        }
        function onEnd(e) { clean(e); }
        function onOver(e) {
          if (from < 0) { return; }
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          const it = getItems();
          const cur = it.find(x => x.classList.contains('dragging')) || it[from];
          const target = e.target.closest('[draggable="true"]');
          it.forEach(x => x.classList.remove('drag-over-top', 'drag-over-bot'));
          if (!target || target === cur) { over = null; return; }
          const r = target.getBoundingClientRect();
          const before = e.clientY < r.top + r.height / 2;
          target.classList.add(before ? 'drag-over-top' : 'drag-over-bot');
          over = target;
        }
        function onDrop(e) {
          if (from < 0) return;
          e.preventDefault();
          const it = getItems();
          const cur = it.find(x => x.classList.contains('dragging')) || it[from];
          let moveTo = null;
          if (over) {
            const i = it.indexOf(over);
            moveTo = over.classList.contains('drag-over-top') ? i : i + 1;
          }
          const f = it.indexOf(cur);
          clean();
          if (f === -1 || moveTo === null) return;
          let to = moveTo; if (f < to) to--;
          if (to !== f && typeof binding.value === 'function') binding.value(f, to);
        }
        el.addEventListener('dragstart', onStart);
        el.addEventListener('dragend', onEnd);
        el.addEventListener('dragover', onOver);
        el.addEventListener('drop', onDrop);
        el.__sortClean = () => {
          el.removeEventListener('dragstart', onStart);
          el.removeEventListener('dragend', onEnd);
          el.removeEventListener('dragover', onOver);
          el.removeEventListener('drop', onDrop);
        };
      },
      unmounted(el) { if (el.__sortClean) el.__sortClean(); },
    });
  }

  /* ---------------- 全局状态：裁剪器 / 素材库选择器 ---------------- */
  const CropState = reactive({ show: false, src: '', ratio: 1, width: 1200, height: 800, cb: null });
  const AssetState = reactive({ show: false, cb: null });

  window.UIz = {
    openCrop(src, opts, cb) {
      opts = opts || {};
      if (opts.ratio == null) opts.ratio = 16 / 9;
      Object.assign(CropState, {
        show: true, src, ratio: opts.ratio,
        width: opts.width || 1200,
        height: opts.height || Math.round((opts.width || 1200) / opts.ratio),
        cb,
      });
    },
    openAsset(cb) { AssetState.show = true; AssetState.cb = cb; },
    ICO, fmtSize, readAsDataURL,
    CropState, AssetState,
    /* 上传图片：云模式经 fileUpload 云函数入云存储并返回 fileID；否则原样返回 dataURL */
    async uploadImage(dataUrl) {
      const C = window.Cloud;
      if (C && C.enabled() && typeof dataUrl === 'string' && dataUrl.indexOf('data:') === 0) {
        const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
        let ext = m ? m[1].toLowerCase() : 'jpg';
        if (ext === 'jpeg') ext = 'jpg';
        try {
          const r = await C.upload(dataUrl, ext);
          if (r && (r.fileID || r.url)) return r.fileID || r.url;
        } catch (e) { /* 上传失败则回退 dataURL */ }
      }
      return dataUrl;
    },
  };

  /* ---------------- 裁剪弹窗 ---------------- */
  const CropDialog = {
    name: 'CropDialog',
    template: `
    <el-dialog :model-value="CropState.show" title="裁剪图片" width="760px" append-to-body :close-on-click-modal="false" @update:model-value="v => CropState.show = v" @closed="onClosed">
      <div style="display:flex;gap:18px">
        <div class="crop-stage" ref="stage"
             style="flex:1;position:relative;height:340px;overflow:hidden;border-radius:10px;background:repeating-conic-gradient(#e8e0d0 0% 25%, #f4efe4 0% 50%) 50%/18px 18px;cursor:grab;touch-action:none">
          <img ref="imgEl" :src="CropState.src" alt="" draggable="false"
               :style="imgStyle" @load="onLoadImg" @error="onImgError"
               @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" />
          <div :style="cropRectStyle" style="position:absolute;border:2px solid #fff;box-shadow:0 0 0 4000px rgba(24,20,14,.55);pointer-events:none"></div>
        </div>
        <div style="width:150px;display:flex;flex-direction:column;gap:8px">
          <label style="font-size:12px;color:var(--ink-soft)">缩放</label>
          <el-slider v-model="zoom" :min="0.3" :max="3" :step="0.05" />
          <label style="font-size:12px;color:var(--ink-soft)">尺寸</label>
          <div class="soft">{{CropState.width}} × {{CropState.height}}</div>
          <el-button type="primary" @click="apply" style="margin-top:auto">确认裁剪</el-button>
        </div>
      </div>
    </el-dialog>`,
    setup() {
      const CropState = window.UIz.CropState;
      const stage = ref(null), imgEl = ref(null);
      const zoom = ref(1);
      const off = reactive({ x: 0, y: 0 });
      let nat = { w: 0, h: 0 }, scale = 1, dragging = false, origin = { x: 0, y: 0 };

      const cropRectStyle = computed(() => {
        const S = stage.value; if (!S) return {};
        const boxW = S.clientWidth, boxH = S.clientHeight;
        return { width: boxW + 'px', height: Math.round(boxW / CropState.ratio) + 'px', left: '0px', top: Math.round((boxH - boxW / CropState.ratio) / 2) + 'px' };
      });
      const imgStyle = computed(() => {
        const S = stage.value; if (!S || !nat.w) return {};
        const boxW = S.clientWidth, boxH = S.clientHeight;
        const cropW = boxW, cropH = boxW / CropState.ratio;
        const cropTop = (boxH - cropH) / 2;
        const base = Math.max(cropW / nat.w, cropH / nat.h) || 1;
        scale = base * zoom.value;
        const dw = nat.w * scale, dh = nat.h * scale;
        const minX = cropW - dw, minY = cropTop + cropH - dh;
        const cx = Math.min(0, Math.max(minX, off.x));
        const cy = Math.min(cropTop, Math.max(minY, off.y));
        off.x = cx; off.y = cy;
        return {
          width: dw + 'px', height: dh + 'px',
          transform: 'translate(' + cx + 'px,' + cy + 'px)',
          position: 'absolute', left: '0', top: '0', userSelect: 'none',
        };
      });
      function fit() {
        const S = stage.value; if (!S || !nat.w) return;
        const boxW = S.clientWidth, boxH = S.clientHeight;
        const cropW = boxW, cropH = boxW / CropState.ratio;
        const cropTop = (boxH - cropH) / 2;
        zoom.value = 1;
        const base = Math.max(cropW / nat.w, cropH / nat.h) || 1;
        off.x = (cropW - nat.w * base) / 2;
        off.y = cropTop + (cropH - nat.h * base) / 2;
      }
      function onDown(e) { dragging = true; origin = { x: e.clientX - off.x, y: e.clientY - off.y }; e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); }
      function onMove(e) { if (!dragging) return; off.x = e.clientX - origin.x; off.y = e.clientY - origin.y; }
      function onUp() { dragging = false; }
      function apply() {
        const S = stage.value, I = imgEl.value;
        const c = document.createElement('canvas');
        c.width = CropState.width; c.height = CropState.height;
        const ctx = c.getContext('2d');
        const srcX = -off.x / scale, srcY = -off.y / scale;
        const srcW = S.clientWidth / scale, srcH = (S.clientWidth / CropState.ratio) / scale;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(I, srcX, srcY, srcW, srcH, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.92);
        if (CropState.cb) CropState.cb(out);
        CropState.show = false;
      }
      function onClosed() { CropState.cb = null; CropState.src = ''; }
      watch(() => CropState.show, v => {
        if (v) { zoom.value = 1; off.x = 0; off.y = 0; nat.w = 0; nat.h = 0; nextTick(() => { const I = imgEl.value; if (I && I.complete) onLoadImg(); }); }
      });
      function onLoadImg() { const I = imgEl.value; if (!I) return; nat.w = I.naturalWidth || 100; nat.h = I.naturalHeight || 100; fit(); }
      function onImgError() { ElementPlus.ElMessage.error('图片加载失败，请重新选择'); CropState.show = false; }
      return { CropState, stage, imgEl, zoom, imgStyle, cropRectStyle, onDown, onMove, onUp, apply, onClosed, onLoadImg, onImgError };
    },
  };

  /* ---------------- 素材库选择弹窗 ---------------- */
  const AssetDialog = {
    name: 'AssetDialog',
    template: `
    <el-dialog :model-value="AssetState.show" title="图片素材库" width="760px" append-to-body @update:model-value="v => AssetState.show = v" @closed="onClosed">
      <div class="toolbar" style="margin-bottom:14px">
        <el-button type="primary" plain @click="upload">上传图片到素材库</el-button>
        <span class="faint">共 {{list.length}} 张</span>
        <span class="spacer"></span>
        <el-input v-model="kw" placeholder="搜索文件名" style="width:200px" clearable><template #prefix>🔍</template></el-input>
      </div>
      <div class="asset-grid scroll-slim" style="max-height:420px;overflow:auto">
        <div class="asset-cell" v-for="a in filtered" :key="a.id" @click="pick(a)">
          <img :src="img(a.url)" :alt="a.name" />
          <div class="date"><span class="ellipsis">{{a.name}}</span><span>{{fmtSize(a.size)}}</span></div>
        </div>
        <div class="asset-cell" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint)" v-if="!filtered.length">
          暂无可选素材
        </div>
      </div>
      <input ref="file" type="file" accept="image/*" multiple style="display:none" @change="onFile" />
    </el-dialog>`,
    setup() {
      const AssetState = window.UIz.AssetState;
      const list = computed(() => Store.db.assets);
      const kw = ref('');
      const file = ref(null);
      const filtered = computed(() => { const k = kw.value.trim(); return k ? list.value.filter(a => a.name.includes(k)) : list.value; });
      function pick(a) { if (AssetState.cb) AssetState.cb(a); AssetState.show = false; }
      async function upload() { file.value && file.value.click(); }
      async function onFile(e) {
        for (const f of Array.from(e.target.files || [])) {
          if (!f.type.startsWith('image/')) continue;
          const url = await window.UIz.readAsDataURL(f);
          const stored = await window.UIz.uploadImage(url);
          Store.addAsset(f.name || ('IMG_' + Math.random().toString(36).slice(2, 6)), stored);
        }
        e.target.value = '';
      }
      function onClosed() { AssetState.cb = null; }
      return { AssetState, list, kw, filtered, file, fmtSize: window.UIz.fmtSize, img: window.Store.img, pick, upload, onFile, onClosed };
    },
  };

  /* ---------------- 单图上传 ImgPicker ---------------- */
  const ImgPicker = {
    name: 'ImgPicker',
    props: { modelValue: String, ratio: { type: Number, default: null }, title: { type: String, default: '上传图片' }, targetW: { type: Number, default: 1200 } },
    emits: ['update:modelValue', 'change'],
    template: `
    <div>
      <div v-if="modelValue" class="img-wrap" :style="css">
        <img :src="img(modelValue)" alt="" @click="preview" style="cursor:zoom-in" />
        <div class="img-mask">
          <i title="查看大图" @click="preview">👁</i>
          <i title="从素材库选择" @click="fromAsset">📁</i>
          <i title="重新上传 / 裁剪" @click="upload">🖼</i>
          <i title="删除" @click="clear">🗑</i>
        </div>
      </div>
      <div v-else class="dropzone" @click="upload" @dragover.prevent @drop.prevent="onDrop">
        <div class="big-ic">🖼</div>
        <div>{{title}}</div>
        <div class="faint">{{ratio ? '上传后将自动裁剪为 ' + getRatioLabel() : '建议 16:9 大图'}} · 可拖拽图片到此处</div>
      </div>
      <input ref="file" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>`,
    setup(props, { emit }) {
      const file = ref(null);
      const css = computed(() => {
        const w = 168;
        if (!props.ratio) return { width: w + 'px', height: '96px' };
        const h = Math.round(w / props.ratio);
        return { width: w + 'px', height: Math.min(Math.max(h, 72), 210) + 'px' };
      });
      function getRatioLabel() {
        const r = props.ratio;
        if (Math.abs(r - 1) < 0.02) return '1:1 方形';
        if (Math.abs(r - 750 / 880) < 0.02) return '750×880 竖幅';
        if (Math.abs(r - 16 / 9) < 0.05) return '16:9 横图';
        return r > 1 ? '横图' : '竖图';
      }
      async function acceptData(url) {
        if (props.ratio) {
          window.UIz.openCrop(url, { ratio: props.ratio, width: props.targetW }, async done => {
            const stored = await window.UIz.uploadImage(done);
            const a = Store.addAsset((props.title || 'img') + '-' + Date.now().toString(36), stored);
            emit('update:modelValue', stored); emit('change', a);
          });
        } else {
          const stored = await window.UIz.uploadImage(url);
          const a = Store.addAsset((props.title || 'img') + '-' + Date.now().toString(36), stored);
          emit('update:modelValue', stored); emit('change', a);
        }
      }
      function upload() { file.value && file.value.click(); }
      async function onFile(e) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) { ElementPlus.ElMessage.warning('请选择图片文件'); return; }
        const url = await window.UIz.readAsDataURL(f);
        acceptData(url);
      }
      async function onDrop(e) {
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f || !f.type.startsWith('image/')) return;
        const url = await window.UIz.readAsDataURL(f);
        acceptData(url);
      }
      function clear() { emit('update:modelValue', ''); }
      function preview() {
        if (props.modelValue) {
          const w = window.open('', '_blank');
          if (w) w.document.write('<img style="max-width:100%" src="' + window.Store.img(props.modelValue) + '" alt=""/>');
        }
      }
      function fromAsset() { window.UIz.openAsset(a => emit('update:modelValue', a.url)); }
      return { file, css, upload, onFile, onDrop, clear, preview, fromAsset, getRatioLabel, img: window.Store.img };
    },
  };

  /* ---------------- 多图上传 ImgAlbum ---------------- */
  const ImgAlbum = {
    name: 'ImgAlbum',
    props: { modelValue: Array, ratio: { type: Number, default: null }, max: { type: Number, default: 9 }, title: { type: String, default: '点击上传图片' } },
    emits: ['update:modelValue'],
    template: `
    <div>
      <ul class="sortable" v-sort="onMove" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px">
        <li v-for="(u, i) in modelValue" :key="u._k || u" draggable="true" class="img-wrap" :style="{height:'82px',margin:0,display:modelValue?'block':'flex'}">
          <img :src="img(u)" alt="" style="height:100%;object-fit:cover" @click="preview(u)" />
          <div class="img-mask">
            <i title="删除" @click="removeAt(i)">🗑</i>
          </div>
        </li>
        <li v-if="modelValue.length < max" class="dropzone" style="height:82px;padding:6px;border:none;background:var(--el-color-primary-light-9)" @click="upload" @dragover.prevent @drop.prevent="onDrop">
          <span style="font-size:26px;line-height:1">＋</span>
          <span style="font-size:11px">上传</span>
        </li>
      </ul>
      <div class="faint" style="margin-top:6px">拖拽缩略图可排序 · 已 {{modelValue.length }}/{{max}} 张 · 支持多选</div>
      <input ref="file" type="file" accept="image/*" multiple style="display:none" @change="onFile" />
    </div>`,
    setup(props, { emit }) {
      const file = ref(null);
      function upload() { file.value && file.value.click(); }
      async function onFile(e) {
        const fs = Array.from(e.target.files || []);
        e.target.value = '';
        let arr = props.modelValue.slice();
        for (const f of fs) {
          if (arr.length >= props.max) break;
          if (!f.type.startsWith('image/')) continue;
          const url = await window.UIz.readAsDataURL(f);
          const stored = await window.UIz.uploadImage(url);
          Store.addAsset(f.name || 'album', stored);
          arr.push(stored);
        }
        emit('update:modelValue', arr);
      }
      async function onDrop(e) {
        const fs = Array.from(e.dataTransfer.files || []);
        let arr = props.modelValue.slice();
        for (const f of fs) {
          if (arr.length >= props.max) break;
          if (!f.type.startsWith('image/')) continue;
          const url = await window.UIz.readAsDataURL(f);
          const stored = await window.UIz.uploadImage(url);
          Store.addAsset(f.name || 'album', stored);
          arr.push(stored);
        }
        emit('update:modelValue', arr);
      }
      function removeAt(i) { const arr = props.modelValue.slice(); arr.splice(i, 1); emit('update:modelValue', arr); }
      function onMove(from, to) { const arr = props.modelValue.slice(); const [x] = arr.splice(from, 1); arr.splice(to, 0, x); emit('update:modelValue', arr); }
      function preview(u) {
        const w = window.open('', '_blank');
        if (w) w.document.write('<img style="max-width:100%" src="' + window.Store.img(u) + '" alt=""/>');
      }
      return { file, upload, onFile, onDrop, removeAt, onMove, preview, img: window.Store.img };
    },
  };

  /* ---------------- 富文本 RichText ---------------- */
  const RichText = {
    name: 'RichText',
    props: { modelValue: String, placeholder: { type: String, default: '请输入详细内容…' }, height: { type: String, default: '160px' } },
    emits: ['update:modelValue'],
    template: `
    <div class="rt-editor">
      <div class="rt-toolbar">
        <span class="soft" style="margin-right:4px;font-size:12px">格式</span>
        <button type="button" class="rt-btn" @click="cmd('bold')"><b>B</b></button>
        <button type="button" class="rt-btn" @click="cmd('italic')"><i>I</i></button>
        <button type="button" class="rt-btn" @click="cmd('formatBlock','H2')">H2</button>
        <button type="button" class="rt-btn" @click="cmd('formatBlock','H3')">H3</button>
        <button type="button" class="rt-btn" @click="cmd('formatBlock','P')">正文</button>
        <button type="button" class="rt-btn" @click="cmd('insertUnorderedList')">• 列表</button>
        <button type="button" class="rt-btn" @click="cmd('insertOrderedList')">1. 列表</button>
        <span class="soft" style="margin:0 4px;font-size:12px">插入</span>
        <button type="button" class="rt-btn" @click="addImg">图片</button>
        <button type="button" class="rt-btn" @click="addLink">链接</button>
        <button type="button" class="rt-btn" @click="addLine">分隔线</button>
        <span style="flex:1"></span>
        <button type="button" class="rt-btn" @click="clearAll">清空</button>
      </div>
      <div class="rt-body" :data-placeholder="placeholder" :style="{minHeight:height}" ref="body" contenteditable="true"
           @input="emitHtml" @focus="hadFocus = true"></div>
      <input ref="file" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>`,
    setup(props, { emit }) {
      const body = ref(null), file = ref(null);
      const hadFocus = ref(false);
      function emitHtml() {
        if (body.value) emit('update:modelValue', body.value.innerHTML);
      }
      function cmd(name, arg) {
        body.value && body.value.focus();
        document.execCommand(name, false, arg);
        emitHtml();
      }
      function addLink() {
        const url = prompt('请输入链接地址（http/https）：');
        if (url) cmd('createLink', url);
      }
      function addLine() { cmd('insertHorizontalRule'); }
      function clearAll() { if (body.value) { body.value.innerHTML = ''; emitHtml(); } }
      function addImg() { file.value && file.value.click(); }
      async function onFile(e) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        const url = await window.UIz.readAsDataURL(f);
        const stored = await window.UIz.uploadImage(url);
        body.value.focus();
        document.execCommand('insertHTML', false, '<img src="' + stored + '" alt="" />');
        Store.addAsset(f.name || 'rich-text', stored);
        emitHtml();
      }
      watch(() => props.modelValue, v => {
        if (!hadFocus.value && body.value && body.value.innerHTML !== (v || '')) body.value.innerHTML = v || '';
      });
      onMounted(() => { if (body.value && !body.value.innerHTML) body.value.innerHTML = props.modelValue || ''; });
      return { body, file, hadFocus, cmd, addLink, addLine, clearAll, addImg, onFile, emitHtml };
    },
  };

  /* ---------------- 批量删除确认 Popconfirm 封装 ---------------- */
  const Confirm = {
    name: 'Confirm',
    props: { title: { type: String, default: '确认删除？' }, text: String, okText: { type: String, default: '删除' } },
    emits: ['ok'],
    template: `
    <el-popconfirm :title="title" :confirm-button-text="okText" confirm-button-type="danger" @confirm="$emit('ok')">
      <template #reference><slot></slot></template>
      <div v-if="text" class="soft">{{text}}</div>
    </el-popconfirm>`,
  };

  /* ---------------- 安装 ---------------- */
  window.UI = {
    install(app) {
      installSort(app);
      app.component('ImgPicker', ImgPicker);
      app.component('ImgAlbum', ImgAlbum);
      app.component('RichText', RichText);
      app.component('CropDialog', CropDialog);
      app.component('AssetDialog', AssetDialog);
      app.component('Confirm', Confirm);
    },
  };
})();