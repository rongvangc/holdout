#!/usr/bin/env node
// Chấm điểm cân bằng: N seed × M ngày, in bảng + PASS/FAIL theo tiêu chí đã chốt.
//
//   npx vite-node scripts/balance.ts -- [days] [seeds]
//
// Tiêu chí PASS (chốt 2026-11):
//   • ≥ 8/10 ván sống ≥ 100 ngày
//   · dân cuối trung bình 6–14
//   · 0 chết đói sau ngày 30
//   · ≤ 25% số chết là do tập kích
import { runBot } from './headless';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const days = Number(args[0] ?? 120);
const seeds = Number(args[1] ?? 10);

interface Run {
  seed: number;
  day: number;
  alive: number;
  deaths: number;
  starved: number;
  raidDeaths: number;
  harvest: number;
}

const runs: Run[] = [];
for (let seed = 1; seed <= seeds; seed++) {
  const s = runBot(days, seed);
  const log = s.log ?? [];
  const starved = log.filter((l) => (l.msg ?? '').includes('chết đói')).length;
  const raidDeaths = log.filter((l) => /chết \((?:tập kích|bị .*giết)/.test(l.msg ?? '')).length;
  runs.push({
    seed,
    day: Math.floor(s.t / 86400),
    alive: s.survivors.filter((v) => v.status === 'alive').length,
    deaths: s.stats.deaths,
    starved,
    raidDeaths,
    harvest: s.stats.harvestedKcal,
  });
}

const survived = runs.filter((r) => r.alive > 0 && r.day >= 100).length;
const avgAlive = runs.reduce((a, r) => a + r.alive, 0) / runs.length;
const starvedLate = runs.filter((r) => r.starved > 0 && r.day > 30 && r.alive === 0).length;
const totalDeaths = runs.reduce((a, r) => a + r.deaths, 0);
const raidShare = totalDeaths ? runs.reduce((a, r) => a + r.raidDeaths, 0) / totalDeaths : 0;

console.log('seed  ngày  sống  chết  chết đói  chết do tập kích  thu hoạch');
for (const r of runs) {
  console.log(
    `${String(r.seed).padStart(4)} ${String(r.day).padStart(5)} ${String(r.alive).padStart(5)} ${String(r.deaths).padStart(5)} ${String(r.starved).padStart(9)} ${String(r.raidDeaths).padStart(16)} ${Math.round(r.harvest).toString().padStart(11)}`,
  );
}

const checks: [string, boolean, string][] = [
  ['≥80% ván sống ≥100 ngày', survived >= Math.ceil(seeds * 0.8), `${survived}/${seeds}`],
  ['dân cuối 6–14', avgAlive >= 6 && avgAlive <= 14, avgAlive.toFixed(1)],
  ['không ván nào chết đói sau ngày 30', starvedLate === 0, `${starvedLate} ván`],
  ['≤25% chết do tập kích', raidShare <= 0.25, `${(raidShare * 100).toFixed(0)}%`],
];

console.log('\n--- tiêu chí ---');
let pass = true;
for (const [label, ok, value] of checks) {
  if (!ok) pass = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} ${value}`);
}
console.log(`\n${pass ? 'KẾT LUẬN: PASS' : 'KẾT LUẬN: FAIL — sửa theo mục FAIL ở trên'}`);
process.exit(pass ? 0 : 1);
