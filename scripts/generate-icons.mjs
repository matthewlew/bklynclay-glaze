// One-off placeholder PWA icon generator — no image dependencies.
// Draws a dark square (theme background) with a lighter centered circle
// inset within the maskable safe zone, PNG-encoded via zlib deflate.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x1a, 0x1a, 0x1a];   // matches manifest.json background_color/theme_color
const FG = [0xe8, 0xc9, 0x7a];   // warm clay accent

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36; // stays within the ~80% maskable safe zone

  const raw = Buffer.alloc(size * (1 + size * 4));
  let pos = 0;
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0; // filter type 0 (none) per scanline
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const [r8, g8, b8] = d <= r ? FG : BG;
      raw[pos++] = r8; raw[pos++] = g8; raw[pos++] = b8; raw[pos++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, makeIcon(size));
  console.log(`wrote public/icon-${size}.png`);
}
