import { normalizeSnapshot } from './racing.js';

export function parseCatalog(value) {
  if (value?.version !== 1 || !Array.isArray(value.versions) || !value.versions.length) throw new Error('El historial de versiones no está disponible.');
  const ids = new Set();
  for (const entry of value.versions) {
    if (!/^(?:[a-f0-9]{40}|local-[a-f0-9]{16})$/.test(entry.id) || entry.file !== `snapshots/${entry.id}.json` || ids.has(entry.id)) throw new Error('El historial de versiones no es válido.');
    ids.add(entry.id);
  }
  if (value.latest !== value.versions[0].id) throw new Error('No se encontró la última versión.');
  return value;
}

export async function loadVersion(catalog, id, fetcher = fetch) {
  const index = catalog.versions.findIndex(entry => entry.id === id);
  if (index < 0) throw new Error('Esta versión ya no está disponible.');
  const entries = catalog.versions.slice(index, index + 2);
  const snapshots = await Promise.all(entries.map(async entry => {
    const response = await fetcher(`./data/${entry.file}`);
    if (!response.ok) throw new Error('No se pudo cargar la versión. Inténtalo de nuevo.');
    return normalizeSnapshot(await response.json());
  }));
  return { snapshot: snapshots[0], previous: snapshots[1] ?? null, selected: entries[0], compared: entries[1] ?? null };
}
