import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { normalizeSnapshot } from '../public/lib/racing.js';

export async function collectSnapshots(root, input = 'resultados.txt') {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const current = JSON.parse(await readFile(resolve(root, input), 'utf8'));
  const history = input === 'resultados.txt' ? git(['log', '--reverse', '--format=%H %cI', '--', input]).split('\n').filter(Boolean) : [];
  const versions = [];
  const fingerprint = snapshot => createHash('sha256').update(JSON.stringify(snapshot.races)).digest('hex');
  for (const line of history) {
    const [commit, sourceUpdatedAt] = line.split(' ');
    let historicalMetadata = {};
    if (git(['ls-tree', '--name-only', commit, '--', 'resultados.meta.json']) && git(['log', '-1', '--format=%H', commit, '--', 'resultados.meta.json']) === commit) historicalMetadata = JSON.parse(git(['show', `${commit}:resultados.meta.json`]));
    const snapshot = normalizeSnapshot(JSON.parse(git(['show', `${commit}:${input}`])), { ...historicalMetadata, sourceUpdatedAt });
    const hash = fingerprint(snapshot);
    if (versions.at(-1)?.hash !== hash) versions.push({ id: commit, commit, hash, snapshot });
  }
  versions.reverse();
  let metadata = {};
  if (input === 'resultados.txt' && git(['status', '--porcelain', '--', 'resultados.meta.json'])) {
    try { metadata = JSON.parse(await readFile(resolve(root, 'resultados.meta.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const snapshot = normalizeSnapshot(current, metadata);
  const hash = fingerprint(snapshot);
  if (!versions.length || versions[0].hash !== hash) versions.unshift({ id: `local-${hash.slice(0, 16)}`, commit: null, hash, snapshot });
  return versions;
}
