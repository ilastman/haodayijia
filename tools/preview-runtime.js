/**
 * 小程序预览运行时
 * 直接加载真实 WXML / JS / WXSS 源码，在浏览器中模拟微信小程序运行环境。
 */
(function () {
  'use strict';

  var SRC = window.SRC || {};
  var APP_JSON = window.APP_JSON || { pages: [], tabBar: { list: [] } };
  var COMP_TAGS = {
    'route-card': 'components/route-card/route-card',
    'consult-modal': 'components/consult-modal/consult-modal'
  };

  var screenEl, tabbarEl, titleEl, backEl;
  var PAGE_CFG = {}, COMP_CFG = {}, APP_CFG = null;
  var modCache = {}, wxmlCache = {};
  var COMP_INST = {};
  var MOUSE_DRAG = null;
  var PV_TIMERS = [];
  var stack = [];
  var uidSeq = 1;

  /* ================= CSS ================= */

  function cssConvert(css) {
    return css
      .replace(/(-?\d*\.?\d+)rpx\b/g, function (m, n) { return (parseFloat(n) / 2) + 'px'; })
      .replace(/(^|\})\s*page\s*\{/g, '$1 .screen{');
  }

  function injectCss() {
    var keys = Object.keys(SRC).filter(function (k) { return /\.wxss$/.test(k); });
    keys.sort(function (a, b) {
      if (a === 'app.wxss') return -1;
      if (b === 'app.wxss') return 1;
      return 0;
    });
    var css = keys.map(function (k) { return cssConvert(SRC[k]); }).join('\n');
    var base = [
      'div,span,img,input,textarea,button{box-sizing:border-box}',
      'input,textarea{border:none;outline:none;background:transparent;font:inherit;color:inherit;-webkit-appearance:none;appearance:none}',
      'button{appearance:none;border:none;background:none;font:inherit;color:inherit;padding:0;margin:0 auto;cursor:pointer;display:block}',
      'button::after{content:none}',
      'picker{display:block}',
      '.pv-swiper-wrap{position:relative}',
      '.pv-swiper{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.pv-slide{flex:0 0 100%;height:100%;scroll-snap-align:start}',
      '.pv-swiper-wrap,.pv-swiper,.pv-slide{height:100%}',
      '.pv-dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;align-items:center;z-index:5;pointer-events:none}',
      '.pv-dots i{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.5);margin:0 3px;transition:width .2s}',
      '.pv-swiper-wrap.banner .pv-dots{bottom:28px}',
      '.pv-swiper-wrap.banner .pv-dots i{width:5px;height:5px;border-radius:5px;box-shadow:0 1px 2px rgba(36,28,20,.28)}',
      '.pv-swiper-wrap.banner .pv-dots i.on{width:14px}',
      '.pv-slide{position:relative}',
      '.pv-comp{display:contents}',
      '.pv-date-input{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;border:none;padding:0;background:transparent}',
      '.pv-toast{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);background:rgba(0,0,0,.78);color:#fff;font-size:14px;line-height:1.5;padding:14px 18px;border-radius:10px;max-width:80%;text-align:center;z-index:2000}',
      '.pv-mask{position:absolute;inset:0;z-index:1500;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}',
      '.pv-sheet{width:100%;background:#fff;border-radius:14px 14px 0 0;padding:8px 0 16px;max-height:64%;overflow:auto}',
      '.pv-sheet-item{padding:14px 20px;font-size:15px;color:#2C2C2E;border-bottom:1px solid #f2f2f2}',
      '.pv-sheet-item:last-child{border-bottom:none}',
      '.pv-sheet-item.on{color:#8A7152;font-weight:600}',
      '.pv-sheet-cancel{margin-top:8px;padding:14px;text-align:center;font-size:15px;color:#666;background:#f7f7f7}',
      '.pv-viewer{position:absolute;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:2200;cursor:zoom-out}',
      '.pv-viewer img{max-width:92%;max-height:88%}',
      '.screen::-webkit-scrollbar,.pv-swiper::-webkit-scrollbar{display:none;width:0;height:0}'
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = base + '\n' + css;
    document.head.appendChild(style);
  }

  /* ================= 模块加载 ================= */

  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }

  function resolveReq(from, spec) {
    var base = spec;
    if (spec.charAt(0) === '.') {
      var parts = (dirOf(from) + '/' + spec).split('/');
      var out = [];
      parts.forEach(function (x) {
        if (x === '' || x === '.') return;
        if (x === '..') out.pop(); else out.push(x);
      });
      base = out.join('/');
    } else if (spec.charAt(0) === '/') {
      base = spec.slice(1);
    }
    if (!/\.(js|json)$/.test(base)) base += '.js';
    return base;
  }

  function loadJs(path) {
    if (modCache[path]) return modCache[path].exports;
    var code = SRC[path];
    if (code == null) throw new Error('缺少源文件: ' + path);
    var module = { exports: {} };
    modCache[path] = module;
    var fn = new Function(
      'require', 'module', 'exports', 'wx', 'Page', 'Component', 'App', 'getApp',
      code + '\n//# sourceURL=' + path
    );
    fn(
      function (spec) { return loadJs(resolveReq(path, spec)); },
      module, module.exports, wx,
      function (cfg) { PAGE_CFG[path] = cfg; },
      function (cfg) { COMP_CFG[path] = cfg; },
      function (cfg) { APP_CFG = cfg; },
      function () { return APP_CFG; }
    );
    return module.exports;
  }

  /* ================= wx 模拟 ================= */

  var store = {};
  function sget(k) {
    if (Object.prototype.hasOwnProperty.call(store, k)) return store[k];
    try {
      var v = localStorage.getItem('mppreview_' + k);
      return v == null ? undefined : JSON.parse(v);
    } catch (e) { return undefined; }
  }
  function sset(k, v) {
    store[k] = v;
    try { localStorage.setItem('mppreview_' + k, JSON.stringify(v)); } catch (e) {}
  }

  var DEMO_AVATAR = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2F8F5B"/>' +
    '<circle cx="60" cy="46" r="20" fill="#fff"/>' +
    '<path d="M24 108c0-20 16-33 36-33s36 13 36 33z" fill="#fff"/></svg>'
  );

  function parseUrl(url) {
    var i = url.indexOf('?');
    var path = (i < 0 ? url : url.slice(0, i)).replace(/^\//, '');
    var params = {};
    if (i >= 0) {
      url.slice(i + 1).split('&').forEach(function (kv) {
        var seg = kv.split('=');
        if (seg[0]) params[seg[0]] = decodeURIComponent(seg[1] || '');
      });
    }
    return { path: path, params: params };
  }

  function showToast(opt) {
    var old = document.querySelector('.pv-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'pv-toast';
    el.textContent = opt && opt.title || '';
    document.querySelector('.device').appendChild(el);
    var t = setTimeout(function () { el.remove(); }, (opt && opt.duration) || 1500);
    PV_TIMERS.push(t);
  }

  function closeSheet() {
    var m = document.querySelector('.pv-mask');
    if (m) m.remove();
  }

  function openSheet(items, onPick, onCancel) {
    closeSheet();
    var mask = document.createElement('div');
    mask.className = 'pv-mask';
    var sheet = document.createElement('div');
    sheet.className = 'pv-sheet';
    items.forEach(function (text, i) {
      var it = document.createElement('div');
      it.className = 'pv-sheet-item';
      it.textContent = text;
      it.addEventListener('click', function () {
        closeSheet();
        onPick && onPick(i);
      });
      sheet.appendChild(it);
    });
    var cancel = document.createElement('div');
    cancel.className = 'pv-sheet-cancel';
    cancel.textContent = '取消';
    cancel.addEventListener('click', function () { closeSheet(); onCancel && onCancel(); });
    sheet.appendChild(cancel);
    mask.appendChild(sheet);
    mask.addEventListener('click', function (e) { if (e.target === mask) { closeSheet(); onCancel && onCancel(); } });
    document.querySelector('.device').appendChild(mask);
  }

  function previewImage(opt) {
    var old = document.querySelector('.pv-viewer');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'pv-viewer';
    var img = document.createElement('img');
    img.src = opt.current || (opt.urls && opt.urls[0]) || '';
    box.appendChild(img);
    box.addEventListener('click', function () { box.remove(); });
    document.querySelector('.device').appendChild(box);
  }

  var wx = {
    getStorageSync: sget,
    setStorageSync: sset,
    removeStorageSync: function (k) { delete store[k]; try { localStorage.removeItem('mppreview_' + k); } catch (e) {} },
    setStorage: function (o) { sset(o.key, o.data); },
    request: function (o) {
      o = o || {};
      var method = String(o.method || 'GET').toUpperCase();
      var opt = { method: method, headers: { 'content-type': 'application/json' } };
      if (o.data && method !== 'GET') opt.body = JSON.stringify(o.data);
      try {
        fetch(o.url, opt)
          .catch(function () { return null; })
          .then(function (res) {
            if (!res) { o.fail && o.fail({ errMsg: 'request:fail connect' }); return; }
            var ct = res.headers.get('content-type') || '';
            var parse = ct.indexOf('json') > -1 ? res.json() : res.text();
            parse.catch(function () { return null; }).then(function (body) {
              o.success && o.success({ statusCode: res.status, data: body, header: {}, cookies: [] });
            });
          });
      } catch (e) { o.fail && o.fail({ errMsg: 'request:fail' }); }
    },
    showToast: showToast,
    hideToast: function () { var t = document.querySelector('.pv-toast'); if (t) t.remove(); },
    navigateTo: function (o) { pushPage(o.url); },
    redirectTo: function (o) { replaceTop(o.url); },
    switchTab: function (o) { switchTab(o.url); },
    navigateBack: function () { goBack(); },
    setNavigationBarTitle: function (o) {
      var e = topEntry();
      if (e) { e.title = o.title; updateChrome(); }
    },
    stopPullDownRefresh: function () {},
    makePhoneCall: function (o) { showToast({ title: '模拟拨打 ' + o.phoneNumber }); },
    setClipboardData: function (o) { showToast({ title: '已复制：' + o.data }); o.success && o.success(); },
    previewImage: previewImage,
    showActionSheet: function (o) {
      openSheet(o.itemList || [], function (i) { o.success && o.success({ tapIndex: i }); }, function () { o.fail && o.fail(); });
    },
    /* app.js / 首页 onLoad 会调用；预览环境没有真云开发 */
    cloud: { init: function () {}, callFunction: function () { return Promise.resolve({ result: null }); } },
    showShareMenu: function () {},
    getWindowInfo: function () {
      var device = document.querySelector('.device');
      var tab = document.getElementById('tabbar');
      var status = document.querySelector('.statusbar');
      var w = device && device.clientWidth ? device.clientWidth : 390;
      var screenH = device && device.clientHeight ? device.clientHeight : 780;
      var tabH = 56;
      if (tab) tabH = tab.style.display === 'none' ? 0 : (tab.offsetHeight || 56);
      var statusH = status && status.offsetHeight ? status.offsetHeight : 34;
      return {
        windowWidth: w,
        windowHeight: Math.max(480, screenH - tabH),
        screenWidth: w,
        screenHeight: screenH,
        statusBarHeight: statusH,
        safeArea: { top: statusH, bottom: screenH, left: 0, right: w, width: w, height: Math.max(0, screenH - statusH) }
      };
    },
    getSystemInfoSync: function () { return wx.getWindowInfo(); },
    getMenuButtonBoundingClientRect: function () {
      var info = wx.getWindowInfo();
      var top = info.statusBarHeight + 6;
      var height = 32;
      var width = 87;
      var right = info.windowWidth - 7;
      return { width: width, height: height, top: top, bottom: top + height, left: right - width, right: right };
    },
    setNavigationBarColor: function (o) {
      var sb = document.querySelector('.statusbar');
      if (sb) sb.classList.toggle('is-dark', !!(o && o.frontColor === '#000000'));
      if (o && o.success) o.success();
    }
  };

  /* ================= WXML 解析 ================= */

  function findTagEnd(s, start) {
    var q = null;
    for (var i = start + 1; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '>') return i;
    }
    return -1;
  }

  function parseWxml(src) {
    src = src.replace(/<!--[\s\S]*?-->/g, '');
    var root = { tag: '#root', attrs: {}, children: [] };
    var stack = [root];
    var i = 0;

    function pushText(t) {
      if (t.replace(/\s/g, '') !== '') {
        stack[stack.length - 1].children.push({ tag: '#text', attrs: {}, children: [], text: t });
      }
    }

    while (i < src.length) {
      var lt = src.indexOf('<', i);
      if (lt < 0) { pushText(src.slice(i)); break; }
      if (lt > i) pushText(src.slice(i, lt));
      if (src.charAt(lt + 1) === '/') {
        var gt0 = src.indexOf('>', lt);
        if (stack.length > 1) stack.pop();
        i = gt0 + 1;
        continue;
      }
      var gt = findTagEnd(src, lt);
      if (gt < 0) break;
      var tagSrc = src.slice(lt + 1, gt);
      var selfClose = /\s$/.test(tagSrc) || tagSrc.charAt(tagSrc.length - 1) === '/';
      if (selfClose) tagSrc = tagSrc.replace(/\/$/, '');
      var m = tagSrc.match(/^([^\s]+)/);
      var tag = m[1];
      var attrs = {};
      var rest = tagSrc.slice(m[0].length);
      var attrRe = /([^\s=]+)(?:\s*=\s*"([^"]*)")?/g;
      var am;
      while ((am = attrRe.exec(rest))) {
        attrs[am[1]] = am[2] !== undefined ? am[2] : true;
      }
      var node = { tag: tag, attrs: attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
      i = gt + 1;
    }
    return root;
  }

  function getWxmlRoot(basePath) {
    if (!wxmlCache[basePath]) {
      var src = SRC[basePath + '.wxml'];
      if (src == null) throw new Error('缺少 WXML: ' + basePath + '.wxml');
      wxmlCache[basePath] = parseWxml(src);
    }
    return wxmlCache[basePath];
  }

  /* ================= 表达式 ================= */

  function evalExpr(expr, scope) {
    try {
      return new Function('s', 'with(s){return (' + expr + ')}')(scope);
    } catch (e) {
      console.warn('[preview] 表达式求值失败:', expr, e.message);
      return undefined;
    }
  }

  function interp(val, scope) {
    if (val === true || val == null) return val;
    if (typeof val !== 'string') return val;
    if (val.charAt(0) === '{' && val.charAt(1) === '{' && val.indexOf('}}') === val.length - 2) {
      return evalExpr(val.slice(2, -2), scope);
    }
    if (val.indexOf('{{') < 0) return val;
    return val.replace(/\{\{([\s\S]*?)\}\}/g, function (m, e) {
      var v = evalExpr(e, scope);
      if (v == null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  }

  /* ================= setData / 页面 ================= */

  function applyPatch(data, patch) {
    Object.keys(patch).forEach(function (k) {
      var parts = k.split('.');
      var o = data;
      for (var i = 0; i < parts.length - 1; i++) {
        var p = parts[i];
        if (o[p] == null || typeof o[p] !== 'object') {
          o[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        o = o[p];
      }
      o[parts[parts.length - 1]] = patch[k];
    });
  }

  function deepCopy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  function createEntry(path, params) {
    var json = {};
    try { json = JSON.parse(SRC[path + '.json'] || '{}'); } catch (e) {}
    loadJs(path + '.js');
    var cfg = PAGE_CFG[path + '.js'];
    if (!cfg) throw new Error('页面未调用 Page(): ' + path);
    var inst = {
      path: path,
      config: cfg,
      data: deepCopy(cfg.data) || {},
      setData: function (patch, cb) {
        if (patch && typeof patch === 'object') applyPatch(inst.data, patch);
        render();
        if (cb) cb();
      }
    };
    mergeMethods(inst, cfg);
    return {
      uid: uidSeq++,
      path: path,
      params: params || {},
      cfg: cfg,
      inst: inst,
      json: json,
      title: null
    };
  }

  function callLife(entry, name, arg) {
    var fn = entry.cfg[name];
    if (fn) fn.call(entry.inst, arg);
  }

  function topEntry() { return stack[stack.length - 1]; }

  /* ================= 路由 ================= */

  var TAB_PAGES = (APP_JSON.tabBar && APP_JSON.tabBar.list || []).map(function (t) { return t.pagePath; });

  function openPath(path, params) {
    COMP_INST = {};
    var entry = createEntry(path, params);
    stack.push(entry);
    callLife(entry, 'onLoad', params);
    callLife(entry, 'onShow');
    render();
  }

  function pushPage(url) {
    var r = parseUrl(url);
    if (TAB_PAGES.indexOf(r.path) > -1) { switchTab('/' + r.path); return; }
    openPath(r.path, r.params);
  }

  function replaceTop(url) {
    var r = parseUrl(url);
    stack.pop();
    openPath(r.path, r.params);
  }

  function switchTab(url) {
    var r = parseUrl(url);
    COMP_INST = {};
    stack = [];
    var entry = createEntry(r.path, r.params);
    stack.push(entry);
    callLife(entry, 'onLoad', r.params);
    callLife(entry, 'onShow');
    render();
  }

  function goBack() {
    if (stack.length <= 1) return;
    COMP_INST = {};
    stack.pop();
    var e = topEntry();
    callLife(e, 'onShow');
    render();
  }

  /* ================= 事件 ================= */

  function datasetOf(el) {
    var o = {};
    for (var k in el.dataset) o[k] = el.dataset[k];
    return o;
  }

  function mkEvent(el, type, detail, native, touches) {
    var t = touches || (native && (native.touches || native.changedTouches)) || [];
    return {
      type: type,
      detail: detail || {},
      touches: t,
      changedTouches: t,
      currentTarget: { dataset: datasetOf(el), _el: el },
      target: { dataset: datasetOf(el), _el: el },
      stopPropagation: function () { if (native && native.stopPropagation) native.stopPropagation(); }
    };
  }

  function mergeMethods(inst, cfg) {
    function add(src) {
      Object.keys(src || {}).forEach(function (k) {
        if (typeof src[k] === 'function' && inst[k] === undefined) inst[k] = src[k];
      });
    }
    add(cfg);
    add(cfg && cfg.methods);
  }

  function dispatch(ctx, handler, evt) {
    if (!handler || !ctx) return;
    var fn = ctx.inst ? ctx.inst[handler] : undefined;
    if (typeof fn !== 'function') fn = ctx.cfg[handler] || (ctx.cfg.methods && ctx.cfg.methods[handler]);
    if (typeof fn !== 'function') { console.warn('[preview] 事件处理函数未定义:', handler); return; }
    fn.call(ctx.inst, evt);
  }

  /* ================= 弹层辅助 ================= */

  function deviceEl() { return document.querySelector('.device'); }

  function openPickerSheet(el, range, onPick) {
    openSheet(range.map(function (x) { return String(x); }), onPick);
  }

  /* ================= 元素渲染 ================= */

  var TAG_MAP = {
    view: 'div', text: 'span', image: 'img',
    swiper: 'swiper', 'swiper-item': 'swiper-item', 'scroll-view': 'scroll-view',
    picker: 'picker', input: 'input', textarea: 'textarea', button: 'button'
  };

  function setClass(el, node, env, extra) {
    var c = interp(node.attrs['class'], env.scope);
    el.className = [typeof c === 'string' ? c : '', extra || ''].join(' ').trim();
  }

  function applyInlineStyle(el, node, env) {
    var raw = node.attrs && node.attrs.style;
    if (raw === undefined) return;
    var s = interp(raw, env.scope);
    if (!s) return;
    el.style.cssText = (el.style.cssText ? el.style.cssText.replace(/;?\s*$/, '') + ';' : '') + s;
  }

  function bindCommon(el, node, env) {
    var attrs = node.attrs;
    // data-*
    Object.keys(attrs).forEach(function (k) {
      if (k.indexOf('data-') === 0) {
        el.setAttribute(k, String(interp(attrs[k], env.scope)));
      }
    });
    // 简单属性
    ['placeholder', 'maxlength', 'type', 'aria-label', 'placeholder-class'].forEach(function (k) {
      if (attrs[k] !== undefined) el.setAttribute(k, String(interp(attrs[k], env.scope)));
    });
    // 事件
    if (attrs.bindtap || attrs.catchtap) {
      var hTap = attrs.bindtap || attrs.catchtap;
      var stop = !!attrs.catchtap;
      el.addEventListener('click', function (ev) {
        if (stop) ev.stopPropagation();
        dispatch(env.ctx, hTap, mkEvent(el, 'tap', {}, ev));
      });
    }
    if (attrs.bindinput) {
      var hIn = attrs.bindinput;
      el.addEventListener('input', function (ev) {
        dispatch(env.ctx, hIn, mkEvent(el, 'input', { value: ev.target.value }, ev));
      });
    }
    if (attrs.bindconfirm) {
      var hCf = attrs.bindconfirm;
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') dispatch(env.ctx, hCf, mkEvent(el, 'confirm', { value: ev.target.value }, ev));
      });
    }
    if (attrs.bindchooseavatar) {
      var hAv = attrs.bindchooseavatar;
      el.addEventListener('click', function (ev) {
        dispatch(env.ctx, hAv, mkEvent(el, 'chooseavatar', { avatarURL: DEMO_AVATAR }, ev));
      });
    }
    // touch 事件（移动端原生 / 桌面鼠标模拟）
    var tStart = attrs.bindtouchstart, tMove = attrs.bindtouchmove,
        tEnd = attrs.bindtouchend, tCancel = attrs.bindtouchcancel;
    if (tStart || tMove || tEnd) {
      var TOUCH_ONLY = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0;
      if (tStart) {
        el.addEventListener('touchstart', function (ev) {
          if (ev.target !== el) return;
          if (ev.cancelable) ev.preventDefault();
          dispatch(env.ctx, tStart, mkEvent(el, 'touchstart', {}, ev));
        }, { passive: false });
      }
      if (tMove) {
        el.addEventListener('touchmove', function (ev) {
          if (ev.cancelable) ev.preventDefault();
          dispatch(env.ctx, tMove, mkEvent(el, 'touchmove', {}, ev));
        }, { passive: false });
      }
      if (tEnd) {
        el.addEventListener('touchend', function (ev) {
          dispatch(env.ctx, tEnd, mkEvent(el, 'touchend', {}, ev));
        });
      }
      if (tCancel) {
        el.addEventListener('touchcancel', function (ev) {
          dispatch(env.ctx, tCancel, mkEvent(el, 'touchcancel', {}, ev));
        });
      }
      // 桌面鼠标模拟：每次 mousedown 重装本次元素的 move/up 监听，
      // 避免首个绑定元素独占后续页面的滑动事件
      if (!TOUCH_ONLY && tStart) {
        el.addEventListener('mousedown', function (ev) {
          if (ev.target !== el) return;
          ev.preventDefault();
          if (document.__pvMouseMoveFn) {
            document.removeEventListener('mousemove', document.__pvMouseMoveFn);
            document.__pvMouseMoveFn = null;
          }
          if (document.__pvMouseUpFn) {
            document.removeEventListener('mouseup', document.__pvMouseUpFn);
            document.__pvMouseUpFn = null;
          }
          MOUSE_DRAG = { env: env, end: tEnd, el: el };
          if (tMove) {
            document.__pvMouseMoveFn = function (mv) {
              if (!MOUSE_DRAG || !tMove) return;
              var d = MOUSE_DRAG;
              dispatch(d.env.ctx, tMove, mkEvent(d.el, 'touchmove', {}, null,
                [{ clientX: mv.clientX, clientY: mv.clientY }]));
            };
            document.addEventListener('mousemove', document.__pvMouseMoveFn);
          }
          if (tEnd) {
            document.__pvMouseUpFn = function (mu) {
              if (!MOUSE_DRAG || !tEnd) return;
              var d = MOUSE_DRAG;
              MOUSE_DRAG = null;
              dispatch(d.env.ctx, tEnd, mkEvent(d.el, 'touchend', {}, null,
                [{ clientX: mu.clientX, clientY: mu.clientY }]));
            };
            document.addEventListener('mouseup', document.__pvMouseUpFn);
          }
        dispatch(env.ctx, tStart, mkEvent(el, 'touchstart', {}, null,
          [{ clientX: ev.clientX, clientY: ev.clientY }]));
        });
      }
    }
    applyInlineStyle(el, node, env);
  }

  function bindPicker(el, node, env) {
    var attrs = node.attrs;
    var mode = attrs.mode || 'selector';
    if (mode === 'date') {
      el.style.position = 'relative';
      var di = document.createElement('input');
      di.type = 'date';
      di.className = 'pv-date-input';
      var v = interp(attrs.value, env.scope);
      if (v) di.value = String(v);
      el.appendChild(di);
      di.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (di.showPicker) { try { di.showPicker(); } catch (e) {} }
      });
      di.addEventListener('change', function () {
        dispatch(env.ctx, attrs.bindchange, mkEvent(el, 'change', { value: di.value }, null));
      });
    } else {
      el.style.position = 'relative';
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var range = interp(attrs.range, env.scope) || [];
        openPickerSheet(el, range, function (i) {
          dispatch(env.ctx, attrs.bindchange, mkEvent(el, 'change', { value: i }, null));
        });
      });
    }
  }

  function bindSwiper(wrap, scroller, node, env) {
    var attrs = node.attrs;
    var dotsBox = null;
    var slides = scroller.children;
    function makeDots() {
      if (String(interp(attrs['indicator-dots'], env.scope)) !== 'true') return;
      dotsBox = document.createElement('div');
      dotsBox.className = 'pv-dots';
      var activeColor = String(interp(attrs['indicator-active-color'], env.scope) || '#2F8F5B');
      var idleColor = String(interp(attrs['indicator-color'], env.scope) || 'rgba(255,255,255,.5)');
      for (var i = 0; i < slides.length; i++) {
        var d = document.createElement('i');
        d.style.background = i === 0 ? activeColor : idleColor;
        d.className = i === 0 ? 'on' : '';
        dotsBox.appendChild(d);
      }
      wrap.appendChild(dotsBox);
    }
    function activeIndex() {
      var w = scroller.clientWidth || 1;
      return Math.round(scroller.scrollLeft / w);
    }
    function syncDots() {
      if (!dotsBox) return;
      var active = String(interp(attrs['indicator-active-color'], env.scope) || '#8A7152');
      var idle = String(interp(attrs['indicator-color'], env.scope) || 'rgba(255,255,255,.5)');
      var idx = activeIndex();
      Array.prototype.forEach.call(dotsBox.children, function (d, i) {
        d.style.background = i === idx ? active : idle;
        d.className = i === idx ? 'on' : '';
      });
    }
    var lastTouch = 0;
    scroller.addEventListener('scroll', function () { lastTouch = Date.now(); syncDots(); });
    makeDots();
    // 自动轮播
    var autoplay = String(interp(attrs.autoplay, env.scope)) === 'true';
    if (autoplay && slides.length > 1) {
      var interval = Number(interp(attrs.interval, env.scope)) || 4000;
      var timer = setInterval(function () {
        if (Date.now() - lastTouch < interval) return;
        var w = scroller.clientWidth;
        var next = (activeIndex() + 1) % slides.length;
        try { scroller.scrollTo({ left: next * w, behavior: 'smooth' }); } catch (e) { scroller.scrollLeft = next * w; }
      }, interval);
      PV_TIMERS.push(timer);
    }
  }

  function renderOne(node, env, host) {
    var tag = node.tag;
    var attrs = node.attrs || {};

    if (tag === '#text') {
      var t = interp(node.text, env.scope);
      if (t !== '' && t != null) host.appendChild(document.createTextNode(String(t)));
      return;
    }
    if (tag === '#root') { renderChildren(node.children, env, host); return; }
    if (tag === 'block') { renderChildren(node.children, env, host); return; }

    // 组件
    if (COMP_TAGS[tag]) { renderComponent(tag, node, env, host); return; }

    var mapped = TAG_MAP[tag] || (tag.indexOf('-') > 0 ? 'div' : tag);
    var el;
    var childHost;

    if (tag === 'swiper') {
      var wrap = document.createElement('div');
      setClass(wrap, node, env, 'pv-swiper-wrap');
      applyInlineStyle(wrap, node, env);
      var sc = document.createElement('div');
      sc.className = 'pv-swiper';
      wrap.appendChild(sc);
      host.appendChild(wrap);
      childHost = sc;
      renderChildren(node.children, env, sc);
      bindSwiper(wrap, sc, node, env);
      return;
    }

    el = document.createElement(mapped);
    try { el.dataset.kp = env.kp || ''; } catch (e) {}

    if (tag === 'image') {
      setClass(el, node, env, '');
      var src = interp(attrs.src, env.scope);
      el.src = src == null ? '' : String(src);
      var mode = attrs.mode || '';
      if (mode === 'aspectFit') el.style.objectFit = 'contain';
      else if (mode === 'widthFix') { el.style.width = '100%'; el.style.height = 'auto'; }
      else if (mode) el.style.objectFit = 'cover';
      if (attrs['lazy-load'] !== undefined) el.loading = 'lazy';
      bindCommon(el, node, env);
      host.appendChild(el);
      return;
    }

    setClass(el, node, env, tag === 'swiper-item' ? 'pv-slide' : '');
    if (tag === 'scroll-view') {
      el.style.display = 'block';
      if (attrs['scroll-x'] !== undefined) el.style.overflowX = 'auto';
      if (attrs['scroll-y'] !== undefined) el.style.overflowY = 'auto';
    }
    if (tag === 'input' || tag === 'textarea') {
      if (attrs.value !== undefined) {
        var v = interp(attrs.value, env.scope);
        el.value = v == null ? '' : String(v);
      }
    }
    bindCommon(el, node, env);
    if (tag === 'picker') bindPicker(el, node, env);
    host.appendChild(el);
    childHost = el;

    renderChildren(node.children, env, childHost);
  }

  function renderChildren(children, env, host) {
    var lastIf = false;
    var tagCount = {};
    children.forEach(function (ch) {
      var a = ch.attrs || {};
      if (a['wx:if'] !== undefined) {
        lastIf = !!interp(a['wx:if'], env.scope);
        if (!lastIf) return;
      } else if (a['wx:elif'] !== undefined) {
        if (lastIf) return;
        lastIf = !!interp(a['wx:elif'], env.scope);
        if (!lastIf) return;
      } else if (a['wx:else'] !== undefined) {
        if (lastIf) return;
        lastIf = false;
      }

      if (a['wx:for'] !== undefined) {
        var list = interp(a['wx:for'], env.scope) || [];
        var itemName = a['wx:for-item'] || 'item';
        var idxName = a['wx:for-index'] || 'index';
        Array.prototype.forEach.call(list, function (it, idx) {
          var scope = Object.create(env.scope);
          scope[itemName] = it;
          scope[idxName] = idx;
          var sub = { ctx: env.ctx, scope: scope, kp: env.kp + '/' + ch.tag + ':for' + idx };
          renderOne(ch, sub, host);
        });
        return;
      }

      tagCount[ch.tag] = (tagCount[ch.tag] || 0) + 1;
      var kp = env.kp + '/' + ch.tag + ':' + tagCount[ch.tag];
      renderOne(ch, { ctx: env.ctx, scope: env.scope, kp: kp }, host);
    });
  }

  /* ================= 组件 ================= */

  function renderComponent(tag, node, env, host) {
    var path = COMP_TAGS[tag];
    loadJs(path + '.js');
    var cfg = COMP_CFG[path + '.js'];
    if (!cfg) throw new Error('组件未调用 Component(): ' + path);

    // kebab-case 属性名映射回 camelCase 后再取属性值
    var propAttr = function (k) {
      var alt = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return node.attrs[k] !== undefined ? node.attrs[k] : node.attrs[alt];
    };

    var kp = env.kp + '#' + tag;
    var inst = COMP_INST[kp];
    if (!inst) {
      inst = {
        config: cfg,
        data: deepCopy(cfg.data) || {},
        props: {},
        attrs: {},
        ctx: null,
        parentCtx: env.ctx,
        setData: function (patch, cb) {
          if (patch && typeof patch === 'object') applyPatch(inst.data, patch);
          render();
          if (cb) cb();
        },
        triggerEvent: function (name, detail) {
          var h = inst.attrs['bind:' + name];
          if (h && inst.parentCtx) {
            dispatch(inst.parentCtx, h, {
              type: name, detail: detail || {},
              currentTarget: { dataset: {} }, target: { dataset: {} }
            });
          }
        },
        properties: {}
      };
      inst.ctx = { cfg: cfg, inst: inst };
      COMP_INST[kp] = inst;
      mergeMethods(inst, cfg);
      // 属性先同步，再触发 attached
      Object.keys(cfg.properties || {}).forEach(function (k) {
        var raw = propAttr(k);
        var val = raw === undefined ? cfg.properties[k].value : interp(raw, env.scope);
        inst.props[k] = val;
        inst.data[k] = val;
      });
      if (cfg.lifetimes && cfg.lifetimes.attached) cfg.lifetimes.attached.call(inst);
    } else {
      Object.keys(cfg.properties || {}).forEach(function (k) {
        var raw = propAttr(k);
        var val = raw === undefined ? cfg.properties[k].value : interp(raw, env.scope);
        inst.props[k] = val;
        inst.data[k] = val;
      });
    }
    // 记录事件绑定
    inst.attrs = {};
    Object.keys(node.attrs).forEach(function (k) {
      if (k.indexOf('bind:') === 0) inst.attrs[k] = node.attrs[k];
    });
    inst.parentCtx = env.ctx;

    var wrap = document.createElement('div');
    wrap.className = 'pv-comp';
    host.appendChild(wrap);
    var scope = Object.create(inst.data);
    renderOne(getWxmlRoot(path), { ctx: inst.ctx, scope: scope, kp: kp }, wrap);
  }

  /* ================= 渲染页面 ================= */

  function render() {
    if (!screenEl || !stack.length) return;
    PV_TIMERS.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    PV_TIMERS = [];

    var entry = topEntry();
    var keepScroll = screenEl.scrollTop;
    var active = document.activeElement;
    var focusInfo = null;
    if (active && screenEl.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.dataset && active.dataset.kp) {
      focusInfo = { kp: active.dataset.kp, start: active.selectionStart, end: active.selectionEnd };
    }

    screenEl.innerHTML = '';
    var root = getWxmlRoot(entry.path);
    var scope = Object.create(entry.inst.data);
    renderChildren(root.children, { ctx: { cfg: entry.cfg, inst: entry.inst }, scope: scope, kp: 'p' + entry.uid }, screenEl);

    screenEl.scrollTop = keepScroll;

    if (focusInfo) {
      var sel = '[data-kp="' + focusInfo.kp.replace(/"/g, '\\"') + '"]';
      var el = screenEl.querySelector(sel);
      if (el) {
        el.focus();
        try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) {}
      }
    }
    updateChrome();
  }

  /* ================= 外壳（导航/Tab/工具栏） ================= */

  function updateChrome() {
    if (!stack.length) return;
    var entry = topEntry();
    titleEl.textContent = entry.title != null ? entry.title : (entry.json.navigationBarTitleText || '');

    var device = document.querySelector('.device');
    var navbar = document.querySelector('.navbar');
    var customNav = !!(entry.json && entry.json.navigationStyle === 'custom');
    if (device) device.classList.toggle('nav-custom', customNav);
    if (navbar) navbar.style.display = customNav ? 'none' : '';

    var isTab = TAB_PAGES.indexOf(entry.path) > -1;
    backEl.style.visibility = stack.length > 1 ? 'visible' : 'hidden';
    tabbarEl.style.display = isTab ? 'flex' : 'none';

    var hasMask = !!screenEl.querySelector('.mask, .pv-mask');
    tabbarEl.style.visibility = hasMask ? 'hidden' : 'visible';

    var items = tabbarEl.querySelectorAll('.pv-tab');
    items.forEach(function (it) {
      var on = it.dataset.page === entry.path;
      it.classList.toggle('on', on);
      var img = it.querySelector('img');
      if (img) img.src = 'images/tab/' + it.dataset.icon + '-' + (on ? 'green' : 'gray') + '.png';
    });
  }

  function buildTabbar() {
    var list = (APP_JSON.tabBar && APP_JSON.tabBar.list) || [];
    var ICON_NAME = { 'pages/index/index': 'home', 'pages/routes/routes': 'route', 'pages/strategy/strategy': 'guide', 'pages/mine/mine': 'mine' };
    tabbarEl.innerHTML = '';
    list.forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'pv-tab';
      item.dataset.page = t.pagePath;
      item.dataset.icon = ICON_NAME[t.pagePath] || 'home';
      var img = document.createElement('img');
      img.src = 'images/tab/' + item.dataset.icon + '-gray.png';
      var span = document.createElement('span');
      span.textContent = t.text;
      item.appendChild(img);
      item.appendChild(span);
      item.addEventListener('click', function () {
        if (topEntry().path === t.pagePath && stack.length === 1) return;
        switchTab('/' + t.pagePath);
      });
      tabbarEl.appendChild(item);
    });
    tabbarEl.style.color = APP_JSON.tabBar.color;
  }

  /* ================= 启动 ================= */

  function boot() {
    screenEl = document.getElementById('screen');
    tabbarEl = document.getElementById('tabbar');
    titleEl = document.getElementById('nav-title');
    backEl = document.getElementById('nav-back');

    injectCss();
    buildTabbar();

    backEl.addEventListener('click', goBack);

    document.getElementById('btn-refresh').addEventListener('click', function () {
      location.reload();
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('mppreview_') === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
      location.reload();
    });

    var rbLock = false;
    screenEl.addEventListener('scroll', function () {
      var top = topEntry();
      if (top && top.cfg.onPageScroll) {
        try { top.cfg.onPageScroll.call(top.inst, { scrollTop: screenEl.scrollTop }); } catch (err) { console.warn(err); }
      }
      if (rbLock) return;
      if (screenEl.scrollTop + screenEl.clientHeight >= screenEl.scrollHeight - 30) {
        var e = topEntry();
        if (e && e.cfg.onReachBottom) {
          rbLock = true;
          try { e.cfg.onReachBottom.call(e.inst); } catch (err) { console.warn(err); }
          setTimeout(function () { rbLock = false; }, 700);
        }
      }
    });

    loadJs('app.js');
    if (APP_CFG && APP_CFG.onLaunch) APP_CFG.onLaunch();

    var firstTab = TAB_PAGES[0] || APP_JSON.pages[0];
    switchTab('/' + firstTab);

    window.__preview = {
      wx: wx,
      getStack: function () { return stack; },
      render: render,
      switchTab: switchTab,
      pushPage: pushPage,
      goBack: goBack
    };

    // 支持深度链接: preview.html?p=/pages/route-detail/route-detail&id=r001
    var qs = new URLSearchParams(location.search);
    var deep = qs.get('p');
    if (deep) {
      qs.delete('p');
      var extra = qs.toString();
      pushPage(deep + (extra ? (deep.indexOf('?') >= 0 ? '&' : '?') + extra : ''));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
