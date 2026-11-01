/* 把小程序源码打包为 tools/preview-data.js，供 preview.html 运行时加载 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const map = {};

function add(rel) {
  const abs = path.join(ROOT, rel.replace(/\//g, path.sep));
  if (fs.existsSync(abs)) {
    map[rel] = fs.readFileSync(abs, 'utf8');
  } else {
    console.warn('[skip] not found: ' + rel);
  }
}

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

add('utils/copy.js');
add('utils/util.js');
add('utils/data.js');
add('utils/config.js');
add('utils/cloud.js');
add('utils/api.js');
add('utils/quote.js');
add('utils/workbench.js');
add('utils/gallery.js');
add('utils/catalog.js');
add('utils/clause.js');
add('utils/user.js');
add('utils/days.js');
add('utils/route-extra.js');
add('app.js');
add('app.wxss');

app.pages.forEach(pg => {
  ['.js', '.json', '.wxml', '.wxss'].forEach(ext => add(pg + ext));
});

/* 广场仍会打开旧路径 share-detail，源码在，但不在 app.json 页面列表里 */
['pages/share-detail/share-detail'].forEach(pg => {
  ['.js', '.json', '.wxml', '.wxss'].forEach(ext => add(pg + ext));
});

['components/consult-modal', 'components/route-card'].forEach(c => {
  const base = c + '/' + c.split('/').pop();
  ['.js', '.json', '.wxml', '.wxss'].forEach(ext => add(base + ext));
});

const out =
  '/* 本文件由 tools/build-preview.js 自动生成，请勿手动编辑 */\n' +
  'window.SRC = ' + JSON.stringify(map) + ';\n' +
  'window.APP_JSON = ' + JSON.stringify(app, null, 2) + ';\n';

fs.writeFileSync(path.join(ROOT, 'tools', 'preview-data.js'), out);
console.log('generated tools/preview-data.js (' + Object.keys(map).length + ' files, ' + out.length + ' bytes)');
