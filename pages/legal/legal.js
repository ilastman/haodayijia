const consent = require('../../utils/consent');
const share = require('../../utils/share');

function readContact() {
  try {
    const site = require('../../utils/site-config');
    return site.load().then(() => site.contactData()).catch(() => null);
  } catch (e) {
    return Promise.resolve(null);
  }
}

Page(share.install({
  data: {
    title: '隐私政策',
    blocks: []
  },

  onLoad(query) {
    const kind = query && query.kind === 'agreement' ? 'agreement' : 'privacy';
    this._kind = kind;
    this.showDoc(null);
    const self = this;
    readContact().then(contact => { self.showDoc(contact); });
  },

  showDoc(contact) {
    const doc = consent.docOf(this._kind, contact);
    this.setData({ title: doc.title, blocks: doc.blocks });
    wx.setNavigationBarTitle({ title: doc.title });
  }
}));
