const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0;
    rgbaBuffer.copy(rawData, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = item.width >= 256 ? 0 : item.width;
    entry[1] = item.height >= 256 ? 0 : item.height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

// Distance from point (px, py) to line segment (ax, ay) -> (bx, by)
function distToSegment(px, py, ax, ay, bx, by) {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

// Signed distance to TrustPay Shield
function shieldSdf(nx, ny) {
  // Top horizontal limit
  if (ny < -0.82) return ny - -0.82;
  if (ny > 0.88) return ny - 0.88;

  // Width at vertical position ny
  let maxWidth = 0.80;
  if (ny > -0.2) {
    const progress = (ny - (-0.2)) / 1.08;
    maxWidth = 0.80 * (1 - Math.pow(progress, 1.6));
  }
  return Math.abs(nx) - maxWidth;
}

function renderShieldRgba(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Checkmark segments
  const p1 = [-0.34, 0.05];
  const p2 = [-0.08, 0.35];
  const p3 = [0.38, -0.22];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = ((x + 0.5) / size - 0.5) * 2;
      const ny = ((y + 0.5) / size - 0.5) * 2;

      const dShield = shieldSdf(nx, ny);

      // Checkmark distance
      const dCheck1 = distToSegment(nx, ny, p1[0], p1[1], p2[0], p2[1]);
      const dCheck2 = distToSegment(nx, ny, p2[0], p2[1], p3[0], p3[1]);
      const dCheck = Math.min(dCheck1, dCheck2);

      // Antialiasing feather
      const pixelSize = 2.0 / size;
      const shieldAlpha = Math.max(0, Math.min(1, -dShield / pixelSize));

      if (shieldAlpha <= 0) {
        // Transparent outside shield
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Border check (outer 8% is glowing border)
      const isBorder = dShield > -0.09;

      if (dCheck < 0.09) {
        // Inner Checkmark: Crisp white/cyan
        const checkAlpha = Math.max(0, Math.min(1, (0.09 - dCheck) / pixelSize));
        buf[idx] = Math.round(255 * checkAlpha + 99 * (1 - checkAlpha)); // R
        buf[idx + 1] = Math.round(255 * checkAlpha + 102 * (1 - checkAlpha)); // G
        buf[idx + 2] = Math.round(255 * checkAlpha + 241 * (1 - checkAlpha)); // B
        buf[idx + 3] = Math.round(255 * shieldAlpha);
      } else if (isBorder) {
        // Outer shield border: Electric indigo (#6366f1 to #4f46e5)
        buf[idx] = 99; // #63
        buf[idx + 1] = 102; // #66
        buf[idx + 2] = 241; // #f1
        buf[idx + 3] = Math.round(255 * shieldAlpha);
      } else {
        // Shield interior: Deep TrustPay obsidian / slate gradient (#09090b to #1e1b4b)
        const vGrad = (ny + 0.8) / 1.6;
        const r = Math.round(9 + 15 * vGrad);
        const g = Math.round(9 + 18 * vGrad);
        const b = Math.round(18 + 55 * vGrad);
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = Math.round(255 * shieldAlpha);
      }
    }
  }

  return buf;
}

// Generate all target sizes
const sizes = [16, 32, 180, 192, 512];
const generatedBuffers = {};

for (const s of sizes) {
  const rgba = renderShieldRgba(s);
  const png = encodePng(s, s, rgba);
  generatedBuffers[s] = png;
}

// Write PNG files to frontend/public/
const publicDir = path.resolve(__dirname, '../frontend/public');
fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), generatedBuffers[16]);
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), generatedBuffers[32]);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatedBuffers[180]);
fs.writeFileSync(path.join(publicDir, 'icon-192x192.png'), generatedBuffers[192]);
fs.writeFileSync(path.join(publicDir, 'icon-512x512.png'), generatedBuffers[512]);

// Multi-resolution ICO (16x16 and 32x32)
const ico = makeIco([
  { width: 16, height: 16, buffer: generatedBuffers[16] },
  { width: 32, height: 32, buffer: generatedBuffers[32] },
]);

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);

// Also update frontend/src/app/favicon.ico
const appDir = path.resolve(__dirname, '../frontend/src/app');
fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico);

// Create crisp SVG shield icon
const shieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="shieldGrad" x1="256" y1="32" x2="256" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="64" y1="32" x2="448" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Ambient Glow -->
  <path d="M256 40 C350 40 440 70 440 180 C440 320 340 420 256 468 C172 420 72 320 72 180 C72 70 162 40 256 40 Z" fill="#6366f1" opacity="0.25" filter="url(#glow)"/>

  <!-- Outer Shield Border -->
  <path d="M256 44 C346 44 432 72 432 178 C432 312 336 408 256 454 C176 408 80 312 80 178 C80 72 166 44 256 44 Z" fill="url(#borderGrad)"/>

  <!-- Inner Shield Fill -->
  <path d="M256 64 C332 64 406 88 406 178 C406 296 322 382 256 424 C190 382 106 296 106 178 C106 88 180 64 256 64 Z" fill="url(#shieldGrad)"/>

  <!-- Escrow Verification Checkmark -->
  <path d="M180 250 L232 306 L338 186" stroke="#ffffff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), shieldSvg);
fs.writeFileSync(path.join(publicDir, 'shield.svg'), shieldSvg);

console.log('Successfully generated crisp TrustPay shield icons in 16x16, 32x32, 180x180, 192x192, 512x512, ICO, and SVG!');
