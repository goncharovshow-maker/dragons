// Иконки приложения (PWA) из логотипа клуба: PNG 8 бит RGBA, без внешних библиотек.
// Логотип масштабируется и кладётся на тёмный фон; для maskable-иконки — с запасом под обрезку по маске.
// Вызывается из tools/club.js (npm run club): makeIcons(файл логотипа, папка для иконок).
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const BG = [11, 21, 34]; // #0b1522

function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable(), crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }

function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8, w, h, depth, ctype, interlace; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len); pos += 12 + len; if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; } else if (type === "IDAT") idat.push(data); else if (type === "IEND") break; }
  if (depth !== 8 || ctype !== 6 || interlace !== 0) throw new Error("need 8-bit RGBA non-interlaced, got depth=" + depth + " type=" + ctype + " interlace=" + interlace);
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0; let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
  }
  return { w, h, px };
}
// Билинейное масштабирование с предумноженной альфой
function sample(img, fx, fy) {
  const x0 = Math.max(0, Math.min(img.w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(img.h - 1, Math.floor(fy))), x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0, out = [0, 0, 0, 0];
  for (const [x, y, wt] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) { const i = (y * img.w + x) * 4, a = img.px[i + 3] / 255; out[0] += img.px[i] * a * wt; out[1] += img.px[i + 1] * a * wt; out[2] += img.px[i + 2] * a * wt; out[3] += a * wt; }
  return out;
}
function render(img, size, scale) {
  const inner = size * scale, off = (size - inner) / 2, rgba = Buffer.alloc(size * size * 4), k = img.w / inner, SS = k > 1 ? Math.ceil(k) : 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) { const fx = (x + (sx + .5) / SS - off) * k - .5, fy = (y + (sy + .5) / SS - off) * k - .5; if (fx < -.5 || fy < -.5 || fx > img.w - .5 || fy > img.h - .5) { n++; continue; } const s = sample(img, fx, fy); r += s[0]; g += s[1]; b += s[2]; a += s[3]; n++; }
    a /= n; r /= n; g /= n; b /= n; // r,g,b предумножены на альфу
    const i = (y * size + x) * 4;
    rgba[i] = Math.round(r + BG[0] * (1 - a)); rgba[i + 1] = Math.round(g + BG[1] * (1 - a)); rgba[i + 2] = Math.round(b + BG[2] * (1 - a)); rgba[i + 3] = 255;
  }
  return rgba;
}
function writePng(file, size, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc(size * (size * 4 + 1)); for (let y = 0; y < size; y++) { rows[y * (size * 4 + 1)] = 0; rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

const ICONS = [["icon-192.png", 192, 0.8], ["icon-512.png", 512, 0.8], ["icon-maskable-512.png", 512, 0.6], ["apple-touch-icon.png", 180, 0.8]];
function makeIcons(logoFile, outDir) {
  const logo = readPng(fs.readFileSync(logoFile));
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, size, scale] of ICONS) writePng(path.join(outDir, name), size, render(logo, size, scale));
  return ICONS.map(x => x[0]);
}
module.exports = { makeIcons, writePng, ICONS };
