const cloud = require('wx-server-sdk');

/**
 * 云函数：scenicCRUD
 * 功能：景区增删改查（字段与本地 admin SEED 完全对齐）
 * 字段：{ id, name, cover, album, intro, detailHtml, tags, dest, duration, bestSeason, lon, lat, weight, online }
 * 权限：查询公开；增删改需管理员 token
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken, verifySuperAdmin } = require('./auth');
const COLL = 'scenic';

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
async function findBiz(id) { if (!id) return null; const r = await db.collection(COLL).where({ id }).limit(1).get(); return (r.data && r.data[0]) || null; }
async function listAll(coll, where) {
  const out = [];
  let skip = 0;
  for (;;) {
    let q = db.collection(coll);
    if (where) q = q.where(where);
    let r;
    try { r = await q.skip(skip).limit(100).get(); }
    catch (e) { return out; }
    const rows = (r && r.data) || [];
    out.push.apply(out, rows);
    if (rows.length < 100) break;
    skip += rows.length;
    if (skip > 10000) break;
  }
  return out;
}
function clean(data) { const d = Object.assign({}, data || {}); delete d._id; delete d._openid; return d; }
function genId() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/* 多值文本 -> 数组（支持 / 、 , ， ; ； 换行 分隔） */
function toArray(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v == null ? '' : v).split(/[\/、,，;；\n]+/).map(s => s.trim()).filter(Boolean);
}
/* 经纬度文本 "经度,纬度" -> { lon, lat } | null */
function parseLatLng(s) {
  const m = String(s == null ? '' : s).split(/[,，\s]+/).filter(Boolean);
  if (m.length >= 2) { const lon = Number(m[0]), lat = Number(m[1]); if (!isNaN(lon) && !isNaN(lat)) return { lon, lat }; }
  return null;
}
/* 一级大区与二级区域映射（与小程序 data.js 保持一致） */
const REGIONS = ['呼伦贝尔', '雪乡', '哈尔滨', '新疆'];
const REGION_BY_DEST = {
  海拉尔: '呼伦贝尔', 额尔古纳: '呼伦贝尔', 满洲里: '呼伦贝尔', 黑山头: '呼伦贝尔',
  室韦: '呼伦贝尔', 阿尔山: '呼伦贝尔', 恩和: '呼伦贝尔', 根河: '呼伦贝尔', 莫尔道嘎: '呼伦贝尔'
};
function deriveRegion(area, regionText) {
  const rt = String(regionText == null ? '' : regionText).trim();
  if (rt) return rt;
  const a = String(area == null ? '' : area).trim();
  for (let i = 0; i < REGIONS.length; i++) { if (a.indexOf(REGIONS[i]) >= 0) return REGIONS[i]; }
  return REGION_BY_DEST[a] || '呼伦贝尔';
}
/* 任意分类文字 -> scenic / entertainment（宽松识别，不拦截） */
async function loadCategoryList() {
  try {
    const r = await cloud.callFunction({ name: 'categoryCRUD', data: { action: 'list' } });
    const res = r && r.result;
    return (res && res.code === 200 && Array.isArray(res.data)) ? res.data : [];
  } catch (e) { return []; }
}
function matchScenicCategory(regionName, typeName, placeName, cats) {
  const list = (cats || []).filter(c => c.tree === 'scenic');
  const warns = [];
  const empty = { regionCatId: '', typeCatId: '', placeCatId: '', regionName: regionName || '', typeName: typeName || '', warns };
  if (!list.length) return empty;
  let region = regionName ? (list.filter(c => c.level === 1 && c.name === regionName)[0] || null) : null;
  if (regionName && !region) warns.push('一级大区「' + regionName + '」不在景区分类库中，已按原文保存');
  let type = null;
  if (typeName) {
    const pool = region ? list.filter(c => c.level === 2 && c.parentId === region.id && c.name === typeName)
      : list.filter(c => c.level === 2 && c.name === typeName);
    if (pool.length === 1) {
      type = pool[0];
      if (!region) region = list.filter(c => c.id === type.parentId)[0] || null;
    } else if (!pool.length) {
      warns.push('类型「' + typeName + '」不在' + (region ? '「' + region.name + '」下级' : '景区分类库') + '中，已按原文保存');
    } else {
      warns.push('类型「' + typeName + '」对应多个大区，请填写一级大区后再匹配');
    }
  }
  let place = null;
  if (placeName) {
    const pool = type ? list.filter(c => c.level === 3 && c.parentId === type.id && c.name === placeName)
      : list.filter(c => c.level === 3 && c.name === placeName);
    if (pool.length === 1) {
      place = pool[0];
      if (!type) type = list.filter(c => c.id === place.parentId)[0] || null;
      if (type && !region) region = list.filter(c => c.id === type.parentId)[0] || null;
    } else if (type && !pool.length) {
      warns.push('地点「' + placeName + '」不在「' + type.name + '」下级，已按原文保存');
    } else if (!type && pool.length > 1) {
      warns.push('地点「' + placeName + '」对应多个分类，请填写大区和类型后再匹配');
    } else if (!type && !pool.length) {
      warns.push('地点「' + placeName + '」不在景区分类库中，已按原文保存');
    }
  }
  return {
    regionCatId: region ? region.id : '',
    typeCatId: type ? type.id : '',
    placeCatId: place ? place.id : '',
    regionName: region ? region.name : (regionName || ''),
    typeName: type ? type.name : (typeName || ''),
    warns
  };
}
function mapSubType(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return 'scenic';
  if (s.indexOf('娱乐') >= 0 || s.indexOf('体验') >= 0) return 'entertainment';
  return 'scenic';
}

exports.main = async (event) => {
  const { action, token, data, id, ids, orderedIds, field } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      return { code: 200, data: (await listAll(COLL)).map(strip) };
    }
    if (action === 'get') {
      const f = await findBiz(id);
      return f ? { code: 200, data: strip(f) } : { code: 404, msg: '记录不存在' };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'importBatch') {
      const rows = (data && Array.isArray(data.rows)) ? data.rows : [];
      if (!rows.length) return { code: 400, msg: '没有可导入的数据' };
      const existed = {};
      (await listAll(COLL)).forEach(s => { const n = String(s.name || '').trim(); if (n) existed[n] = 1; });
      const failed = [];
      const warnings = [];
      const cats = await loadCategoryList();
      let success = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {};
        const rowNo = r._row || (i + 2);
        const name = String(r.name || '').trim();
        const area = String(r.area || r.dest || '').trim();
        if (!name) { failed.push({ row: rowNo, msg: '景区名称不能为空' }); continue; }
        if (!area) { failed.push({ row: rowNo, name, msg: '所在区域不能为空' }); continue; }
        if (existed[name]) { failed.push({ row: rowNo, name, msg: '同名景区已存在，已跳过' }); continue; }
        existed[name] = 1;
        const ll = parseLatLng(r.location);
        const feature = String(r.feature || '').trim();
        const typeText = String(r.subType || '').trim();
        const hit = matchScenicCategory(String(r.regionLevel1 || '').trim(), typeText, area, cats);
        hit.warns.forEach(msg => warnings.push({ name, msg }));
        const typeName = hit.typeName || typeText;
        const doc = {
          id: genId(), name,
          dest: area,
          area,
          regionLevel1: hit.regionName || deriveRegion(area, r.regionLevel1),
          regionCatId: hit.regionCatId,
          typeName,
          typeCatId: hit.typeCatId,
          placeCatId: hit.placeCatId,
          subType: mapSubType(typeName),
          address: String(r.address || '').trim(),
          openTime: String(r.openTime || '').trim(),
          ticketPrice: String(r.ticketPrice == null ? '' : r.ticketPrice).trim(),
          duration: String(r.duration || '').trim(),
          feature,
          intro: String(r.briefDesc || '').trim(),
          tags: toArray(feature),
          weight: Number(r.sort) || 0,
          cover: '', album: [], detailHtml: '', bestSeason: '', online: true
        };
        if (ll) { doc.lon = ll.lon; doc.lat = ll.lat; }
        await db.collection(COLL).add({ data: doc });
        success++;
      }
      return { code: 200, msg: '导入完成', data: { total: rows.length, success, failed, warnings } };
    }

    if (action === 'add') {
      const doc = clean(data);
      if (!doc.id) doc.id = genId();
      if (!Array.isArray(doc.album)) doc.album = [];
      if (doc.online === undefined) doc.online = true;
      if (doc.weight === undefined) doc.weight = 0;
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '新增成功', data: { id: doc.id, _id: r._id } };
    }
    if (action === 'update') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '记录不存在' };
      const d = clean(data); delete d.id;
      await db.collection(COLL).doc(f._id).update({ data: d });
      return { code: 200, msg: '更新成功' };
    }
    if (action === 'remove') {
      const list = Array.isArray(ids) && ids.length ? ids : (id ? [id] : []);
      let n = 0;
      for (const bid of list) { const f = await findBiz(bid); if (f) { await db.collection(COLL).doc(f._id).remove(); n++; } }
      return { code: 200, msg: '删除成功', data: { removed: n } };
    }
    if (action === 'reorder') {
      const list = Array.isArray(orderedIds) ? orderedIds : [];
      const fl = field || 'weight';
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const f = await findBiz(list[i]);
        if (f) { const val = fl === 'weight' ? (list.length - i) : (i + 1); await db.collection(COLL).doc(f._id).update({ data: { [fl]: val } }); n++; }
      }
      return { code: 200, msg: '排序更新成功', data: { updated: n } };
    }
    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
