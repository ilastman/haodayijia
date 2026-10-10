const { isFavorite, toggleFavorite } = require('../../utils/util');

Component({
  properties: {
    item: { type: Object, value: {} },
    mode: { type: String, value: 'grid' } // grid=瀑布流卡片 wide=横滑大卡片
  },

  data: {
    faved: false
  },

  lifetimes: {
    attached() {
      this.setData({ faved: isFavorite(this.data.item.id) });
    }
  },

  methods: {
    onTap() {
      wx.navigateTo({ url: '/pages/route-detail/route-detail?id=' + this.data.item.id });
    },

    onFavorite(e) {
      e.stopPropagation && e.stopPropagation();
      const faved = toggleFavorite(this.data.item.id);
      this.setData({ faved });
      wx.showToast({ title: faved ? '已收藏' : '已取消收藏', icon: 'none', duration: 1200 });
      this.triggerEvent('favoritechange', { id: this.data.item.id, faved });
    }
  }
});
