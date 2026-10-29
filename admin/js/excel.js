/* ============================================================
 * Excel 工具（浏览器端，基于 SheetJS）
 * - parse(file)            ：解析 xlsx 首个工作表 -> { headers:[], rows:[{_row, cells:[]}] }
 * - downloadTemplate(opts) ：生成并下载模板（表头含提示+批注 + 字段说明表）
 * - toObjects(parsed, defs) ：按表头名称/别名映射为对象数组
 *   依赖 window.XLSX（由 index.html 引入 SheetJS CDN）。
 * ============================================================ */
(function () {
  function xlsx() { return window.XLSX; }
  function available() { return !!xlsx(); }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('读取文件失败'));
      fr.readAsArrayBuffer(file);
    });
  }

  /* 表头归一化：去 BOM、去【】（）()[] 内的提示、去空白 */
  function normHeader(s) {
    return String(s == null ? '' : s)
      .replace(/^\uFEFF/, '')
      .replace(/[【（(\[][^】）)\]]*[】）)\]]/g, '')
      .replace(/[\s\u3000]+/g, '')
      .trim();
  }

  async function parse(file) {
    if (!xlsx()) throw new Error('Excel 组件未加载');
    const buf = await readFile(file);
    const wb = xlsx().read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { headers: [], rows: [], aoa: [], merges: [] };
    const aoa = xlsx().utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: true });
    const merges = (ws['!merges'] || []).map(m => ({ s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } }));
    const headers = (aoa[0] || []).map(h => String(h == null ? '' : h).trim());
    const rows = [];
    for (let i = 1; i < aoa.length; i++) {
      const cells = aoa[i] || [];
      if (!cells.some(v => String(v == null ? '' : v).trim() !== '')) continue;
      rows.push({ _row: i + 1, cells });
    }
    return { headers, rows, aoa, merges };
  }

  function headerText(h) { return h.headerText || h.title || ''; }

  /* opts: { fileName, headers:[{ key, title, headerText, required, aliases, desc }], sample:{ key: value } } */
  function downloadTemplate(opts) {
    if (!xlsx()) { window.alert('Excel 组件未加载，请检查网络'); return; }
    const XLSX = xlsx();
    const headers = opts.headers || [];
    const headerRow = headers.map(headerText);
    const ws1 = XLSX.utils.aoa_to_sheet([headerRow]);
    ws1['!cols'] = headerRow.map(t => ({ wch: Math.max(12, Math.min(42, String(t).length + 6)) }));
    headers.forEach((h, i) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws1[ref]) return;
      const note = (h.required ? '【必填】' : '【选填】') + (h.desc || '');
      ws1[ref].c = [{ a: '填写说明', t: note }];
    });

    const descAoa = [['字段', '是否必填', '填写规则', '示例值']].concat(
      headers.map(h => [
        headerText(h),
        h.required ? '必填' : '选填',
        h.desc || '',
        (opts.sample && opts.sample[h.key] != null) ? String(opts.sample[h.key]) : ''
      ])
    );
    const defaultNotes = [
      '1. 表格为「基础信息 + 多条价格档期」：一行 = 一个房型的一个价格档期。',
      '2. 同一酒店同一房型的多个档期，请分多行重复填写酒店基础信息，只修改起止日期与售价。',
      '3. 日期格式统一为 yyyy-MM-dd，例如 2026-11-15，否则该行会被拦截报错。',
      '4. 必填四项：酒店名称、钻级级别、一级大区、地区。四项全同则补全已有酒店，任意一项不同则新增。',
      '5. 价格匹配为闭区间：入住日期 ≥ 开始日期 且 ≤ 结束日期 时命中该档期。',
      '6. 图片请在导入后到列表/详情中手动上传，不走 Excel。',
      '7. 多个值请使用英文逗号（,）分隔。',
      '8. 请尽量保留表头文字（【】/（）内为填写提示，可保留不影响导入）。'
    ];
    const notes = Array.isArray(opts.footNotes) ? opts.footNotes : defaultNotes;
    descAoa.push([]);
    descAoa.push(['通用说明', '', '', '']);
    notes.forEach(line => descAoa.push([line, '', '', '']));
    const ws2 = XLSX.utils.aoa_to_sheet(descAoa);
    ws2['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 56 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, '数据');
    XLSX.utils.book_append_sheet(wb, ws2, '字段说明');
    XLSX.writeFile(wb, opts.fileName || 'template.xlsx');
  }

  /* 横向多档期标准模板：一行一个房型；后列为 M.D-M.D 日期区间，单元格为售价。 */
  function downloadHotelHorizontalTemplate(fileName) {
    if (!xlsx()) { window.alert('Excel 组件未加载，请检查网络'); return; }
    const XLSX = xlsx();
    const head = ['酒店名称', '携程钻级', '地区', '一级大区', '房型', '床型',
      '11.1-11.15', '12.1-12.20', '12.20-2.06', '1.1-2.28'];
    const aoa = [head];
    aoa.push(['示例酒店A', '五钻', '海拉尔', '呼伦贝尔', '标准间', '大床', '900', '880', '1200', '1100']);
    aoa.push(['示例酒店A', '五钻', '海拉尔', '呼伦贝尔', '家庭房', '三床', '980', '960', '1300', '1180']);
    aoa.push(['示例酒店B', '四钻', '雪乡', '哈尔滨', '标间', '双床', '680', '', '1428', '845']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = head.map((_, i) => ({ wch: (i === 0 ? 22 : 14) }));
    if (!ws['A1']) ws['A1'] = { t: 's', v: '酒店名称' };
    ws['A1'].c = [{ a: '填写说明', t: '【必填】同一酒店多房型请分多行，四项标识重复填写或留空继承上一行。' }];
    if (!ws['B1']) ws['B1'] = { t: 's', v: '携程钻级' };
    ws['B1'].c = [{ a: '填写说明', t: '【必填】钻级级别，如五钻、5钻。与名称、地区、一级大区四项全同视为同一家酒店。' }];
    if (!ws['C1']) ws['C1'] = { t: 's', v: '地区' };
    ws['C1'].c = [{ a: '填写说明', t: '【必填】二级地点，如海拉尔、额尔古纳。' }];
    if (!ws['D1']) ws['D1'] = { t: 's', v: '一级大区' };
    ws['D1'].c = [{ a: '填写说明', t: '【必填】一级分类，如呼伦贝尔、哈尔滨。' }];
    if (!ws['E1']) ws['E1'] = { t: 's', v: '房型' };
    ws['E1'].c = [{ a: '填写说明', t: '【选填】一行一个房型。' }];
    if (!ws['F1']) ws['F1'] = { t: 's', v: '床型' };
    ws['F1'].c = [{ a: '填写说明', t: '【选填】如大床/双床/三床。' }];
    if (!ws['G1']) ws['G1'] = { t: 's', v: head[6] };
    ws['G1'].c = [{ a: '填写说明', t: '【选填】列头写 M.D-M.D。今年剩余时段归当年，跨年（如 12.20-2.06）自动拆成当年 12.31 前 + 次年 1.1 起两段。单元格填该房型售价。' }];

    const descAoa = [
      ['字段', '是否必填', '填写规则', '示例'],
      ['酒店名称', '必填', '同一酒店多房型分多行；后续行可留空继承', '示例酒店A'],
      ['携程钻级', '必填', '钻级级别。与名称、地区、大区四项全同视为同一家', '五钻'],
      ['地区', '必填', '二级地点', '海拉尔'],
      ['一级大区', '必填', '一级分类', '呼伦贝尔'],
      ['房型', '选填', '一行一个房型', '标准间'],
      ['床型', '选填', '如大床/双床/三床', '大床'],
      ['日期档期列头', '选填', '格式 M.D-M.D；跨年自动拆成当年段+次年段', '12.20-2.06'],
      ['售价', '选填', '对应房型在该日期列的售价；不填则跳过该档期', '880'],
      [],
      ['通用说明', '', '', ''],
      ['1. 表头顺序：酒店名称、携程钻级、地区、一级大区、房型、床型，后面每列一个日期区间。', '', '', ''],
      ['2. 必填四项：酒店名称、携程钻级、地区、一级大区。缺任意一项则该行跳过。', '', '', ''],
      ['3. 四项全部相同：匹配已有酒店只补全新信息，不覆盖旧数据；任意一项不同则新增。', '', '', ''],
      ['4. 一行一个房型；房型、床型、档期价格都选填。', '', '', ''],
      ['5. 12.1-12.20 归属今年；12.20-2.06 拆成今年 12.20~12.31 与次年 1.1~2.06。', '', '', ''],
      ['6. 价格匹配为闭区间：入住日期 ≥ 开始日期 且 ≤ 结束日期 命中该档期。', '', '', ''],
      ['7. 图片请在导入后到列表/详情中手动上传，不走 Excel。', '', '', '']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(descAoa);
    ws2['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 60 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '横向多档期');
    XLSX.utils.book_append_sheet(wb, ws2, '字段说明');
    XLSX.writeFile(wb, fileName || '酒店横向多档期导入模板.xlsx');
  }

  /* 将 {[_row,cells]} 按 headers 名称/别名映射为对象数组（标题取不到则留空） */  function toObjects(parsed, defs) {
    const idx = {};
    (parsed.headers || []).forEach((h, i) => {
      const n = normHeader(h);
      if (n && idx[n] === undefined) idx[n] = i;
    });
    return (parsed.rows || []).map(r => {
      const o = { _row: r._row };
      (defs || []).forEach(t => {
        const names = [t.title].concat(t.aliases || []);
        let i;
        for (let k = 0; k < names.length; k++) {
          const n = normHeader(names[k]);
          if (n && idx[n] !== undefined) { i = idx[n]; break; }
        }
        o[t.key] = (i === undefined) ? '' : String(r.cells[i] == null ? '' : r.cells[i]).trim();
      });
      return o;
    });
  }

  window.ExcelKit = { available, parse, downloadTemplate, downloadHotelHorizontalTemplate, toObjects, normHeader };
})();
