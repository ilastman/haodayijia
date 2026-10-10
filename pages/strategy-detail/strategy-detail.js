const copy = require('../../utils/copy');
const data = require('../../utils/data');
const { ph } = require('../../utils/util');

Page({
  data: {
    publishLabel: copy.strategy.publishLabel,
    article: null
  },

  onLoad(options) {
    let article = data.getStrategy(options.id || '');
    if (!article) {
      article = data.strategies[0];
    }
    article = Object.assign({}, article, {
      content: article.content.map(c =>
        c.t === 'img' ? Object.assign({}, c, { ph: ph(c.text, 750, 420) }) : c
      )
    });
    this.setData({ article });
    wx.setNavigationBarTitle({ title: article.category });
  },

  previewImage() {
    const urls = this.data.article.content.filter(c => c.t === 'img').map(c => c.ph);
    if (urls.length) {
      wx.previewImage({ current: urls[0], urls });
    }
  }
});
