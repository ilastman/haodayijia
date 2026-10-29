/* ============================================================
 * 酒店「横向多档期」表解析（纯函数，无副作用，浏览器 + Node 通用）
 * - 日期档期文本解析：parsePeriod / splitPeriodText
 * - 区间价解析：parsePriceRange
 * - 雪季年份推断：resolveSeasonYear
 * - 横向块表解析：parseHotelBlocks(aoa, merges, opts)
 * 依赖：无（不依赖 window / XLSX）
 * ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HotelImport = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  const FULLYEAR_RE = /(\d{4})/;            /* 4 位年份 */
  const SHORTYEAR_RE = /(?:^|[^\d])(\d{2})\s*年/; /* 2 位年份 + 年 */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isNum(v) { return v !== '' && v != null && !isNaN(Number(v)); }

  /* 0 基列号 -> A、B ... AA */
  function colLetter(c) {
    let s = '';
    c = Math.max(0, parseInt(c, 10) || 0);
    do { s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26) - 1; } while (c >= 0);
    return s;
  }
  /* 0 基 (r,c) -> A2 单元格引用 */
  function cellRef(r, c) { return colLetter(c) + (r + 1); }

  /* 合并区展开：把每个合并区的左上值填充到区内所有坐标 -> Map("r,c" -> value) */
  function expandMerges(aoa, merges) {
    const map = {};
    (merges || []).forEach(m => {
      const sr = m && m.s ? m.s.r : null, sc = m && m.s ? m.s.c : null;
      const er = m && m.e ? m.e.r : null, ec = m && m.e ? m.e.c : null;
      if (sr == null || sc == null || er == null || ec == null) return;
      const v = (aoa[sr] && aoa[sr][sc] != null) ? aoa[sr][sc] : '';
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) { map[r + ',' + c] = v; }
      }
    });
    return map;
  }

  /* ================= 区间价 ================= */
  /* "680-775" -> {price:680, priceMin:680, priceMax:775, priceRaw:"680-775"}
   * "3000"    -> {price:3000,...}
   * "免费"/空/无数字 -> null
   * 说明：纯数字或 数字-数字（含全角/波浪号 ~ ～ -）。取区间较低值作为核价 price。 */
  function parsePriceRange(text) {
    const raw = String(text == null ? '' : text).trim();
    if (raw === '') return null;
    const nums = raw.match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return null;
    const list = nums.map(Number).filter(n => !isNaN(n));
    if (!list.length) return null;
    const min = Math.min.apply(null, list);
    const max = Math.max.apply(null, list);
    return { price: min, priceMin: min, priceMax: max, priceRaw: raw };
  }

  /* ================= 日期档期 ================= */
  /* 一段档期文本 -> {start,end} | {fuzzy:true, raw} | null
   * 支持：
   *   "11.1-11.15"、"12.1-2.20"       （简写，可跨年）
   *   "26年12月11日-27年02月5日"       （全写带年份）
   *   "10月6日-11月31日"、"1.1-2.28"
   * 说明：仅解析单段（不含换行/多段）；模糊（无日）返回 fuzzy。
   */
  function parseSinglePeriod(text) {
    const s = String(text == null ? '' : text).trim();
    if (s === '') return null;
    /* 去空格与多余符号 */
    const t = s.replace(/\s+/g, '').replace(/[～~—–－]/g, '-').replace(/[．。]/g, '.');
    /* 模糊：含「上旬/中旬/下旬/月中/月底」等无日写法 */
    const isFuzzyWord = /[上中下]\s*旬|月(中|初|底)$/.test(t);
    /* 全写带年份日期：26年12月11日-27年02月5日 / 2026年12月11日 */
    const fullRe = /(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g;
    const fulls = [];
    let fm;
    while ((fm = fullRe.exec(t)) !== null) {
      fulls.push({ y: Number(fm[1]), m: Number(fm[2]), d: Number(fm[3]) });
    }
    if (fulls.length >= 2) {
      const a = normYMD(fulls[0].y, fulls[0].m, fulls[0].d);
      const b = normYMD(fulls[1].y, fulls[1].m, fulls[1].d);
      if (a && b) return { start: a, end: b, raw: s };
      return null;
    }
    if (fulls.length === 1) {
      const a = normYMD(fulls[0].y, fulls[0].m, fulls[0].d);
      if (a) return { start: a, end: a, raw: s };
      return null;
    }
    /* 简写区间 M.D-M.D（可跨年），兼容「10月6日-11月31日」的月日无年写法 */
    const mdRe = /(\d{1,2})\s*[.\/月]\s*(\d{1,2})\s*日?/g;
    const mds = [];
    let mm;
    while ((mm = mdRe.exec(t)) !== null) {
      const mo = Number(mm[1]), dd = Number(mm[2]);
      if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) mds.push({ m: mo, d: dd });
    }
    if (mds.length >= 2) {
      return { _start: mds[0], _end: mds[1], raw: s }; /* 无年份，待补全 */
    }
    if (mds.length === 1) {
      /* 形如 "2.7-11"：结束为裸日号，月份同起点 */
      const tail = /[-~]([0-9]{1,2})$/.exec(t);
      if (tail) {
        const d2 = Number(tail[1]);
        if (d2 >= 1 && d2 <= 31) return { _start: mds[0], _end: { m: mds[0].m, d: d2 }, raw: s };
      }
      return { _start: mds[0], _end: null, raw: s, _single: true };
    }
    if (isFuzzyWord) return { fuzzy: true, raw: s };
    /* 纯月份数字（如 "11"、"12"）或中文档期名（如 "春节"）-> 模糊档期 */
    if (/^\d{1,2}$/.test(t) || /[\u4e00-\u9fa5A-Za-z]/.test(t)) return { fuzzy: true, raw: s };
    return null;
  }

  function normYMD(y, m, d) {
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
    if (y < 100) y = 2000 + y; /* 26 -> 2026 */
    /* 用 Date 校验真实存在（含闰年） */
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  /* 把一个「日期列头」单元格文本拆成多段（支持换行 / 多段空格分隔）
   * 返回原始段字符串数组（不含空段）。 */
  function splitPeriodText(text) {
    const s = String(text == null ? '' : text);
    return s.split(/[\n\r]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .reduce((acc, seg) => {
        /* 一段里可能含 "11.16-11.30 2.21-3.31"（空格隔开两个区间） */
        const parts = splitInlinePeriods(seg);
        return acc.concat(parts);
      }, []);
  }
  /* 在同一段文本里切多个档期：仅当出现 ≥2 个 "起-止" 结构时才按空格切 */
  function splitInlinePeriods(seg) {
    const s = seg.trim();
    if (!s) return [];
    /* 统计区间数量：M.D-M.D 或 年月日 出现次数 */
    const dashCount = (s.match(/[0-9]\s*[-~～—–－]\s*[0-9]/g) || []).length;
    if (dashCount >= 2) {
      /* 按空格切，再两两配对：把 "a-b c-d" 拆成 "a-b"、"c-d" */
      const tokens = s.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) return tokens;
    }
    return [s];
  }

  /* 已带年份的区间若跨年，按 12.31 / 1.1 拆成多段 */
  function splitDatedRange(start, end, raw) {
    const s = String(start || '');
    const e = String(end || '');
    const sm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const em = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e);
    if (!sm || !em) return [];
    const y1 = Number(sm[1]), y2 = Number(em[1]);
    if (y2 <= y1) return [{ start: s, end: e, raw: raw || '' }];
    const out = [{ start: s, end: y1 + '-12-31', raw: raw || '' }];
    for (let y = y1 + 1; y < y2; y++) out.push({ start: y + '-01-01', end: y + '-12-31', raw: raw || '' });
    out.push({ start: y2 + '-01-01', end: e, raw: raw || '' });
    return out;
  }

  /* 年份归属（导入当天所在年 = 今年）：
   * - 档期内月日都在今年剩余时段（≥ 今天且 ≤ 12.31）→ 今年
   * - 起始月日已过、或落在次年（1.1 起，等价于大于 12.31）→ 明年
   * - 起始月日 > 结束月日（如 12.20-2.06）→ 跨年，拆成 今年12.20~12.31 + 明年1.1~2.06 */
  function expandPeriodByYear(part, now) {
    if (!part) return [];
    if (part.fuzzy) return [{ fuzzy: true, raw: part.raw || '' }];
    if (part.start && part.end && !part._start) return splitDatedRange(part.start, part.end, part.raw);
    const a = part._start;
    const b = part._end || part._start;
    if (!a) return [];
    const d = now || new Date();
    const yThis = d.getFullYear();
    const yNext = yThis + 1;
    const todayOrd = (d.getMonth() + 1) * 100 + d.getDate();
    const startOrd = a.m * 100 + a.d;
    const endOrd = b.m * 100 + b.d;
    const crosses = !!(part._end && startOrd > endOrd);
    if (crosses) {
      const s1 = normYMD4(yThis, a.m, a.d);
      const e1 = normYMD4(yThis, 12, 31);
      const s2 = normYMD4(yNext, 1, 1);
      const e2 = normYMD4(yNext, b.m, b.d);
      const out = [];
      if (s1 && e1) out.push({ start: s1, end: e1, raw: part.raw || '' });
      if (s2 && e2) out.push({ start: s2, end: e2, raw: part.raw || '' });
      return out;
    }
    const year = startOrd >= todayOrd ? yThis : yNext;
    const start = normYMD4(year, a.m, a.d);
    const end = normYMD4(year, b.m, b.d);
    if (!start || !end) return [];
    return [{ start, end, raw: part.raw || '' }];
  }

  /* 用雪季基准年补全无年份简写档期（旧逻辑，单段不拆年）
   * seasonYear = 雪季起始年（如 2026 表示 2026-11-01 ~ 2027-04-30）
   * 归属：若结束月 < 起始月（跨年）或开始月 >= 11 视为该雪季起始年，否则次年。
   * 实际：以起始月判断——月 >= 11 用 seasonYear；月 <= 4 用 seasonYear+1；
   *       其余（5-10，非雪季）用 seasonYear。
   * 跨年：若 end.m < start.m，则 end 年份 = start 年份 + 1。 */
  function completePeriod(part, seasonYear) {
    if (!part) return null;
    if (part.fuzzy) return { fuzzy: true, raw: part.raw };
    if (part.start && part.end && !part._start) return part;
    const sy = seasonYear || currentSeasonYear(new Date());
    const a = part._start;
    const b = part._end || part._start;
    if (!a) return null;
    const y1 = (a.m >= 11) ? sy : (a.m <= 4 ? sy + 1 : sy);
    let y2 = (b.m >= 11) ? sy : (b.m <= 4 ? sy + 1 : sy);
    /* 同段内跨年：结束月 < 开始月 -> 结束年 = 开始年 + 1 */
    if (part._end && b.m < a.m) y2 = y1 + 1;
    if (part._end && b.m >= a.m && y2 < y1) y2 = y1;
    const start = normYMD4(y1, a.m, a.d);
    const end = normYMD4(y2, b.m, b.d);
    if (!start || !end) return null; /* 无法补全 -> 视为异常，不静默转模糊 */
    return { start, end, raw: part.raw };
  }

  function normYMD4(y, m, d) {
    if (!(y >= 1900 && y <= 2999) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  /* 当前日期所属雪季起始年：>= 11 月 -> 当年；<= 4 月 -> 去年；中间月取最近起始（按当前年） */
  function currentSeasonYear(now) {
    const d = now || new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    if (m >= 11) return y;
    if (m <= 4) return y - 1;
    return y; /* 非雪季月份：以当年为基准（兜底） */
  }

  /* 从全部原始档期文本中推断雪季基准年
   * - 若出现明确年份（如 26年 / 2026），取「最小年份」作为基准
   * - 否则用导入当天所属雪季
   * items: 原始文本数组 */
  function resolveSeasonYear(items, now) {
    let base = null;
    (items || []).forEach(txt => {
      const s = String(txt == null ? '' : txt);
      let m;
      const re4 = /(\d{4})\s*年/g;
      while ((m = re4.exec(s)) !== null) {
        const y = Number(m[1]);
        if (y >= 1900 && y <= 2999 && (base === null || y < base)) base = y;
      }
      const re2 = /(?:^|[^\d])(\d{2})\s*年/g;
      while ((m = re2.exec(s)) !== null) {
        const y = 2000 + Number(m[1]);
        if (base === null || y < base) base = y;
      }
    });
    if (base !== null) {
      /* 归一化到雪季起始年：若最小年份落在 1-4 月所属（如 27年2月），雪季起始年应为 26 */
      return normalizeSeasonBase(base);
    }
    return currentSeasonYear(now);
  }

  /* 明确年份可能是「档期内的任一年份」，这里只做保守处理：
   * 若基准年份对应 1-4 月的档期，其雪季起始年为 base-1；这里无法判断月份，
   * 因此调用方应传入「已解析出的 start/end」来更精确推断。保留简单实现。 */
  function normalizeSeasonBase(y) { return y; }

  /* 块首行文本是否「像日期档期列」：能解析为档期，或含明显日期/中文档期特征 */
  function looksLikeDateHeader(text) {
    const s = String(text == null ? '' : text).trim();
    if (s === '') return false;
    /* 明确的中文档期词 */
    if (/[上中下]\s*旬|月(中|初|底)|春节|元旦|国庆|寒假|雪季/.test(s)) return true;
    /* 明确的区间结构（含年份或 M.D-M.D / M月D日-M月D日） */
    if (/\d{2,4}\s*年\s*\d{1,2}\s*月/.test(s)) return true;
    if (/\d{1,2}\s*[.\/月]\s*\d{1,2}\s*日?\s*[-~～—–－]\s*\d{1,2}/.test(s)) return true;
    /* 单段裸月份/日号（如 "11"、"11月中"）不单独作为判据，避免「4.9 评分」误判 */
    return false;
  }

  /* 表头归一化：去 BOM、去【】（）提示、去空白 */
  function normHeader(s) {
    return String(s == null ? '' : s)
      .replace(/^\uFEFF/, '')
      .replace(/[【（(\[][^】）)\]]*[】）)\]]/g, '')
      .replace(/[\s\u3000]+/g, '')
      .trim();
  }

  /* 表头列角色：基础信息 / 开始日期 / 结束日期 / 售价 / 日期区间列头 */
  function classifyHeader(text) {
    const n = normHeader(text);
    if (!n) return 'empty';
    if (/酒店名称|^酒店名$|^名称$|^店名$/.test(n)) return 'name';
    /* 地区 = 二级分类，优先于「区域」；两列同时存在时以地区/二级分类为准 */
    if (/二级分类|二级地区|所在地区|^地区$/.test(n)) return 'area';
    if (/所在区域|^区域$/.test(n)) return 'areaAlt';
    if (/一级分类|一级大区|一级地区|^分类$|大区/.test(n)) return 'regionLevel1';
    if (/携程钻级|星级|钻级|级别/.test(n) && !/^评分$/.test(n)) return 'level';
    if (/^房型/.test(n)) return 'roomTypes';
    if (/配套设施|基础设施|^设施$/.test(n)) return 'facility';
    if (/经纬度|^坐标$/.test(n)) return 'location';
    if (/详细地址|^地址$/.test(n)) return 'address';
    if (/简介/.test(n)) return 'briefDesc';
    if (/^备注$/.test(n)) return 'remark';
    if (/早餐/.test(n)) return 'breakfast';
    if (/联系/.test(n)) return 'contact';
    if (/装修/.test(n)) return 'decorateYear';
    if (/^床型/.test(n)) return 'bedType';
    if (/开始日期|生效开始|档期开始|^开始$/.test(n)) return 'startDate';
    if (/结束日期|生效结束|档期结束|^结束$/.test(n)) return 'endDate';
    if (/对应售价|该区间售价|^售价$|^价格$|^房价$/.test(n)) return 'price';
    if (looksLikeDateHeader(text)) return 'dateCol';
    return 'other';
  }

  /* 钻级原文：兼容 level / star / levelText */
  function pickLevel(h) {
    if (!h) return '';
    const a = String(h.level == null ? '' : h.level).trim();
    if (a) return a;
    const b = String(h.star == null ? '' : h.star).trim();
    if (b) return b;
    return String(h.levelText == null ? '' : h.levelText).trim();
  }

  /* 四项唯一键：酒店名称 + 钻级级别 + 一级大区 + 地区 */
  function hotelIdentity(h) {
    return {
      name: String((h && (h.name || h.hotelName)) || '').trim(),
      level: pickLevel(h),
      regionLevel1: String((h && h.regionLevel1) || '').trim(),
      area: String((h && h.area) || '').trim()
    };
  }
  function hotelKey(h) {
    const id = hotelIdentity(h);
    return [id.name, id.level, id.regionLevel1, id.area].join('\u0001');
  }
  function stampPeriodHotel(dest, src) {
    const id = hotelIdentity(src);
    dest.hotelName = id.name || dest.hotelName || '';
    dest.level = id.level;
    dest.regionLevel1 = id.regionLevel1;
    dest.area = id.area;
    return dest;
  }

  /* 同一四项键的多行（一行一房型）归成一家，房型/床型追加 */
  function collapseHotels(hotels) {
    const by = {};
    const order = [];
    (hotels || []).forEach(h => {
      const id = hotelIdentity(h);
      if (!id.name) { order.push(h); return; }
      const k = hotelKey(h);
      if (!by[k]) {
        by[k] = h;
        if (!Array.isArray(h.rooms)) h.rooms = [];
        order.push(k);
        return;
      }
      const base = by[k];
      const rooms = Array.isArray(base.rooms) ? base.rooms.slice() : [];
      const seen = {};
      rooms.forEach((r, i) => {
        const n = String((r && r.name) || '').trim();
        if (n) seen[n] = i;
      });
      (h.rooms || []).forEach(r => {
        const n = String((r && r.name) || '').trim();
        if (!n) return;
        if (seen[n] == null) {
          rooms.push({ name: n, bedType: String((r && r.bedType) || '').trim(), desc: String((r && r.desc) || '').trim(), img: (r && r.img) || '' });
          seen[n] = rooms.length - 1;
          return;
        }
        const cur = rooms[seen[n]];
        if (!String(cur.bedType || '').trim() && r.bedType) cur.bedType = r.bedType;
        if (!String(cur.desc || '').trim() && r.desc) cur.desc = r.desc;
        if (!String(cur.img || '').trim() && r.img) cur.img = r.img;
      });
      base.rooms = rooms;
      const extraRt = String((h && h.roomTypes) || '').trim();
      if (extraRt) {
        const curRt = String(base.roomTypes || '').trim();
        if (!curRt) base.roomTypes = extraRt;
        else if (curRt.indexOf(extraRt) < 0) base.roomTypes = curRt + ',' + extraRt;
      }
    });
    return order.map(x => (typeof x === 'string' ? by[x] : x));
  }

  function materializePeriods(rawPeriods, now, anomalies) {
    const periods = [];
    let fuzzyCount = 0;
    (rawPeriods || []).forEach(rp => {
      const segs = expandPeriodByYear(rp.part, now);
      if (!segs.length) {
        anomalies.push({
          hotelName: rp.hotelName,
          cell: rp.cell,
          msg: '档期无法解析：「' + (rp.part && rp.part.raw ? rp.part.raw : '') + '」，请人工确认'
        });
        return;
      }
      segs.forEach(done => {
        if (done.fuzzy) {
          fuzzyCount++;
          periods.push(stampPeriodHotel({
            hotelName: rp.hotelName, roomType: rp.roomType, bedType: rp.bedType,
            start: '', end: '', fuzzy: true, remark: done.raw || '', raw: done.raw || '',
            price: rp.price, priceMin: rp.priceMin, priceMax: rp.priceMax, priceRaw: rp.priceRaw,
            cell: rp.cell, _row: rp._row
          }, rp));
          return;
        }
        periods.push(stampPeriodHotel({
          hotelName: rp.hotelName, roomType: rp.roomType, bedType: rp.bedType,
          start: done.start, end: done.end, fuzzy: false, remark: '', raw: done.raw || '',
          price: rp.price, priceMin: rp.priceMin, priceMax: rp.priceMax, priceRaw: rp.priceRaw,
          cell: rp.cell, _row: rp._row
        }, rp));
      });
    });
    return { periods, fuzzyCount };
  }

  /* 必填四项；返回缺失项中文名，齐全则空数组 */
  function missingHotelFields(h) {
    const miss = [];
    const id = hotelIdentity(h);
    if (!id.name) miss.push('酒店名称');
    if (!id.level) miss.push('钻级级别');
    if (!id.regionLevel1) miss.push('一级大区');
    if (!id.area) miss.push('地区');
    return miss;
  }

  /* 表头列号：地区列优先于区域列；区域只作为地区的别名 */
  function indexBasicColumns(headerRow) {
    const map = {};
    const row = headerRow || [];
    for (let c = 0; c < row.length; c++) {
      const k = classifyHeader(row[c]);
      if (k === 'area') { map.area = c; continue; }
      if (k === 'areaAlt') { if (map.areaAlt == null) map.areaAlt = c; continue; }
      if (!k || k === 'empty' || k === 'other' || k === 'dateCol' || k === 'startDate' || k === 'endDate' || k === 'price' || k === 'roomTypes' || k === 'bedType') continue;
      if (map[k] == null) map[k] = c;
    }
    if (map.area == null && map.areaAlt != null) map.area = map.areaAlt;
    return map;
  }

  function dedupAnomalies(list) {
    const seen = {};
    const out = [];
    (list || []).forEach(a => {
      const k = (a.hotelName || '') + '|' + (a.cell || '') + '|' + (a.msg || '');
      if (seen[k]) return;
      seen[k] = 1;
      out.push(a);
    });
    return out;
  }

  /* 日期/售价解析失败只影响档期，不作为导入错误展示（解析函数本身仍会记 anomalies） */
  function isDateNoise(msg) {
    return /日期|档期无法解析|无法解析档期|售价无法解析|售价缺失/.test(String(msg || ''));
  }

  /* 导入门禁：缺酒店名称 / 钻级级别 / 一级大区 / 地区的酒店剔除，并丢掉其档期。档期解析结果原样保留。 */
  function gateHotelImport(res) {
    if (!res) return res;
    const anomalies = [];
    (res.anomalies || []).forEach(a => {
      if (!isDateNoise(a && a.msg)) anomalies.push(a);
    });
    const kept = [];
    const goodKeys = {};
    const namesToKeys = {};
    (res.hotels || []).forEach(h => {
      const miss = missingHotelFields(h);
      const name = String((h && h.name) || '').trim();
      if (miss.length) {
        anomalies.push({
          hotelName: name || '（未命名）',
          cell: (h && h._cell) || '',
          msg: '缺少必填项：' + miss.join('、') + '，已跳过该行'
        });
        return;
      }
      kept.push(h);
    });
    const collapsed = collapseHotels(kept);
    collapsed.forEach(h => {
      const name = String((h && h.name) || '').trim();
      const k = hotelKey(h);
      goodKeys[k] = 1;
      if (!namesToKeys[name]) namesToKeys[name] = [];
      namesToKeys[name].push(k);
    });
    const periods = (res.periods || []).filter(p => {
      const k = hotelKey({ name: p && p.hotelName, level: p && p.level, regionLevel1: p && p.regionLevel1, area: p && p.area });
      if (p && (p.level || p.regionLevel1 || p.area)) return !!goodKeys[k];
      const n = String((p && p.hotelName) || '').trim();
      return !!(namesToKeys[n] && namesToKeys[n].length);
    });
    const fuzzy = periods.filter(p => p.fuzzy).length;
    const dedup = dedupAnomalies(anomalies);
    return {
      format: res.format,
      seasonYear: res.seasonYear,
      hotels: collapsed,
      periods: periods,
      anomalies: dedup,
      stats: Object.assign({}, res.stats, {
        hotels: collapsed.length,
        periods: periods.length,
        anomalies: dedup.length,
        fuzzy: fuzzy
      })
    };
  }

  /* 单元格 -> yyyy-MM-dd；支持 yyyy-MM-dd、简写月日、Excel 序列、中文日期；无法解析返回 null */
  function parseDateCell(text, seasonYear) {
    const s = String(text == null ? '' : text).trim();
    if (s === '') return null;
    let m = /^(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/.exec(s);
    if (m) return normYMD4(Number(m[1]), Number(m[2]), Number(m[3]));
    m = /^(\d{2})年(\d{1,2})月(\d{1,2})/.exec(s.replace(/\s+/g, ''));
    if (m) return normYMD4(2000 + Number(m[1]), Number(m[2]), Number(m[3]));
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (n > 20000 && n < 80000) {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        epoch.setUTCDate(epoch.getUTCDate() + Math.floor(n));
        return normYMD4(epoch.getUTCFullYear(), epoch.getUTCMonth() + 1, epoch.getUTCDate());
      }
    }
    const part = parseSinglePeriod(s);
    if (!part || part.fuzzy) return null;
    if (part.start) return part.start;
    const done = completePeriod(part, seasonYear);
    if (done && done.start) return done.start;
    return null;
  }

  /* 当前横向表：表头含名称+钻级+地区+大区，且有房型或日期列 */
  function looksLikeCurrentWideHeader(aoa) {
    const rows = Array.isArray(aoa) ? aoa : [];
    let header = [];
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const row = rows[r] || [];
      if (row.some(cell => classifyHeader(cell) === 'name')) { header = row; break; }
    }
    const kinds = header.map(classifyHeader);
    const has = (k) => kinds.indexOf(k) >= 0;
    return has('name') && has('level') && (has('area') || has('areaAlt')) && has('regionLevel1') && (has('roomTypes') || has('dateCol'));
  }

  /* 是否「酒店块 + 下方房型行」旧版横向表。
   * 当前表 A-D 合并单元格也会产生多条纵向合并，不能再靠「纵向合并≥3」误判。 */
  function looksLikeBlockTable(aoa, merges) {
    const rows = Array.isArray(aoa) ? aoa : [];
    /* 当前横向表也会在酒店块里重复写「房型/床型」分行表头，不能据此走旧块表（旧块表 C_NAME=B 会把级别当成酒店名） */
    if (looksLikeCurrentWideHeader(aoa)) return false;
    for (let r = 1; r < rows.length; r++) {
      const texts = (rows[r] || []).map(x => String(x == null ? '' : x).replace(/\s+/g, ''));
      if (texts.indexOf('房型') >= 0 && texts.indexOf('床型') >= 0) return true;
    }
    const v = (merges || []).filter(m => m && m.s && m.e && m.e.r > m.s.r).length;
    return v >= 3;
  }
  function isRoomSectionHeader(roomTxt, bedTxt) {
    const a = String(roomTxt == null ? '' : roomTxt).replace(/\s+/g, '');
    const b = String(bedTxt == null ? '' : bedTxt).replace(/\s+/g, '');
    return a === '房型' && (b === '床型' || b === '');
  }

  function blankIdentity() {
    return { name: '', level: '', area: '', regionLevel1: '' };
  }
  function identityHasAny(id) {
    return !!(id && (id.name || id.level || id.area || id.regionLevel1));
  }
  /* 四项全空 → 整套读缓存；任一项有新内容 → 缓存换成当前行这 4 个值 */
  function takeIdentityCache(cur, cache) {
    const src = cur || blankIdentity();
    if (!identityHasAny(src)) {
      return { name: cache.name || '', level: cache.level || '', area: cache.area || '', regionLevel1: cache.regionLevel1 || '' };
    }
    cache.name = src.name || '';
    cache.level = src.level || '';
    cache.area = src.area || '';
    cache.regionLevel1 = src.regionLevel1 || '';
    return { name: cache.name, level: cache.level, area: cache.area, regionLevel1: cache.regionLevel1 };
  }
  function findIdentityCols(header) {
    const colOf = {};
    (header || []).forEach((cell, c) => {
      const k = classifyHeader(cell);
      if (k === 'area') colOf.area = c;
      else if (k === 'areaAlt') { if (colOf.areaAlt == null) colOf.areaAlt = c; }
      else if ((k === 'name' || k === 'level' || k === 'regionLevel1') && colOf[k] == null) colOf[k] = c;
    });
    if (colOf.area == null && colOf.areaAlt != null) colOf.area = colOf.areaAlt;
    return {
      name: colOf.name != null ? colOf.name : 0,
      level: colOf.level != null ? colOf.level : 1,
      area: colOf.area != null ? colOf.area : 2,
      regionLevel1: colOf.regionLevel1 != null ? colOf.regionLevel1 : 3
    };
  }
  function readIdentityAt(row, cols) {
    const at = (c) => String((row && row[c] != null) ? row[c] : '').trim();
    return {
      name: at(cols.name),
      level: at(cols.level),
      area: at(cols.area),
      regionLevel1: at(cols.regionLevel1)
    };
  }
  function writeIdentityAt(row, cols, id) {
    row[cols.name] = id.name;
    row[cols.level] = id.level;
    row[cols.area] = id.area;
    row[cols.regionLevel1] = id.regionLevel1;
  }

  /* 先展开合并单元格，再按「四项整套缓存」向下填充：全空用缓存，有新内容则整套更新 */
  function fillDownIdentity(aoa, merges) {
    const src = Array.isArray(aoa) ? aoa : [];
    const out = src.map(row => (row || []).slice());
    const mergeMap = expandMerges(src, merges);
    let headerRow = 0;
    for (let r = 0; r < Math.min(out.length, 8); r++) {
      if ((out[r] || []).some(cell => classifyHeader(cell) === 'name')) { headerRow = r; break; }
    }
    const header = out[headerRow] || [];
    const cols = findIdentityCols(header);
    const needC = Math.max(cols.name, cols.level, cols.area, cols.regionLevel1, header.length - 1, 0);
    const cache = blankIdentity();
    for (let r = headerRow + 1; r < out.length; r++) {
      if (!out[r]) out[r] = [];
      while (out[r].length <= needC) out[r].push('');
      let any = false;
      const scan = Math.max(out[r].length, header.length);
      for (let c = 0; c < scan; c++) {
        const mv = mergeMap[r + ',' + c];
        if (mv != null && String(mv).trim() !== '') {
          while (out[r].length <= c) out[r].push('');
          out[r][c] = String(mv).trim();
        }
        if (String(out[r][c] == null ? '' : out[r][c]).trim() !== '') any = true;
      }
      if (!any) continue;
      const filled = takeIdentityCache(readIdentityAt(out[r], cols), cache);
      writeIdentityAt(out[r], cols, filled);
    }
    return out;
  }

  /* ================= 一行一酒店横向表 =================
   * 单条酒店占一行；多组【开始日期、结束日期、售价】或日期区间列头下的售价，拆成多条 hotelPrice。
   * 各酒店档期区间不需要对齐。导入门禁在 gateHotelImport：必填酒店名称、钻级级别、一级大区、地区。 */
  function parseHotelWideRows(aoa, merges, opts) {
    opts = opts || {};
    const now = opts.now || new Date();
    const rows = Array.isArray(aoa) ? aoa : [];
    const mergeMap = expandMerges(rows, merges);
    const anomalies = [];
    const hotels = [];
    const rawPeriods = [];
    const allRawTexts = [];

    const getVal = (r, c) => {
      const key = r + ',' + c;
      if (mergeMap[key] !== undefined) {
        const v = mergeMap[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const cell = rows[r] ? rows[r][c] : '';
      return cell == null ? '' : String(cell).trim();
    };

    let headerRow = 0;
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (classifyHeader(row[c]) === 'name') { headerRow = r; r = 99; break; }
      }
    }
    const header = rows[headerRow] || [];
    const maxC = Math.max(header.length, 8);
    const colOf = {};
    const starts = [];
    const ends = [];
    const prices = [];
    let dateCols = [];
    for (let c = 0; c < maxC; c++) {
      const rawH = header[c];
      const kind = classifyHeader(rawH);
      if (kind === 'startDate') starts.push(c);
      else if (kind === 'endDate') ends.push(c);
      else if (kind === 'price') prices.push(c);
      else if (kind === 'dateCol') dateCols.push({ c, text: String(rawH == null ? '' : rawH).trim() });
      else if (kind === 'area') colOf.area = c;
      else if (kind === 'areaAlt') { if (colOf.area == null && colOf.areaAlt == null) colOf.areaAlt = c; }
      else if (kind !== 'empty' && kind !== 'other' && colOf[kind] == null) colOf[kind] = c;
    }
    if (colOf.area == null && colOf.areaAlt != null) colOf.area = colOf.areaAlt;
    const groups = [];
    const gCount = Math.max(starts.length, ends.length);
    for (let i = 0; i < gCount; i++) {
      groups.push({ startC: starts[i], endC: ends[i], priceC: prices[i] });
    }

    const nameCol = colOf.name != null ? colOf.name : (classifyHeader(header[0]) === 'empty' ? 1 : 0);
    const globalDateCols = dateCols.slice();
    dateCols.forEach(dc => allRawTexts.push(dc.text));
    function adoptDateColsFromRow(r) {
      const next = [];
      const skip = {};
      Object.keys(colOf).forEach(k => { if (colOf[k] != null) skip[colOf[k]] = 1; });
      const scan = Math.max(header.length, (rows[r] || []).length, 8);
      for (let c = 0; c < scan; c++) {
        if (skip[c]) continue;
        const txt = getVal(r, c);
        if (looksLikeDateHeader(txt)) next.push({ c, text: txt });
      }
      if (next.length) {
        dateCols = next;
        next.forEach(dc => allRawTexts.push(dc.text));
      }
    }
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.some(v => String(v == null ? '' : v).trim() !== '')) continue;
      groups.forEach(g => {
        if (g.startC != null) allRawTexts.push(getVal(r, g.startC));
        if (g.endC != null) allRawTexts.push(getVal(r, g.endC));
      });
    }
    const seasonYear = resolveSeasonYear(allRawTexts, now);

    function pushPeriod(item) {
      rawPeriods.push(item);
    }

    const idCache = blankIdentity();
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.some(v => String(v == null ? '' : v).trim() !== '')) continue;
      const pick = (k) => (colOf[k] == null ? '' : getVal(r, colOf[k]));
      const curId = {
        name: getVal(r, nameCol),
        level: pick('level'),
        area: pick('area'),
        regionLevel1: pick('regionLevel1')
      };
      const roomRaw = pick('roomTypes');
      const bedType = String(pick('bedType') || '').trim();
      if (isRoomSectionHeader(roomRaw, bedType)) {
        takeIdentityCache(curId, idCache);
        adoptDateColsFromRow(r);
        continue;
      }
      const prevKey = [idCache.name, idCache.level, idCache.area, idCache.regionLevel1].join('\u0001');
      const id = takeIdentityCache(curId, idCache);
      const newKey = [id.name, id.level, id.area, id.regionLevel1].join('\u0001');
      if (newKey !== prevKey) dateCols = globalDateCols.slice();
      const name = id.name;
      if (!name) {
        anomalies.push({ hotelName: '（未命名）', cell: cellRef(r, nameCol), msg: '缺少必填项：酒店名称，已跳过该行' });
        continue;
      }
      const roomName = String(roomRaw || '').trim();
      const hotel = {
        name,
        area: id.area,
        regionLevel1: id.regionLevel1,
        breakfast: pick('breakfast'),
        level: id.level,
        decorateYear: pick('decorateYear'),
        contact: pick('contact'),
        remark: pick('remark'),
        facility: pick('facility'),
        roomTypes: roomRaw,
        address: pick('address'),
        briefDesc: pick('briefDesc'),
        location: pick('location'),
        rooms: roomName ? [{ name: roomName, bedType, desc: '', img: '' }] : [],
        _row: r + 1,
        _cell: cellRef(r, nameCol)
      };
      hotels.push(hotel);
      const roomType = roomName;

      groups.forEach(g => {
        const startTxt = g.startC == null ? '' : getVal(r, g.startC);
        const endTxt = g.endC == null ? '' : getVal(r, g.endC);
        const priceTxt = g.priceC == null ? '' : getVal(r, g.priceC);
        if (!startTxt && !endTxt && !priceTxt) return;
        const start = parseDateCell(startTxt, seasonYear);
        const end = parseDateCell(endTxt, seasonYear) || start;
        const pr = parsePriceRange(priceTxt);
        if (!start && startTxt) {
          const fuzzy = parseSinglePeriod(startTxt);
          if (fuzzy && fuzzy.fuzzy) {
            pushPeriod(stampPeriodHotel({
              hotelName: name, roomType, bedType: pick('bedType').replace(/\s+/g, ''),
              part: { fuzzy: true, raw: startTxt }, price: pr ? pr.price : null,
              priceMin: pr ? pr.priceMin : null, priceMax: pr ? pr.priceMax : null,
              priceRaw: pr ? pr.priceRaw : '',
              cell: cellRef(r, g.startC), _row: r + 1
            }, hotel));
            return;
          }
          anomalies.push({ hotelName: name, cell: cellRef(r, g.startC), msg: '开始日期无法解析：「' + startTxt + '」' });
          return;
        }
        if (!end && endTxt) {
          anomalies.push({ hotelName: name, cell: cellRef(r, g.endC), msg: '结束日期无法解析：「' + endTxt + '」' });
          return;
        }
        if (!start) return;
        if (!pr) {
          if (priceTxt) anomalies.push({ hotelName: name, cell: cellRef(r, g.priceC != null ? g.priceC : g.startC), msg: '售价无法解析：「' + priceTxt + '」' });
          return;
        }
        let s = start, e = end || start;
        if (e < s) {
          const sm = /^(\d{4})-/.exec(s);
          const em = /^(\d{4})-/.exec(e);
          if (sm && em && sm[1] === em[1]) {
            const y2 = Number(em[1]) + 1;
            e = y2 + e.slice(4);
          }
        }
        pushPeriod(stampPeriodHotel({
          hotelName: name, roomType, bedType: pick('bedType').replace(/\s+/g, ''),
          part: { start: s, end: e, raw: startTxt + '~' + endTxt },
          price: pr.price, priceMin: pr.priceMin, priceMax: pr.priceMax, priceRaw: pr.priceRaw,
          cell: cellRef(r, g.startC != null ? g.startC : g.priceC), _row: r + 1
        }, hotel));
      });

      dateCols.forEach(dc => {
        const priceTxt = getVal(r, dc.c);
        const segs = splitPeriodText(dc.text);
        segs.forEach(seg => {
          if (!seg) return;
          const parsed = parseSinglePeriod(seg);
          if (!parsed) {
            anomalies.push({ hotelName: name, cell: cellRef(headerRow, dc.c), msg: '无法解析档期列头：「' + seg + '」' });
            return;
          }
          if (priceTxt === '' && !parsed.fuzzy) return;
          const pr = parsePriceRange(priceTxt);
          if (!parsed.fuzzy && !pr) {
            anomalies.push({ hotelName: name, cell: cellRef(r, dc.c), msg: '售价无法解析：「' + priceTxt + '」' });
            return;
          }
          rawPeriods.push(stampPeriodHotel({
            hotelName: name, roomType, bedType: pick('bedType').replace(/\s+/g, ''),
            part: parsed, price: pr ? pr.price : null,
            priceMin: pr ? pr.priceMin : null, priceMax: pr ? pr.priceMax : null,
            priceRaw: pr ? pr.priceRaw : '',
            cell: cellRef(headerRow, dc.c), _row: r + 1
          }, hotel));
        });
      });
    }

    const materialized = materializePeriods(rawPeriods, now, anomalies);
    const periods = materialized.periods;
    const fuzzyCount = materialized.fuzzyCount;

    const seenAn = {};
    const dedupAn = [];
    anomalies.forEach(a => {
      const k = a.hotelName + '|' + a.cell + '|' + a.msg;
      if (!seenAn[k]) { seenAn[k] = 1; dedupAn.push(a); }
    });

    return {
      format: 'horizontal',
      seasonYear,
      hotels,
      periods,
      anomalies: dedupAn,
      stats: { hotels: hotels.length, periods: periods.length, anomalies: dedupAn.length, fuzzy: fuzzyCount }
    };
  }

  function parseWorkbook(aoa, merges, opts) {
    const filled = fillDownIdentity(aoa, merges);
    let res;
    if (looksLikeBlockTable(aoa, merges)) res = parseHotelBlocks(filled, merges, opts);
    else {
      const wide = parseHotelWideRows(filled, merges, opts);
      if (wide.stats.hotels || wide.stats.periods || (wide.anomalies && wide.anomalies.length)) res = wide;
      else res = parseHotelBlocks(filled, merges, opts);
    }
    return gateHotelImport(res);
  }

  /* 自适应列布局：优先按块首行的「房型」「床型」表头定位数据列，最稳；找不到再回退到日期列探测
   * - C_ROOM = 「房型」表头所在列；C_BED = C_ROOM+1；dateCol0 = C_ROOM+2
   * - 旧版式 C_ROOM=7(H)/dateCol0=9(J)；新版式 C_ROOM=8(I)/dateCol0=10(K)
   * - 是否含区域列：dateCol0 >= 10
   * 返回列索引对象（0 基）。 */
  function detectLayout(rows, r0, getVal) {
    const row = rows[r0] || [];
    const maxC = Math.max(row.length || 0, 30);
    let cRoom = -1;
    /* 1) 按「房型」表头定位（块首行的房型/床型表头单元格） */
    for (let c = 2; c < maxC; c++) {
      if (String(getVal(r0, c)).replace(/\s+/g, '') === '房型') { cRoom = c; break; }
    }
    /* 2) 回退：日期列探测（从 C 列起找首个日期档期列，再反推房型列） */
    if (cRoom < 0) {
      let dateCol0 = -1;
      for (let c = 2; c < maxC; c++) {
        if (looksLikeDateHeader(getVal(r0, c))) { dateCol0 = c; break; }
      }
      if (dateCol0 < 0) dateCol0 = 9; /* 默认旧版式 */
      cRoom = dateCol0 - 2;
    }
    const dateCol0 = cRoom + 2;
    const hasArea = dateCol0 >= 10;
    const off = hasArea ? 1 : 0; /* 新版式基础信息列整体右移 1 */
    return {
      dateCol0,
      hasArea,
      C_NAME: 1,
      C_AREA: hasArea ? 2 : -1,
      C_BREAKFAST: 2 + off,
      C_LEVEL: 3 + off,
      C_DECOR: 4 + off,
      C_CONTACT: 5 + off,
      C_REMARK: 6 + off,
      C_ROOM: cRoom,
      C_BED: cRoom + 1
    };
  }

  /* ================= 横向块表解析 ================= */
  /*
   * parseHotelBlocks(aoa, merges, opts)
   * aoa     : 二维数组（含首行全局表头）
   * merges  : [{s:{r,c},e:{r,c}}]
   * opts    : { now: Date, headerRows: 1 }
   * 返回：{
   *   format:'horizontal',
   *   hotels: [{ name, area, breakfast, level, decorateYear, contact, remark, rooms:[], _row, _cell }],
   *   periods: [{ hotelName, roomType, bedType, start, end, fuzzy, raw, price, priceMin, priceMax, priceRaw, cell }],
   *   anomalies: [{ hotelName, cell, msg }],
   *   stats: { hotels, periods, anomalies, fuzzy, skipped }
   * }
   */
  function parseHotelBlocks(aoa, merges, opts) {
    opts = opts || {};
    const now = opts.now || new Date();
    const rows = Array.isArray(aoa) ? aoa : [];
    const mergeMap = expandMerges(rows, merges);
    const anomalies = [];
    const hotels = [];
    const rawPeriods = []; /* 中间态：含未补年份的档期 */

    const getVal = (r, c) => {
      const key = r + ',' + c;
      if (mergeMap[key] !== undefined) {
        const v = mergeMap[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const cell = rows[r] ? rows[r][c] : '';
      return cell == null ? '' : String(cell).trim();
    };

    /* 列布局：按每块首行自适应探测（兼容旧版式无区域列 / 新版式含区域列）。
     * 一级大区 / 地区按全局表头名称读取，避免插入这两列后错位；档期列仍走 dateCol0。 */
    const basicCols = indexBasicColumns(rows[0] || []);

    const nRows = rows.length;
    /* 找块起点：A 列（0）非空视为块首行；也兼容 A 列空但 B 列换名的情形 */
    const blockStarts = [];
    let lastA = '__init__';
    for (let r = 1; r < nRows; r++) { /* r=0 是全局表头，跳过 */
      const aVal = getVal(r, 0);
      if (aVal !== '' && aVal !== lastA) { blockStarts.push(r); lastA = aVal; }
    }
    /* 兜底：若无 A 列序号，则以 B 列酒店名变化分块 */
    if (!blockStarts.length) {
      let lastB = '__init__';
      for (let r = 1; r < nRows; r++) {
        const bVal = getVal(r, 1);
        if (bVal !== '' && bVal !== lastB) { blockStarts.push(r); lastB = bVal; }
      }
    }
    blockStarts.push(nRows); /* 哨兵 */

    const allRawTexts = [];
    for (let bi = 0; bi < blockStarts.length - 1; bi++) {
      const r0 = blockStarts[bi];
      const r1 = blockStarts[bi + 1] - 1;
      /* 本块列布局 */
      const L = detectLayout(rows, r0, getVal);
      /* 块首行向下继承的酒店基础信息 */
      const name = (basicCols.name != null ? getVal(r0, basicCols.name) : getVal(r0, L.C_NAME)) || '';
      const block = {
        name,
        area: L.C_AREA < 0 ? '' : getVal(r0, L.C_AREA), /* 新版式才有区域列；旧版式留空 */
        breakfast: getVal(r0, L.C_BREAKFAST),
        level: getVal(r0, L.C_LEVEL),
        decorateYear: getVal(r0, L.C_DECOR),
        contact: getVal(r0, L.C_CONTACT),
        remark: getVal(r0, L.C_REMARK),
        rooms: [], _row: r0 + 1, _cell: cellRef(r0, L.C_NAME)
      };
      if (!name) {
        anomalies.push({ hotelName: '（未命名）', cell: cellRef(r0, L.C_NAME), msg: '缺少必填项：酒店名称，已跳过该行' });
        continue;
      }
      /* 表头能对上的列以表头为准（含空单元格），避免插入一级大区/地区后错用旁边的列 */
      ['area', 'regionLevel1', 'breakfast', 'level', 'decorateYear', 'contact', 'remark'].forEach(key => {
        if (basicCols[key] == null) return;
        block[key] = getVal(r0, basicCols[key]);
      });

      /* 日期列头：块首行从 dateCol0 起；哪些列有值 */
      const dateCols = []; /* { c, text } */
      const maxC = Math.max.apply(null, [rows[r0] ? rows[r0].length : 0].concat([L.dateCol0 + 20]));
      for (let c = L.dateCol0; c < maxC; c++) {
        const txt = getVal(r0, c);
        if (txt !== '') dateCols.push({ c, text: txt });
      }
      /* 数据行：r0+1 .. r1（房型竖排）*/
      const roomSeen = {};
      for (let r = r0 + 1; r <= r1; r++) {
        const roomName = getVal(r, L.C_ROOM);
        const bedType = getVal(r, L.C_BED);
        if (!roomName) continue;
        /* 房型名可能含「大、双床」等 -> 原样保留作为房型名（去空格） */
        const rn = roomName.replace(/\s+/g, '');
        if (rn && !roomSeen[rn]) { roomSeen[rn] = 1; block.rooms.push({ name: rn, bedType: bedType.replace(/\s+/g, ''), desc: '', img: '' }); }
        dateCols.forEach(dc => {
          const priceTxt = getVal(r, dc.c);
          const segs = splitPeriodText(dc.text);
          segs.forEach(seg => {
            const raw = seg;
            if (!raw) return;
            const parsed = parseSinglePeriod(seg);
            if (!parsed) {
              anomalies.push({ hotelName: name, cell: cellRef(r0, dc.c), msg: '无法解析档期/价格对应：「' + seg + '」' });
              return;
            }
            if (priceTxt === '' && !parsed.fuzzy) {
              /* 无价格：跳过（该房型此档期无报价），不计异常 */
              return;
            }
            const pr = parsePriceRange(priceTxt);
            if (!parsed.fuzzy && !pr) {
              anomalies.push({ hotelName: name, cell: cellRef(r, dc.c), msg: '售价无法解析：「' + priceTxt + '」' });
              return;
            }
            rawPeriods.push(stampPeriodHotel({
              hotelName: name, roomType: rn, bedType: bedType.replace(/\s+/g, ''),
              part: parsed, price: pr ? pr.price : null,
              priceMin: pr ? pr.priceMin : null, priceMax: pr ? pr.priceMax : null,
              priceRaw: pr ? pr.priceRaw : '',
              cell: cellRef(r0, dc.c), _row: r + 1
            }, block));
            allRawTexts.push(raw);
          });
        });
      }
      hotels.push(block);
    }

    /* 推断雪季基准年（兼容旧说明）；档期年份按 expandPeriodByYear 拆分 */
    const seasonYear = resolveSeasonYear(allRawTexts, now);
    const materialized = materializePeriods(rawPeriods, now, anomalies);
    const periods = materialized.periods;
    const fuzzyCount = materialized.fuzzyCount;

    /* 异常去重（同一单元格 + 原因只报一次） */
    const seenAn = {};
    const dedupAn = [];
    anomalies.forEach(a => {
      const k = a.hotelName + '|' + a.cell + '|' + a.msg;
      if (!seenAn[k]) { seenAn[k] = 1; dedupAn.push(a); }
    });

    return {
      format: 'horizontal',
      seasonYear,
      hotels,
      periods,
      anomalies: dedupAn,
      stats: { hotels: hotels.length, periods: periods.length, anomalies: dedupAn.length, fuzzy: fuzzyCount }
    };
  }

  return {
    colLetter, cellRef, expandMerges,
    parsePriceRange, splitPeriodText, parseSinglePeriod, completePeriod, expandPeriodByYear, parseDateCell,
    currentSeasonYear, resolveSeasonYear, parseHotelBlocks, parseHotelWideRows, parseWorkbook,
    gateHotelImport, missingHotelFields, hotelKey, hotelIdentity, pickLevel, collapseHotels,
    fillDownIdentity, takeIdentityCache, looksLikeCurrentWideHeader,
    classifyHeader, looksLikeBlockTable, looksLikeDateHeader
  };
});
