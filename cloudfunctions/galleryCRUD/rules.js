/**
 * 图库写入规则（纯函数，供 galleryCRUD 与单测共用）
 * 封面图只能进私人定制封面层，不能挂到酒店或景区节点。
 */

const COVER_TREE = 'customCover';
const COVER_PLACE = 'custom-cover';

function normalizeGalleryDoc(input, categories) {
  const src = input || {};
  const tree = src.tree === 'hotel' || src.tree === 'scenic' || src.tree === COVER_TREE ? src.tree : '';
  if (!tree) return { ok: false, msg: '请选择图库分类' };
  const url = String(src.url || '').trim();
  if (!url) return { ok: false, msg: '请上传图片' };
  const name = String(src.name || '').trim().slice(0, 80);
  const size = Number(src.size) || 0;

  if (tree === COVER_TREE || src.role === 'cover') {
    if (tree !== COVER_TREE) return { ok: false, msg: '封面图只能上传到私人定制封面' };
    return {
      ok: true,
      doc: {
        tree: COVER_TREE,
        categoryId: COVER_PLACE,
        role: 'cover',
        url,
        name: name || '私人定制封面',
        size
      }
    };
  }

  const categoryId = String(src.categoryId || '').trim();
  const cat = (categories || []).filter(c => c && c.id === categoryId && c.tree === tree)[0];
  if (!cat) return { ok: false, msg: '请先选中酒店或景区分类节点' };
  return {
    ok: true,
    doc: {
      tree,
      categoryId,
      role: 'image',
      url,
      name: name || cat.name || '图片',
      size
    }
  };
}

module.exports = { COVER_TREE, COVER_PLACE, normalizeGalleryDoc };
