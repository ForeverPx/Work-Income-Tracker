const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..", "build");
fs.mkdirSync(root, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function createPNG(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function roundedRect(nx, ny, radius) {
  const inset = 0.06;
  const left = inset;
  const right = 1 - inset;
  const top = inset;
  const bottom = 1 - inset;
  if (nx < left || nx > right || ny < top || ny > bottom) {
    return false;
  }
  const cx = nx < left + radius ? left + radius : nx > right - radius ? right - radius : nx;
  const cy = ny < top + radius ? top + radius : ny > bottom - radius ? bottom - radius : ny;
  return Math.hypot(nx - cx, ny - cy) <= radius;
}

function stroke(nx, ny, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const t = Math.max(0, Math.min(1, ((nx - x1) * dx + (ny - y1) * dy) / (length * length)));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(nx - px, ny - py) <= width;
}

function paint(x, y, size) {
  const nx = (x + 0.5) / size;
  const ny = (y + 0.5) / size;
  if (!roundedRect(nx, ny, 0.22)) {
    return [0, 0, 0, 0];
  }
  const background = mix([16, 16, 18], [36, 36, 40], ny);
  const cx = 0.5;
  const cy = 0.48;
  const radius = 0.3;
  const distance = Math.hypot(nx - cx, ny - cy);
  if (distance <= radius) {
    const localX = (nx - cx) / radius;
    const localY = (ny - cy) / radius;
    const yen =
      stroke(localX, localY, -0.46, -0.62, 0, -0.02, 0.11) ||
      stroke(localX, localY, 0.46, -0.62, 0, -0.02, 0.11) ||
      stroke(localX, localY, 0, -0.02, 0, 0.62, 0.11) ||
      stroke(localX, localY, -0.38, 0.08, 0.38, 0.08, 0.09) ||
      stroke(localX, localY, -0.32, 0.32, 0.32, 0.32, 0.09);
    if (yen) {
      return [42, 28, 8, 255];
    }
    const tone = mix([255, 206, 84], [230, 140, 24], Math.min(1, distance / radius));
    return [...tone, 255];
  }
  const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
  if (edge < 0.08) {
    return [...mix(background, [255, 255, 255], 0.08), 255];
  }
  return [...background, 255];
}

function createICO(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map((image) => {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const sizes = [16, 32, 48, 256];
const images = sizes.map((size) => ({ size, png: createPNG(size, paint) }));
fs.writeFileSync(path.join(root, "icon.png"), images[images.length - 1].png);
fs.writeFileSync(path.join(root, "tray.png"), images.find((image) => image.size === 32).png);
fs.writeFileSync(path.join(root, "icon.ico"), createICO(images));
console.log(`wrote icons in ${root}`);
