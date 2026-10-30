/**
 * 景区游玩项目。
 * price 一律保留字符串（如 "10元"、"免费"），不转成数字。
 * 云函数目录里有同内容副本：部署包不含仓库 utils，改这里时请同步那两份。
 */

function normalizePlayItems(list) {
  const src = Array.isArray(list) ? list : [];
  const out = [];
  const seen = {};
  src.forEach((it, i) => {
    if (it == null || it === '') return;
    const name = String(typeof it === 'string' ? it : (it.name == null ? '' : it.name)).trim();
    if (!name) return;
    let id = String((it && typeof it === 'object' && it.id) || '').trim();
    if (!id) id = 'pi' + (i + 1);
    if (seen[id]) id = id + '_' + (i + 1);
    seen[id] = 1;
    const rawPrice = (it && typeof it === 'object') ? it.price : '';
    const price = String(rawPrice == null ? '' : rawPrice).trim();
    out.push({ id, name, price });
  });
  return out;
}

/* 「骑马/10元,射箭/免费」或换行。价格原文留在斜杠后面。 */
function parsePlayItemsText(text) {
  const parts = String(text == null ? '' : text).split(/[,，;；、\n\r]+/);
  const list = [];
  parts.forEach(part => {
    const seg = String(part || '').trim();
    if (!seg) return;
    const bits = seg.split(/[/／|｜]/);
    const name = (bits.shift() || '').trim();
    const price = bits.join('/').trim();
    if (!name) return;
    list.push({ name, price });
  });
  return normalizePlayItems(list);
}

function asPlayItems(v) {
  if (v == null || v === '') return [];
  if (typeof v === 'string') return parsePlayItemsText(v);
  return normalizePlayItems(v);
}

/* scenicIds 给出顺序；不在当天景区里的选择丢掉。未传 scenicIds 则全部保留。 */
function normalizeSelections(raw, scenicIds) {
  const src = Array.isArray(raw) ? raw : [];
  const allow = Array.isArray(scenicIds) ? scenicIds : null;
  const byId = {};
  src.forEach(row => {
    if (!row || !row.scenicId) return;
    const sid = String(row.scenicId);
    const items = normalizePlayItems(row.items);
    if (!items.length) return;
    byId[sid] = items;
  });
  const order = allow || Object.keys(byId);
  const out = [];
  const used = {};
  order.forEach(sid => {
    const id = String(sid);
    if (used[id] || !byId[id]) return;
    if (allow && allow.indexOf(id) < 0 && allow.indexOf(sid) < 0) return;
    used[id] = 1;
    out.push({ scenicId: id, items: byId[id] });
  });
  return out;
}

function decorateScenics(scenics, selections) {
  const picked = {};
  normalizeSelections(selections).forEach(row => {
    const set = {};
    row.items.forEach(it => { set[it.id] = 1; });
    picked[row.scenicId] = set;
  });
  return (scenics || []).map(s => {
    const set = picked[s && s.id] || {};
    const playItems = normalizePlayItems(s && s.playItems).map(it => Object.assign({}, it, { sel: !!set[it.id] }));
    return Object.assign({}, s, { playItems });
  });
}

function togglePlayItem(selections, scenicIds, scenicId, item) {
  const sid = String(scenicId || '');
  const rows = normalizeSelections(selections, scenicIds).map(row => ({
    scenicId: row.scenicId,
    items: row.items.map(it => ({ id: it.id, name: it.name, price: it.price }))
  }));
  let row = null;
  rows.forEach(r => { if (r.scenicId === sid) row = r; });
  if (!row) {
    row = { scenicId: sid, items: [] };
    rows.push(row);
  }
  const id = String((item && item.id) || '');
  const pos = row.items.findIndex(it => it.id === id);
  if (pos > -1) row.items.splice(pos, 1);
  else if (item && String(item.name || '').trim()) {
    row.items.push({
      id: id || ('pi' + (row.items.length + 1)),
      name: String(item.name).trim(),
      price: String(item.price == null ? '' : item.price).trim()
    });
  }
  return normalizeSelections(rows, scenicIds);
}

function playLine(items) {
  return normalizePlayItems(items).map(it => (it.price ? (it.name + ' ' + it.price) : it.name)).join('、');
}

module.exports = {
  normalizePlayItems,
  parsePlayItemsText,
  asPlayItems,
  normalizeSelections,
  decorateScenics,
  togglePlayItem,
  playLine
};
