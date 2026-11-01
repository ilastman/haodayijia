/** 与 utils/clause.js 的 DEFAULTS 保持一致。改文案时两处一起改。 */
module.exports = [
  {
    id: 'clause_include_std', kind: 'include', name: '标准费用包含', enabled: true, sort: 1,
    lines: [
      '车辆：全程 SUV / 商务车独立用车，含油费与过路费',
      '住宿：行程内标注的精选住宿',
      '服务：熟悉草原路线的司机兼向导全程服务',
      '保障：全程旅行意外险'
    ]
  },
  {
    id: 'clause_exclude_std', kind: 'exclude', name: '标准费用不含', enabled: true, sort: 1,
    lines: [
      '往返呼伦贝尔的大交通（机票 / 火车票）',
      '行程未标注的用餐及个人餐饮消费',
      '景区内自费项目与个人购物支出',
      '单房差及升级房型差价'
    ]
  },
  {
    id: 'clause_notice_std', kind: 'notice', name: '标准出行须知', enabled: true, sort: 1,
    tips: [
      '草原昼夜温差大，即使夏季也请备一件薄外套',
      '呼伦贝尔盛夏多阵雨，建议随身携带雨具',
      '全程为半自由行，游览时间可与司机协商微调',
      '请携带身份证原件，儿童携带户口本（国门等景区需查验）'
    ],
    gear: ['防晒霜 / 墨镜 / 遮阳帽', '薄羽绒或冲锋衣（早晚穿着）', '舒适防滑运动鞋', '驱蚊水 / 充电宝']
  },
  {
    id: 'clause_refund_std', kind: 'refund', name: '标准退改政策', enabled: true, sort: 1,
    lines: [
      '出行前 15 天以上取消，全额退款',
      '出行前 7-14 天取消，收取 20% 损失费',
      '出行前 7 天内取消，收取 50% 损失费；出行当日取消不退款'
    ]
  }
];
