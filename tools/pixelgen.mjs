import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'tools', 'pixelout');
const ICONS = path.join(ROOT, 'public', 'icons', 'pixel');

// Palette sampled/pinned by docs/superpowers/specs/2026-11-08-pixel-icon-sheets-design.md
const P = {
  '.': null, p: '#a0a0a0', k: '#202020', K: '#000000', d: '#404040', g: '#606060', G: '#808080',
  s: '#a0a0a0', w: '#a08080', r: '#602020', R: '#804040', q: '#604040',
  o: '#8a6a40', O: '#b09060', y: '#c0a83a', z: '#202000', e: '#404020',
  n: '#204000', m: '#204020', h: '#406020', H: '#5f9a3a', l: '#4fa77a',
  b: '#3f7fbf', B: '#5aa0d0', c: '#5b6fa8', u: '#9a6ab0', U: '#9a8a7a',
  a: '#c0703a', A: '#c06050', v: '#8a8a80',
};

// Each compact sketch is expanded into an actual 24x24 character-grid map.
// A sketch cell becomes a 2x2 block, preserving crisp, hand-authored pixels.
function map(rows) {
  if (rows.length !== 12) throw new Error(`Expected 12 sketch rows, got ${rows.length}`);
  const expanded = [];
  for (const source of rows) {
    const cleaned = source.replaceAll(' ', '.').replace(/\.+$/, '');
    if (cleaned.length > 12) throw new Error(`Sketch row exceeds 12 columns: ${source}`);
    const row = cleaned.padEnd(12, '.');
    for (const char of row) if (!(char in P)) throw new Error(`Unknown palette key: ${char}`);
    const wide = [...row].map(char => char + char).join('');
    expanded.push(wide, wide);
  }
  return expanded;
}

const icons = [
  ['bedroom', [
    '............','..hhhh......','..hwwhh.....','..hwwhh.....','..kkkkkkkk..','..kpplbbbbk.','..kpplbbbbk.','..kkkkkkkk..','..hbbbbbbhk.','..hbbbbbbhk.','..hkkkkkkhk.','............',
  ]],
  ['kitchen', [
    '.....aa.....','....aAa.....','.....a......','...kkkkkk...','..kddddddk..','..kddggddk..','..kddddddk..','...kkkkkk...','....k..k....','...o....o...','..oo....oo..','............',
  ]],
  ['storage', [
    '............','...oooooo...','..okkkkkko..','..oooooooo..','..okgssgko..','..okgssgko..','..okgssgko..','..okgsygko..','..okkkkkko..','...o....o...','............','............',
  ]],
  ['workshop', [
    '............','..ssssssss..','..skkkkkks..','..sggggggs..','..kkkkkkkk..','..o......o..','..o......o..','..o......o..','.....k......','....kdk.....','.....k......','............',
  ]],
  ['infirmary', [
    '....ssss....','...s....s...','...s....s...','....ssss....','..kkkkkkkk..','..ksggggsk..','..ksgAAgsk..','..ksgAAgsk..','..ksggggsk..','..kkkkkkkk..','...o....o...','............',
  ]],
  ['latrine', [
    '....kkkk....','...ksssskk..','..ksssssssk.','..kkkkkkkkk.','..kdddddddk.','..kdgggggdk.','..kdgkkkgdk.','..kdgkkkgdk.','..kdgkkkgdk.','..kkkkkkkkk.','...o.....o..','............',
  ]],
  ['water_tank', [
    '....bbbb....','...bkkkkb...','..bBssssBb..','..bBsGGsBb..','..bBsGGsBb..','..bBsGGsBb..','..bBsGGsBb..','..bBssssBb..','...bkkkkb...','..o......o..','..o......o..','............',
  ]],
  ['filter', [
    '...bbbbbb...','....bBBb....','.....bb......','.....k.......','.....k.......','....dkkd.....','....dggd.....','....dkkd.....','...kkkkkk....','..b..b..b....','..b..b..b....','............',
  ]],
  ['garden', [
    '............','.....h......','.....H......','.....n......','..kkkkkkkk..','..kmmmmmmk..','..khhhhhh k.','..kmmmmmmk..','..khhhhhh k.','..kmmmmmmk..','..kkkkkkkk..','............',
  ]],
  ['herb_garden', [
    '.....h......','....hHh.....','....hHh.....','.....H......','....ll......','...lkkkl....','...lkykl....','...kkkkk....','....ooo.....','...okkkko...','....oooo....','............',
  ]],
  ['well', [
    '...okkkk....','..o.....o...','..o..kkko...','..o..k..k...','..o..k..k...','..o..k..k...','..kkkkkkk...','..kgggggk...','..kgdddgk...','..kkkkkkk...','...o...o....','....o.o.....',
  ]],
  ['watchtower', [
    '....kkkk....','...kddddk...','..kddddddk..','..kkkkkkkk..','..kddddddk..','..kddy ddk..','..kkkkkkkk..','..k....k....','..k....k....','..k....k....','..k....k....','..k....k....',
  ]],
  ['rec_room', [
    '...uuuuuu...','..ukkkkkku..','..ukuuuu ku.','..ukuuuu ku.','..ukkkkkku..','..ukgsggku..','..ukgkg gku.','..ukgsggku..','..ukkkkkku..','...u..u.....','...u..u......','....u.u......',
  ]],
  ['bookshelf', [
    '..oooooooo..','..okkkkkkko.','..krrGycck..','..kkkkkkkk..','..kHHuBcck..','..kkkkkkkk..','..kOArrykk..','..kkkkkkkk..','..k......k..','..kkkkkkkk..','..o......o..','............',
  ]],
  ['garage', [
    '..ssssssss..','..skkkkkkks.','..ssssssss..','..k......k..','..k.dddd.k..','..kddddddk..','..kdrkk rd k','..krrrrrrk..','..kkkkkkkk..','............','............','............',
  ]],
  ['generator', [
    '..a....k....','..akk..k....','..ayk..k.....','..akkkkkkkk.','..kaaaaaaak.','..kayyyyaak.','..kakkkkak..','..kakdgdak..','..kakdgdak..','..kakkkkak..','..kkkkkkkk..','............',
  ]],
  ['shelter', [
    '.....h......','....hHh.....','...hHnHh....','..hHnknHh...','..hHnkkHh...','..hHnkkHh...','..hHnkkHh...','..kkkkkkkk..','...k....k...','...k....k...','....k..k....','.....kk.....',
  ]],
  ['site_base', [
    '..k..kkkk...','..k..kssss..','..kkkkkkkk..','..ksssssssk.','..kskkssssk.','..ksssssssk.','..kddy ddk..','..ksssssssk.','..kkkkkkkkk.','..o......o..','..o......o..','............',
  ]],
  ['site_outpost', [
    '....k.......','....krrr....','....krrr....','....k.......','..kkkkkkkk..','..kddddddk..','..kddddddk..','..kddddddk..','..kkkkkkkk..','..o......o..','..o......o..','............',
  ]],
  ['site_field', [
    '............','..o..o..o...','..o..o..o...','..kkkkkkkk..','..khhhh hhk.','..kmmmmmmk..','..khhhh hhk.','..kmmmmmmk..','..khhhh hhk.','..kkkkkkkk..','............','............',
  ]],
  ['struct_wall', [
    '............','..ssssssss..','..skkkgkks..','..sggggggs..','..skkkgkks..','..kkkkkkkk..','..sggggggs..','..skkkgkks..','..sggggggs..','..skkkgkks..','..kkkkkkkk..','............',
  ]],
  ['struct_barricade', [
    '............','..o......o..','..ok....ko..','...ok..ko...','....okko....','.....kk.....','....okko....','...ok..ko...','..ok....ko..','..o......o..','..o......o..','............',
  ]],
  ['struct_spikes', [
    '............','..k.........','..ks........','..kso.......','..k..ks......','..k..kso.....','..k..k..ks...','..k..k..kso..','..kkkkkkkkk..','..g......g...','............','............',
  ]],
  ['struct_gate', [
    '............','..oooooooo..','..okkkkkkko.','..okokokoko.','..okokokoko.','..okokokoko.','..okokokoko.','..okokokoko.','..okokokoko.','..kkkkkkkk..','..o..y...o..','............',
  ]],
  ['struct_tower', [
    '....kkkk....','...krrrrkk..','..krrrrrrrk.','..kkkkkkkkk.','..krddddd rk.','..krdkkkdrk..','..kkkkkkkkk.','..k......k...','..k......k...','..k......k...','..k......k...','..kkkkkkkk...',
  ]],
];

const maps = icons.map(([name, rows]) => ({ name, rows: map(rows) }));
if (maps.length !== 25) throw new Error(`Expected 25 icons, got ${maps.length}`);
for (const icon of maps) if (icon.rows.length !== 24 || icon.rows.some(row => row.length !== 24)) throw new Error(`Invalid 24x24 map: ${icon.name}`);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // PNG filter type 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND'),
  ]);
}
function colorBytes(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
function drawMap(rows) {
  const pixels = Buffer.alloc(48 * 48 * 4);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const hex = P[rows[y][x]];
    if (!hex) continue;
    const rgba = colorBytes(hex);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const at = (((y * 2 + dy) * 48) + x * 2 + dx) * 4;
      pixels.set(rgba, at);
    }
  }
  return pixels;
}
function putCell(sheet, cell, col, row, gutter = 8) {
  const x0 = col * (48 + gutter), y0 = row * (48 + gutter);
  for (let y = 0; y < 48; y++) {
    const start = ((y0 + y) * sheet.width + x0) * 4;
    cell.copy(sheet.data, start, y * 48 * 4, (y + 1) * 48 * 4);
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(ICONS, { recursive: true });
const cols = 5, rows = 5, gutter = 8;
const sheet = { width: cols * 48 + (cols - 1) * gutter, height: rows * 48 + (rows - 1) * gutter };
sheet.data = Buffer.alloc(sheet.width * sheet.height * 4);
const manifest = [];
const written = [];
for (let i = 0; i < maps.length; i++) {
  const { name, rows: charRows } = maps[i];
  const cell = drawMap(charRows);
  const file = `public/icons/pixel/${name}.png`;
  const dest = path.join(ROOT, file);
  fs.writeFileSync(dest, encodePng(48, 48, cell));
  const row = Math.floor(i / cols), col = i % cols;
  putCell(sheet, cell, col, row, gutter);
  manifest.push({ name, sheet: 'sheet-01.png', row, col, file });
  written.push(dest);
}
const sheetPath = path.join(OUT, 'sheet-01.png');
fs.writeFileSync(sheetPath, encodePng(sheet.width, sheet.height, sheet.data));
const manifestPath = path.join(OUT, 'smanifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
written.push(sheetPath, manifestPath);

const header = fs.readFileSync(sheetPath);
const signature = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const width = header.readUInt32BE(16), height = header.readUInt32BE(20);
const idats = [];
let cursor = 8, sawEnd = false;
while (cursor < header.length) {
  const length = header.readUInt32BE(cursor);
  const type = header.toString('ascii', cursor + 4, cursor + 8);
  const dataStart = cursor + 8, dataEnd = dataStart + length;
  if (dataEnd + 4 > header.length) throw new Error(`Truncated PNG chunk: ${type}`);
  const data = header.subarray(dataStart, dataEnd);
  const recordedCrc = header.readUInt32BE(dataEnd);
  if (crc32(header.subarray(cursor + 4, dataEnd)) !== recordedCrc) throw new Error(`PNG CRC mismatch: ${type}`);
  if (type === 'IDAT') idats.push(data);
  if (type === 'IEND') { sawEnd = true; break; }
  cursor = dataEnd + 4;
}
const decodedRows = zlib.inflateSync(Buffer.concat(idats));
if (!sawEnd || decodedRows.length !== (width * 4 + 1) * height) throw new Error('PNG structure or decoded data length invalid');
for (let y = 0; y < height; y++) if (decodedRows[y * (width * 4 + 1)] !== 0) throw new Error(`Unexpected PNG filter on row ${y}`);
const manifestCheck = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!signature || width !== 272 || height !== 272) throw new Error(`Sheet PNG header invalid: ${width}x${height}`);
if (manifestCheck.length !== 25 || manifestCheck.some(item => item.row < 0 || item.row >= 5 || item.col < 0 || item.col >= 5)) throw new Error('Manifest bounds/count check failed');
for (const file of written) if (fs.statSync(file).size <= 0) throw new Error(`Empty output: ${file}`);
const totalBytes = written.reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`Verified sheet PNG header: ${width}x${height}; manifest: ${manifestCheck.length} entries in 5x5 bounds.`);
console.log(`Sheet: tools/pixelout/sheet-01.png`);
console.log(`Icon count: ${maps.length}`);
console.log('Files:');
for (const file of written) console.log(`  ${path.relative(ROOT, file)} (${fs.statSync(file).size} bytes)`);
console.log(`Total bytes: ${totalBytes}`);


