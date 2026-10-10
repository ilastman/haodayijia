/**
 * 生成底部 tab 图标（灵感广场）：81x81 线稿四角星光，风格与现有线稿图标统一
 * 运行：node tools/make-tab-icon.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 81;
const GRAY = [154, 154, 154];
const GREEN = [47, 143, 91];

// 线段距离（像素级 AA）
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

// 四角星光：中心两条正交线段（长臂）+ 两条短臂 + 中心点
function sparkleAlpha(px, py) {
  const c = SIZE / 2;
  const longArm = 27, shortArm = 14, w = 3.4;
  const segs = [
    [c - longArm, c, c + longArm, c],
    [c, c - longArm, c, c + longArm],
    [c - shortArm, c - shortArm, c + shortArm, c + shortArm],
    [c - shortArm, c + shortArm, c + shortArm, c - shortArm]
  ];
  let d = Infinity;
  for (const s of segs) d = Math.min(d, segDist(px, py, s[0], s[1], s[2], s[3]));
  let a = Math.max(0, 1 - (d - w / 2));
  if (d > w / 2) a = Math.max(0, 1 - (d - w / 2));
  const dr = Math.sqrt((px - c) * (px - c) + (py - c) * (py - c));
  if (dr < 3) a = Math.max(a, 1 - (dr - 1.2));
  return Math.max(0, Math.min(1, a));
}

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

function makePng(color) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let o = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[o++] = 0;
    for (let x = 0; x < SIZE; x++) {
      const p = 0.5 + x, q = 0.5 + y;
      const a = (sparkleAlpha(p, q) + sparkleAlpha(p - 0.5, q - 0.5)) / 2;
      raw[o++] = color[0];
      raw[o++] = color[1];
      raw[o++] = color[2];
      raw[o++] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  return png;
}

const dir = path.join(__dirname, '..', 'images', 'tab');
fs.writeFileSync(path.join(dir, 'inspiration-gray.png'), makePng(GRAY));
fs.writeFileSync(path.join(dir, 'inspiration-green.png'), makePng(GREEN));
console.log('generated inspiration-gray.png / inspiration-green.png (' + SIZE + 'x' + SIZE + ')');