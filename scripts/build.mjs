import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSnapshot } from '../public/lib/racing.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = resolve(root, process.argv[2] || 'resultados.txt');
const raw = JSON.parse(await readFile(input, 'utf8'));
let sourceUpdatedAt = null;
try {
  sourceUpdatedAt = execFileSync('git', ['log', '-1', '--format=%cI', '--', input], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
} catch {}
let metadata = {};
if (!process.argv[2]) {
  try { metadata = JSON.parse(await readFile(resolve(root, 'resultados.meta.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const snapshot = normalizeSnapshot(raw, { sourceUpdatedAt, ...metadata });
await mkdir(resolve(root, 'public/data'), { recursive: true });
await writeFile(resolve(root, 'public/data/races.json'), JSON.stringify(snapshot));
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
console.log(`Red Zone: ${snapshot.races.length} carreras. Sitio listo en dist/.`);
