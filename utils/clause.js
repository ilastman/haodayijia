/**
 * 专属行程底部四段说明的模板。
 * 云端 clauseTemplate 为空或未部署时，用这里的默认模板，文案与原先写死的 copy.customPreview.travel 一致。
 * 行程上保存的是快照（templateId + 正文），后台以后改模板不会改写已生成的行程。
 */

const KINDS = [
  { kind: 'include', title: '费用包含' },
  { kind: 'exclude', title: '费用不含' },
  { kind: 'notice', title: '出行须知' },
  { kind: 'refund', title: '退改政策' }
];

const DEFAULTS = [
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

function copyTpl(t) {
  return {
    id: t.id,
    kind: t.kind,
    name: t.name,
    enabled: t.enabled !== false,
    sort: Number(t.sort) || 0,
    lines: (t.lines || []).slice(),
    tips: (t.tips || []).slice(),
    gear: (t.gear || []).slice()
  };
}

function defaults() {
  return DEFAULTS.map(copyTpl);
}

function cleanList(list) {
  return (Array.isArray(list) ? list : []).map(x => String(x || '').trim()).filter(Boolean);
}

function snapshot(tpl) {
  if (!tpl) return null;
  const base = { templateId: tpl.id || '', name: tpl.name || '', kind: tpl.kind || '' };
  if (tpl.kind === 'notice') {
    return Object.assign(base, { tips: cleanList(tpl.tips), gear: cleanList(tpl.gear) });
  }
  return Object.assign(base, { lines: cleanList(tpl.lines) });
}

function emptyClauses() {
  const out = {};
  defaults().forEach(t => { out[t.kind] = snapshot(t); });
  return out;
}

function normalizeClauses(raw) {
  const base = emptyClauses();
  const src = raw && typeof raw === 'object' ? raw : {};
  KINDS.forEach(k => {
    const item = src[k.kind];
    if (!item || typeof item !== 'object') return;
    if (k.kind === 'notice') {
      const tips = cleanList(item.tips);
      const gear = cleanList(item.gear);
      if (!tips.length && !gear.length && !item.templateId) return;
      base.notice = {
        templateId: item.templateId || '',
        name: item.name || base.notice.name,
        kind: 'notice',
        tips: tips.length ? tips : base.notice.tips,
        gear: gear.length ? gear : base.notice.gear
      };
      return;
    }
    const lines = cleanList(item.lines);
    if (!lines.length && !item.templateId) return;
    base[k.kind] = {
      templateId: item.templateId || '',
      name: item.name || base[k.kind].name,
      kind: k.kind,
      lines: lines.length ? lines : base[k.kind].lines
    };
  });
  return base;
}

function previewLines(snap) {
  if (!snap) return [];
  if (snap.kind === 'notice') return cleanList(snap.tips).concat(cleanList(snap.gear));
  return cleanList(snap.lines);
}

function cards(clauses) {
  const src = normalizeClauses(clauses);
  return KINDS.map(k => {
    const snap = src[k.kind];
    return {
      kind: k.kind,
      title: k.title,
      name: snap.name || '选择模板',
      preview: previewLines(snap).slice(0, 3)
    };
  });
}

function view(raw) {
  const src = normalizeClauses(raw);
  return {
    include: src.include.lines,
    exclude: src.exclude.lines,
    tips: src.notice.tips,
    gear: src.notice.gear,
    refund: src.refund.lines,
    names: {
      include: src.include.name,
      exclude: src.exclude.name,
      notice: src.notice.name,
      refund: src.refund.name
    }
  };
}

module.exports = {
  KINDS, defaults, snapshot, emptyClauses, normalizeClauses, previewLines, cards, view, cleanList
};
