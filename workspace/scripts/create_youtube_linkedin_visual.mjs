#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 627;

function parseArgs(argv) {
  const args = {
    out: '',
    packetId: 'youtube-linkedin-packet',
    title: 'Transcript-backed technical note',
    topic: 'software engineering',
    channel: 'YouTube'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--') || value === undefined) continue;
    i += 1;
    if (key === '--out') args.out = value;
    if (key === '--packet-id') args.packetId = value;
    if (key === '--title') args.title = value;
    if (key === '--topic') args.topic = value;
    if (key === '--channel') args.channel = value;
  }

  if (!args.out) {
    const safe = args.packetId.replace(/[^a-zA-Z0-9_-]/g, '_');
    args.out = `assets/youtube-linkedin/thumbnails/${safe}_primary.png`;
  }
  return args;
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function palette(seed) {
  const palettes = [
    [[246, 248, 244], [26, 84, 89], [230, 92, 68], [242, 188, 74]],
    [[247, 247, 250], [48, 88, 158], [38, 132, 112], [228, 172, 66]],
    [[248, 246, 239], [52, 74, 92], [190, 74, 82], [82, 148, 124]],
    [[244, 249, 247], [40, 96, 110], [216, 112, 74], [237, 199, 91]]
  ];
  return palettes[seed % palettes.length];
}

function setPixel(buf, x, y, rgb) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  buf[idx] = rgb[0];
  buf[idx + 1] = rgb[1];
  buf[idx + 2] = rgb[2];
  buf[idx + 3] = 255;
}

function fillRect(buf, x, y, w, h, rgb) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(WIDTH, Math.ceil(x + w));
  const y1 = Math.min(HEIGHT, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) setPixel(buf, xx, yy, rgb);
  }
}

function fillCircle(buf, cx, cy, radius, rgb) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(buf, x, y, rgb);
    }
  }
}

function drawLine(buf, x0, y0, x1, y1, rgb, width = 5) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    fillCircle(buf, x, y, width / 2, rgb);
  }
}

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
};

function normalizeText(text) {
  return text.toUpperCase().replace(/[^A-Z0-9 .\\/-]/g, '');
}

function wrapText(text, maxChars, maxLines) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, maxChars);
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function drawText(buf, text, x, y, scale, rgb) {
  let cursor = x;
  for (const char of normalizeText(text)) {
    const glyph = FONT[char] || FONT[' '];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] === '1') {
          fillRect(buf, cursor + gx * scale, y + gy * scale, scale, scale, rgb);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function makePng(args) {
  const seed = hashText(`${args.packetId}|${args.title}|${args.topic}`);
  const [bg, ink, accent, accent2] = palette(seed);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = 255;
  }

  fillRect(pixels, 0, 0, WIDTH, 12, accent);
  fillRect(pixels, 72, 78, 92, 92, accent);
  fillRect(pixels, 94, 100, 48, 48, bg);
  fillCircle(pixels, 900, 210, 126, [ink[0], ink[1], ink[2]]);
  fillCircle(pixels, 1008, 342, 84, accent);
  fillCircle(pixels, 804, 392, 62, accent2);

  const blocks = 5 + (seed % 4);
  for (let i = 0; i < blocks; i += 1) {
    const x = 720 + i * 54;
    const h = 110 + ((seed >>> (i * 3)) % 170);
    fillRect(pixels, x, 490 - h, 30, h, i % 2 ? accent : ink);
  }

  for (let i = 0; i < 6; i += 1) {
    const y = 92 + i * 58;
    const length = 310 + ((seed >>> i) % 190);
    drawLine(pixels, 210, y, 210 + length, y, i % 2 ? accent2 : ink, 7);
  }

  drawText(pixels, args.channel, 210, 504, 6, ink);
  const topicLines = wrapText(args.topic, 26, 1);
  drawText(pixels, topicLines[0] || 'TECH NOTE', 210, 552, 7, accent);

  const titleLines = wrapText(args.title, 24, 3);
  titleLines.forEach((line, idx) => {
    drawText(pixels, line, 210, 198 + idx * 64, 8, ink);
  });

  return encodePng(WIDTH, HEIGHT, pixels);
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const args = parseArgs(process.argv.slice(2));
fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, makePng(args));
console.log(JSON.stringify({
  ok: true,
  path: path.resolve(args.out),
  mime_type: 'image/png',
  width: WIDTH,
  height: HEIGHT,
  source: 'local-node-builtins'
}, null, 2));
