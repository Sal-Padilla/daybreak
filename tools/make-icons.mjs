// Daybreak — tools/make-icons.mjs — rasterise the app mark to PNG.
//
// iOS will not use an SVG for a home-screen icon, and Chrome's install prompt is unreliable
// without a raster icon at 192px or larger. So the SVG stays as the source of truth for the
// favicon, and this writes the PNGs the install flows actually need.
//
//   node tools/make-icons.mjs
//
// No dependencies — a small software rasteriser plus zlib, which is in Node already.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../icons/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const SS = 4;                    // supersampling factor, for clean edges

const C = {
  sand:      [0xFB, 0xF7, 0xF4],
  plum:      [0x4A, 0x2E, 0x52],
  clay:      [0xC4, 0x67, 0x4F],
  gold:      [0xD9, 0x9A, 0x32],
  sandLine:  [0xE7, 0xDB, 0xD1],
};

/* ---------------------------------------------------------------- shapes */

/** A rounded rectangle in the 512-unit design space. */
function roundRect(x, y, w, h, r) {
  return (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const cx = Math.min(Math.max(px, x + r), x + w - r);
    const cy = Math.min(Math.max(py, y + r), y + h - r);
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };
}

/** The upper half of a disc — the sun coming over the horizon. */
function halfDisc(cx, cy, r) {
  return (px, py) => py <= cy && (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

// Drawn back to front, in the same 512-unit space as icon.svg.
//
// Sunrise over a barbell. The previous version stacked a dome, two gold bars, a dark bar
// and a pale bar, which at home-screen size read as a hamburger rather than a sunrise.
// This is one horizon line and one sun: the horizon IS the barbell, which is the whole
// idea of the app in a single mark, and there is nothing left to mistake for a bun.
const LAYERS = [
  { test: () => true,                              colour: C.sand },      // full bleed
  { test: halfDisc(256, 330, 160),                 colour: C.gold },      // first light, as a rim
  { test: halfDisc(256, 330, 144),                 colour: C.clay },      // the sun
  { test: roundRect(88, 316, 336, 26, 13),         colour: C.plum },      // the bar
  { test: roundRect(92, 272, 42, 118, 18),         colour: C.plum },      // plates
  { test: roundRect(378, 272, 42, 118, 18),        colour: C.plum },
];

/* ------------------------------------------------------------ rasteriser */

function render(size, { inset = 0 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  // `inset` shrinks the artwork toward the centre, for maskable icons where the platform
  // crops to a circle and anything near the edge is lost.
  const scale = 512 / (size * (1 - inset * 2));
  const offset = size * inset;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = ((x + (sx + 0.5) / SS) - offset) * scale;
          const dy = ((y + (sy + 0.5) / SS) - offset) * scale;

          let colour = C.sand;
          for (const layer of LAYERS) if (layer.test(dx, dy)) colour = layer.colour;

          r += colour[0]; g += colour[1]; b += colour[2];
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
      px[i + 3] = 255;
    }
  }
  return px;
}

/* ------------------------------------------------------------ PNG output */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ main */

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-180.png', size: 180 },                    // apple-touch-icon
  { name: 'icon-maskable-512.png', size: 512, inset: 0.1 }, // Android crops to a circle
];

for (const t of targets) {
  const buf = toPng(render(t.size, { inset: t.inset || 0 }), t.size);
  writeFileSync(OUT + t.name, buf);
  console.log(`  ${t.name.padEnd(24)} ${t.size}×${t.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log('\nDone. Re-run this if icon.svg changes.');
