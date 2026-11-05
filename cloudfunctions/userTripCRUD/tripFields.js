/**
 * 行程计费日的存取。纯函数，供 userTripCRUD 与单测使用。
 * 不存金额。carUseCustom=false 表示跟行程每一天（旧数据）。
 * 空数组表示明确 0 天，不能写成「没这个字段」。
 */
const CAR_OFFSET_MAX = 45;

function packStoredCarUse(d) {
  if (!d || typeof d !== 'object') return null;
  const has = d.carUseCustom !== undefined || Array.isArray(d.carUseOffsets);
  if (!has) return null;
  const custom = d.carUseCustom === true || d.carUseCustom === 'true' || d.carUseCustom === 1
    || (d.carUseCustom === undefined && Array.isArray(d.carUseOffsets));
  if (!custom) return { carUseCustom: false, carUseOffsets: null };
  const seen = {};
  const offsets = [];
  (Array.isArray(d.carUseOffsets) ? d.carUseOffsets : []).forEach(x => {
    const n = parseInt(x, 10);
    if (isNaN(n) || n < 0 || n > CAR_OFFSET_MAX || seen[n]) return;
    seen[n] = 1;
    offsets.push(n);
  });
  offsets.sort((a, b) => a - b);
  return { carUseCustom: true, carUseOffsets: offsets };
}

/* 分享读取：去掉内部金额和员工备注，保留计费日与行程正文。 */
function toPublicTrip(doc) {
  const d = Object.assign({}, doc || {});
  delete d._id;
  delete d._openid;
  delete d.openid;
  delete d.quote;
  delete d.internalQuote;
  delete d.staffRemark;
  delete d.carCostOverride;
  return d;
}

module.exports = { packStoredCarUse, toPublicTrip, CAR_OFFSET_MAX };
