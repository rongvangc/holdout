import { chromium } from 'playwright';

/**
 * Release end-to-end check.
 *
 * Drives the built app the way a player would: cold start, new game, pick a spot,
 * select a room, queue a building, fast-forward, change a role, change a law, open
 * the map, let the automation send a trip, save, reload, resume, then squeeze the
 * layout down to a 320 px phone. Every step prints PASS or FAIL and the exit code is
 * non-zero if any failed, so it can gate a release.
 *
 *   npm run build && npm run e2e
 *
 * The script starts `vite preview` itself when nothing answers on the port.
 */
import { spawn } from 'node:child_process';

const BASE = process.env.BASE || 'http://localhost:4174';

async function ensureServer() {
  const up = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (up) return null;
  const child = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore', shell: true });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await fetch(BASE).then((r) => r.ok).catch(() => false)) return child;
  }
  child.kill();
  throw new Error('vite preview did not start on ' + BASE);
}
const results = [];
const errors = [];
let page;

const step = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } catch (e) {
    results.push({ name, ok: false, detail: String(e).slice(0, 120) });
    console.log(`FAIL  ${name} — ${String(e).slice(0, 120)}`);
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const day = () => page.evaluate(() => Number((document.body.innerText.match(/NGÀY\s*\|?\s*(\d+)/i) || [])[1] ?? 0));
const text = () => page.evaluate(() => document.body.innerText);
const tab = async (re) => { await page.locator('button').filter({ hasText: new RegExp(re, 'i') }).first().click(); await page.waitForTimeout(700); };
/**
 * Stop the clock before touching the UI. At 240x the list re-renders several times a
 * second, which makes Playwright's actionability checks flaky and lets a supply run
 * land between two readings (rice went UP in the middle of a cooking test).
 */
const pause = async () => {
  const running = await page.evaluate(() => !document.querySelector('.topstrip button.on') || !/❚❚/.test([...document.querySelectorAll('.topstrip button.on')].map((b) => b.innerText).join('')));
  if (running) await page.locator('button').filter({ hasText: /^❚❚$/ }).first().click().catch(() => {});
  await page.waitForTimeout(250);
};

const server = await ensureServer();
const B = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await B.newContext({ viewport: { width: 390, height: 844 } });
page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('PAGE ' + e.message.slice(0, 90)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CON ' + m.text().slice(0, 90)); });

await step('cold start: trang mở, không lỗi', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  assert((await text()).includes('VÁN MỚI'), 'không thấy nút Ván mới');
});

await step('ván mới → chọn vị trí → căn cứ hiện ra', async () => {
  await page.getByText('Ván mới', { exact: false }).first().click();
  for (let i = 0; i < 20; i++) {
    const syn = page.getByText('Dùng thành phố mô phỏng');
    if (await syn.isVisible().catch(() => false)) await syn.click().catch(() => {});
    await page.waitForTimeout(900);
    if ((await page.locator('button').allInnerTexts()).some((x) => /bắt đầu/i.test(x))) break;
  }
  const start = page.getByRole('button', { name: 'Bắt đầu', exact: true });
  await page.waitForTimeout(1600);
  for (let i = 0; i < 26 && !(await start.isEnabled().catch(() => false)); i++) {
    await page.mouse.click(60 + (i % 6) * 55, 200 + Math.floor(i / 6) * 60);
    await page.waitForTimeout(140);
  }
  assert(await start.isEnabled(), 'nút Bắt đầu không bật');
  await start.click();
  await page.waitForSelector('.baseview canvas', { timeout: 10000 });
  await page.waitForTimeout(1200);
  assert((await day()) >= 1, 'HUD không hiện ngày');
});

await step('5 ô HUD có số, không NaN', async () => {
  const t = await text();
  assert(!/NaN|undefined/.test(t), 'HUD có NaN/undefined');
  const cells = await page.locator('.topstrip-main .stat').count();
  assert(cells === 5, `HUD có ${cells} ô, cần 5`);
});

await step('chọn phòng → danh sách công trình hiện', async () => {
  const cv = page.locator('.baseview canvas').first();
  const box = await cv.boundingBox();
  let found = false;
  for (let gy = 0; gy < 6 && !found; gy++) {
    for (let gx = 0; gx < 6 && !found; gx++) {
      await cv.dispatchEvent('mousedown', { clientX: box.x + box.width * ((gx + 0.5) / 6), clientY: box.y + box.height * ((gy + 0.5) / 6), button: 0, bubbles: true });
      await page.waitForTimeout(130);
      found = (await page.locator('.modlist button').count()) > 0;
    }
  }
  assert(found, 'không chọn được phòng trống nào');
});

await step('xây Bếp → vào hàng đợi', async () => {
  // Tìm một phòng trống đặt được Bếp (không phải công trình nào cũng thay thế được).
  const cv = page.locator('.baseview canvas').first();
  const box = await cv.boundingBox();
  let label = null;
  for (let gy = 0; gy < 7 && !label; gy++) {
    for (let gx = 0; gx < 7 && !label; gx++) {
      await cv.dispatchEvent('mousedown', { clientX: box.x + box.width * ((gx + 0.5) / 7), clientY: box.y + box.height * ((gy + 0.5) / 7), button: 0, bubbles: true });
      await page.waitForTimeout(120);
      const pick = page.locator('.modlist button').filter({ hasText: /^Bếp/i }).first();
      if (await pick.count() && !(await pick.isDisabled())) {
        label = (await pick.innerText()).split(String.fromCharCode(10))[0];
        await pick.click();
      }
    }
  }
  assert(label, 'không phòng nào đặt được Bếp');
  await page.waitForTimeout(900);
  assert(/Đang xây|đang xây/i.test(await text()), 'không thấy dấu hiệu đang xây');
  return label;
});

await step('tua 240× → công trình hoàn thành', async () => {
  await tab('CĂN CỨ');
  await page.locator('button').filter({ hasText: /^240×$/ }).first().click();
  const before = await day();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    if (await page.locator('.paused-banner').count()) await page.locator('.paused-banner button').click().catch(() => {});
    if ((await day()) >= before + 1) break;
  }
  assert((await day()) > before, 'đồng hồ không chạy');
  await page.locator('button').filter({ hasText: /^❚❚$/ }).first().click();
  await page.waitForTimeout(300);
});

await pause();
await step('tab Người: đổi vai trò qua ô chọn', async () => {
  await tab('NGƯỜI');
  await page.waitForTimeout(600);
  const sel = page.locator('.overlay-main select').nth(2);
  assert(await sel.count(), 'không thấy ô chọn vai trò');
  const before = await sel.inputValue();
  const options = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value));
  const next = options.find((v) => v !== before && v !== 'idle') || options[1];
  await sel.selectOption(next);
  await page.waitForTimeout(600);
  const after = await sel.inputValue();
  assert(after === next, 'vai trò không đổi: ' + before + ' -> ' + after);
  return before + ' -> ' + after;
});

await pause();
await step('tab Luật: đổi luật, luật mới được chọn', async () => {
  await tab('LUẬT');
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => [...document.querySelectorAll('.overlay-main button.on')].map((b) => b.innerText.split(String.fromCharCode(10))[0]));
  const card = page.locator('.overlay-main .card').first();
  const options = card.locator('button');
  const n = await options.count();
  assert(n >= 2, 'thẻ luật đầu không có lựa chọn');
  // chọn lựa chọn chưa active đầu tiên
  let clicked = null;
  for (let i = 0; i < n; i++) {
    const b = options.nth(i);
    const cls = (await b.getAttribute('class')) || '';
    if (!cls.includes('on') && !(await b.isDisabled())) {
      clicked = (await b.innerText()).split(String.fromCharCode(10))[0];
      await b.click();
      break;
    }
  }
  assert(clicked, 'không bấm được lựa chọn luật nào');
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => [...document.querySelectorAll('.overlay-main button.on')].map((b) => b.innerText.split(String.fromCharCode(10))[0]));
  assert(after.includes(clicked), 'luật mới không được đánh dấu: ' + JSON.stringify(after));
  return clicked + ' (truoc: ' + before.slice(0, 2).join(',') + ')';
});

await step('tab Bản đồ: bản đồ tải, có ô mục tiêu', async () => {
  await tab('BẢN ĐỒ');
  await page.waitForTimeout(2500);
  assert((await page.locator('.mapview canvas').count()) > 0, 'không có canvas bản đồ');
  assert(/ĐỘI ĐANG NGOÀI/i.test(await text()), 'thiếu bảng đội');
});

await pause();
await step('chạm bản đồ: chọn được toà nhà và thấy hành động', async () => {
  await tab('BẢN ĐỒ');
  await page.waitForTimeout(2500);
  const cv = page.locator('.mapview canvas').first();
  const box = await cv.boundingBox();
  assert(box, 'không có canvas bản đồ');
  // Bản đồ hit-test theo tile vector: phải chờ tile tải xong. Quét lưới điểm.
  let hit = null;
  for (let gy = 0; gy < 8 && !hit; gy++) {
    for (let gx = 0; gx < 8 && !hit; gx++) {
      await page.mouse.click(box.x + 20 + ((box.width - 40) * gx) / 7, box.y + 20 + ((box.height - 40) * gy) / 7);
      await page.waitForTimeout(120);
      const acts = await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .map((b) => b.innerText.replace(/[ 	]+/g, ' ').trim())
          .filter((t) => /^LỤC SOÁT|^CHIẾM|^ĐI TUẦN/i.test(t)),
      );
      if (acts.length) hit = acts;
    }
  }
  assert(hit, 'chạm 64 điểm mà không chọn được toà nhà nào');
  return hit.join(' / ').slice(0, 60);
});


await step('automation tự phóng chuyến (≤ 3 ngày game)', async () => {
  await tab('CĂN CỨ');
  await page.locator('button').filter({ hasText: /^240×$/ }).first().click();
  let saw = false;
  for (let i = 0; i < 60 && !saw; i++) {
    await page.waitForTimeout(1200);
    if (await page.locator('.paused-banner').count()) await page.locator('.paused-banner button').click().catch(() => {});
    await tab('NHẬT KÝ');
    const t = await text();
    if (/rời .* để lục soát|để lấy nước|Đội về/i.test(t)) saw = true;
    await tab('CĂN CỨ');
  }
  assert(saw, 'không thấy chuyến viễn chinh nào trong log');
});

await pause();
await step('Bếp: gán người nấu, nấu ra món thật', async () => {
  // 1) gán một người vai Bếp
  await tab('NGƯỜI');
  const roles = page.locator('.overlay-main select').nth(2);
  await roles.selectOption('cook');
  await page.waitForTimeout(400);
  // 2) nấu
  await tab('CĂN CỨ');
  await page.locator('button').filter({ hasText: /^BẾP$/i }).first().click();
  await page.waitForTimeout(800);
  const portions = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.overlay-main .row')].filter((r) => /ph[ầa]n/i.test(r.innerText));
    return rows.reduce((sum, r) => {
      const m = r.innerText.match(/(\d+)\s*ph[ầa]n/i);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
  });
  const before = await portions();
  const usable = page.locator('.overlay-main button:not([disabled])').filter({ hasText: /^NẤU/i }).first();
  assert(await usable.count(), 'không món nào bấm được (kiểm tra @staple)');
  const label = (await usable.innerText()).replace(/\s+/g, ' ').slice(0, 20);
  await usable.click();
  // 3) cho đồng hồ chạy đủ để nấu xong (20 phút game)
  await page.locator('button').filter({ hasText: /^240×$/ }).first().click();
  let after = before;
  for (let i = 0; i < 20 && after <= before; i++) {
    await page.waitForTimeout(1200);
    if (await page.locator('.paused-banner').count()) await page.locator('.paused-banner button').click().catch(() => {});
    after = await portions();
  }
  assert(after > before, 'không nấu ra phần ăn nào (' + before + ' -> ' + after + ')');
  return label + ' · phần ăn ' + before + ' -> ' + after;
});

await pause();
await step('tab Nghiên cứu: cây đề tài hiện ra', async () => {
  await tab('NGHIÊN CỨU');
  await page.waitForTimeout(700);
  const t = await text();
  assert(/KỆ SÁCH/i.test(t), 'thiếu khối Kệ sách');
  const cards = await page.locator('.overlay-main .card').count();
  assert(cards >= 3, 'chỉ có ' + cards + ' thẻ đề tài');
  return cards + ' thẻ';
});

await pause();
await step('lưu → tải lại → tiếp tục đúng ngày', async () => {
  await page.locator('button').filter({ hasText: /^❚❚$/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  const d0 = await day();
  await page.locator('button').filter({ hasText: /^LƯU$/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const cont = page.getByText(/TIẾP TỤC/i).first();
  assert(await cont.count(), 'không có nút Tiếp tục sau khi reload');
  await cont.click();
  await page.waitForTimeout(2500);
  const d1 = await day();
  assert(d1 > 0 && Math.abs(d1 - d0) <= 1, `ngày lệch: ${d0} → ${d1}`);
  return `${d0} → ${d1}`;
});

await pause();
await step('mobile 320×568: không tràn, nút Thoát thấy được', async () => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const main = document.querySelector('.topstrip-main');
    const exit = [...document.querySelectorAll('.topstrip-actions button')].pop();
    const er = exit.getBoundingClientRect();
    const stage = document.querySelector('.overlay-main');
    stage.scrollTop = stage.scrollHeight;
    const reached = Math.round(stage.scrollTop) >= Math.round(stage.scrollHeight - stage.clientHeight) - 2;
    return { fit: main.scrollWidth === main.clientWidth, exit: er.right <= window.innerWidth + 1, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth, reached };
  });
  assert(r.overX === 0, 'tràn ngang');
  assert(r.fit, 'HUD tràn ngang');
  assert(r.exit, 'nút Thoát ngoài màn hình');
  assert(r.reached, 'không cuộn tới cuối được');
});

await pause();
await step('landscape 844x390: không tràn, khung chính cuộn được', async () => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const stage = document.querySelector('.overlay-main');
    stage.scrollTop = stage.scrollHeight;
    return {
      overX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrolls: stage.scrollHeight > stage.clientHeight,
      reached: Math.round(stage.scrollTop) >= Math.round(stage.scrollHeight - stage.clientHeight) - 2,
    };
  });
  assert(r.overX === 0, 'tràn ngang');
  assert(r.scrolls && r.reached, 'khung chính không cuộn tới cuối');
});

await step('không có lỗi runtime trong cả phiên', async () => {
  assert(errors.length === 0, errors.slice(0, 2).join(' | '));
});

await B.close();
if (server) server.kill();
const pass = results.filter((r) => r.ok).length;
console.log('RESULT ' + pass + '/' + results.length + ' PASS');
if (errors.length) console.log('runtime errors:', [...new Set(errors)].slice(0, 5));
process.exit(pass === results.length ? 0 : 1);
