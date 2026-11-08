#!/usr/bin/env node
// Validator cho bộ icon mono-line HOLDOUT. Dùng tools/icons.manifest.json.
// Usage: node tools/validate_icons.mjs [path/to/x.svg ...]  (rỗng = validate hết manifest)
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const iconRoot = join(root, "public", "icons", "custom");
const manifest = JSON.parse(readFileSync(join(here, "icons.manifest.json"), "utf8"));
const palette = new Set(manifest.palette.map((c) => c.toLowerCase()));
const CANVAS = manifest.viewBox;

const ALLOWED = new Set(["svg", "g", "rect", "path", "polygon"]);

function checkPathD(d, label, errs) {
  if (typeof d !== "string" || !d.trim()) { errs.push(`${label}: thiếu d`); return; }
  const nonInt = [...d.matchAll(/-?\d+/g)].some((m) => !/^-?\d+$/.test(m[0]) && Number.isNaN(Number(m[0])) === false && m[0].includes("."));
  if (!/^-?\d+$/.test(d.match(/-?\d+/)?.[0] ?? "0")) { /* handled below */ }
  const toks = d.match(/[a-zA-Z]|-?\d+/g) || [];
  let cmd = null, i = 0, pts = [];
  let sx = null, sy = null, cx = null, cy = null;
  while (i < toks.length) {
    const t = toks[i];
    if (/[a-zA-Z]/.test(t)) {
      if (!"MLHVZmlhvz".includes(t)) errs.push(`${label} d: lệnh cấm "${t}" (chỉ M L H V Z)`);
      cmd = t.toUpperCase();
      i++;
      let cur = [0, 0];
      switch (cmd) {
        case "M":
          if (!toks[i] || !toks[i + 1]) { errs.push(`${label} d: M thiếu coppia`); return; }
          [cx, cy] = [toks[i], toks[i + 1]];
          sx = cx; sy = cy;
          if (cx.includes(".") || cy.includes(".")) errs.push(`${label} d: toạ độ lẻ ${cx},${cy}`);
          i += 2; break;
        case "L":
          if (!toks[i] || !toks[i + 1]) { errs.push(`${label} d: L thiếu coppia`); return; }
          {
            const nx = toks[i], ny = toks[i + 1];
            if (nx.includes(".") || ny.includes(".")) errs.push(`${label} d: toạ độ lẻ ${nx},${ny}`);
            const dx = Math.abs(parseInt(nx) - parseInt(cx)), dy = Math.abs(parseInt(ny) - parseInt(cy));
            if (!(dx === 0 || dy === 0 || dx === dy)) errs.push(`${label} d: cạnh không 45°/axis (${dx},${dy})`);
            cx = nx; cy = ny;
          }
          i += 2; break;
        case "H":
          if (toks[i] === undefined) { errs.push(`${label} d: H thiếu giá trị`); return; }
          if (toks[i].includes(".")) errs.push(`${label} d: toạ độ lẻ ${toks[i]}`);
          cx = toks[i]; i++; break;
        case "V":
          if (toks[i] === undefined) { errs.push(`${label} d: V thiếu giá trị`); return; }
          if (toks[i].includes(".")) errs.push(`${label} d: toạ độ lẻ ${toks[i]}`);
          cy = toks[i]; i++; break;
        case "Z":
          cx = sx; cy = sy; i++; break;
        default: i++;
      }
      continue;
    }
    i++;
  }
}

function attrsOf(str) {
  const o = {};
  for (const m of str.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) o[m[1].toLowerCase()] = m[2];
  return o;
}

function validate(file, meta) {
  const errs = [];
  if (!existsSync(file)) return [`thiếu file: ${file}`];
  const src = readFileSync(file, "utf8").trim();
  if (!/^<svg/i.test(src)) errs.push("không bắt đầu <svg>");
  if (!/xmlns=("|')http:\/\/www\.w3\.org\/2000\/svg\1/.test(src)) errs.push("thiếu xmlns");
  const vb = src.match(/viewBox="0 0 (2[4]) (2[4])"/);
  if (!vb) errs.push("viewBox không đúng '0 0 24 24'");

  // elements whitelist
  for (const m of src.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)/g)) {
    const name = m[1].toLowerCase();
    if (!ALLOWED.has(name)) errs.push(`element cấm <${name}>`);
  }
  for (const bad of ["defs", "filter", "mask", "text", "image", "gradient", "circle", "ellipse"]) {
    if (src.includes(`<${bad}`)) errs.push(`có <${bad}>`);
  }
  if (/opacity\s*=\s*"0?\.?\d/.test(src.replace('opacity="1"', ""))) errs.push("opacity < 1");
  if (/rx\s*=/i.test(src)) errs.push("rx (bo góc) bị cấm");

  // palette + stroke-width + fill rules
  for (const m of src.matchAll(/(stroke|fill)="([^"]*)"/g)) {
    const [, at, val] = m;
    if (val === "none") continue;
    if (at === "stroke-width") continue;
    if (!val.startsWith("#")) errs.push(`${at}="${val}" ngoài palette`);
    else if (!palette.has(val.toLowerCase())) errs.push(`${at}="${val}" không trong palette`);
  }
  for (const m of src.matchAll(/stroke-width="([^"]*)"/g)) {
    if (m[1] !== "2") errs.push(`stroke-width "${m[1]}" — chỉ cho phép 2`);
  }
  for (const m of src.matchAll(/stroke-linecap="([^"]*)"/g)) {
    if (m[1] !== "square") errs.push("stroke-linecap phải square");
  }
  for (const m of src.matchAll(/stroke-linejoin="([^"]*)"/g)) {
    if (m[1] !== "miter") errs.push("stroke-linejoin phải miter");
  }
  // stroke cần có trên element có content, fill=none mỗi element có stroke
  const tags = [...src.matchAll(/<(rect|path|polygon|g)\b([^>]*?)(\/>|>)/g)];
  let shapeCount = 0;
  for (const [, name, attrStr] of tags) {
    const a = attrsOf(attrStr);
    if (name === "g") continue;
    shapeCount++;
    const hasStroke = a.stroke !== undefined;
    if (!hasStroke) errs.push(`<${name}> thiếu stroke`);
    else if ((a.fill ?? "") !== "none") errs.push(`<${name}> có stroke nhưng fill khác 'none'`);
    if (name === "rect") {
      for (const k of ["x", "y", "width", "height"]) {
        if (a[k] === undefined) errs.push(`<rect> thiếu ${k}`);
        else if (a[k].includes(".")) errs.push(`<rect> ${k} lẻ`);
      }
      if (a.x !== undefined && 2 > 0) {
        const x = parseInt(a.x), y = parseInt(a.y), w = parseInt(a.width), h = parseInt(a.height);
        if (x < 2 || y < 2 || x + w > CANVAS - 2 || y + h > CANVAS - 2) errs.push(`<rect> ${a.x},${a.y}${w ? "" : ""} ${w}x${h} vượt vùng 2..22`);
      }
    }
    if (name === "path" && /d/i in a) checkPathD(a.d, `<path>`, errs);
    if (name === "polygon" && a.points) {
      const nums = (a.points.match(/-?\d+/g) || []).map(Number);
      if (nums.length % 2) errs.push("<polygon> điểm lẻ");
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const sq = String(nums[i]).includes(".") || String(nums[i + 1]).includes(".");
        if (sq) errs.push("<polygon> toạ độ lẻ");
        if (nums[i] < 2 || nums[i] > CANVAS - 2 || nums[i + 1] < 2 || nums[i + 1] > CANVAS - 2) errs.push(`<polygon> điểm (${nums[i]},${nums[i + 1]}) ngoài 2..22`);
      }
      for (let i = 0; i + 3 < nums.length; i += 2) {
        const dx = parseInt(Math.abs(nums[i + 2] - nums[i])), dy = parseInt(Math.abs(nums[i + 3] - nums[i + 1]));
        if (!(dx === 0 || dy === 0 || dx === dy)) errs.push(`<polygon> cạnh không 45°/axis (${dx},${dy})`);
      }
    }
  }
  const [, range] = meta?.shapes ?? [2, 5];
  if (shapeCount < 2 || shapeCount > range) errs.push(`element shape ${shapeCount} ngoài 2..${range}`);
  return errs;
}

const args = process.argv.slice(2);
const targets = args.length ? args : manifest.assets.map((a) => join(iconRoot, a.path));
let fail = 0;
for (const t of targets) {
  const meta = manifest.assets.find((a) => join(iconRoot, a.path) === t);
  const errs = validate(t, meta);
  if (errs.length) { fail++; console.log(`FAIL ${t}`); for (const e of errs) console.log(`   - ${e}`); }
  else console.log(`ok   ${t}`);
}
console.log(`\n${targets.length - fail}/${targets.length} files đạt`);
process.exit(fail ? 1 : 0);
