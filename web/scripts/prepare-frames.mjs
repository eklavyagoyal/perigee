import { spawn } from 'node:child_process';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [input, ...args] = process.argv.slice(2);
const option = flag => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const name = option('--name') ?? 'descent-v1';
const mobileInput = option('--mobile');

async function run() {
  if (!input || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Usage: npm run frames -- /path/clip.mp4 --name descent-v1 [--mobile /path/portrait.mp4]');
  for (let i = 0; i < args.length; i += 2) {
    if (!['--name', '--mobile'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Invalid options. Use --name and optionally --mobile.');
  }
  const source = resolve(input);
  await access(source);
  if (mobileInput) await access(resolve(mobileInput));
  const destination = resolve(root, 'public', 'sequences', name);
  let exists = false;
  try { await access(destination); exists = true; } catch { /* New output only. */ }
  if (exists) throw new Error(`Refusing to overwrite ${destination}. Choose a new --name.`);
  await mkdir(destination, { recursive: true });
  const manifest = { version: 1 };
  async function encode(file, variant, width, height) {
    const directory = resolve(destination, variant);
    await mkdir(directory);
    const filters = `fps=24,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    await new Promise((accept, reject) => {
      const child = spawn(process.env.FFMPEG_PATH || ffmpeg, ['-hide_banner', '-nostdin', '-n', '-i', file, '-an', '-vf', filters, '-frames:v', '601', '-c:v', 'libwebp', '-quality', '78', '-compression_level', '4', '-start_number', '0', resolve(directory, 'frame-%05d.webp')], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? accept() : reject(new Error(`FFmpeg exited with ${code}. Partial output is retained at ${destination}.`)));
    });
    const count = (await readdir(directory)).filter(file => /^frame-\d{5}\.webp$/.test(file)).length;
    if (count < 2 || count > 600) throw new Error('Use a clip with 2–600 frames at 24 fps (at most 25 seconds). Partial output is retained; choose a new name for your next attempt.');
    return { prefix: `/sequences/${name}/${variant}/`, count, width, height, fps: 24 };
  }
  manifest.desktop = await encode(source, 'desktop', 1600, 900);
  if (mobileInput) {
    manifest.mobile = await encode(resolve(mobileInput), 'mobile', 768, 1366);
    if (Math.abs(manifest.mobile.count - manifest.desktop.count) > 2) throw new Error('Desktop and mobile must have matching durations and chapter timing. Partial output is retained.');
  }
  await writeFile(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(`Ready: ${destination}\nSet NEXT_PUBLIC_SCENE_MANIFEST=/sequences/${name}/manifest.json and restart/rebuild Next.js.`);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
