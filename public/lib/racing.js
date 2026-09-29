export function parseTime(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = String(value ?? '').trim();
  let match = text.match(/^(\d+)\s*Minutos?\s+(\d{1,2})[:.](\d{1,3})\s*Segundos?$/i);
  if (!match) match = text.match(/^(\d+):(\d{2})(?:[.:,](\d{1,3}))?$/);
  if (match) {
    if (Number(match[2]) >= 60) return null;
    return Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number((match[3] ?? '').padEnd(3, '0'));
  }
  if (/^\d+(?:[.,]\d{1,3})?$/.test(text)) return Math.round(Number(text.replace(',', '.')) * 1000);
  return null;
}

export function formatTime(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return 'Sin tiempo';
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function raceKey(race) {
  return JSON.stringify([String(race.name).trim(), String(race.vehicle).trim()]);
}

export function normalizeSnapshot(input, metadata = {}) {
  const rows = Array.isArray(input) ? input : input?.races;
  if (!Array.isArray(rows)) throw new Error('El archivo debe contener la lista de carreras de resultados.txt o un snapshot JSON.');
  const seen = new Set();
  let skipped = 0;
  const races = [];
  for (const row of rows) {
    const array = Array.isArray(row);
    if (array && !/^\d+$/.test(String(row[0]))) continue;
    if (!array && (!row || typeof row !== 'object')) { skipped++; continue; }
    const name = String(array ? row[1] ?? '' : row.name ?? '').trim();
    const vehicle = String(array ? row[2] ?? '' : row.vehicle ?? '').trim();
    const checkpoints = Number(array ? row[3] : row.checkpoints);
    const rawHolder = String(array ? row[4] ?? '' : row.holder ?? '').trim();
    const holder = /^(?:-|n\/?a|ninguno|sin r[eé]cord)$/i.test(rawHolder) ? '' : rawHolder;
    const rawTime = array ? row[5] : (Object.hasOwn(row, 'timeMs') ? row.timeMs : row.time);
    const timeMs = rawTime === null ? null : parseTime(rawTime);
    if (!name || !vehicle || !Number.isInteger(checkpoints) || checkpoints < 0) { skipped++; continue; }
    const key = raceKey({ name, vehicle });
    if (seen.has(key)) continue;
    seen.add(key);
    races.push({ id: String(array ? row[0] : row.id ?? races.length + 1), key, name, vehicle, checkpoints, holder, timeMs });
  }
  if (!races.length) throw new Error('No se encontraron carreras válidas. Revisa el formato del archivo.');
  const safeDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
  return {
    version: 1,
    source: metadata.source ?? input.source ?? 'Red Zone',
    capturedAt: safeDate(metadata.capturedAt ?? input.capturedAt),
    sourceUpdatedAt: safeDate(metadata.sourceUpdatedAt ?? input.sourceUpdatedAt),
    importedName: metadata.importedName ?? input.importedName ?? null,
    skipped,
    races
  };
}

export function filterRaces(races, filters = {}, favorites = new Set()) {
  const query = normalize(filters.q);
  const holder = normalize(filters.holder);
  const min = parseTime(filters.minTime);
  const max = parseTime(filters.maxTime);
  return races.filter(race => {
    if (query && !normalize(`${race.name} ${race.vehicle} ${race.holder}`).includes(query)) return false;
    if (filters.vehicle && race.vehicle !== filters.vehicle) return false;
    if (holder && !normalize(race.holder).includes(holder)) return false;
    if (filters.exactHolder && race.holder !== filters.exactHolder) return false;
    if (min !== null && (race.timeMs === null || race.timeMs < min)) return false;
    if (max !== null && (race.timeMs === null || race.timeMs > max)) return false;
    if (filters.minCheckpoints !== '' && filters.minCheckpoints != null && race.checkpoints < Number(filters.minCheckpoints)) return false;
    if (filters.maxCheckpoints !== '' && filters.maxCheckpoints != null && race.checkpoints > Number(filters.maxCheckpoints)) return false;
    if (filters.favorites && !favorites.has(race.key)) return false;
    if (filters.record === 'with' && (!race.holder || race.timeMs === null)) return false;
    if (filters.record === 'without' && race.holder && race.timeMs !== null) return false;
    return true;
  });
}

export function sortRaces(races, sort = 'name') {
  return [...races].sort((a, b) => {
    if (sort === 'time-asc' || sort === 'time-desc') {
      if (a.timeMs === null) return b.timeMs === null ? 0 : 1;
      if (b.timeMs === null) return -1;
      return (a.timeMs - b.timeMs) * (sort === 'time-desc' ? -1 : 1);
    }
    if (sort === 'checkpoints-desc') return b.checkpoints - a.checkpoints || a.name.localeCompare(b.name);
    if (sort === 'checkpoints-asc') return a.checkpoints - b.checkpoints || a.name.localeCompare(b.name);
    if (sort === 'vehicle') return a.vehicle.localeCompare(b.vehicle) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name, 'es', { numeric: true });
  });
}

export function getRanking(races, previous = null) {
  const count = data => {
    const map = new Map();
    for (const race of data) {
      if (!race.holder || race.timeMs === null) continue;
      if (!map.has(race.holder)) map.set(race.holder, { name: race.holder, count: 0, vehicles: new Set(), races: [] });
      const player = map.get(race.holder);
      player.count++;
      player.vehicles.add(race.vehicle);
      player.races.push(race);
    }
    return map;
  };
  const counts = count(races);
  const prior = previous ? count(previous) : null;
  if (prior) for (const name of prior.keys()) if (!counts.has(name)) counts.set(name, { name, count: 0, vehicles: new Set(), races: [] });
  let lastCount = null;
  let position = 0;
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((player, i) => {
    if (player.count !== lastCount) position = i + 1;
    lastCount = player.count;
    return { ...player, position, vehicleCount: player.vehicles.size, share: races.length ? player.count / races.length * 100 : 0, delta: prior ? player.count - (prior.get(player.name)?.count ?? 0) : null };
  });
}

export function getVehicles(races) {
  const map = new Map();
  for (const race of races) {
    if (!map.has(race.vehicle)) map.set(race.vehicle, { name: race.vehicle, count: 0, bestMs: null, holders: new Set() });
    const vehicle = map.get(race.vehicle);
    vehicle.count++;
    if (race.holder && race.timeMs !== null) vehicle.holders.add(race.holder);
    if (race.timeMs !== null && (vehicle.bestMs === null || race.timeMs < vehicle.bestMs)) vehicle.bestMs = race.timeMs;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
