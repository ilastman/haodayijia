const cloud = require('wx-server-sdk');

/**
 * 云函数：categoryCRUD
 * 两套独立分类树：
 *   scenic 三级：大区 → 类型 → 地点
 *   hotel  两级：大区 → 地点
 * 查询公开；增删改需管理员 token。删除前检查下级分类，以及酒店/景区是否已绑定。
 */

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { verifyAdminToken } = require('./auth');
const COLL = 'category';

const REGIONS = ['呼伦贝尔', '雪乡', '哈尔滨', '新疆'];
const PLACES = {
  呼伦贝尔: ['海拉尔', '满洲里', '黑山头', '额尔古纳', '室韦', '阿尔山', '恩和', '根河', '莫尔道嘎'],
  雪乡: ['雪乡'],
  哈尔滨: ['哈尔滨'],
  新疆: ['新疆']
};
const SCENIC_TYPES = ['景区', '远野体验'];

async function isAdmin(token) { return !!(await verifyAdminToken(token)); }
function strip(doc) { if (!doc) return doc; const d = Object.assign({}, doc); delete d._id; delete d._openid; return d; }
function genId() { return 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
async function findBiz(id) {
  if (!id) return null;
  const r = await db.collection(COLL).where({ id }).limit(1).get();
  return (r.data && r.data[0]) || null;
}

async function listAll(coll) {
  const out = [];
  let skip = 0;
  for (;;) {
    let r;
    try { r = await db.collection(coll).skip(skip).limit(100).get(); }
    catch (e) { return out; }
    const rows = (r && r.data) || [];
    out.push.apply(out, rows);
    if (rows.length < 100) break;
    skip += rows.length;
    if (skip > 3000) break;
  }
  return out;
}

function typeMatches(doc, name) {
  if (doc.typeName) return doc.typeName === name;
  if (/体验|娱乐/.test(name)) return doc.subType === 'entertainment';
  if (name === '景区') return doc.subType !== 'entertainment';
  return false;
}

async function ensureSeed() {
  try { await db.createCollection(COLL); } catch (e) { /* 已存在 */ }
  const cur = await listAll(COLL);
  if (cur.length) return cur;
  const docs = [];
  let seq = 0;
  function push(tree, parentId, level, name) {
    const doc = { id: genId(), tree, parentId: parentId || '', level, name, sort: seq++ };
    docs.push(doc);
    return doc;
  }
  REGIONS.forEach(region => {
    const places = PLACES[region] || [region];
    const h1 = push('hotel', '', 1, region);
    places.forEach(p => push('hotel', h1.id, 2, p));
    const s1 = push('scenic', '', 1, region);
    SCENIC_TYPES.forEach(tp => {
      const s2 = push('scenic', s1.id, 2, tp);
      places.forEach(p => push('scenic', s2.id, 3, p));
    });
  });
  for (let i = 0; i < docs.length; i += 20) {
    const batch = docs.slice(i, i + 20);
    await Promise.all(batch.map(d => db.collection(COLL).add({ data: d })));
  }
  return docs.map(d => Object.assign({ _id: '' }, d));
}

function boundOf(cat, hotels, scenics, cats) {
  let n = 0;
  if (cat.tree === 'hotel') {
    const parent = cats.filter(c => c.id === cat.parentId)[0];
    hotels.forEach(h => {
      if (cat.level === 1 && (h.regionCatId === cat.id || (!h.regionCatId && h.regionLevel1 === cat.name))) n++;
      if (cat.level === 2) {
        const byId = h.areaCatId === cat.id;
        const byName = !h.areaCatId && h.area === cat.name && (!parent || !h.regionLevel1 || h.regionLevel1 === parent.name);
        if (byId || byName) n++;
      }
    });
    return n;
  }
  const parent = cats.filter(c => c.id === cat.parentId)[0];
  scenics.forEach(s => {
    if (cat.level === 1 && (s.regionCatId === cat.id || (!s.regionCatId && s.regionLevel1 === cat.name))) n++;
    if (cat.level === 2 && (s.typeCatId === cat.id || (!s.typeCatId && typeMatches(s, cat.name)))) n++;
    if (cat.level === 3) {
      const byId = s.placeCatId === cat.id;
      const byName = !s.placeCatId && ((s.dest || s.area) === cat.name);
      const typeOk = !parent || typeMatches(s, parent.name);
      if (byId || (byName && typeOk)) n++;
    }
  });
  return n;
}

async function renameBindings(cat, oldName, newName, cats) {
  if (!oldName || oldName === newName) return;
  if (cat.tree === 'hotel') {
    const parent = cats.filter(c => c.id === cat.parentId)[0];
    const hotels = await listAll('hotel');
    for (let i = 0; i < hotels.length; i++) {
      const h = hotels[i];
      const upd = {};
      if (cat.level === 1 && (h.regionCatId === cat.id || (!h.regionCatId && h.regionLevel1 === oldName))) {
        upd.regionLevel1 = newName;
        upd.regionCatId = cat.id;
      }
      if (cat.level === 2) {
        const byId = h.areaCatId === cat.id;
        const byName = !h.areaCatId && h.area === oldName && (!parent || !h.regionLevel1 || h.regionLevel1 === parent.name);
        if (byId || byName) {
          upd.area = newName;
          upd.areaCatId = cat.id;
        }
      }
      if (Object.keys(upd).length) await db.collection('hotel').doc(h._id).update({ data: upd });
    }
    return;
  }
  const parent = cats.filter(c => c.id === cat.parentId)[0];
  const scenics = await listAll('scenic');
  for (let i = 0; i < scenics.length; i++) {
    const s = scenics[i];
    const upd = {};
    if (cat.level === 1 && (s.regionCatId === cat.id || (!s.regionCatId && s.regionLevel1 === oldName))) {
      upd.regionLevel1 = newName;
      upd.regionCatId = cat.id;
    }
    if (cat.level === 2 && (s.typeCatId === cat.id || (!s.typeCatId && typeMatches(s, oldName)))) {
      upd.typeName = newName;
      upd.typeCatId = cat.id;
      upd.subType = /体验|娱乐/.test(newName) ? 'entertainment' : 'scenic';
    }
    if (cat.level === 3) {
      const byId = s.placeCatId === cat.id;
      const byName = !s.placeCatId && ((s.dest || s.area) === oldName) && (!parent || typeMatches(s, parent.name));
      if (byId || byName) {
        upd.dest = newName;
        upd.area = newName;
        upd.placeCatId = cat.id;
      }
    }
    if (Object.keys(upd).length) await db.collection('scenic').doc(s._id).update({ data: upd });
  }
}

exports.main = async (event) => {
  const { action, token, data, id, orderedIds, tree } = event || {};
  if (!action) return { code: 400, msg: '参数缺失：action必填' };
  try {
    if (action === 'list') {
      await ensureSeed();
      let list = (await listAll(COLL)).map(strip);
      const t = tree || (data && data.tree);
      if (t) list = list.filter(c => c.tree === t);
      list.sort((a, b) => (a.level - b.level) || ((a.sort || 0) - (b.sort || 0)) || String(a.name).localeCompare(String(b.name)));
      return { code: 200, data: list };
    }
    if (!(await isAdmin(token))) return { code: 403, msg: '无权限：需管理员token' };

    if (action === 'add') {
      const name = String((data && data.name) || '').trim();
      const treeName = (data && data.tree) === 'hotel' ? 'hotel' : 'scenic';
      const parentId = String((data && data.parentId) || '').trim();
      if (!name) return { code: 400, msg: '请填写分类名称' };
      let level = 1;
      if (parentId) {
        const parent = await findBiz(parentId);
        if (!parent || parent.tree !== treeName) return { code: 400, msg: '上级分类不存在' };
        level = Number(parent.level) + 1;
        const max = treeName === 'hotel' ? 2 : 3;
        if (level > max) return { code: 400, msg: treeName === 'hotel' ? '酒店分类只有两级' : '景区分类只有三级' };
      }
      const all = await listAll(COLL);
      if (all.some(c => c.tree === treeName && String(c.parentId || '') === parentId && c.name === name)) {
        return { code: 400, msg: '同级已有同名分类' };
      }
      const sibs = all.filter(c => c.tree === treeName && String(c.parentId || '') === parentId);
      const sort = sibs.reduce((m, c) => Math.max(m, Number(c.sort) || 0), -1) + 1;
      const doc = { id: genId(), tree: treeName, parentId, level, name, sort };
      const r = await db.collection(COLL).add({ data: doc });
      return { code: 200, msg: '已新增', data: { id: doc.id, _id: r._id } };
    }

    if (action === 'update') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '分类不存在' };
      const name = String((data && data.name) || '').trim();
      if (!name) return { code: 400, msg: '请填写分类名称' };
      const all = await listAll(COLL);
      const parentId = String(f.parentId || '');
      if (all.some(c => c.id !== f.id && c.tree === f.tree && String(c.parentId || '') === parentId && c.name === name)) {
        return { code: 400, msg: '同级已有同名分类' };
      }
      await db.collection(COLL).doc(f._id).update({ data: { name } });
      await renameBindings(f, f.name, name, all);
      return { code: 200, msg: '已保存' };
    }

    if (action === 'remove') {
      const f = await findBiz(id);
      if (!f) return { code: 404, msg: '分类不存在' };
      const all = await listAll(COLL);
      const childN = all.filter(c => c.parentId === f.id).length;
      if (childN) return { code: 400, msg: '请先删除下级分类（还有 ' + childN + ' 项）' };
      const hotels = f.tree === 'hotel' ? await listAll('hotel') : [];
      const scenics = f.tree === 'scenic' ? await listAll('scenic') : [];
      const n = boundOf(f, hotels, scenics, all);
      if (n) return { code: 400, msg: '已有 ' + n + ' 条' + (f.tree === 'hotel' ? '酒店' : '景区') + '使用该分类，不能删除' };
      await db.collection(COLL).doc(f._id).remove();
      return { code: 200, msg: '已删除' };
    }

    if (action === 'reorder') {
      const list = Array.isArray(orderedIds) ? orderedIds : [];
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const f = await findBiz(list[i]);
        if (f) { await db.collection(COLL).doc(f._id).update({ data: { sort: i } }); n++; }
      }
      return { code: 200, msg: '排序已更新', data: { updated: n } };
    }

    return { code: 400, msg: '不支持的action' };
  } catch (err) {
    return { code: 500, msg: (err && err.message) || '操作失败', error: err };
  }
};
