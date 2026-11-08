// Usage: npx vite-node scripts/sim.ts -- <days> <seed> [logLines] [nofield]
import { dayOf } from '../src/core/time';
import { runBot } from './headless';

const argv = process.argv.slice(2);
const nums = argv.filter((a: string) => /^\d+$/.test(a));
const s = runBot(Number(nums[0] ?? 120), Number(nums[1] ?? 11), true, !argv.includes('nofield'));
console.log(s.gameOver ? `GAME OVER day ${dayOf(s.t)}` : `Alive at day ${dayOf(s.t)}`);
console.log(s.log.slice(-Number(nums[2] ?? 15)).map((l) => `[${dayOf(l.t)}] ${l.msg}`).join('\n'));
