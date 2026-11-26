/**
 * 景区 / 原野体验的独立价格。
 * 只接受大于 0 的数字。空着、以及 0，都不落成 0。
 * 门票说明文字在 ticketPrice，这里不解析「免费」「成人298」这类长文案。
 * 后台 admin/js/views/scenic.js 里的 classifyScenicPrice 必须与本函数保持一致。
 */

function classifyScenicPrice(v) {
  if (v == null) return { ok: true, value: null };
  const s = String(v).trim();
  if (!s) return { ok: true, value: null };
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s)) return { ok: false, reason: 'invalid' };
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return { ok: false, reason: 'zero' };
  return { ok: true, value: n };
}

/* 写入前整理 doc.price。返回错误文案时调用方应中止保存，且不要改掉已有价格。
 * existing 为库里的旧文档；空价格在更新时删掉已有数字，新增时不写该字段。 */
function applyScenicPrice(doc, existing, db) {
  if (!doc || !Object.prototype.hasOwnProperty.call(doc, 'price')) return null;
  const c = classifyScenicPrice(doc.price);
  if (!c.ok) {
    return c.reason === 'zero'
      ? '独立价格请留空，不要填 0'
      : '独立价格只填大于 0 的数字，不填请留空';
  }
  if (typeof c.value === 'number') {
    doc.price = c.value;
    return null;
  }
  const prev = existing && existing.price;
  const had = !(prev == null || prev === '');
  if (had && db && db.command && typeof db.command.remove === 'function') doc.price = db.command.remove();
  else delete doc.price;
  return null;
}

module.exports = { classifyScenicPrice, applyScenicPrice };
