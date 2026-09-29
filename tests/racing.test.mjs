import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseTime, formatTime, normalizeSnapshot, filterRaces, sortRaces, getRanking, toCsv } from '../public/lib/racing.js';

const raw = JSON.parse(await readFile(new URL('../resultados.txt', import.meta.url), 'utf8'));
const snapshot = normalizeSnapshot(raw);

test('normaliza la captura real y elimina encabezados repetidos sin perder carreras', () => {
  assert.equal(snapshot.races.length, raw.filter(row => /^\d+$/.test(row[0])).length);
  assert.ok(snapshot.races.every(race => Number.isInteger(race.timeMs) && race.timeMs > 0));
  assert.equal(new Set(snapshot.races.map(race => race.key)).size, snapshot.races.length);
});

test('interpreta milisegundos y límites de tiempo sin confundir 3:06 con 3,06 segundos', () => {
  assert.equal(parseTime('03 Minutos 06:008 Segundos'), 186008);
  assert.equal(parseTime('3:06.008'), 186008);
  assert.equal(parseTime('3:06'), 186000);
  assert.equal(parseTime('186,008'), 186008);
  assert.equal(parseTime('00:01.5'), 1500);
  assert.equal(parseTime('1:60'), null);
  assert.equal(parseTime(''), null);
  assert.equal(formatTime(186008), '03:06.008');
});

test('combina vehículo, piloto, rango de tiempo y checkpoints con AND', () => {
  const race = snapshot.races.find(row => row.vehicle === 'Uranus');
  const result = filterRaces(snapshot.races, { vehicle: race.vehicle, exactHolder: race.holder, minTime: formatTime(race.timeMs), maxTime: formatTime(race.timeMs), minCheckpoints: race.checkpoints, maxCheckpoints: race.checkpoints });
  assert.ok(result.some(row => row.key === race.key));
  assert.ok(result.every(row => row.vehicle === race.vehicle && row.holder === race.holder && row.timeMs === race.timeMs && row.checkpoints === race.checkpoints));
  assert.equal(filterRaces(snapshot.races, { q: 'carrera-que-no-existe-999999' }).length, 0);
});

test('porcentajes y conteos usan el archivo filtrado sin fusionar apodos', () => {
  const races = [
    { holder: 'Neo', vehicle: 'Sultan', timeMs: 10 },
    { holder: 'Neo', vehicle: 'Infernus', timeMs: 20 },
    { holder: '[5V]Neo', vehicle: 'Sultan', timeMs: 30 },
    { holder: '', vehicle: 'Sultan', timeMs: null }
  ];
  const ranking = getRanking(races);
  assert.equal(ranking[0].count, 2);
  assert.equal(ranking[0].share, 50);
  assert.equal(ranking[0].vehicleCount, 2);
  assert.equal(ranking.length, 2);
  assert.equal(ranking[0].delta, null);
});

test('comparación muestra pérdidas incluso si un piloto pierde todos sus récords', () => {
  const old = [{ holder: 'A', vehicle: 'Sultan', timeMs: 10 }, { holder: 'B', vehicle: 'Sultan', timeMs: 20 }];
  const current = old.map(row => ({ ...row, holder: 'B' }));
  const ranking = getRanking(current, old);
  assert.equal(ranking.find(row => row.name === 'B').delta, 1);
  assert.equal(ranking.find(row => row.name === 'A').delta, -1);
  assert.equal(ranking.find(row => row.name === 'A').count, 0);
});

test('ordena tiempos numéricamente y deja tiempos desconocidos al final', () => {
  const data = [{ timeMs: null }, { timeMs: 999 }, { timeMs: 10000 }, { timeMs: 1000 }];
  assert.deepEqual(sortRaces(data, 'time-asc').map(row => row.timeMs), [999, 1000, 10000, null]);
  assert.deepEqual(sortRaces(data, 'time-desc').map(row => row.timeMs), [10000, 1000, 999, null]);
});

test('favoritos se identifican por carrera y vehículo, no por posición cambiante', () => {
  const race = snapshot.races[0];
  assert.equal(filterRaces([{ ...race, id: '99999' }], { favorites: true }, new Set([race.key])).length, 1);
});

test('importación rechaza formatos incorrectos y neutraliza fechas inválidas', () => {
  assert.throws(() => normalizeSnapshot({ rows: [] }), /archivo/);
  assert.throws(() => normalizeSnapshot([]), /válidas/);
  const imported = normalizeSnapshot({ races: snapshot.races.slice(0, 1), capturedAt: 'fecha falsa' });
  assert.equal(imported.capturedAt, null);
});

test('CSV escapa comillas, saltos y fórmulas introducidas por nombres importados', () => {
  const csv = toCsv([['=HYPERLINK("https://example.com")', 'A,B', 'Carrera\n2', '+cmd', '@sum', 'Normal']]);
  assert.ok(csv.startsWith('\uFEFF"\'=HYPERLINK'));
  assert.ok(csv.includes('"A,B"'));
  assert.ok(csv.includes('"Carrera\n2"'));
  assert.ok(csv.includes('"\'+cmd"'));
  assert.ok(csv.includes('"\'@sum"'));
});
