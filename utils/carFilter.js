/* 选车三级筛选：地点 → 车型 → 长线/短线（酒店同款纯 chips + 全部，兼容旧车空字段） */
const ALL = '全部';
const NONE_REGION = '__none__';
const REGIONS = ['哈尔滨', '漠河', '新疆', '伊犁', '阿勒泰', '乌鲁木齐'];
const LINES = ['长线', '短线'];
const TYPES = ['SUV五座', '商务', '九座商务'];

function uniq(arr) { return arr.filter((x, i, a) => x && a.indexOf(x) === i); }

function isAll(v) { return !v || v === ALL; }

function regionOk(c, r) {
  if (isAll(r)) return true;
  if (r === NONE_REGION) return !c.regionLevel1;
  return c.regionLevel1 === r;
}

function categoryOk(c, cat) {
  return isAll(cat) || c.category === cat;
}

function lineOk(c, line) {
  return isAll(line) || c.lineType === line;
}

/** 规范化筛选值：空串视为「全部」 */
function norm(f) {
  f = f || {};
  return {
    region: isAll(f.region) ? ALL : f.region,
    category: isAll(f.category) ? ALL : f.category,
    line: isAll(f.line) ? ALL : f.line
  };
}

function buildOpts(cars, meta, f) {
  cars = cars || [];
  meta = meta || {};
  f = norm(f);

  const baseRegions = (meta.regions && meta.regions.length) ? meta.regions.slice() : REGIONS.slice();
  const hasNoRegion = cars.some(c => !c.regionLevel1);
  const regions = [ALL].concat(baseRegions);
  if (hasNoRegion) regions.push(NONE_REGION);

  const poolByRegion = cars.filter(c => regionOk(c, f.region));
  const seenCats = uniq(poolByRegion.map(c => c.category));
  let categories;
  if (isAll(f.region)) {
    categories = [ALL].concat(uniq(uniq(cars.map(c => c.category)).concat(TYPES, meta.vehicleTypes || [])));
  } else {
    categories = [ALL].concat(seenCats);
  }

  const poolByCat = poolByRegion.filter(c => categoryOk(c, f.category));
  const seenLines = uniq(poolByCat.map(c => c.lineType));
  const metaLines = (meta.lineTypes && meta.lineTypes.length) ? meta.lineTypes.slice() : LINES.slice();
  const lines = [ALL].concat(seenLines.length ? seenLines : metaLines);

  return {
    regions: regions,
    categories: categories,
    lines: lines,
    hasNoRegion: hasNoRegion
  };
}

function apply(cars, f) {
  f = norm(f);
  return (cars || []).filter(c => regionOk(c, f.region) && categoryOk(c, f.category) && lineOk(c, f.line));
}

function emptyText(total, shown, f) {
  if (shown > 0) return '';
  if (!total) return '暂无车型';
  f = norm(f);
  var tip = '该筛选下暂无车型（旧车型需到后台补地点/长线短线）';
  if (!isAll(f.line)) tip += '\n有车型未填长短线，请到 PC 车型管理补全';
  return tip;
}

/** 打开弹层时的默认筛选：三级都是「全部」 */
function defaultFilter() {
  return { region: ALL, category: ALL, line: ALL };
}

module.exports = {
  ALL: ALL,
  NONE_REGION: NONE_REGION,
  REGIONS: REGIONS,
  LINES: LINES,
  buildOpts: buildOpts,
  apply: apply,
  emptyText: emptyText,
  defaultFilter: defaultFilter,
  norm: norm,
  isAll: isAll
};
