import { access, cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(resolve(root, '.env.local')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const standalone = resolve(root, '.next/standalone');
try { await access(resolve(standalone, 'server.js')); }
catch { console.error('No standalone build found. Run npm run build first.'); process.exit(1); }

// These are generated deployment copies, not source files. Next does not copy them itself.
await cp(resolve(root, 'public'), resolve(standalone, 'public'), { recursive: true });
await cp(resolve(root, '.next/static'), resolve(standalone, '.next/static'), { recursive: true });
const child = spawn(process.execPath, [resolve(standalone, 'server.js')], {
  cwd: standalone, stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '5173', HOSTNAME: process.env.PERIGEE_HOST || '127.0.0.1', NEXT_TELEMETRY_DISABLED: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
