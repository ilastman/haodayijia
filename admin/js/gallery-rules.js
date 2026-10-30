/* 图库写入规则（浏览器）。与 cloudfunctions/galleryCRUD/rules.js 保持一致。 */
(function () {
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

  /* 与 categoryCRUD.ensureSeed 同一套默认树，云端分类未拉到时用于本地演示 */
  function fallbackCategories() {
    const regions = ['呼伦贝尔', '雪乡', '哈尔滨', '新疆'];
    const places = {
      '呼伦贝尔': ['海拉尔', '满洲里', '黑山头', '额尔古纳', '室韦', '阿尔山', '恩和', '根河', '莫尔道嘎'],
      '雪乡': ['雪乡'],
      '哈尔滨': ['哈尔滨'],
      '新疆': ['新疆']
    };
    const types = ['景区', '远野体验'];
    const docs = [];
    let seq = 0;
    function push(tree, parentId, level, name) {
      const doc = { id: 'gal_' + tree + '_' + seq, tree, parentId: parentId || '', level, name, sort: seq };
      seq += 1;
      docs.push(doc);
      return doc;
    }
    regions.forEach(region => {
      const ps = places[region] || [region];
      const h1 = push('hotel', '', 1, region);
      ps.forEach(p => push('hotel', h1.id, 2, p));
      const s1 = push('scenic', '', 1, region);
      types.forEach(tp => {
        const s2 = push('scenic', s1.id, 2, tp);
        ps.forEach(p => push('scenic', s2.id, 3, p));
      });
    });
    return docs;
  }

  window.GalleryRules = { COVER_TREE, COVER_PLACE, normalizeGalleryDoc, fallbackCategories };
})();
