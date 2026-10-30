/**
 * 图库约定（小程序选用）
 * - 酒店图库两级、景区图库三级：宣传图
 * - 私人定制封面是独立一层，封面只从这一层选取
 */

const COVER_TREE = 'customCover';
const COVER_PLACE = 'custom-cover';
const MAX_PROMO = 2;

function isCover(img) {
  if (!img) return false;
  return img.tree === COVER_TREE || img.role === 'cover' || img.categoryId === COVER_PLACE;
}

function clipPromo(list) {
  const src = Array.isArray(list) ? list : [];
  const out = [];
  src.forEach(x => {
    const s = String(x || '').trim();
    if (!s || out.length >= MAX_PROMO || out.indexOf(s) >= 0) return;
    out.push(s);
  });
  return out;
}

module.exports = { COVER_TREE, COVER_PLACE, MAX_PROMO, isCover, clipPromo };
