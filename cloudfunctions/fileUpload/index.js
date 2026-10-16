const cloud = require('wx-server-sdk');

/**
 * 云函数：fileUpload
 * 功能：图片上传至云存储 / fileID 批量解析为临时链接（供浏览器后台预览）
 * 运行环境：nodejs16
 * 权限：需管理员 token 校验
 * 入参：
 *   - action='upload'（默认）: { token, fileBase64 | filePath, ext, cloudPath }
 *   - action='getURL':        { token, fileIDs: [] }
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const { verifyAdminToken } = require('./auth');

exports.main = async (event, context) => {
  const { action, token, filePath, fileBase64, ext = 'png', cloudPath, fileIDs } = event || {};

  const admin = await verifyAdminToken(token);
  if (!admin) return { code: 403, msg: '无权限：需管理员登录token' };

  try {
    /* ---------- fileID 批量解析为临时链接 ---------- */
    if (action === 'getURL') {
      const list = (Array.isArray(fileIDs) ? fileIDs : []).filter(f => typeof f === 'string' && f.indexOf('cloud://') === 0);
      if (!list.length) return { code: 200, data: {} };
      const res = await cloud.getTempFileURL({ fileList: list });
      const map = {};
      (res.fileList || []).forEach(f => { if (f.fileID) map[f.fileID] = f.tempFileURL || ''; });
      return { code: 200, data: map };
    }

    /* ---------- 上传 ---------- */
    if (!filePath && !fileBase64) {
      return { code: 400, msg: '参数缺失：filePath 或 fileBase64 至少提供一个' };
    }
    const targetPath = cloudPath || `cms/images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    let uploadResult;
    if (fileBase64) {
      const base64Data = String(fileBase64).replace(/^data:image\/\w+;base64,/, '');
      uploadResult = await cloud.uploadFile({
        cloudPath: targetPath,
        fileContent: Buffer.from(base64Data, 'base64')
      });
    } else {
      uploadResult = await cloud.uploadFile({ cloudPath: targetPath, filePath });
    }

    const fileID = uploadResult.fileID;
    const getRes = await cloud.getTempFileURL({ fileList: [fileID] });
    const url = getRes.fileList && getRes.fileList[0] && getRes.fileList[0].tempFileURL;

    return { code: 200, msg: '上传成功', data: { fileID, url: url || '' } };
  } catch (err) {
    return { code: 500, msg: '操作失败', error: err };
  }
};
