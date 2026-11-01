const cloud = require('wx-server-sdk');

/**
 * 云函数：httpGateway（HTTP 访问网关）
 * 功能：为 PC 浏览器 CMS 提供统一的 HTTP -> 云函数转发通道。
 * 运行环境：nodejs16
 * 部署：
 *   - 在云开发控制台为【本函数】开启「HTTP 访问服务」，得到公网 URL；
 *   - 将 URL 填入 admin/js/config.js 的 gateway 并置 mode='cloud'。
 * 请求体 JSON：{ "name": "云函数名", "data": {...} }
 * 通过 cloud.callFunction 转发，保留原鉴权字段（token 等）。
 * 响应带 CORS 头，支持浏览器跨域直连。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED = [
  'login',
  'adminInit',
  'fileUpload',
  'homeModuleCRUD',
  'bannerCRUD',
  'scenicCRUD',
  'hotelCRUD',
  'privateGroupCRUD',
  'userTripCRUD',
  'inspirationPostCRUD',
  'homeConfigCRUD',
  'assetCRUD',
  'dataSeed',
  'dataExport',
  'staffCRUD',
  'orderCRUD',
  'opLogCRUD',
  'workOrderPdf',
  'workbenchInit',
  'userCRUD',
  'categoryCRUD',
  'adminUserCRUD',
  'galleryCRUD',
  'clauseCRUD'
];

const CORS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS'
};

function reply(result, statusCode) {
  return { statusCode: statusCode || 200, headers: CORS, body: JSON.stringify({ result }) };
}

exports.main = async (event, context) => {
  // CORS 预检
  const method = event && (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method));
  if (method && String(method).toUpperCase() === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  let payload = event && event.body !== undefined ? event.body : event;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (err) {
      return reply({ code: 400, msg: '请求体不是合法 JSON' });
    }
  }
  const name = payload && payload.name;
  const data = (payload && payload.data) || {};
  if (!name) return reply({ code: 400, msg: '缺少云函数名 name' });
  if (ALLOWED.indexOf(name) === -1) return reply({ code: 400, msg: '不支持的云函数' });
  try {
    const res = await cloud.callFunction({ name, data });
    return reply(res.result);
  } catch (err) {
    return reply({ code: 500, msg: '转发失败', error: err });
  }
};
