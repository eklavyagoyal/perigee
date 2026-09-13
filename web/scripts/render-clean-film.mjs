import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import ffmpeg from 'ffmpeg-static';

// Render the existing scene directly: no website DOM, typography, branding or UI.
// Frames are streamed to FFmpeg, never accumulated as a multi-GB image directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];
if (!destination || !destination.endsWith('.mp4')) {
  throw new Error('Usage: node scripts/render-clean-film.mjs /absolute/path/new-film.mp4');
}
const output = resolve(destination);
try { await access(output); throw new Error(`Refusing to overwrite ${output}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(dirname(output), { recursive: true });
const width = 1920, height = 1080, fps = 24, count = 480;
const require = createRequire(import.meta.url);
const threeDir = dirname(require.resolve('three'));
const source = await readFile(join(root, 'src/scene.ts'), 'utf8');
const scene = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;background:#080d12;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style><script type="importmap">{"imports":{"three":"/three.module.js"}}</script></head><body><canvas id="scene" width="${width}" height="${height}"></canvas><script type="module">import { OrbitalScene } from '/scene.js'; const canvas=document.getElementById('scene'); const renderer=new OrbitalScene(canvas); renderer.resize(${width},${height},1); await renderer.ready; window.renderFrame=(index)=>{ const time=index/${fps}; const progress=index/(${count}-1); renderer.render(progress,time); return canvas.toDataURL('image/png').split(',')[1]; }; window.sceneReady=true;</script></body></html>`;
const assets = new Map([
  ['/', ['text/html', Buffer.from(pageHtml)]],
  ['/scene.js', ['text/javascript', Buffer.from(scene)]],
  ['/three.module.js', ['text/javascript', await readFile(join(threeDir, 'three.module.js'))]],
  ['/three.core.js', ['text/javascript', await readFile(join(threeDir, 'three.core.js'))]],
  ['/images/orbital-earth.png', ['image/png', await readFile(join(root, 'public/images/orbital-earth.png'))]],
]);
const server = createServer((request, response) => {
  const asset = assets.get(request.url);
  if (!asset) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': asset[0] }); response.end(asset[1]);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const cachedBrowser = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell');
let browser, encoder;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PERIGEE_CHROMIUM || (existsSync(cachedBrowser) ? cachedBrowser : undefined), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.sceneReady === true);
  if (await page.locator('body').innerText() !== '') throw new Error('Render page unexpectedly contains text.');
  encoder = spawn(process.env.FFMPEG_PATH || ffmpeg, ['-hide_banner', '-loglevel', 'error', '-n', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encoderErrors = '';
  encoder.stderr.on('data', chunk => { encoderErrors += chunk.toString(); });
  const finished = new Promise((resolve, reject) => { encoder.once('error', reject); encoder.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg ${code}: ${encoderErrors}`))); });
  // Attach a rejection handler while frames are being produced, then await below.
  finished.catch(() => {});
  encoder.stdin.on('error', () => {});
  for (let index = 0; index < count; index++) {
    const png = Buffer.from(await page.evaluate(i => window.renderFrame(i), index), 'base64');
    if ([0, 144, 240, 336, 432, 479].includes(index)) {
      await writeFile(join(dirname(output), `clean-frame-${String(index).padStart(3, '0')}.png`), png);
    }
    if (encoder.exitCode !== null || encoder.stdin.destroyed) throw new Error(`Encoder stopped: ${encoderErrors}`);
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (index % 48 === 0) console.log(`Clean scene: ${index}/${count} frames`);
  }
  encoder.stdin.end();
  await finished;
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(join(dirname(output), 'clean-video-qa.txt'), `Source: web/src/scene.ts\n${width}x${height}, ${fps} fps, ${count} frames, 20 seconds\nNo HTML text, logo, overlay, caption or UI is captured.\nBrowser errors: ${JSON.stringify(errors)}\n`);
  console.log(`Rendered ${output}`);
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill('SIGTERM');
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
