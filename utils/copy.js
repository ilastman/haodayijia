/**
 * 全站文案集中配置 —— 修改此处即可一键替换全站文案
 */

const brand = '你的旅行社名称';

const copy = {
  brand,
  slogan: '呼伦贝尔全域定制 · 私家团 · 小包团',
  servicePhone: '400-000-0000',
  serviceHours: '服务时间 08:30 - 20:00',
  wechatId: 'your-wechat-id',
  address: '内蒙古呼伦贝尔市海拉尔区（办公地址可修改）',

  companyIntro:
    brand + '专注呼伦贝尔、阿尔山、满洲里、额尔古纳、黑山头、莫尔道嘎深度旅行，提供定制游、小包团、私家团、拼团、租车与酒店预订服务。一对一旅行顾问全程跟进，让每一次北疆之行都省心、尽兴。',

  aboutParagraphs: [
    brand + '成立于呼伦贝尔，深耕北疆旅行资源多年，熟悉草原、森林、边境小城的每一条路线。',
    '我们主打小众深度体验：私家团独立用车、小包团灵活成行、拼团结交同好，也可按您的想法完全定制行程。',
    '从接站、住宿、用车到向导，全程一站式服务，旅行顾问7×12小时在线响应，让您的旅行只剩风景。'
  ],

  // 首页
  home: {
    hotTitle: '热门呼伦贝尔线路',
    destTitle: '目的地直达',
    offerTitle: '特惠推荐',
    more: '查看全部',
    consult: '立即咨询',
    introTitle: '关于我们',
    nav: ['私家团', '拼团', '景区', '酒店', '旅行攻略', '私人定制']
  },

  // 线路列表
  routes: {
    title: '旅游线路',
    searchPlaceholder: '搜索行程名称、目的地',
    empty: '暂无线路',
    loading: '加载中...',
    noMore: '没有更多了',
    filter: {
      dest: '目的地',
      days: '出行天数',
      type: '团型',
      price: '价格区间',
      all: '全部'
    },
    daysOptions: ['全部', '1-3天', '4-6天', '7天及以上'],
    priceOptions: ['全部', '3000元以下', '3000-5000元', '5000-8000元', '8000元以上'],
    headerTitle: '呼伦贝尔私享线路',
    slogan: '随走随停，专属你的草原旅程',
    cats: ['全部线路', '夏日草原', '阿尔山秋线', '冬季雪原', '亲子私旅', '小众秘境'],
    moreLabel: '更多筛选',
    moreFold: '收起',
    moreGroups: {
      days: '出行天数',
      dest: '目的地',
      type: '团型'
    },
    customTitle: '不知道选哪条线路？',
    customDesc: '可以联系我们定制专属行程',
    customBtn: '定制专属行程',
    journalLink: '看看其他游客的旅途记录',
    emptyCategory: '该分类下暂无线路',
    lazyHint: ''
  },

  // 线路详情
  detail: {
    title: '线路详情',
    highlight: '行程亮点',
    itinerary: '每日行程安排',
    dayPerk: '今日专属体验',
    dayStay: '当日住宿',
    dayMeal: '当日美食',
    dayTip: '贴心提示',
    feeInclude: '费用包含',
    feeExclude: '费用不含',
    notice: '出行须知',
    refund: '退改政策',
    refPrice: '行程参考价格',
    consultBook: '预约定制咨询',
    baseInfo: ['总天数', '适宜人群', '行程节奏', '出行季节'],
    noticeItems: ['注意事项', '装备建议', '退改规则'],
    favorite: '收藏',
    favorited: '已收藏',
    consult: '立即咨询',
    dayLabel: '第',
    dayUnit: '天',
    meals: '用餐',
    hotel: '住宿',
    spots: '游玩景点',
    scene: '当日行程'
  },

  // 攻略
  strategy: {
    title: '旅行攻略',
    searchPlaceholder: '搜索攻略关键词',
    empty: '暂无攻略',
    all: '全部',
    cats: ['穿搭指南', '季节出行', '避坑攻略', '目的地介绍'],
    readMore: '阅读全文',
    publishLabel: '发布时间'
  },

  // 个人中心
  mine: {
    title: '我的',
    notLogin: '未登录',
    loginTip: '点击授权微信获取头像昵称',
    loginBtn: '微信授权登录',
    avatarBtn: '选择头像',
    nicknamePlaceholder: '点击填写昵称',
    confirmSave: '保存资料',
    saved: '资料已保存',
    menu: {
      workbench: '员工工作台',
      myTrips: '我的行程',
      consults: '我的咨询记录',
      orders: '我的订单',
      contact: '联系我们',
      about: '关于旅行社',
      staffBind: '员工绑定'
    },
    phoneLabel: '客服电话',
    callNow: '点击拨打'
  },

  // 咨询弹窗
  modal: {
    title: '获取定制方案',
    name: '姓名',
    phone: '手机号码',
    people: '出行人数',
    date: '计划出行日期',
    remark: '需求备注',
    required: '*',
    namePlaceholder: '请输入您的姓名',
    phonePlaceholder: '请输入11位手机号码',
    peoplePlaceholder: '如：2大1小',
    remarkPlaceholder: '补充您的需求（选填）',
    submit: '提交',
    success: '提交成功！顾问会尽快联系您',
    nameError: '请填写姓名',
    phoneError: '请输入正确的手机号码',
    close: '关闭'
  },

  // 订单
  order: {
    title: '我的订单',
    tabs: ['全部', '待确认', '已完成', '已取消'],
    empty: '暂无订单',
    status: {
      pending: '待确认',
      done: '已完成',
      cancelled: '已取消'
    },
    again: '再次咨询',
    people: '出行人数',
    date: '出行日期',
    amount: '订单金额'
  },

  // 收藏 / 咨询记录
  favorites: { title: '我的收藏', empty: '暂无收藏，快去挑选心仪的线路吧' },
  consults: { title: '我的咨询记录', empty: '暂无咨询记录' },

  // 酒店
  hotels: {
    title: '酒店预订',
    subtitle: '精选草原沿线住宿',
    perNight: '起 / 晚',
    score: '分',
    book: '预订咨询',
    empty: '暂无酒店'
  },

  // 酒店详情
  hotelDetail: {
    consult: '咨询定制',
    envTitle: '酒店环境',
    roomTitle: '房型特色',
    locTitle: '周边位置',
    facTitle: '配套设施',
    priceTitle: '分时段价格'
  },

  // 租车
  cars: {
    title: '车辆租车',
    subtitle: '草原自驾 · 商务接站 · 越野包车',
    perDay: '起 / 天',
    rent: '租车咨询',
    seat: '座位',
    empty: '暂无可用车辆',
    withDriver: '含司机可选',
    selfDrive: '支持自驾'
  },

  // 景区列表
  scenic: {
    title: '呼伦贝尔景区',
    subtitle: '按目的地查看热门景区',
    all: '全部',
    visit: '去逛逛',
    empty: '该分类下暂无景区'
  },

  // 景区详情
  scenicDetail: {
    descTitle: '景区介绍',
    durationLabel: '游玩时长建议',
    seasonLabel: '最佳游玩季节',
    tipsLabel: '注意事项'
  },

  // 私人定制
  custom: {
    title: '私人定制行程',
    subtitle: '自由搭配每天景区与酒店，定制您的专属草原之旅',
    base: '基础信息',
    daysLabel: '行程天数',
    days: ['3天', '5天', '7天', '自定义'],
    daysUnit: '天',
    customDaysPlaceholder: '输入天数',
    dateLabel: '出行日期',
    datePlaceholder: '请选择出行日期',
    peopleLabel: '出行人数',
    adult: '成人',
    child: '儿童',
    dayPlanLabel: '每日行程安排',
    tips: '按住序号拖动排序，或用上移 / 下移调整',
    scenicTitle: '当日景区',
    addScenic: '选择景区',
    scenicEmpty: '还没有选择景区，点击添加',
    hotelTitle: '当日酒店',
    addHotel: '选择酒店',
    hotelEmpty: '还未选择酒店',
    hotelAltTitle: '或以下同等级酒店：',
    sheetAltTitle: '选择同等级酒店',
    altEmpty: '该地点暂无其他同等级酒店',
    noteTitle: '当日备注',
    notePlaceholder: '写下当天的特殊需求，如想看日落、想体验骑马、想品尝特色餐…',
    summaryScenic: '已选景区',
    summaryHotel: '已选酒店',
    submit: '提交定制咨询',
    sheetScenicTitle: '选择景区',
    sheetHotelTitle: '选择酒店',
    sheetConfirm: '完成',
    sheetCancel: '取消',
    selected: '已选',
    remove: '移除',
    up: '上移',
    down: '下移',
    formTitle: '提交定制咨询',
    name: '姓名',
    phone: '手机号码',
    wechat: '微信号',
    namePlaceholder: '请输入您的姓名',
    phonePlaceholder: '请输入11位手机号码',
    wechatPlaceholder: '请输入微信号（选填）',
    submitBtn: '提交',
    nameError: '请填写姓名',
    phoneError: '请输入正确的手机号码',
    success: '提交成功！定制顾问将在1小时内联系您',
    close: '关闭',
    generateBtn: '生成我的专属行程',
    coverTitle: '行程封面',
    coverRequired: '封面（第一张，必填）',
    coverPick: '从私人定制封面选择',
    coverUpload: '上传封面',
    coverSlotHint: '行程封面',
    coverSlotUpload: '上传客人看到的第一张',
    coverSlotPick: '从私人定制封面库选择',
    coverEmpty: '请上传或选择封面。封面只来自私人定制封面，不能用景区或酒店图。',
    metaDays: '总天数',
    metaPeople: '适宜人群',
    metaPace: '行程节奏',
    metaSeason: '出行季节',
    metaAudienceDefault: '大众休闲 · 全家皆宜',
    metaPaceDefault: '节奏轻快',
    coverMiss: '请先上传封面图',
    coverSheet: '选择私人定制封面',
    promoTitle: '当日宣传图',
    promoHint: '选填，每天最多 2 张',
    promoAdd: '插入宣传图',
    promoUpload: '上传宣传图',
    promoSlotHint: '当日宣传图',
    promoSlotUpload: '上传当天行程配图',
    promoSlotPick: '从酒店 / 景区图库插入',
    carTitle: '用车车型',
    addCar: '选择车型',
    carEmpty: '未选择车型（城市SUV / 越野 / 7-22座商务车）',
    sheetCarTitle: '选择车型',
    promoFull: '当天最多 2 张宣传图',
    promoSheet: '选择宣传图',
    editHint: '生成后仍可返回修改人数、封面和每天的宣传图'
  },

  // 专属行程预览
  customPreview: {
    heroTitle: '你的专属呼伦贝尔',
    heroTitleSuffix: '天行程',
    slogan: '雪落北疆，把一整季的温柔留给你。',
    dayUnit: '天',
    hotelLabel: '当日住宿',
    hotelAltTitle: '或以下同等级酒店：',
    noteLabel: '行程备注',
    noScenic: '自由安排',
    saveBtn: '保存到我的行程',
    editBtn: '修改行程',
    priceLabel: '行程总价',
    guestTotalLabel: '总价',
    pricePending: '待核算',
    saveSuccess: '行程已保存至【我的行程】',
    saveUpdated: '行程已更新',
    tipsTitle: '温馨提示',
    travel: {
      banner: '本方案为您的自助行程规划，具体安排与报价可由旅行顾问根据出行时间、人数为您微调优化。',
      include: [
        '车辆：全程 SUV / 商务车独立用车，含油费与过路费',
        '住宿：行程内标注的精选住宿',
        '服务：熟悉草原路线的司机兼向导全程服务',
        '保障：全程旅行意外险'
      ],
      exclude: [
        '往返呼伦贝尔的大交通（机票 / 火车票）',
        '行程未标注的用餐及个人餐饮消费',
        '景区内自费项目与个人购物支出',
        '单房差及升级房型差价'
      ],
      tips: [
        '草原昼夜温差大，即使夏季也请备一件薄外套',
        '呼伦贝尔盛夏多阵雨，建议随身携带雨具',
        '全程为半自由行，游览时间可与司机协商微调',
        '请携带身份证原件，儿童携带户口本（国门等景区需查验）'
      ],
      gear: ['防晒霜 / 墨镜 / 遮阳帽', '薄羽绒或冲锋衣（早晚穿着）', '舒适防滑运动鞋', '驱蚊水 / 充电宝'],
      refund: [
        '出行前 15 天以上取消，全额退款',
        '出行前 7-14 天取消，收取 20% 损失费',
        '出行前 7 天内取消，收取 50% 损失费；出行当日取消不退款'
      ]
    }
  },

  // 我的行程
  myTrips: {
    title: '我的行程',
    daysUnit: '天',
    empty: '暂无自定义行程，去创建你的专属旅行计划',
    emptyDesc: '在“私人定制行程”页点击【保存到我的行程】，这里会收藏你的专属旅途',
    emptyBtn: '去创建我的行程',
    del: '删除',
    delConfirm: '确定要删除这条自定义行程吗？删除后无法恢复',
    cancel: '取消',
    confirm: '确认删除'
  },

  // 灵感广场
  square: {
    title: '灵感广场',
    daysUnit: '天',
    cats: ['全部', '行程方案', '旅行笔记', '私家团', '亲子游', '秋季线', '冬季线'],
    all: '全部',
    typePlan: '行程方案',
    typeNote: '旅行笔记',
    likes: '赞',
    empty: '该分类下暂无内容'
  },

  // 行程分享详情
  shareDetail: {
    daysUnit: '天',
    highlight: '行程亮点',
    timeline: '每日行程',
    dayLabel: '第',
    dayUnit: '天',
    scenicLabel: '当日景区',
    hotelLabel: '当日酒店',
    noteLabel: '当日备注',
    like: '点赞',
    liked: '已赞',
    fav: '收藏',
    faved: '已收藏',
    customCta: '照此方案定制'
  },

  // 发布行程分享
  sharePublish: {
    title: '发布灵感',
    modePlan: '发布行程方案',
    modeNote: '发布旅行笔记',
    coverPlaceholder: '添加行程封面图',
    titleLabel: '行程标题',
    titlePlaceholder: '比如「5天4晚呼伦贝尔秋季亲子线」',
    introLabel: '行程简介',
    introPlaceholder: '简单介绍这份行程的亮点',
    daysLabel: '行程天数',
    seasonLabel: '出行季节',
    seasons: ['夏季草原', '秋季阿尔山', '冬季雪景'],
    dayPlanTitle: '每日行程',
    scenicTitle: '当日景区',
    addScenic: '选择景区',
    addHotelShort: '选择酒店',
    scenicEmpty: '还没选择景区，点击上方按钮添加',
    hotelTitle: '当日酒店',
    hotelEmpty: '还未选择酒店',
    noteTitle: '当日备注',
    notePlaceholder: '写下当天的安排与建议…',
    sheetScenicTitle: '选择景区',
    sheetHotelTitle: '选择酒店',
    sheetConfirm: '完成',
    remove: '移除',
    publishBtn: '发布',
    publishFail: '请先填写行程标题',
    success: '发布成功',
    noteImagesLabel: '旅途随拍',
    noteAddImage: '添加图片',
    noteTitleLabel: '笔记标题',
    noteTitlePlaceholder: '一句话说主题，比如「草原日落随拍」',
    noteContentLabel: '游记正文',
    noteContentPlaceholder: '写下旅途感受、沿途见闻、美食与避坑心得…',
    noteTagLabel: '内容标签',
    noteTags: ['呼伦贝尔草原', '阿尔山', '满洲里', '亲子瞬间', '自驾随拍', '美食探店', '住宿体验', '避坑指南'],
    noteFail: '请先填写笔记标题',
    noteImageFail: '旅行笔记请至少添加一张图片'
  },

  // 旅行笔记详情
  noteDetail: {
    day: '发布于',
    contentTitle: '游记',
    photosTitle: '旅途随拍',
    like: '点赞',
    liked: '已赞',
    fav: '收藏',
    faved: '已收藏'
  },

  // 关于页
  about: {
    title: '关于旅行社',
    contactTitle: '联系我们',
    phoneLabel: '客服电话',
    wechatLabel: '微信号',
    addressLabel: '公司地址',
    copyWechat: '复制微信号',
    copied: '已复制',
    callBtn: '电话咨询'
  }
};

module.exports = copy;
