import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const RAW = path.join(ROOT, 'tools', 'imgout');
const ICONS = path.join(ROOT, 'public', 'icons', 'pixel');
const OUT = path.join(ROOT, 'tools', 'pixelout');
const sources = [
  ['bedroom', 'exec-73fff5f7-8da8-404a-8795-44a6f1c0b564.png'],
  ['kitchen', 'exec-f2e54075-eb66-4953-bbd2-a8ae9ed6c35c.png'],
  ['storage', 'exec-67ec2b7f-511f-4c34-b6fe-794c01f7db20.png'],
  ['workshop', 'exec-385ce4dc-ed69-4462-981e-74f004db73dd.png'],
  ['infirmary', 'exec-1a4df4a1-f6cb-4236-8998-9d436e63ce3e.png'],
  ['latrine', 'exec-461c141e-07bf-4d54-a8c2-0dd866941fbb.png'],
  ['water_tank', 'exec-88cd0d58-9531-4a2d-86cc-833208e83220.png'],
  ['filter', 'exec-9513ad8f-7c05-4148-a002-a6b8d9d14ec5.png'],
  ['garden', 'exec-f5b983b4-8d71-419c-913c-3c622b97aa33.png'],
  ['herb_garden', 'exec-bc077f87-b82d-41e4-9554-55c1fb14d1b3.png'],
  ['well', 'exec-56761603-fb58-4acf-8d46-d560b78d98ef.png'],
  ['watchtower', 'exec-69425520-f4e9-4ef6-bd06-d4db558fa76b.png'],
  ['rec_room', 'exec-bec7f688-a759-4542-b6e2-a76be7d78132.png'],
  ['bookshelf', 'exec-0541eb10-f074-4750-a493-283508940e58.png'],
  ['garage', 'exec-7a6333f7-2c84-4c84-a739-e4acddbe676e.png'],
  ['generator', 'exec-274c288c-6221-4fc2-a31c-79c4ea071de5.png'],
  ['shelter', 'exec-c2b7b89c-06a3-42b7-a508-29489db78609.png'],
  ['site_base', 'exec-d78e463f-6c1c-409f-a8d9-838b615a62e2.png'],
  ['site_outpost', 'exec-4c4031bb-7851-4533-a59e-9b09bc224e48.png'],
  ['site_field', 'exec-62a48833-eaed-449a-90a7-f64c1d5d6d46.png'],
  ['struct_wall', 'exec-02bea692-1c02-4c21-8e8f-ca201b58b8a1.png'],
  ['struct_barricade', 'exec-b4cd1852-a890-4ce4-9db3-91cb4f96041a.png'],
  ['struct_spikes', 'exec-77176f9b-49e2-4079-84b9-d4259a310349.png'],
  ['struct_gate', 'exec-620af215-8ce5-4d33-9e6d-9915532e8250.png'],
  ['struct_tower', 'exec-f26e759a-49af-4e67-8b92-36232924b0d8.png'],
];
const GENERATED = 'C:/Users/Sinh_/.codex/generated_images/01a1bab9-1258-74d0-aaa8-c1d01be5b5ed';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type, 'ascii'), body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function encodePng(width, height, rgba) {
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND')]);
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid PNG signature');
  let width, height, bitDepth, colorType, interlace, cursor = 8;
  const idats = [];
  while (cursor < buf.length) {
    const len = buf.readUInt32BE(cursor), type = buf.toString('ascii', cursor + 4, cursor + 8);
    const start = cursor + 8, end = start + len;
    if (type === 'IHDR') { width = buf.readUInt32BE(start); height = buf.readUInt32BE(start + 4); bitDepth = buf[start + 8]; colorType = buf[start + 9]; interlace = buf[start + 12]; }
    if (type === 'IDAT') idats.push(buf.subarray(start, end));
    cursor = end + 4;
    if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) throw new Error(`Unsupported PNG format ${bitDepth}-bit type ${colorType} interlace ${interlace}`);
  const bpp = 4, stride = width * bpp, packed = zlib.inflateSync(Buffer.concat(idats));
  if (packed.length !== (stride + 1) * height) throw new Error('Unexpected decoded PNG byte count');
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = packed[y * (stride + 1)], rowStart = y * stride, sourceStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const value = packed[sourceStart + x], left = x >= bpp ? raw[rowStart + x - bpp] : 0;
      const up = y ? raw[rowStart + x - stride] : 0, upLeft = y && x >= bpp ? raw[rowStart + x - stride - bpp] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      raw[rowStart + x] = (value + predictor) & 255;
    }
  }
  return { width, height, data: raw };
}
function makeCell({ width, height, data }, name) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = data[(y * width + x) * 4 + 3];
    if (a < 64) data[(y * width + x) * 4 + 3] = 0;
    else { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) throw new Error(`${name} has no visible pixels after alpha threshold`);
  const cropW = maxX - minX + 1, cropH = maxY - minY + 1, fit = 42 / Math.max(cropW, cropH);
  const drawW = Math.max(1, Math.floor(cropW * fit)), drawH = Math.max(1, Math.floor(cropH * fit));
  const x0 = Math.floor((48 - drawW) / 2), y0 = Math.floor((48 - drawH) / 2), cell = Buffer.alloc(48 * 48 * 4);
  for (let y = 0; y < drawH; y++) for (let x = 0; x < drawW; x++) {
    const sx = minX + Math.floor(x * cropW / drawW), sy = minY + Math.floor(y * cropH / drawH);
    const src = (sy * width + sx) * 4;
    if (data[src + 3] < 64) continue;
    data.copy(cell, ((y0 + y) * 48 + x0 + x) * 4, src, src + 4);
  }
  return cell;
}

fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(ICONS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const cols = 5, gutter = 8, sheetW = 272, sheetH = 272, sheet = Buffer.alloc(sheetW * sheetH * 4), manifest = [];
for (let i = 0; i < sources.length; i++) {
  const [name, sourceName] = sources[i];
  const source = path.join(GENERATED, sourceName);
  const rawPath = path.join(RAW, `${name}.png`);
  fs.copyFileSync(source, rawPath);
  const cell = makeCell(decodePng(fs.readFileSync(rawPath)), name);
  fs.writeFileSync(path.join(ICONS, `${name}.png`), encodePng(48, 48, cell));
  const row = Math.floor(i / cols), col = i % cols, x0 = col * (48 + gutter), y0 = row * (48 + gutter);
  for (let y = 0; y < 48; y++) cell.copy(sheet, ((y0 + y) * sheetW + x0) * 4, y * 48 * 4, (y + 1) * 48 * 4);
  manifest.push({ name, sheet: 'sheet-02.png', row, col, file: `public/icons/pixel/${name}.png` });
}
const sheetPath = path.join(OUT, 'sheet-02.png');
fs.writeFileSync(sheetPath, encodePng(sheetW, sheetH, sheet));
fs.writeFileSync(path.join(OUT, 'smanifest.json'), JSON.stringify(manifest, null, 2) + '\n');

for (let i = 0; i < sources.length; i++) {
  const [name] = sources[i], png = fs.readFileSync(path.join(ICONS, `${name}.png`));
  const decoded = decodePng(png);
  if (decoded.width !== 48 || decoded.height !== 48) throw new Error(`${name} is not 48x48`);
  for (const [x, y] of [[0,0],[47,0],[0,47],[47,47]]) if (decoded.data[(y * 48 + x) * 4 + 3] !== 0) throw new Error(`${name} has a nontransparent corner`);
  if (!decoded.data.some((value, index) => index % 4 === 3 && value > 0)) throw new Error(`${name} has no visible pixels`);
}
console.log(`Sheet: tools/pixelout/sheet-02.png`);
console.log(`Icon count: ${sources.length}`);
