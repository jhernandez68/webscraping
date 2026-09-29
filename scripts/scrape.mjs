import puppeteer from 'puppeteer';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeSnapshot } from '../public/lib/racing.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const username = process.env.REDZONE_USER;
const password = process.env.REDZONE_PASSWORD;
const timeout = Number(process.env.SCRAPER_TIMEOUT || 20000);

if (!username || !password) {
  console.error('Configura REDZONE_USER y REDZONE_PASSWORD en .env antes de ejecutar npm run scrape.');
  process.exitCode = 1;
} else {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: process.env.SCRAPER_HEADLESS !== 'false' });
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);
    await page.goto('https://redzoneserver.com:7777', { waitUntil: 'domcontentloaded', timeout });
    await page.waitForSelector('#user', { visible: true });
    await page.type('#user', username);
    await page.type('#pass', password);
    await page.click('#login_button');
    await page.waitForFunction(() => [...document.querySelectorAll('a, button, li')].some(element => element.textContent.replace(/\s+/g, ' ').includes('Tops/Listas') && element.offsetParent !== null));
    await page.evaluate(() => {
      const element = [...document.querySelectorAll('a, button, li')].find(item => item.textContent.replace(/\s+/g, ' ').includes('Tops/Listas') && item.offsetParent !== null);
      (element.matches('a, button') ? element : element.querySelector('a, button') || element).click();
    });
    await page.waitForSelector('#race_list', { visible: true });
    await page.click('#race_list');
    await page.waitForFunction(() => [...document.querySelectorAll('table tr')].some(row => /^\d+$/.test(row.querySelector('td')?.textContent.trim() || '')));
    let loadedPages = 0;
    while (true) {
      const more = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('[id^="race_list "]')].filter(element => element.offsetParent !== null);
        const button = buttons.sort((a, b) => Number(b.id.split(' ').at(-1)) - Number(a.id.split(' ').at(-1)))[0];
        const ids = [...document.querySelectorAll('table tr')].map(row => row.querySelector('td')?.textContent.trim()).filter(id => /^\d+$/.test(id));
        return button ? { id: button.id, signature: ids.join(',') } : null;
      });
      if (!more) break;
      if (++loadedPages > 10000) throw new Error('Se excedió el límite de seguridad de páginas. No se reemplazó el archivo anterior.');
      await page.evaluate(id => document.getElementById(id).click(), more.id);
      await page.waitForFunction(({ id, signature }) => {
        const ids = [...document.querySelectorAll('table tr')].map(row => row.querySelector('td')?.textContent.trim()).filter(value => /^\d+$/.test(value));
        return ids.join(',') !== signature;
      }, { timeout }, more);
      console.log(`Bloque ${loadedPages} cargado.`);
    }
    const rows = await page.$$eval('table tr', elements => elements.filter(row => !row.querySelector('[id^="race_list "]')).map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent.trim())).filter(row => row.length >= 6));
    const snapshot = normalizeSnapshot(rows, { capturedAt: new Date().toISOString(), source: 'Red Zone' });
    const destination = resolve(root, 'resultados.txt');
    let existing;
    try { existing = await readFile(destination, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) await writeFile(resolve(root, 'resultados.previous.json'), existing);
    await writeFile(`${destination}.tmp`, JSON.stringify(rows, null, 2));
    await rename(`${destination}.tmp`, destination);
    await mkdir(resolve(root, 'public/data'), { recursive: true });
    const snapshotPath = resolve(root, 'public/data/races.json');
    await writeFile(`${snapshotPath}.tmp`, JSON.stringify(snapshot));
    await rename(`${snapshotPath}.tmp`, snapshotPath);
    await writeFile(resolve(root, 'resultados.meta.json'), JSON.stringify({ capturedAt: snapshot.capturedAt, source: snapshot.source }, null, 2));
    console.log(`${snapshot.races.length} carreras guardadas. Ejecuta npm run build para preparar el sitio.`);
  } catch (error) {
    console.error(`No se pudo completar la captura: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
