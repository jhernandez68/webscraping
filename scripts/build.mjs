import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSnapshots } from './snapshots.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const versions = await collectSnapshots(root, process.argv[2] || 'resultados.txt');
const snapshot = versions[0].snapshot;
await rm(resolve(root, 'public/data/snapshots'), { recursive: true, force: true });
await mkdir(resolve(root, 'public/data/snapshots'), { recursive: true });
const manifest = { version: 1, latest: versions[0].id, versions: [] };
for (const version of versions) {
  const file = `snapshots/${version.id}.json`;
  await writeFile(resolve(root, 'public/data', file), JSON.stringify(version.snapshot));
  manifest.versions.push({ id: version.id, commit: version.commit, file, capturedAt: version.snapshot.capturedAt, publishedAt: version.snapshot.sourceUpdatedAt, raceCount: version.snapshot.races.length });
}
await writeFile(resolve(root, 'public/data/versions.json'), JSON.stringify(manifest));
await writeFile(resolve(root, 'public/data/races.json'), JSON.stringify(snapshot));
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
console.log(`Red Zone: ${snapshot.races.length} carreras y ${versions.length} versiones. Sitio listo en dist/.`);
