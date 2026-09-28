// Renders index.html frame by frame in headless Chrome and muxes it with the track through ffmpeg.
//   node render.mjs           -> out/magic.mp4 (1080x1920, 24 fps, assets/magic.m4a)
//   node render.mjs --sheet   -> out/sheet.png (6 frames across the clip, for a quick look)
// The page draws into <canvas id="c">, sets window.ready = true and exposes async window.frame(t) (t in seconds).
// Chrome: the system Google Chrome on macOS; set CHROME=/path/to/chrome elsewhere.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

const ROOT = import.meta.dirname, OUT = resolve(ROOT, 'out'), FPS = 24, sheet = process.argv.includes('--sheet');
const { duration } = JSON.parse(readFileSync(resolve(ROOT, 'assets/timing.json')));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const f = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (relative(ROOT, f).startsWith('..')) return res.writeHead(403).end();
  let body; try { body = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, protocolTimeout: 0, args: ['--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization', '--window-size=1080,1920'] });
const page = await browser.newPage();
page.on('console', m => ['error', 'warn'].includes(m.type()) && console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 120000 });
const grab = t => page.evaluate(async t => { await window.frame(t); return document.getElementById('c').toDataURL('image/jpeg', .92); }, t);
mkdirSync(OUT, { recursive: true });

if (sheet) {
  const cells = [];
  for (let i = 0; i < 6; i++) cells.push(await grab(+(.3 + i * (duration - .6) / 5).toFixed(2)));
  const url = await page.evaluate(async cells => { const w = 360, h = 640, s = document.createElement('canvas'); s.width = w * cells.length; s.height = h;
    const x = s.getContext('2d'); for (let i = 0; i < cells.length; i++) { const im = new Image(); im.src = cells[i]; await im.decode(); x.drawImage(im, i * w, 0, w, h); }
    return s.toDataURL('image/png'); }, cells);
  writeFileSync(resolve(OUT, 'sheet.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote out/sheet.png');
} else {
  const n = Math.round(duration * FPS), t0 = Date.now();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', resolve(ROOT, 'assets/magic.m4a'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', resolve(OUT, 'magic.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = Buffer.from((await grab(i / FPS)).split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 48 === 0) console.log(`frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote out/magic.mp4');
}
await browser.close(); server.close(); process.exit(0);
