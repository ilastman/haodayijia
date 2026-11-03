/**
 * 云函数公共模块：auth.js
 * 功能：管理员密码加密 + 登录token校验 + 员工身份解析（各云函数内部各放一份）
 * 运行环境：nodejs16（仅用Node内置crypto，无需额外依赖）
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');

const PWD_SALT = 'songtsam-cms-2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(PWD_SALT + ':' + String(password)).digest('hex');
}

function generateToken(username) {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(12).toString('hex');
  return Buffer.from(`${username}|${ts}|${rand}`).toString('base64');
}

async function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const db = cloud.database();
    const res = await db.collection('adminUser').where({ 'extend.token': token }).limit(1).get();
    if (!res.data || res.data.length === 0) return null;
    const admin = res.data[0];
    const expire = admin.extend && admin.extend.tokenExpire;
    if (expire && Date.now() > expire) return null;
    return admin;
  } catch (e) {
    return null;
  }
}

async function resolveStaff(openid) {
  if (!openid) return null;
  try {
    const db = cloud.database();
    const res = await db.collection('staff').where({ openid }).limit(1).get();
    if (!res.data || res.data.length === 0) return null;
    const staff = res.data[0];
    if (staff.status && staff.status !== 'enabled') return null;
    return staff;
  } catch (e) {
    return null;
  }
}

module.exports = { hashPassword, generateToken, verifyAdminToken, resolveStaff, PWD_SALT };
