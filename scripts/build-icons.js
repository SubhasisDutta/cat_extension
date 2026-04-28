#!/usr/bin/env node
// Renders the Fat Orange Cat logo as PNG at 16/32/48/128 px.
// Zero dependencies — uses only built-in `fs` and `zlib`. The drawing is
// a small software rasterizer that mirrors the shapes in icons/logo.svg.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ----------------------------- PNG encoder -----------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const filtered = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0; // filter: None
    rgba.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(filtered, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ----------------------------- rasterizer -----------------------------

function makeBuffer(size) {
  return Buffer.alloc(size * size * 4); // transparent black
}

function setPixel(buf, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const sa = a / 255;
  const da = buf[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / oa);
  buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / oa);
  buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}

// Anti-aliased filled circle (ellipse if rx != ry).
function fillEllipse(buf, size, cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const x1 = Math.min(size - 1, Math.ceil(cx + rx + 1));
  const y1 = Math.min(size - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      const cover = Math.max(0, Math.min(1, (1 - d) * Math.min(rx, ry)));
      if (cover > 0) setPixel(buf, size, x, y, color[0], color[1], color[2], color[3] * cover);
    }
  }
}

// Stroked circle outline (anti-aliased ring).
function strokeCircle(buf, size, cx, cy, r, w, color) {
  const inner = r - w / 2;
  const outer = r + w / 2;
  const x0 = Math.max(0, Math.floor(cx - outer - 1));
  const y0 = Math.max(0, Math.floor(cy - outer - 1));
  const x1 = Math.min(size - 1, Math.ceil(cx + outer + 1));
  const y1 = Math.min(size - 1, Math.ceil(cy + outer + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let cover = 0;
      if (d >= inner - 0.5 && d <= outer + 0.5) {
        const a = Math.min(1, Math.max(0, outer - d));
        const b = Math.min(1, Math.max(0, d - inner));
        cover = Math.min(a, b);
      }
      if (cover > 0) setPixel(buf, size, x, y, color[0], color[1], color[2], color[3] * cover);
    }
  }
}

// Filled triangle via barycentric, with 1px AA fade at edges.
function fillTriangle(buf, size, p0, p1, p2, color) {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  function edge(a, b, x, y) {
    return (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  }
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = edge(p1, p2, px, py);
      const w1 = edge(p2, p0, px, py);
      const w2 = edge(p0, p1, px, py);
      const inside = (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);
      if (inside) setPixel(buf, size, x, y, color[0], color[1], color[2], color[3]);
    }
  }
}

// Anti-aliased line segment via signed distance.
function strokeLine(buf, size, x0, y0, x1, y1, w, color) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - w));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - w));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1) + w));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1) + w));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
      const cx = x0 + t * dx;
      const cy = y0 + t * dy;
      const d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      const cover = Math.max(0, Math.min(1, w / 2 + 0.5 - d));
      if (cover > 0) setPixel(buf, size, x, y, color[0], color[1], color[2], color[3] * cover);
    }
  }
}

// ----------------------------- the cat ---------------------------------

// Tiny 16-px variant. Hand-tuned because anti-aliasing at this size
// dissolves any literal scale-down of the 128 design.
function drawCatTiny(size) {
  const buf = makeBuffer(size);
  const ORANGE = [239, 139, 42, 255];
  const STROKE = [122, 58, 8, 255];
  const PINK = [255, 177, 177, 255];
  const DARK = [31, 31, 31, 255];

  // Big ears for legibility.
  fillTriangle(buf, size, [1, 7], [4, 0], [7, 6], ORANGE);
  fillTriangle(buf, size, [size - 1 - 1, 7], [size - 1 - 4, 0], [size - 1 - 7, 6], ORANGE);
  fillTriangle(buf, size, [3, 6], [4, 2], [6, 6], PINK);
  fillTriangle(buf, size, [size - 1 - 3, 6], [size - 1 - 4, 2], [size - 1 - 6, 6], PINK);

  // Round face.
  fillEllipse(buf, size, size / 2, size / 2 + 1, size * 0.42, size * 0.42, ORANGE);
  strokeCircle(buf, size, size / 2, size / 2 + 1, size * 0.42, 1, STROKE);

  // Two annoyed eyes — single dark pixels at the right offsets.
  setPixel(buf, size, 5, 8, DARK[0], DARK[1], DARK[2], 255);
  setPixel(buf, size, 6, 8, DARK[0], DARK[1], DARK[2], 255);
  setPixel(buf, size, 9, 8, DARK[0], DARK[1], DARK[2], 255);
  setPixel(buf, size, 10, 8, DARK[0], DARK[1], DARK[2], 255);

  // Nose dot.
  setPixel(buf, size, 7, 11, STROKE[0], STROKE[1], STROKE[2], 255);
  setPixel(buf, size, 8, 11, STROKE[0], STROKE[1], STROKE[2], 255);

  return buf;
}

function drawCat(size) {
  if (size <= 16) return drawCatTiny(size);
  const buf = makeBuffer(size);
  const s = size / 128; // canvas units -> pixels

  const ORANGE = [239, 139, 42, 255];
  const ORANGE_MID = [255, 184, 107, 255];
  const STROKE = [122, 58, 8, 255];
  const PINK = [255, 177, 177, 255];
  const CHEEK = [255, 214, 168, 255];
  const DARK = [31, 31, 31, 255];

  // Ears (orange + pink inner).
  fillTriangle(buf, size, [22 * s, 30 * s], [14 * s, 4 * s], [50 * s, 22 * s], ORANGE);
  fillTriangle(buf, size, [106 * s, 30 * s], [114 * s, 4 * s], [78 * s, 22 * s], ORANGE);
  fillTriangle(buf, size, [28 * s, 26 * s], [22 * s, 12 * s], [44 * s, 22 * s], PINK);
  fillTriangle(buf, size, [100 * s, 26 * s], [106 * s, 12 * s], [84 * s, 22 * s], PINK);

  // Face.
  fillEllipse(buf, size, 64 * s, 68 * s, 50 * s, 50 * s, ORANGE);
  // Highlight to match the radial gradient feel.
  fillEllipse(buf, size, 56 * s, 56 * s, 30 * s, 26 * s, [...ORANGE_MID.slice(0, 3), 90]);
  // Outline.
  strokeCircle(buf, size, 64 * s, 68 * s, 50 * s, Math.max(2, 4 * s), STROKE);

  // Cheeks.
  fillEllipse(buf, size, 40 * s, 78 * s, 14 * s, 10 * s, CHEEK);
  fillEllipse(buf, size, 88 * s, 78 * s, 14 * s, 10 * s, CHEEK);

  // Annoyed eye slits + pupils.
  if (size >= 24) {
    strokeLine(buf, size, 36 * s, 60 * s, 52 * s, 60 * s, Math.max(2, 4 * s), DARK);
    strokeLine(buf, size, 76 * s, 60 * s, 92 * s, 60 * s, Math.max(2, 4 * s), DARK);
  } else {
    fillEllipse(buf, size, 44 * s, 60 * s, 6 * s, 2 * s, DARK);
    fillEllipse(buf, size, 84 * s, 60 * s, 6 * s, 2 * s, DARK);
  }

  // Nose.
  fillTriangle(buf, size, [59 * s, 76 * s], [69 * s, 76 * s], [64 * s, 83 * s], STROKE);

  // Mouth (only at >= 32 — illegible at 16).
  if (size >= 32) {
    strokeLine(buf, size, 52 * s, 88 * s, 64 * s, 92 * s, 2 * s, DARK);
    strokeLine(buf, size, 64 * s, 92 * s, 76 * s, 88 * s, 2 * s, DARK);
  }

  // Whiskers (only at >= 48).
  if (size >= 48) {
    strokeLine(buf, size, 22 * s, 82 * s, 10 * s, 80 * s, 1.5 * s, DARK);
    strokeLine(buf, size, 22 * s, 90 * s, 10 * s, 92 * s, 1.5 * s, DARK);
    strokeLine(buf, size, 106 * s, 82 * s, 118 * s, 80 * s, 1.5 * s, DARK);
    strokeLine(buf, size, 106 * s, 90 * s, 118 * s, 92 * s, 1.5 * s, DARK);
  }

  return buf;
}

// ----------------------------- main ------------------------------------

const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const rgba = drawCat(size);
  const png = encodePng(size, rgba);
  const out = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
