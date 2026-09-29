import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectSnapshots } from '../scripts/snapshots.mjs';
import { parseCatalog, loadVersion } from '../public/lib/versions.js';

const current = 'a'.repeat(40), old = 'b'.repeat(40);
const catalog = { version: 1, latest: current, versions: [current, old].map(id => ({ id, file: `snapshots/${id}.json` })) };
const rows = holder => [['1', 'Circuito', 'Sultan', '20', holder, '01:00.000']];

test('catálogo acepta solo snapshots publicados y rutas internas únicas', () => {
  assert.equal(parseCatalog(catalog), catalog);
  assert.throws(() => parseCatalog({ ...catalog, latest: old }));
  assert.throws(() => parseCatalog({ ...catalog, versions: [catalog.versions[0], catalog.versions[0]] }));
  assert.throws(() => parseCatalog({ ...catalog, versions: [{ id: current, file: 'https://evil.test/file.json' }] }));
  assert.throws(() => parseCatalog({ ...catalog, versions: [] }));
});

test('selecciona el corte y compara solo con el inmediatamente anterior', async () => {
  const requested = [];
  const fetcher = async url => { requested.push(url); return { ok: true, json: async () => rows(url.includes(current) ? 'Nuevo' : 'Anterior') }; };
  const latest = await loadVersion(catalog, current, fetcher);
  assert.equal(latest.snapshot.races[0].holder, 'Nuevo');
  assert.equal(latest.previous.races[0].holder, 'Anterior');
  assert.equal(latest.compared.id, old);
  assert.equal(requested.length, 2);
  const first = await loadVersion(catalog, old, fetcher);
  assert.equal(first.previous, null);
  assert.equal(first.compared, null);
  await assert.rejects(loadVersion(catalog, 'unknown', fetcher), /disponible/);
  await assert.rejects(loadVersion(catalog, current, async () => ({ ok: false })), /cargar/);
});

test('historial Git conserva cortes reales, omite duplicados consecutivos y mantiene reversiones', async () => {
  const root = await mkdtemp(join(tmpdir(), 'redzone-history-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git(['init']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
    const commit = async (holder, pretty = false) => {
      await writeFile(join(root, 'resultados.txt'), JSON.stringify(rows(holder), null, pretty ? 2 : 0));
      git(['add', 'resultados.txt']); git(['commit', '-m', 'Snapshot']); return git(['rev-parse', 'HEAD']);
    };
    const first = await commit('Primero');
    await commit('Primero', true);
    const second = await commit('Segundo');
    const reverted = await commit('Primero');
    const versions = await collectSnapshots(root);
    assert.equal(versions.length, 3);
    assert.equal(versions[0].id, reverted);
    assert.equal(versions[1].id, second);
    assert.equal(versions[2].snapshot.races[0].holder, 'Primero');
    assert.ok(versions.every(entry => entry.commit && entry.snapshot.sourceUpdatedAt));
    assert.equal(versions[2].id, first);
    await writeFile(join(root, 'resultados.txt'), JSON.stringify(rows('Local')));
    assert.match((await collectSnapshots(root))[0].id, /^local-/);
    await writeFile(join(root, 'resultados.txt'), 'invalid');
    await assert.rejects(collectSnapshots(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('subir solo un TXT nuevo no reutiliza la fecha de captura anterior', async () => {
  const root = await mkdtemp(join(tmpdir(), 'redzone-metadata-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git(['init']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
    await writeFile(join(root, 'resultados.txt'), JSON.stringify(rows('Primero')));
    await writeFile(join(root, 'resultados.meta.json'), JSON.stringify({ capturedAt: '2024-02-28T16:00:00Z' }));
    git(['add', '.']); git(['commit', '-m', 'Con fecha de captura']);
    await writeFile(join(root, 'resultados.txt'), JSON.stringify(rows('Segundo')));
    git(['add', 'resultados.txt']); git(['commit', '-m', 'Solo TXT']);
    const versions = await collectSnapshots(root);
    assert.equal(versions[0].snapshot.capturedAt, null);
    assert.equal(versions[1].snapshot.capturedAt, '2024-02-28T16:00:00Z');
    assert.ok(versions[0].snapshot.sourceUpdatedAt);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('la web no expone formularios de carga ni manejadores de importación', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /type="file"|import-current|import-previous/);
  assert.doesNotMatch(app, /file\.text\(|import-current|import-previous/);
  assert.match(html, /id="snapshot-select"/);
});
