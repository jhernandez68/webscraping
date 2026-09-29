import { normalizeSnapshot, normalize, formatTime, parseTime, filterRaces, sortRaces, getRanking, getVehicles, toCsv } from './lib/racing.js';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  flag: '<path d="M4 22V3m0 1c5-5 11 5 16 0v11c-5 5-11-5-16 0"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v7m-5 1h10M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>',
  car: '<path d="m5 7 2-4h10l2 4 2 3v7H3v-7l2-3Zm-1 1h16M6 12h2m8 0h2M5 17v3m14-3v3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  filter: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  compare: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  spark: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3.3-.4 6.7-1.6 6.7-7.3a5.7 5.7 0 0 0-1.5-4A5.3 5.3 0 0 0 19 0s-1.2-.4-4 1.5a13.7 13.7 0 0 0-7 0C5.2-.4 4 0 4 0a5.3 5.3 0 0 0-.2 4A5.7 5.7 0 0 0 2.3 8c0 5.7 3.4 6.9 6.7 7.3A3.5 3.5 0 0 0 8 18v4"/>'
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.flag}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const number = value => new Intl.NumberFormat('es-CO').format(value);
const percent = value => `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
const date = value => value ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(value)) : 'Fecha de captura no disponible';
const views = { overview: ['Vista general', 'grid'], races: ['Explorar carreras', 'flag'], ranking: ['Clasificación', 'trophy'], garage: ['Garaje', 'car'], favorites: ['Mis favoritas', 'heart'] };
const main = document.querySelector('#main');
let original, snapshot, previous = null, vehicleAssets = {}, page = 1, toastTimer;
let favorites;
try { const saved = JSON.parse(localStorage.getItem('redzone:favorites') || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []); } catch { favorites = new Set(); }
const params = new URLSearchParams(location.search);
let view = Object.hasOwn(views, params.get('view')) ? params.get('view') : 'overview';
const filterKeys = ['q', 'vehicle', 'holder', 'exactHolder', 'minTime', 'maxTime', 'minCheckpoints', 'maxCheckpoints', 'record', 'sort'];
let filters = Object.fromEntries(filterKeys.map(key => [key, params.get(key) || '']));

function hydrateIcons(scope = document) { scope.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3800); }
function syncUrl(push = false) { const url = new URL(location.href); url.search = ''; if (view !== 'overview') url.searchParams.set('view', view); for (const key of filterKeys) if (filters[key]) url.searchParams.set(key, filters[key]); if (push && url.href !== location.href) history.pushState({}, '', url); else history.replaceState({}, '', url); }
function dataDate() { return snapshot.capturedAt ? `Captura · ${date(snapshot.capturedAt)}` : snapshot.sourceUpdatedAt ? `Archivo · ${date(snapshot.sourceUpdatedAt)}` : snapshot.importedName || 'Archivo sin fecha de captura'; }
function validFilters() {
  const low = parseTime(filters.minTime), high = parseTime(filters.maxTime);
  if ((filters.minTime && low === null) || (filters.maxTime && high === null)) return 'Usa segundos o el formato mm:ss.000 para los tiempos.';
  if (low !== null && high !== null && low > high) return 'El tiempo mínimo debe ser menor o igual al máximo.';
  const minCp = filters.minCheckpoints, maxCp = filters.maxCheckpoints;
  if ([minCp, maxCp].some(x => x !== '' && (!Number.isInteger(Number(x)) || Number(x) < 0))) return 'Los checkpoints deben ser números enteros positivos.';
  if (minCp !== '' && maxCp !== '' && Number(minCp) > Number(maxCp)) return 'El mínimo de checkpoints debe ser menor o igual al máximo.';
  return '';
}
function filtered() { return validFilters() ? [] : filterRaces(snapshot.races, { ...filters, favorites: view === 'favorites' }, favorites); }
function previousFiltered() { return previous ? validFilters() ? [] : filterRaces(previous.races, { ...filters, favorites: view === 'favorites' }, favorites) : null; }
function delta(player) { if (player.delta === null) return ''; return `<span class="delta ${player.delta > 0 ? 'up' : player.delta < 0 ? 'down' : ''}">${player.delta > 0 ? '+' : ''}${player.delta} ${icon(player.delta > 0 ? 'spark' : 'compare')}</span>`; }
function carImage(name, className = '') { const asset = vehicleAssets[name]; return asset ? `<img class="car-image ${className}" src="./assets/vehicles/${asset.file}" alt="${esc(name)} de GTA San Andreas" loading="lazy" width="160" height="100">` : `<span class="car-placeholder ${className}">${icon('car')}</span>`; }

function renderNav() {
  document.querySelector('#navigation').innerHTML = Object.entries(views).map(([key, [label, glyph]]) => `<a href="?view=${key}" data-nav="${key}" class="nav-item ${view === key ? 'active' : ''}" ${view === key ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${key === 'favorites' ? `<span class="nav-count">${favorites.size}</span>` : key === 'races' && snapshot ? `<span class="nav-count">${number(snapshot.races.length)}</span>` : ''}</a>`).join('');
  document.querySelector('#breadcrumb').textContent = views[view][0];
}

function hero() {
  return `<section class="hero"><img class="hero-image" src="./assets/racing-hero.webp" alt="Ryder junto a un Elegy morado y un Infernus en Los Santos"><div class="hero-shade"></div><div class="hero-copy"><div class="hero-kicker"><span class="tiny-checker"></span> LOS SANTOS. SIN LÍMITES.</div><h1>CADA MILÉSIMA<br><span>CUENTA.</span></h1><p>Conoce la pista. Encuentra tu próxima carrera.<br>Descubre quién manda en Red Zone.</p><button class="button button-primary" data-nav="races">Explorar carreras ${icon('arrow')}</button></div><div class="hero-corner"><span class="status-dot"></span> SA-MP RACING CULTURE <span>01 / RZ</span></div></section>`;
}

function metrics() {
  const ranking = getRanking(snapshot.races), vehicles = getVehicles(snapshot.races);
  const leader = ranking[0];
  return `<section class="metrics" aria-label="Estadísticas del archivo"><div class="metric"><span class="metric-icon purple">${icon('flag')}</span><div><span class="metric-label">Carreras indexadas</span><strong>${number(snapshot.races.length)}</strong><small>Un circuito. Un nuevo desafío.</small></div></div><div class="metric"><span class="metric-icon blue">${icon('users')}</span><div><span class="metric-label">Pilotos con récord</span><strong>${number(ranking.length)}</strong><small>Los nombres que marcan el ritmo.</small></div></div><div class="metric"><span class="metric-icon pink">${icon('car')}</span><div><span class="metric-label">Vehículos diferentes</span><strong>${number(vehicles.length)}</strong><small>Encuentra tu máquina.</small></div></div><div class="metric leader-metric"><span class="metric-icon gold">${icon('trophy')}</span><div><span class="metric-label">Líder del ranking</span><strong>${esc(leader?.name || 'Sin récords')}</strong><small><span class="gold-text">${number(leader?.count || 0)} récords</span> · ${percent(leader?.share || 0)} del archivo</small></div></div></section>`;
}

function filtersPanel() {
  const cars = getVehicles(snapshot.races).sort((a, b) => a.name.localeCompare(b.name));
  const advanced = Boolean(filters.holder || filters.exactHolder || filters.minTime || filters.maxTime || filters.minCheckpoints || filters.maxCheckpoints || filters.record);
  return `<div class="filter-panel"><div class="search-line"><label class="search-box">${icon('search')}<input id="race-search" data-filter="q" type="search" autocomplete="off" placeholder="Busca una carrera, piloto o vehículo…" aria-label="Buscar carreras, pilotos o vehículos" value="${esc(filters.q)}"><kbd>/</kbd></label><label class="select-wrap">${icon('car')}<select data-filter="vehicle" aria-label="Filtrar por vehículo"><option value="">Todos los vehículos</option>${cars.map(car => `<option value="${esc(car.name)}" ${filters.vehicle === car.name ? 'selected' : ''}>${esc(car.name)} (${car.count})</option>`).join('')}</select></label><button class="button advanced-toggle ${advanced ? 'selected' : ''}" id="advanced-toggle" aria-expanded="${advanced}" aria-controls="advanced-filters">${icon('filter')} Filtros</button></div><div class="quick-filters"><span>ENCUENTRA TU RITMO</span><button data-preset="short" class="chip ${filters.maxTime === '1:00' && !filters.minTime ? 'selected' : ''}">Hasta 1 min</button><button data-preset="medium" class="chip ${filters.minTime === '1:00' && filters.maxTime === '3:00' ? 'selected' : ''}">1–3 minutos</button><button data-preset="long" class="chip ${filters.minTime === '3:00' && !filters.maxTime ? 'selected' : ''}">Desde 3 min</button><button data-preset="technical" class="chip ${filters.minCheckpoints === '40' ? 'selected' : ''}">40+ checkpoints</button><button class="clear-filters" id="clear-filters">Limpiar ${icon('x')}</button></div><div id="advanced-filters" class="advanced-filters" ${advanced ? '' : 'hidden'}><label>Piloto<input data-filter="holder" placeholder="Apodo o clan" value="${esc(filters.holder || filters.exactHolder)}"></label><label>Tiempo mínimo<input data-filter="minTime" placeholder="00:30.000" value="${esc(filters.minTime)}" aria-describedby="time-hint"></label><label>Tiempo máximo<input data-filter="maxTime" placeholder="03:00.000" value="${esc(filters.maxTime)}" aria-describedby="time-hint"></label><label>Checkpoints mín.<input data-filter="minCheckpoints" type="number" min="0" step="1" placeholder="0" value="${esc(filters.minCheckpoints)}"></label><label>Checkpoints máx.<input data-filter="maxCheckpoints" type="number" min="0" step="1" placeholder="Sin límite" value="${esc(filters.maxCheckpoints)}"></label><label>Récord<select data-filter="record"><option value="">Todas</option><option value="with" ${filters.record === 'with' ? 'selected' : ''}>Con récord</option><option value="without" ${filters.record === 'without' ? 'selected' : ''}>Sin récord</option></select></label><p id="time-hint">Tiempos en mm:ss.000 o segundos. El ranking y la exportación respetan estos filtros.</p></div><p class="filter-error" id="filter-error" role="status"></p></div>`;
}

function sectionTitle(kicker, title, right = '') { return `<div class="section-heading"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div>${right}</div>`; }

function render() {
  renderNav(); syncUrl();
  if (view === 'overview' || view === 'races' || view === 'favorites') {
    const title = view === 'favorites' ? 'Tu próxima parrilla.' : 'Encuentra tu próxima carrera.';
    main.innerHTML = `${view === 'overview' ? hero() + metrics() : `<div class="page-heading"><span class="eyebrow">${view === 'favorites' ? 'GUARDA. PRACTICA. SUPÉRATE.' : 'EL ARCHIVO DE RED ZONE'}</span><h1>${title}</h1><p>${view === 'favorites' ? 'Las carreras que quieres volver a correr. Guardadas en este dispositivo.' : 'Filtra por vehículo, piloto o tiempo. Cada récord tiene una historia.'}</p></div>`}<div class="content-grid"><section class="race-section">${sectionTitle('LA PISTA TE ESPERA', view === 'favorites' ? 'Carreras favoritas' : 'Explorar carreras', `<button class="text-button" id="export-races">${icon('download')} Exportar CSV</button>`)}${filtersPanel()}<div id="race-results"></div></section><aside class="insights" id="insights"></aside></div><section class="vehicle-section">${sectionTitle('ELIGE TU MÁQUINA', 'Íconos de San Andreas', `<button class="text-button" data-nav="garage">Ver garaje ${icon('arrow')}</button>`)}<div class="featured-vehicles">${getVehicles(snapshot.races).slice(0, 4).map(vehicleCard).join('')}</div></section><div class="data-caption">${icon('clock')} <span>${esc(dataDate())} · Los resultados corresponden al archivo cargado.</span></div>`;
    renderRaceResults();
  } else if (view === 'ranking') {
    main.innerHTML = `<div class="page-heading"><span class="eyebrow">EL CRONÓMETRO NO MIENTE</span><h1>Los dueños del récord.</h1><p>Un primer lugar por carrera. Descubre quién tiene más y cuánto domina.</p></div>${metrics()}${sectionTitle('CLASIFICACIÓN DE PILOTOS', 'Top records · Red Zone', `<button class="text-button" id="export-ranking">${icon('download')} Exportar ranking</button>`)}${filtersPanel()}<div id="ranking-results"></div><div class="data-caption">${icon('clock')} ${esc(dataDate())}</div>`;
    renderRanking();
  } else {
    main.innerHTML = `<div class="page-heading"><span class="eyebrow">DEL GARAJE A LA LEYENDA</span><h1>Elige tu máquina.</h1><p>Los vehículos de San Andreas que compiten en este archivo. Encuentra sus carreras.</p></div><label class="search-box garage-search">${icon('search')}<input id="garage-search" type="search" placeholder="Busca un vehículo…" aria-label="Buscar vehículo"></label><div class="garage-summary" id="garage-summary"></div><div class="garage-grid" id="garage-grid"></div>`;
    renderGarage('');
  }
  hydrateIcons();
}

function vehicleCard(vehicle) {
  return `<button class="vehicle-card" data-vehicle="${esc(vehicle.name)}"><div class="vehicle-top"><span>${esc(vehicleAssets[vehicle.name]?.category || 'SAN ANDREAS')}</span>${icon('arrow')}</div>${carImage(vehicle.name)}<div class="vehicle-bottom"><strong>${esc(vehicle.name)}</strong><span>${number(vehicle.count)} carreras</span></div></button>`;
}

function renderGarage(query) {
  const cars = getVehicles(snapshot.races).filter(car => normalize(car.name).includes(normalize(query)));
  document.querySelector('#garage-summary').textContent = `${cars.length} vehículos · Selecciona uno para ver sus carreras`;
  document.querySelector('#garage-grid').innerHTML = cars.length ? cars.map(vehicleCard).join('') : emptyState('No encontramos ese vehículo.', 'Prueba con otro nombre.', 'garage');
}

function emptyState(title, description, context = 'races') { return `<div class="empty-state">${icon(context === 'favorites' ? 'heart' : 'search')}<h3>${title}</h3><p>${description}</p>${context !== 'garage' ? `<button class="button button-primary" ${context === 'favorites' && !favorites.size ? 'data-nav="races"' : 'id="empty-reset"'}>${context === 'favorites' && !favorites.size ? 'Explorar carreras' : 'Limpiar filtros'} ${icon('arrow')}</button>` : ''}</div>`; }

function renderRaceResults() {
  const data = sortRaces(filtered(), filters.sort || 'name');
  const totalPages = Math.max(1, Math.ceil(data.length / 10));
  page = Math.min(page, totalPages);
  document.querySelector('#filter-error').textContent = validFilters();
  const slice = data.slice((page - 1) * 10, page * 10);
  document.querySelector('#race-results').innerHTML = `<div class="results-toolbar"><p><strong>${number(data.length)}</strong> carreras encontradas</p><label>Ordenar por <select id="sort-races" aria-label="Ordenar carreras">${[['name', 'Nombre A–Z'], ['time-asc', 'Menor tiempo'], ['time-desc', 'Mayor tiempo'], ['checkpoints-desc', 'Más checkpoints'], ['checkpoints-asc', 'Menos checkpoints'], ['vehicle', 'Vehículo']].map(([value, label]) => `<option value="${value}" ${(filters.sort || 'name') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>${data.length ? `<div class="table-wrap"><table class="race-table"><thead><tr><th scope="col">CARRERA</th><th scope="col">VEHÍCULO</th><th scope="col" class="cp-column">CP</th><th scope="col">RÉCORD ACTUAL</th><th scope="col">TIEMPO</th><th scope="col"><span class="sr-only">Favorita</span>${icon('heart')}</th></tr></thead><tbody>${slice.map(race => `<tr><td><button class="race-name" data-race="${esc(race.key)}"><span class="race-symbol">${icon('flag')}</span><span>${esc(race.name)}<small>#${esc(race.id)}</small></span></button></td><td><button class="vehicle-tag" data-vehicle="${esc(race.vehicle)}">${esc(race.vehicle)}</button></td><td class="cp-column muted">${race.checkpoints}</td><td><button class="holder-name" data-holder="${esc(race.holder)}" ${race.holder ? '' : 'disabled'}><span class="pilot-dot"></span>${esc(race.holder || 'Sin récord')}</button></td><td class="race-time">${formatTime(race.timeMs)}</td><td><button class="favorite-button ${favorites.has(race.key) ? 'is-favorite' : ''}" data-favorite="${esc(race.key)}" aria-label="${favorites.has(race.key) ? 'Quitar de' : 'Añadir a'} favoritas: ${esc(race.name)}" aria-pressed="${favorites.has(race.key)}">${icon('heart')}</button></td></tr>`).join('')}</tbody></table></div><div class="pagination"><span>${number((page - 1) * 10 + 1)}–${number(Math.min(page * 10, data.length))} de ${number(data.length)} carreras</span><div><button class="page-button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button><span>Página <strong>${page}</strong> de ${totalPages}</span><button class="page-button" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} aria-label="Página siguiente">›</button></div></div>` : emptyState(view === 'favorites' && !favorites.size ? 'Aquí empieza tu lista.' : 'La pista está vacía.', view === 'favorites' && !favorites.size ? 'Pulsa el corazón de una carrera para guardarla aquí.' : 'Ninguna carrera coincide con estos filtros. Prueba otra combinación.', view)}`;
  renderInsights(data);
}

function renderInsights(races) {
  const leaders = getRanking(races, previousFiltered()).slice(0, 5);
  document.querySelector('#insights').innerHTML = `<section class="leaderboard-panel"><div class="panel-heading"><span class="eyebrow">LOS MÁS RÁPIDOS</span><span class="gold-text">${icon('trophy')}</span></div><h2>Top pilotos<span>/${leaders.length < 5 ? leaders.length : '05'}</span></h2><p class="panel-subtitle">Más récords en las carreras filtradas</p><div class="mini-ranking">${leaders.length ? leaders.map((player, i) => `<button class="mini-player" data-holder="${esc(player.name)}"><span class="rank-number ${i === 0 ? 'first' : ''}">${String(player.position).padStart(2, '0')}</span><span class="player-info"><strong>${esc(player.name)}</strong><span>${percent(player.share)} de las carreras ${delta(player)}</span><span class="share-track"><span style="width:${Math.min(100, player.share)}%"></span></span></span><span class="player-count">${number(player.count)}<small>récords</small></span></button>`).join('') : '<p class="muted small">Sin récords para estos filtros.</p>'}</div><button class="leaderboard-link" data-nav="ranking">Ver clasificación completa ${icon('arrow')}</button></section><section class="pitstop"><span class="eyebrow">BUSCA TU SIGUIENTE RETO</span><h3>Otra vuelta.<br>Un mejor tiempo.</h3><p>Deja que la pista te encuentre.</p><button class="button button-quiet" id="random-race">${icon('spark')} Carrera aleatoria ${icon('arrow')}</button></section>`;
}

function renderRanking() {
  document.querySelector('#filter-error').textContent = validFilters();
  const data = filtered();
  const ranking = getRanking(data, previousFiltered());
  document.querySelector('#ranking-results').innerHTML = `<div class="ranking-info"><span>${number(ranking.length)} pilotos · ${number(data.length)} carreras en el filtro</span><span>${previous ? `Comparando con ${esc(previous.importedName || date(previous.capturedAt || previous.sourceUpdatedAt))}` : 'Carga un corte anterior en Mis datos para ver los cambios.'}</span></div>${ranking.length ? `<div class="ranking-podium">${ranking.slice(0, 3).map((player, i) => `<button class="podium-card podium-${i}" data-holder="${esc(player.name)}"><span class="podium-place">${icon('trophy')} #${player.position}</span><span class="podium-avatar">${esc(player.name.replace(/\[[^\]]*\]/g, '').slice(0, 2).toUpperCase() || 'RZ')}</span><h2>${esc(player.name)}</h2><strong>${number(player.count)}<small>récords</small></strong><span>${percent(player.share)} del filtro · ${player.vehicleCount} vehículos ${delta(player)}</span></button>`).join('')}</div><div class="table-wrap ranking-table"><table><thead><tr><th>POSICIÓN</th><th>PILOTO</th><th>RÉCORDS</th><th>DOMINIO DEL FILTRO</th><th>VEHÍCULOS</th>${previous ? '<th>CAMBIO</th>' : ''}<th><span class="sr-only">Ver carreras</span></th></tr></thead><tbody>${ranking.map(player => `<tr><td class="rank-number ${player.position === 1 ? 'first' : ''}">#${player.position}</td><td><button class="holder-name" data-holder="${esc(player.name)}">${esc(player.name)}</button></td><td class="ranking-count">${number(player.count)}</td><td><div class="dominance"><span class="share-track"><span style="width:${player.share}%"></span></span><span>${percent(player.share)}</span></div></td><td>${player.vehicleCount}</td>${previous ? `<td>${delta(player)}</td>` : ''}<td><button class="icon-button" data-holder="${esc(player.name)}" aria-label="Ver carreras de ${esc(player.name)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('Nadie en esta parrilla.', 'Prueba con otros filtros para encontrar pilotos.')}`;
}

function refreshResults() { syncUrl(); if (view === 'ranking') renderRanking(); else renderRaceResults(); }
function navigate(next, clear = false) { if (!Object.hasOwn(views, next)) return; view = next; page = 1; if (clear) filters = Object.fromEntries(filterKeys.map(key => [key, ''])); syncUrl(true); render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function openRace(key) {
  const race = snapshot.races.find(item => item.key === key); if (!race) return;
  document.querySelector('#detail-content').innerHTML = `<div class="dialog-head"><div><span class="eyebrow">EN LA PARRILLA · #${esc(race.id)}</span><h2 id="detail-title">${esc(race.name)}</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="Cerrar">${icon('x')}</button></div><div class="detail-car">${carImage(race.vehicle)}<span>${esc(race.vehicle)}</span></div><div class="detail-stats"><div><span>RÉCORD ACTUAL</span><strong class="purple-text">${formatTime(race.timeMs)}</strong></div><div><span>PILOTO</span><strong>${esc(race.holder || 'Sin récord')}</strong></div><div><span>CHECKPOINTS</span><strong>${race.checkpoints}</strong></div></div><p class="small muted">${esc(dataDate())}. Este archivo incluye el mejor tiempo de cada carrera, no su top completo.</p><div class="dialog-actions"><button class="button button-quiet" data-favorite="${esc(race.key)}">${icon('heart')} ${favorites.has(race.key) ? 'Quitar de favoritas' : 'Guardar carrera'}</button><button class="button button-primary" data-vehicle="${esc(race.vehicle)}">Más con ${esc(race.vehicle)} ${icon('arrow')}</button></div>`;
  if (!document.querySelector('#detail-dialog').open) document.querySelector('#detail-dialog').showModal();
}
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
function openData() { document.querySelector('#data-info').innerHTML = `<strong>${number(snapshot.races.length)} carreras cargadas</strong><span>${esc(dataDate())}</span>${previous ? `<span>Comparación: ${number(previous.races.length)} carreras</span>` : ''}`; document.querySelector('#data-dialog').showModal(); }
function download(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

document.addEventListener('click', event => {
  const target = event.target.closest('button, a[data-nav]'); if (!target) return;
  if (target.dataset.nav) { event.preventDefault(); navigate(target.dataset.nav, target.dataset.nav === 'overview' || target.dataset.nav === 'favorites'); return; }
  if (target.dataset.close) { document.getElementById(target.dataset.close).close(); return; }
  if (target.dataset.race) { openRace(target.dataset.race); return; }
  if (target.dataset.favorite) {
    const key = target.dataset.favorite;
    if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
    try { localStorage.setItem('redzone:favorites', JSON.stringify([...favorites])); } catch { toast('Tu navegador no permite guardar favoritos. Se conservarán durante esta sesión.'); }
    renderNav(); if (document.querySelector('#race-results')) renderRaceResults();
    if (document.querySelector('#detail-dialog').open) openRace(key);
    return;
  }
  if (target.dataset.vehicle) { closeDialogs(); filters = Object.fromEntries(filterKeys.map(key => [key, ''])); filters.vehicle = target.dataset.vehicle; navigate('races'); return; }
  if (target.dataset.holder) { filters.exactHolder = target.dataset.holder; filters.holder = ''; filters.q = ''; navigate('races'); return; }
  if (target.dataset.page) { page = Number(target.dataset.page); renderRaceResults(); document.querySelector('.results-toolbar').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  if (target.dataset.preset) {
    filters.minTime = ''; filters.maxTime = ''; filters.minCheckpoints = '';
    if (target.dataset.preset === 'short') filters.maxTime = '1:00';
    if (target.dataset.preset === 'medium') { filters.minTime = '1:00'; filters.maxTime = '3:00'; }
    if (target.dataset.preset === 'long') filters.minTime = '3:00';
    if (target.dataset.preset === 'technical') filters.minCheckpoints = '40';
    page = 1; render(); return;
  }
  if (['clear-filters', 'empty-reset'].includes(target.id)) { filters = Object.fromEntries(filterKeys.map(key => [key, ''])); page = 1; render(); }
  if (target.id === 'advanced-toggle') { const panel = document.querySelector('#advanced-filters'); panel.hidden = !panel.hidden; target.setAttribute('aria-expanded', String(!panel.hidden)); }
  if (target.id === 'data-button' || target.id === 'about-button') openData();
  if (target.id === 'random-race') { const data = filtered(); if (!data.length) toast('Limpia los filtros para encontrar una carrera.'); else openRace(data[Math.floor(Math.random() * data.length)].key); }
  if (target.id === 'export-races') { const data = sortRaces(filtered(), filters.sort); if (!data.length) { toast('No hay carreras para exportar.'); return; } download(toCsv([['ID', 'Carrera', 'Vehículo', 'Checkpoints', 'Piloto', 'Tiempo', 'Milisegundos'], ...data.map(race => [race.id, race.name, race.vehicle, race.checkpoints, race.holder, formatTime(race.timeMs), race.timeMs])]), 'red-zone-carreras.csv', 'text/csv;charset=utf-8'); toast(`${number(data.length)} carreras exportadas.`); }
  if (target.id === 'export-ranking') { const data = getRanking(filtered(), previousFiltered()); if (!data.length) { toast('No hay pilotos para exportar.'); return; } download(toCsv([['Posición', 'Piloto', 'Récords', '% carreras filtradas', 'Vehículos', 'Cambio entre cortes'], ...data.map(player => [player.position, player.name, player.count, player.share.toFixed(2), player.vehicleCount, player.delta ?? ''])]), 'red-zone-ranking.csv', 'text/csv;charset=utf-8'); toast('Ranking exportado.'); }
  if (target.id === 'download-snapshot') download(JSON.stringify(snapshot, null, 2), 'red-zone-corte.json', 'application/json');
  if (target.id === 'reset-data') { snapshot = original; previous = null; closeDialogs(); navigate('overview', true); toast('Archivo original restaurado.'); }
});

document.addEventListener('input', event => {
  if (event.target.id === 'garage-search') renderGarage(event.target.value);
  if (event.target.dataset.filter && event.target.tagName === 'INPUT') {
    filters[event.target.dataset.filter] = event.target.value;
    if (event.target.dataset.filter === 'holder') filters.exactHolder = '';
    page = 1; refreshResults();
  }
});

document.addEventListener('change', async event => {
  if (event.target.dataset.filter && event.target.tagName === 'SELECT') { filters[event.target.dataset.filter] = event.target.value; page = 1; refreshResults(); }
  if (event.target.id === 'sort-races') { filters.sort = event.target.value; page = 1; refreshResults(); }
  if (['import-current', 'import-previous'].includes(event.target.id)) {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
      const imported = normalizeSnapshot(JSON.parse(await file.text()), { importedName: file.name });
      if (event.target.id === 'import-current') snapshot = imported; else previous = imported;
      closeDialogs(); filters = Object.fromEntries(filterKeys.map(key => [key, ''])); page = 1; render();
      toast(`${number(imported.races.length)} carreras cargadas${imported.skipped ? ` · ${imported.skipped} filas no válidas omitidas` : ''}.`);
    } catch (error) { toast(error instanceof SyntaxError ? 'El archivo no contiene JSON válido. Usa el resultados.txt del scraper.' : error.message); }
    event.target.value = '';
  }
});

document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); document.querySelector('#race-search, #garage-search')?.focus(); } });
window.addEventListener('popstate', () => { const query = new URLSearchParams(location.search); view = Object.hasOwn(views, query.get('view')) ? query.get('view') : 'overview'; filters = Object.fromEntries(filterKeys.map(key => [key, query.get(key) || ''])); page = 1; render(); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));

hydrateIcons();
renderNav();
try {
  const response = await fetch('./data/races.json');
  if (!response.ok) throw new Error('No se pudo cargar el archivo de carreras.');
  original = normalizeSnapshot(await response.json()); snapshot = original;
  try { const cars = await fetch('./data/vehicles.json'); if (cars.ok) vehicleAssets = await cars.json(); } catch {}
  render();
} catch (error) {
  main.innerHTML = `<div class="initial-state"><h1>Estamos en boxes.</h1><p>${esc(error.message)}</p><button class="button button-primary" id="retry-load">Volver a intentar ${icon('arrow')}</button></div>`;
  document.querySelector('#retry-load').addEventListener('click', () => location.reload());
  document.querySelector('#data-button').disabled = true;
  document.querySelector('#about-button').disabled = true;
}
