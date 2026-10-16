/**
 * 数据通道
 * 1) 微信云开发 wx.cloud.callFunction——生产/真机优先
 * 2) 本地数据桥（utils/config.js: apiBase）——云不可用时回退，供开发预览读取 CMS 后台数据
 * 任一数据源不可用时返回 {code:500}，调用方回退本地静态数据（utils/data.js），保证 UI 不空白
 */
const config = require('./config');

function request(options) {
  return new Promise(resolve => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: { 'content-type': 'application/json' },
      success: res => resolve(res.data),
      fail: () => resolve(null)
    });
  });
}

async function bridgeCallFunction(name, data) {
  if (!config.useBridge || !config.apiBase) return null;
  if (typeof wx === 'undefined' || !wx.request) return null;
  return request({
    url: config.apiBase + '/api/call',
    method: 'POST',
    data: { name, data: data || {} }
  });
}

async function cloudCallFunction(name, data) {
  if (typeof wx === 'undefined' || !wx.cloud) return null;
  try {
    const res = await wx.cloud.callFunction({ name, data: data || {} });
    const r = res && res.result ? res.result : res;
    return (r && r.code) ? r : null;
  } catch (e) {
    return null;
  }
}

const cloud = {
  async callFunction(name, data = {}) {
    // 优先微信云开发
    const cres = await cloudCallFunction(name, data);
    if (cres) return cres;

    // 回退本地数据桥
    try {
      const bres = await bridgeCallFunction(name, data);
      if (bres && bres.code) return bres;
    } catch (e) { /* ignore */ }

    return { code: 500, msg: '数据源不可用' };
  }
};

module.exports = cloud;
