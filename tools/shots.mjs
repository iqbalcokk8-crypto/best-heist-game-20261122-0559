// BRANKAS EMAS — screenshot + playtest runner.
// Serves game/ on localhost, captures every scene in shots.json through the
// real ?shot= staging (the autopilot plays the real rules forward), then
// playtests the live game: click-to-start, walk, EMP, smoke, pause.
// Usage: node tools/shots.mjs [repo-dir]
// Needs playwright-core (tools/node_modules is a symlink to shot-tools').
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(process.argv[2] ?? '.');
const PORT = 8091;
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://localhost:${PORT}/index.html`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('server did not come up');
}

let code = 0;
try {
  await waitServer();
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  for (const shot of shots) {
    await page.goto(`http://localhost:${PORT}/index.html${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const out = join(repo, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    const size = statSync(out).size;
    console.log(`${shot.name}: ${size} bytes${size > 262144 ? '  *** OVER 256 KiB CAP ***' : ''}`);
  }

  // --- click-to-start: a click on the title must start the game ---
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const titleBefore = await page.evaluate(() => window.__brankas.state.screen);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(300);
  const clickStart = await page.evaluate(() => ({
    screen: window.__brankas.state.screen,
    empLeft: window.__brankas.state.empLeft,
    smokeLeft: window.__brankas.state.smokeLeft,
  }));
  const clickOk = titleBefore === 'title' && clickStart.screen === 'play'
    && clickStart.empLeft === 2 && clickStart.smokeLeft === 2;
  console.log('click-to-start:', JSON.stringify({ titleBefore, ...clickStart }),
    clickOk ? 'PASS (start click spent no tool)' : '*** FAIL ***');

  // --- live playtest: start, walk right, EMP x2, smoke x2, pause + resume
  // with P, restart with Space after a forced lose. The x2 tool presses
  // prove keyup releases the key (audit R1: a stuck key would swallow
  // the second edge-triggered use); the second P proves pause can be
  // resumed from the keyboard, not only by clicking.
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  // Hold Space across frames (a quick press can fall between two slow
  // headless frames and never be sampled — same reason tool keys are held).
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ x: Math.round(window.__brankas.state.player.x), screen: window.__brankas.state.screen }));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  // Capture the walk BEFORE the park/restart below move the thief.
  const walked = await page.evaluate(() => Math.round(window.__brankas.state.player.x));
  // Park the thief on the shadow carpet and the guards far away before
  // the slow key-hold sequence: standing still in the open gets the
  // thief caught mid-test (Sari's patrol reaches the spawn lane), which
  // says nothing about the keys being tested.
  await page.evaluate(() => {
    const s = window.__brankas.state;
    s.player.x = 320; s.player.y = 500;
    for (const g of s.guards) { g.x = 60; g.y = 740; g.angle = Math.PI; g.state = 'patrol'; g.path = []; }
  });
  await page.waitForTimeout(200);
  // Hold each tool key down across frames: at headless swiftshader FPS
  // a quick press can fall between two animation frames and never be
  // sampled by the game loop.
  const holdKey = async (key) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
    await page.waitForTimeout(200);
  };
  await holdKey('KeyQ');
  await holdKey('KeyQ');
  await holdKey('KeyF');
  await holdKey('KeyF');
  // Capture the tool counts BEFORE the restart below resets the state.
  const tools = await page.evaluate(() => ({
    empLeft: window.__brankas.state.empLeft,
    smokeLeft: window.__brankas.state.smokeLeft,
    smokes: window.__brankas.state.smokes.length,
  }));
  console.log('playtest tools after Qx2 + Fx2:', JSON.stringify(tools));
  await holdKey('KeyP');
  const paused = await page.evaluate(() => window.__brankas.state.screen);
  await holdKey('KeyP');
  const resumed = await page.evaluate(() => window.__brankas.state.screen);
  // Forced lose, then restart with Space (the live game reaches lose
  // only by being caught; the restart path itself is what is tested).
  await page.evaluate(() => { window.__brankas.state.screen = 'lose'; });
  await page.waitForTimeout(200);
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    x: Math.round(window.__brankas.state.player.x),
    screen: window.__brankas.state.screen,
    empLeft: window.__brankas.state.empLeft,
    smokeLeft: window.__brankas.state.smokeLeft,
    smokes: window.__brankas.state.smokes.length,
    status: document.querySelector('#status')?.textContent ?? '',
  }));
  console.log('playtest before:', JSON.stringify(before), 'paused:', paused, 'resumed:', resumed, 'after:', JSON.stringify(after));
  // Walk distance is small at headless swiftshader FPS (few frames per
  // second, dt clamped); the exact 150px/s is proven by the node test.
  // After the forced-lose restart the state is fresh: emp/smoke back to 2.
  const playOk = walked > before.x + 10 && tools.empLeft === 0 && tools.smokeLeft === 0
    && tools.smokes === 2 && paused === 'pause' && resumed === 'play'
    && after.screen === 'play' && after.empLeft === 2 && after.smokeLeft === 2;
  console.log(playOk ? 'playtest PASS (walk + EMP x2 + smoke x2 + P pause/resume + Space restart)' : '*** playtest FAIL ***');
  if (!playOk) code = 1;
  try {
    await page.screenshot({ path: '/tmp/brankas-playtest.jpg', type: 'jpeg', quality: 82 });
  } catch (err) {
    console.log('playtest screenshot skipped (flake):', err.message.slice(0, 120));
  }
  console.log('page errors:', errors.length ? errors : 'none');
  if (errors.length) code = 1;
  await browser.close();
} catch (err) {
  console.error('FAILED:', err.message);
  code = 1;
} finally {
  server.kill();
}
process.exit(code);
