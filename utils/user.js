/**
 * 用户资料（游客头像/昵称）
 * - 本地：wx storage 'userInfo' 为优先数据源，保证离线可用
 * - 云端：userCRUD.me / saveProfile 尽力同步（失败静默，不影响本地）
 * 头像：
 *   - 默认头像为包内内置元素图 /images/avatars/aN.png（按种子稳定分配）
 *   - 自定义头像经相册选择 -> 裁剪页 -> 上传云存储，保存 cloud:// fileID
 */
const api = require('./api');

const DEFAULT_AVATARS = [];
for (let i = 1; i <= 8; i++) DEFAULT_AVATARS.push('/images/avatars/a' + i + '.png');

function hash(seed) {
  const s = String(seed || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function defaultAvatar(seed) {
  return DEFAULT_AVATARS[hash(seed) % DEFAULT_AVATARS.length];
}

function local() {
  try { return wx.getStorageSync('userInfo') || null; } catch (e) { return null; }
}

function saveLocal(info) {
  try { wx.setStorageSync('userInfo', info); } catch (e) { /* ignore */ }
}

/* 云端资料同步：本地缺失时补齐（不覆盖用户已保存的昵称/头像） */
async function syncFromCloud() {
  let me = null;
  try { me = await api.userMe(); } catch (e) { me = null; }
  const cur = local();
  const merged = {
    nickname: (cur && cur.nickname) || (me && me.nickname) || '',
    avatar: (cur && cur.avatar) || (me && me.avatarUrl) || '',
    openid: (me && me.openid) || (cur && cur.openid) || '',
    avatarType: (cur && cur.avatarType) || (me && me.avatarType) || 'default'
  };
  if (!merged.avatar) merged.avatar = defaultAvatar(merged.openid || merged.nickname || 'guest');
  saveLocal(merged);
  return merged;
}

/* 保存资料：先写本地，尽力同步云端 */
async function saveProfile(patch) {
  const cur = local() || {};
  const info = Object.assign({}, cur, patch);
  saveLocal(info);
  try {
    await api.saveProfile({ nickname: info.nickname, avatarUrl: info.avatar });
  } catch (e) { /* 静默 */ }
  return info;
}

module.exports = { DEFAULT_AVATARS, defaultAvatar, local, saveLocal, syncFromCloud, saveProfile };
