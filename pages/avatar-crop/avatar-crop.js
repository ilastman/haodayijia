Page({
  data: {
    ready: false,
    size: 0
  },

  onLoad(options) {
    this.src = options && options.src ? decodeURIComponent(options.src) : '';
  },

  onReady() {
    if (!this.src) {
      wx.showToast({ title: '图片无效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const q = wx.createSelectorQuery();
    q.select('#cropCanvas').fields({ node: true, size: true, rect: true }).exec(res => {
      const item = res && res[0];
      if (!item || !item.node) { wx.showToast({ title: '初始化失败', icon: 'none' }); return; }
      const canvas = item.node;
      const vp = item.width;
      const rect = { left: item.left || 0, top: item.top || 0 };
      const dpr = (wx.getSystemInfoSync() && wx.getSystemInfoSync().pixelRatio) || 2;
      canvas.width = Math.round(vp * dpr);
      canvas.height = Math.round(vp * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this.canvas = canvas;
      this.ctx = ctx;
      this.vp = vp;
      this.rect = rect;
      this.loadImage();
    });
  },

  loadImage() {
    const img = this.canvas.createImage();
    img.onload = () => {
      this.img = img;
      this.minScale = Math.max(this.vp / img.width, this.vp / img.height);
      this.scale = this.minScale;
      this.offsetX = 0;
      this.offsetY = 0;
      this.draw();
      this.setData({ ready: true, size: this.vp });
    };
    img.onerror = () => { wx.showToast({ title: '图片加载失败', icon: 'none' }); };
    img.src = this.src;
  },

  clamp() {
    const dw = this.img.width * this.scale;
    const dh = this.img.height * this.scale;
    const maxX = Math.max(0, (dw - this.vp) / 2);
    const maxY = Math.max(0, (dh - this.vp) / 2);
    this.offsetX = Math.min(maxX, Math.max(-maxX, this.offsetX));
    this.offsetY = Math.min(maxY, Math.max(-maxY, this.offsetY));
  },

  draw() {
    const ctx = this.ctx;
    const vp = this.vp;
    ctx.clearRect(0, 0, vp, vp);
    const dw = this.img.width * this.scale;
    const dh = this.img.height * this.scale;
    const dx = (vp - dw) / 2 + this.offsetX;
    const dy = (vp - dh) / 2 + this.offsetY;
    ctx.drawImage(this.img, dx, dy, dw, dh);
  },

  onTouchStart(e) {
    const t = e.touches || [];
    if (t.length === 1) {
      this._lastX = t[0].pageX;
      this._lastY = t[0].pageY;
      this._dist = 0;
    } else if (t.length >= 2) {
      this._dist = this.distance(t[0], t[1]);
      this._startScale = this.scale;
    }
  },

  onTouchMove(e) {
    const t = e.touches || [];
    if (t.length === 1 && this._lastX != null) {
      this.offsetX += t[0].pageX - this._lastX;
      this.offsetY += t[0].pageY - this._lastY;
      this._lastX = t[0].pageX;
      this._lastY = t[0].pageY;
      this.clamp();
      this.draw();
    } else if (t.length >= 2 && this._dist) {
      const d = this.distance(t[0], t[1]);
      this.scale = Math.max(this.minScale, Math.min(this.minScale * 4, this.scale * (d / this._dist)));
      this._dist = d;
      this.clamp();
      this.draw();
    }
  },

  onTouchEnd() {
    this._lastX = 0;
    this._lastY = 0;
    this._dist = 0;
  },

  distance(a, b) {
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  onZoom(e) {
    if (!this.img) return;
    const ratio = e.detail.value / 100;
    this.scale = this.minScale * (0.6 + ratio * 1.4);
    this.clamp();
    this.draw();
  },

  confirm() {
    if (!this.canvas) return;
    wx.canvasToTempFilePath({
      canvas: this.canvas,
      x: 0,
      y: 0,
      width: this.canvas.width,
      height: this.canvas.height,
      destWidth: 600,
      destHeight: 600,
      fileType: 'png',
      success: res => {
        const ch = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (ch && ch.emit) ch.emit('cropped', res.tempFilePath);
        wx.navigateBack();
      },
      fail: () => wx.showToast({ title: '裁剪失败', icon: 'none' })
    });
  },

  cancel() {
    wx.navigateBack();
  }
});
