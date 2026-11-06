/**
 * 用户服务协议 / 隐私政策正文，以及收集前是否已同意。
 * 只写当前代码实际做的事。联系方式由调用方传入公示配置，不用占位号码。
 */
const ENTITY = '内蒙古好大一家旅游有限公司';
const APP_NAME = '好大一家冰雪旅行社';

function allowCollect(agreed) {
  return agreed === true;
}

function cleanContactValue(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (s === '400-000-0000' || s === 'your-wechat-id') return '';
  if (s.indexOf('办公地址可修改') >= 0) return '';
  if (s.indexOf('你的旅行社名称') >= 0) return '';
  return s;
}

function publicContact(contact) {
  const c = contact || {};
  return {
    phone: cleanContactValue(c.phone || c.servicePhone),
    wechat: cleanContactValue(c.wechat || c.wechatId),
    email: cleanContactValue(c.email),
    address: cleanContactValue(c.address)
  };
}

function contactLines(contact) {
  const c = publicContact(contact);
  const lines = [];
  if (c.phone) lines.push('客服电话：' + c.phone + '。可用于咨询，以及申请更正或删除你提交的信息。');
  if (c.wechat) lines.push('微信：' + c.wechat + '。');
  if (c.email) lines.push('邮箱：' + c.email + '。');
  if (c.address) lines.push('地址：' + c.address + '。');
  if (!lines.length) {
    lines.push('公示联系方式暂时没有读取到。请稍后重新打开本页。这里不会改用占位号码。');
  }
  return lines;
}

function agreementDoc(contact) {
  return {
    kind: 'agreement',
    title: '用户服务协议',
    blocks: [
      { heading: '服务提供方', lines: [
        '本小程序名称为「' + APP_NAME + '」。服务由「' + ENTITY + '」提供。',
        '你可以浏览线路、景区、酒店和攻略。需要我们联系你时，再填写咨询或资料。'
      ] },
      { heading: '咨询与定制', lines: [
        '咨询弹窗会请你填写姓名和手机号，也可以填写人数、出行日期和备注。',
        '私人定制的提交表单会请你填写姓名和手机号，也可以填写微信号。',
        '这些内容在你勾选同意并提交后，写入本机存储「consultRecords」，用于回访、确认行程，以及在「咨询记录」里查看。',
        '当前代码没有把这条咨询记录上传到单独的咨询云函数。'
      ] },
      { heading: '未同意时', lines: [
        '勾选框默认不选。未勾选时不能提交咨询，也不能提交私人定制里的联系信息。',
        '只浏览页面不需要勾选。'
      ] },
      { heading: '联系', lines: contactLines(contact) }
    ]
  };
}

function privacyDoc(contact) {
  return {
    kind: 'privacy',
    title: '隐私政策',
    blocks: [
      { heading: '谁在处理', lines: [
        '处理者是「' + ENTITY + '」，小程序名称是「' + APP_NAME + '」。',
        '下面只说明当前小程序代码里实际收集、使用和保存的信息。'
      ] },
      { heading: '你填写的联系信息', lines: [
        '咨询弹窗：姓名、手机号，以及你选填的人数、出行日期、备注、所咨询的线路或酒店名称。用途是联系你、确认出行需求，并在本机「咨询记录」中展示。方式是你自己输入。提交后保存在本机存储「consultRecords」。',
        '私人定制提交：姓名、手机号，以及你选填的微信号，连同当次行程摘要。用途相同。同样写入本机「consultRecords」。行程本身另按保存行程的功能写入行程记录，那一份不靠这个表单自动带上手机号。',
        '个人资料：你可填写手机号、邮箱，以及昵称、性别、生日。头像可由你选择图片后上传。整份先写入本机存储「userInfo」。同步到云端用户档案的只有昵称和头像；当前云函数不接收、不保存手机号和邮箱。'
      ] },
      { heading: '微信提供的标识', lines: [
        '使用云函数时，微信会把当前用户的 openid 提供给云函数，用来区分你的资料和行程。这不是手机号，也不是微信快速验证手机号。',
        '当前源码没有「获取微信绑定手机号」按钮，也没有读取定位。'
      ] },
      { heading: '图片', lines: [
        '选择私人定制封面、当日宣传图或头像时，会打开你的相册或相机选取图片。你确认上传的图片会存到当前云开发存储，并记下文件标识。'
      ] },
      { heading: '员工填写的订单电话', lines: [
        '员工在工作台建立或编辑订单时，可以填写客户电话。该号码保存在订单记录中，供安排行程和联系使用。这不是客人在前台页面里勾选同意的那一次提交。'
      ] },
      { heading: '保存多久、给谁', lines: [
        '代码没有写统一的保存天数。本机里的咨询记录和资料会留到你清除小程序缓存或删除小程序。云端的昵称、头像、行程和订单会留在当前云开发环境，直到按你的申请处理。',
        '代码没有把咨询手机号自动提交给广告平台，也没有列出其他固定的信息接收公司。微信云开发会按其自身规则处理云函数、数据库和存储。'
      ] },
      { heading: '同意、拒绝和撤回', lines: [
        '收集联系信息的勾选框默认不选。未勾选不能提交咨询、私人定制联系信息，也不能保存个人资料。',
        '拒绝或关闭这些表单后，浏览线路、景区、酒店和攻略不受影响。',
        '你可以不再提交新的信息。已经写在本机的记录不会因为关闭页面而自动删掉。需要更正或删除云端资料时，请用下面的公示方式联系。'
      ] },
      { heading: '联系方式', lines: contactLines(contact).concat([
        '以上电话、微信、邮箱和地址来自小程序公示的客服配置，用于咨询以及更正、删除申请。不把某一位员工写成单独的联系人。'
      ]) }
    ]
  };
}

function docOf(kind, contact) {
  return kind === 'agreement' ? agreementDoc(contact) : privacyDoc(contact);
}

/** 在 Windows 4 主包 app.json 上追加协议分包，不改动已有主包页。 */
function withLegalSubpackage(appJson) {
  const app = JSON.parse(JSON.stringify(appJson || {}));
  const list = app.subPackages || app.subpackages || [];
  const key = app.subPackages ? 'subPackages' : (app.subpackages ? 'subpackages' : 'subPackages');
  const exists = list.some(p => p && p.root === 'pages/legal');
  if (!exists) {
    list.push({ root: 'pages/legal', name: 'legal', pages: ['legal'] });
  }
  app[key] = list;
  return app;
}

module.exports = {
  ENTITY,
  APP_NAME,
  allowCollect,
  publicContact,
  contactLines,
  agreementDoc,
  privacyDoc,
  docOf,
  withLegalSubpackage
};
