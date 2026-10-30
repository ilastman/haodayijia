/**
 * 景区游玩项目。
 * price 始终是字符串，可以是「10元」「免费」，不只是数字。
 * 私人定制每天的选择：playItemSelections: [{ scenicId, items:[{id,name,price}] }]
 */

function playId() {
  return 'pi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function normalizePlayItems(list) {
  const src = Array.isArray(list) ? list : [];
  const out = [];
  const seen = {};
  src.forEach(it => {
    if (!it || typeof it !== 'object') return;
    const name = String(it.name == null ? '' : it.name).trim();
    if (!name) return;
    let id = String(it.id == null ? '' : it.id).trim();
    if (!id || seen[id]) id = playId();
    seen[id] = 1;
    out.push({
      id: id,
      name: name,
      price: String(it.price == null ? '' : it.price).trim()
    });
  });
  return out;
}

/* 「骑马|10元;篝火|免费」或已是数组 -> playItems */
function parsePlayItems(v) {
  if (Array.isArray(v)) return normalizePlayItems(v);
  const text = String(v == null ? '' : v).trim();
  if (!text) return [];
  return normalizePlayItems(text.split(/[;；\n]+/).map(s => s.trim()).filter(Boolean).map(seg => {
    const bar = seg.indexOf('|');
    const cut = bar >= 0 ? bar : seg.indexOf('/');
    if (cut < 0) return { name: seg, price: '' };
    return { name: seg.slice(0, cut).trim(), price: seg.slice(cut + 1).trim() };
  }));
}

/* scenicIds 传入时，丢掉当天没选的景区；items 里的 price 保持字符串 */
function normalizeSelections(list, scenicIds) {
  const limit = Array.isArray(scenicIds);
  const allow = {};
  if (limit) scenicIds.forEach(id => { if (id) allow[String(id)] = 1; });
  const out = [];
  const seen = {};
  (Array.isArray(list) ? list : []).forEach(row => {
    if (!row || typeof row !== 'object') return;
    const scenicId = String(row.scenicId || '').trim();
    if (!scenicId || seen[scenicId]) return;
    if (limit && !allow[scenicId]) return;
    seen[scenicId] = 1;
    const items = normalizePlayItems(row.items);
    if (!items.length) return;
    out.push({ scenicId: scenicId, items: items });
  });
  return out;
}

module.exports = {
  playId: playId,
  normalizePlayItems: normalizePlayItems,
  parsePlayItems: parsePlayItems,
  normalizeSelections: normalizeSelections
};
