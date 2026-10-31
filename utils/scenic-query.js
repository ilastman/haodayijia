/**
 * 景区列表筛选。
 * 后台分类树是「大区 → 类型 → 地点」，导入数据经常对不齐：
 * - 地点写在 dest（如雪乡、亚布力），一级大区 regionLevel1 却是哈尔滨
 * - 类型文案不统一：远野体验 / 远景体验 / 娱乐 / 景点，分类页签只有「景区」「远野体验」
 * 页签按名称精确相等时，这些记录会从对应大区、类型里消失。
 */

const ALL = '全部';

function isEntertainmentName(name) {
  return /体验|娱乐/.test(String(name || ''));
}

function isEntertainment(s) {
  if (!s) return false;
  if (s.subType === 'entertainment') return true;
  return isEntertainmentName(s.typeName);
}

function typeHit(s, name) {
  if (!s) return false;
  if (s.typeName && s.typeName === name) return true;
  if (isEntertainmentName(name)) return isEntertainment(s);
  if (name === '景区') return !isEntertainment(s);
  if (s.typeName) return false;
  return (s.subType || 'scenic') === name;
}

function destOf(s) {
  return String((s && (s.dest || s.area)) || '').trim();
}

/** 大区页签：regionLevel1 一致，或地点名本身就是该大区（雪乡存在分类里，数据却挂在哈尔滨下） */
function regionHit(s, region) {
  if (!region || region === ALL) return true;
  if (!s) return false;
  if (s.regionLevel1 === region) return true;
  return destOf(s) === region;
}

function weightOf(s) {
  const n = Number(s && s.weight);
  return isFinite(n) ? n : 0;
}

function byWeight(a, b) {
  return weightOf(b) - weightOf(a) || String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'zh');
}

function pushName(arr, name) {
  const n = String(name || '').trim();
  if (n && arr.indexOf(n) < 0) arr.push(n);
}

function levelNodes(tree, level, parentIds) {
  return (tree || []).filter(c => Number(c.level) === level && (!parentIds || parentIds.indexOf(c.parentId) >= 0))
    .slice()
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
}

/**
 * @param {Array} items 已映射的景区
 * @param {Array|null} tree scenic 分类树；空则走 subType 兜底页签
 * @param {{region?:string, sub?:string, place?:string, allLabel?:string}} state
 * @param {string[]} fallbackRegions 无分类树时的大区
 */
function query(items, tree, state, fallbackRegions) {
  const allLabel = (state && state.allLabel) || ALL;
  const rows = Array.isArray(items) ? items.slice() : [];
  let region = (state && state.region) || ALL;
  let sub = (state && state.sub) || 'all';
  let place = (state && state.place) || allLabel;
  const hasTree = !!(tree && tree.length);

  if (hasTree) {
    const l1 = levelNodes(tree, 1);
    const regions = [ALL].concat(l1.map(c => c.name));
    if (regions.indexOf(region) < 0) region = ALL;
    const regionNodes = region === ALL ? l1 : l1.filter(c => c.name === region);
    const types = levelNodes(tree, 2, regionNodes.map(c => c.id));
    const typeNames = [];
    types.forEach(t => pushName(typeNames, t.name));
    const subTabs = [{ key: 'all', label: '全部' }].concat(typeNames.map(n => ({ key: n, label: n })));
    if (!subTabs.some(t => t.key === sub)) sub = 'all';
    const chosen = sub === 'all' ? types : types.filter(t => t.name === sub);
    const places = [allLabel];
    levelNodes(tree, 3, chosen.map(t => t.id)).forEach(p => pushName(places, p.name));
    rows.forEach(s => {
      if (!regionHit(s, region)) return;
      if (sub !== 'all' && !typeHit(s, sub)) return;
      pushName(places, destOf(s));
    });
    if (places.indexOf(place) < 0) place = allLabel;
    const list = rows.filter(s => {
      if (!regionHit(s, region)) return false;
      if (sub !== 'all' && !typeHit(s, sub)) return false;
      if (place !== allLabel && destOf(s) !== place) return false;
      return true;
    }).sort(byWeight);
    return { regions, subTabs, places, region, sub, place, list };
  }

  const regions = [ALL].concat(fallbackRegions || []);
  const subTabs = [
    { key: 'all', label: '全部' },
    { key: 'scenic', label: '景区' },
    { key: 'entertainment', label: '原野体验' }
  ];
  if (!subTabs.some(t => t.key === sub)) sub = 'all';
  const base = rows.filter(s => {
    if (!regionHit(s, region)) return false;
    if (sub === 'all') return true;
    if (sub === 'entertainment') return isEntertainment(s);
    if (sub === 'scenic') return !isEntertainment(s);
    return (s.subType || 'scenic') === sub;
  });
  const places = [allLabel];
  base.forEach(s => pushName(places, destOf(s)));
  if (places.indexOf(place) < 0) place = allLabel;
  const list = base.filter(s => place === allLabel || destOf(s) === place).sort(byWeight);
  return { regions, subTabs, places, region, sub, place, list };
}

module.exports = {
  ALL,
  isEntertainment,
  typeHit,
  regionHit,
  query
};
