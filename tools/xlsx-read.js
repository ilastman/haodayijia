/* 极简 xlsx 读取（Node，无第三方依赖）：读 sharedStrings + sheet1，输出 { aoa, merges }
 * 仅用于本地单测，浏览器端仍走 SheetJS。 */
const fs = require('fs');
const zlib = require('zlib');

function readZipEntries(buf) {
  /* 扫描本地文件头 PK\x03\x04，读取 name + 压缩数据（method 0=store, 8=deflate） */
  const entries = {};
  let i = 0;
  const SIG = 0x04034b50;
  while (i + 4 <= buf.length) {
    if (buf.readUInt32LE(i) !== SIG) { i++; continue; }
    const method = buf.readUInt16LE(i + 8);
    let compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    if (compSize === 0) {
      /* 目录项 / 数据描述符：无压缩数据，跳过头部继续 */
      i = dataStart;
      continue;
    }
    const raw = buf.slice(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : zlib.inflateRawSync(raw);
    if (name) entries[name] = data;
    i = dataStart + compSize;
  }
  return entries;
}

function decodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function colToNum(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(path) {
  const buf = fs.readFileSync(path);
  const entries = readZipEntries(buf);
  const ssXml = entries['xl/sharedStrings.xml'] ? entries['xl/sharedStrings.xml'].toString('utf8') : '';
  const strings = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(ssXml)) !== null) {
    const inner = m[1];
    let text = '';
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tRe.exec(inner)) !== null) text += decodeEntities(t[1]);
    strings.push(text);
  }
  /* 首个工作表 */
  const sheetName = Object.keys(entries).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const sheetXml = entries[sheetName].toString('utf8');

  /* merges */
  const merges = [];
  const mergeBlock = /<mergeCells[\s\S]*?<\/mergeCells>/.exec(sheetXml);
  if (mergeBlock) {
    const mcRe = /<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g;
    let mm;
    while ((mm = mcRe.exec(mergeBlock[0])) !== null) {
      const a = mm[1], b = mm[2];
      const sr = parseInt(a.replace(/[A-Z]+/g, ''), 10) - 1;
      const sc = colToNum(a);
      const er = parseInt(b.replace(/[A-Z]+/g, ''), 10) - 1;
      const ec = colToNum(b);
      merges.push({ s: { r: sr, c: sc }, e: { r: er, c: ec } });
    }
  }

  /* rows / cells */
  const body = /<sheetData>([\s\S]*)<\/sheetData>/.exec(sheetXml);
  const aoa = [];
  if (body) {
    const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(body[1])) !== null) {
      const rIdx = parseInt(rm[1], 10) - 1;
      const cellsXml = rm[2];
      const row = aoa[rIdx] || (aoa[rIdx] = []);
      const cRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
      let cm;
      while ((cm = cRe.exec(cellsXml)) !== null) {
        const selfClose = cm[1] !== undefined;
        const attrs = (cm[1] !== undefined ? cm[1] : cm[2]) || '';
        const innerXml = cm[3] || '';
        const refMatch = /\br="([A-Z]+\d+)"/.exec(attrs);
        if (!refMatch) continue;
        const ref = refMatch[1];
        const c = colToNum(ref);
        const tMatch = /t="([^"]+)"/.exec(attrs);
        const type = tMatch ? tMatch[1] : '';
        let val = '';
        if (!selfClose) {
          const vMatch = /<v>([\s\S]*?)<\/v>/.exec(innerXml);
          if (type === 's' && vMatch) val = strings[parseInt(vMatch[1], 10)] || '';
          else if (type === 'str' && vMatch) val = decodeEntities(vMatch[1]);
          else if (type === 'inlineStr') {
            const isMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(innerXml);
            val = isMatch ? decodeEntities(isMatch[1]) : '';
          } else if (vMatch) val = decodeEntities(vMatch[1]);
        }
        row[c] = val;
      }
      for (let k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = '';
    }
  }
  for (let k = 0; k < aoa.length; k++) if (!aoa[k]) aoa[k] = [];
  return { aoa, merges, strings };
}

module.exports = { readXlsx };
