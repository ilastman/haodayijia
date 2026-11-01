/**
 * 私人定制里选景区 / 酒店时用的分类筛选。
 * 景区三级：大区 → 类型 → 地点。酒店两级：大区 → 地点。
 * 与景区列表、酒店列表同一套规则。
 */

const ALL = '全部';

function typeHit(s, name) {
  if (!s) return false;
  if (s.typeName) return s.typeName === name;
  if (/体验|娱乐/.test(name)) return s.subType === 'entertainment';
  if (name === '景区') return (s.subType || 'scenic') !== 'entertainment';
  return (s.subType || 'scenic') === name;
}

function levelNodes(tree, level, parentIds) {
  return (tree || []).filter(c => Number(c.level) === level && (!parentIds || parentIds.indexOf(c.parentId) >= 0))
    .slice()
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.name).localeCompare(String(b.name), 'zh'));
}

function pushName(arr, name) {
  const n = String(name || '').trim();
  if (n && arr.indexOf(n) < 0) arr.push(n);
}

function pick(list, want, fallback) {
  return list.indexOf(want) >= 0 ? want : fallback;
}

/**
 * kind: scenic | hotel
 * filter: { region, sub, place }
 * 返回 { regions, subs, places, region, sub, place, list }
 */
function facet(kind, items, tree, filter, fallbackRegions) {
  const rows = Array.isArray(items) ? items : [];
  const wantRegion = (filter && filter.region) || ALL;
  const wantSub = (filter && filter.sub) || 'all';
  const wantPlace = (filter && filter.place) || ALL;
  const hasTree = !!(tree && tree.length);
  const regions = hasTree
    ? [ALL].concat(levelNodes(tree, 1).map(c => c.name))
    : [ALL].concat(fallbackRegions || []);
  const region = pick(regions, wantRegion, ALL);

  if (kind === 'hotel') {
    const places = [ALL];
    if (hasTree) {
      const nodes = region === ALL ? levelNodes(tree, 1) : levelNodes(tree, 1).filter(c => c.name === region);
      levelNodes(tree, 2, nodes.map(c => c.id)).forEach(p => pushName(places, p.name));
    } else {
      rows.forEach(h => {
        if (region !== ALL && h.regionLevel1 !== region) return;
        pushName(places, h.area);
      });
    }
    const place = pick(places, wantPlace, ALL);
    const list = rows.filter(h => (region === ALL || h.regionLevel1 === region) && (place === ALL || h.area === place));
    return { regions, subs: [], places, region, sub: 'all', place, list };
  }

  let subs;
  let sub;
  const places = [ALL];
  if (hasTree) {
    const nodes = region === ALL ? levelNodes(tree, 1) : levelNodes(tree, 1).filter(c => c.name === region);
    const types = levelNodes(tree, 2, nodes.map(c => c.id));
    const typeNames = [];
    types.forEach(t => pushName(typeNames, t.name));
    subs = [{ key: 'all', label: '全部' }].concat(typeNames.map(n => ({ key: n, label: n })));
    sub = subs.some(t => t.key === wantSub) ? wantSub : 'all';
    const chosen = sub === 'all' ? types : types.filter(t => t.name === sub);
    levelNodes(tree, 3, chosen.map(t => t.id)).forEach(p => pushName(places, p.name));
  } else {
    subs = [
      { key: 'all', label: '全部' },
      { key: 'scenic', label: '景区' },
      { key: 'entertainment', label: '原野体验' }
    ];
    sub = subs.some(t => t.key === wantSub) ? wantSub : 'all';
    rows.forEach(s => {
      if (region !== ALL && s.regionLevel1 !== region) return;
      if (sub !== 'all' && (s.subType || 'scenic') !== sub) return;
      pushName(places, s.dest);
    });
  }
  const place = pick(places, wantPlace, ALL);
  const list = rows.filter(s => {
    if (region !== ALL && s.regionLevel1 !== region) return false;
    if (sub !== 'all') {
      if (hasTree) { if (!typeHit(s, sub)) return false; }
      else if ((s.subType || 'scenic') !== sub) return false;
    }
    if (place !== ALL && s.dest !== place) return false;
    return true;
  });
  return { regions, subs, places, region, sub, place, list };
}

/* 同等级：沿用钻级/stars 全等，不放宽到「同星级跨区」 */
function sameGrade(primary, hotel) {
  return !!(primary && hotel) && primary.stars === hotel.stars;
}

/* 二级大区：双方都有 areaCatId 时只认分类 id；否则用地点名 area，并在双方都有一级大区时要求一级也一致，避免同名地点串区。 */
function sameLevel2Area(primary, hotel) {
  if (!primary || !hotel) return false;
  const pid = String(primary.areaCatId || '').trim();
  const hid = String(hotel.areaCatId || '').trim();
  if (pid && hid) return pid === hid;
  const pa = String(primary.area || '').trim();
  const ha = String(hotel.area || '').trim();
  if (!pa || pa !== ha) return false;
  const pr = String(primary.regionLevel1 || '').trim();
  const hr = String(hotel.regionLevel1 || '').trim();
  if (pr && hr && pr !== hr) return false;
  return true;
}

/* 备选酒店：排除主酒店本身，钻级与主酒店相同，且锁在同一个二级大区。 */
function sameGradeAlt(primary, hotel) {
  if (!primary || !hotel || !hotel.id || hotel.id === primary.id) return false;
  return sameGrade(primary, hotel) && sameLevel2Area(primary, hotel);
}

module.exports = { ALL, typeHit, facet, sameGrade, sameLevel2Area, sameGradeAlt };
