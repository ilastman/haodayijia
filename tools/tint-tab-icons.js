/**
 * 为所有底部 tab 图标重新着色：未选中 → 暖灰 #9A9285，选中 → 大地棕 #8A7152
 * 从原始灰度/绿色图标解码重染，保证与松赞色板统一。
 * 运行：node tools/tint-tab-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const GRAY = [154, 146, 133];   // #9A9285
const BROWN = [138, 113, 82];   // #8A7152

const DIR = path.join(__dirname, '..', 'images', 'tab');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(raw, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function decodePng(buf) {
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  let idat = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (colorType !== 6 || bitDepth !== 8) throw new Error('仅支持 8bit RGBA png，got colorType=' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // 反滤波
  const stride = w * 4;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y === 0 ? Buffer.alloc(stride) : out.slice((y - 1) * stride, y * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[y * stride + i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v += pr;
      }
      out[y * stride + i] = v & 0xff;
    }
  }
  return { w, h, raw: out };
}

function tint(name, color) {
  const src = decodePng(fs.readFileSync(path.join(DIR, name)));
  const { w, h, raw } = src;
  for (let p = 0; p < raw.length; p += 4) {
    const alpha = raw[p + 3];
    if (alpha > 0) {
      raw[p] = color[0];
      raw[p + 1] = color[1];
      raw[p + 2] = color[2];
    }
  }
  fs.writeFileSync(path.join(DIR, name), encodePng(raw, w, h));
  console.log('tinted ' + name);
}

for (const base of ['home', 'route', 'mine', 'inspiration']) {
  tint(base + '-gray.png', GRAY);
  tint(base + '-green.png', BROWN);
}