/**
 * 松赞风格全局换肤：遍历 pages/components 的 wxss 与 app.wxss，
 * 用 大地色系/浅米白 替换旧 草原绿/纯白 配色，并弱化阴影、减细标题字重。
 * 运行：node tools/apply-songtsam-palette.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 颜色映射（精确子串替换）
const COLOR_MAP = {
  // 主绿 → 大地棕
  '#2F8F5B': '#8A7152',
  '#1E7A4C': '#5F4B33',
  '#EAF5EE': '#EDE4D2',
  '#F0F8F2': '#F1EADD',
  // 橙 → 低饱和陶土色
  '#E86A3A': '#A4653A',
  // 米色/白 → 暖米白
  '#FFFFFF': '#FCF9F1',
  '#FAF7F0': '#F6F1E7',
  '#F0EBE1': '#EDE5D6',
  '#F6F3EA': '#F1EADA',
  '#F4F1EA': '#F0EADB',
  '#F7F5EF': '#F3EDDF',
  '#FAF8F1': '#F5EFE1',
  '#F2EFE7': '#EDE6D6',
  '#F7EFE0': '#EFE5CF',
  '#F7F0E2': '#EFE5CF',
  '#F3EDE1': '#EFE7D5',
  '#F5F3EE': '#F2ECDF',
  '#F5F1E8': '#F1EBDE',
  '#F0EBE1': '#EDE5D6',
  '#E4DED2': '#E2DAC9',
  '#E3DFD2': '#E2DAC9',
  '#EEE9DD': '#EBE3D3',
  '#EFE9DD': '#EBE3D3',
  // 文字 → 深棕系
  '#2C2C2E': '#3D362A',
  '#23342B': '#443A2C',
  '#4B4A45': '#5D5547',
  '#6E6A61': '#817A6A',
  '#8A8F8B': '#948D7D',
  '#9A9487': '#9E9886',
  '#8A857A': '#968F80',
  '#A9A396': '#A79F8D',
  '#B4AEA0': '#AEA693',
  '#B0ACA2': '#ADA690',
  '#B3AA97': '#ACA48F',
  '#C0BBB0': '#BBB49F',
  '#C9C4B6': '#C0B9A6',
  '#CFC7B8': '#C7C0AC',
  '#A5A5A5': '#A59E8D',
  '#B6B6B6': '#B0A997',
  '#3A3A3C': '#4A4436',
  '#5B554B': '#6B6453',
  '#35524A': '#4A4133',
  // 棕色系微调统一
  '#8A6A3C': '#9A7B4F',
  '#8A7A55': '#8A7152',
  // 输入占位/分割线
  '#D8D2C2': '#D6CDB8',
  '#C0563A': '#A4653A'
};

// rgba 阴影映射
const RGBA_MAP = [
  ['rgba(47, 143, 91, 0.35)', 'rgba(138, 113, 82, 0.22)'],
  ['rgba(47, 143, 91, 0.4)', 'rgba(138, 113, 82, 0.25)'],
  ['rgba(47, 143, 91, 0.15)', 'rgba(138, 113, 82, 0.12)'],
  ['rgba(30, 122, 76, 0.35)', 'rgba(95, 75, 51, 0.2)'],
  ['rgba(30, 122, 76, 0.25)', 'rgba(95, 75, 51, 0.16)'],
  ['rgba(20, 30, 24, 0.55)', 'rgba(60, 50, 38, 0.4)'],
  ['rgba(20, 40, 30, 0.55)', 'rgba(60, 50, 38, 0.4)'],
  ['rgba(44, 44, 44, 0.08)', 'rgba(90, 82, 66, 0.06)'],
  ['rgba(44, 44, 44, 0.07)', 'rgba(90, 82, 66, 0.05)'],
  ['rgba(44, 44, 44, 0.06)', 'rgba(90, 82, 66, 0.045)'],
  ['rgba(44, 44, 44, 0.05)', 'rgba(90, 82, 66, 0.04)'],
  ['rgba(44, 44, 44, 0.04)', 'rgba(90, 82, 66, 0.03)']
];

// 字重减细：600→500，700→600（先处理 600 再 700）
function thinFonts(css) {
  css = css.split('font-weight: 600').join('font-weight: 500');
  css = css.split('font-weight: 700').join('font-weight: 600');
  return css;
}

function transform(css) {
  for (const k of Object.keys(COLOR_MAP)) {
    css = css.split(k).join(COLOR_MAP[k]);
  }
  for (const pair of RGBA_MAP) {
    css = css.split(pair[0]).join(pair[1]);
  }
  css = thinFonts(css);
  return css;
}

function collect() {
  const files = [path.join(ROOT, 'app.wxss')];
  const walk = dir => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else if (name.name.endsWith('.wxss')) files.push(full);
    }
  };
  walk(path.join(ROOT, 'pages'));
  walk(path.join(ROOT, 'components'));
  return files;
}

let total = 0;
for (const f of collect()) {
  const before = fs.readFileSync(f, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(f, after);
    // 统计替换次数
    let n = 0;
    for (const k of Object.keys(COLOR_MAP)) n += (after.split(COLOR_MAP[k]).length - 1) - (before.split(COLOR_MAP[k]).length - 1);
    // 简单统计：比较有多少处来自映射的颜色出现了
    const changed = Object.keys(COLOR_MAP).filter(k => before.indexOf(k) > -1).length;
    total += changed;
    const rel = f.replace(ROOT + '\\', '');
    console.log(rel + '  ~' + changed + ' 色值替换');
  }
}
console.log('done, touched files with colors: ' + total > 0 ? 'ok' : 'none');