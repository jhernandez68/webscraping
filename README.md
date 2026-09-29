# Red Zone · Racing Intelligence

Explorador de carreras de SA-MP con estética morada oscura, Ryder y San Andreas. Convierte `resultados.txt` en un sitio estático que calcula estadísticas reales en el navegador.

## Ejecutar

Requiere Node.js 22.9 o superior. Para abrir el frontend no necesitas instalar dependencias:

```bash
npm run dev
```

Abre `http://localhost:3000`. El comando prepara los datos y sirve únicamente `public/`. Para otro puerto, configura `PORT` en tu entorno.

## Funciones

- Vista general con número de carreras, vehículos, pilotos y líder.
- Búsqueda por nombre de carrera, vehículo o piloto; atajo `/`.
- Filtros combinados por vehículo, piloto, tiempo mínimo/máximo, checkpoints y disponibilidad de récord.
- Ordenación numérica por tiempo y checkpoints, por vehículo o por nombre; paginación.
- Ranking con cantidad de récords, porcentaje del conjunto filtrado y variedad de vehículos. Los empates comparten posición.
- Comparación de dos cortes: ganancias y pérdidas de récords, incluyendo pilotos que pierden todos.
- Garaje con acceso directo a las carreras de cada vehículo.
- Detalle de carrera, favoritos en el dispositivo y selección aleatoria dentro de los filtros.
- Importación local de `resultados.txt` o snapshots JSON de hasta 10 MB.
- Exportación CSV de las carreras o el ranking filtrados; descarga del corte JSON.
- Diseño adaptable, navegación de teclado, diálogos con Escape y estados vacíos o de error.

## Datos y precisión

El archivo incluido contiene 1.020 carreras, 93 vehículos y 21 apodos con récord. Es un corte del archivo versionado, **no datos en vivo**. La fecha del commit indica cuándo se actualizó el archivo en el repositorio, no cuándo se obtuvo cada récord.

El scraper original guardaba encabezados repetidos entre bloques. El normalizador los descarta y convierte los tiempos a milisegundos. Los nombres de carreras distinguen mayúsculas: `INFERNUS` e `Infernus` son dos recorridos diferentes en este archivo.

Cada carrera aporta como máximo un récord al jugador que aparece en su fila. El porcentaje se calcula sobre todas las carreras que cumplen los filtros, incluidas las que no tienen récord. Los apodos se mantienen separados: no se presume que dos nombres pertenecen a la misma persona. La comparación calcula la diferencia de conteos entre los conjuntos filtrados; agregar o quitar carreras del archivo también puede cambiar esos conteos.

No hay historial de tiempos, top 10 por carrera, fecha de cada récord ni trazado del circuito en los datos de origen. La aplicación no inventa esa información. Los archivos importados duran la sesión; puedes descargar un corte para conservarlo. Los favoritos se mantienen en `localStorage` y se identifican por el nombre exacto y el vehículo, no por la posición en la lista.

## Actualizar el scraping

Instala las dependencias para usar Puppeteer y copia `.env.example` a `.env`:

```bash
npm ci
```

Completa `REDZONE_USER` y `REDZONE_PASSWORD` en `.env` con tu cuenta de Red Zone y ejecuta:

```bash
npm run scrape
npm run build
```

`SCRAPER_HEADLESS=false` muestra el navegador y `SCRAPER_TIMEOUT` configura el tiempo de espera. El scraper amplía la lista mientras exista el botón de carga, sin el antiguo límite de 1.005. Si la carga falla, termina con error antes de guardar los resultados. Al completar la captura guarda el archivo anterior en `resultados.previous.json`, actualiza `resultados.txt`, genera el snapshot público y registra su fecha en `resultados.meta.json`.

La captura requiere acceso al servidor y credenciales válidas. No se ejecutó una captura autenticada durante la implementación. La web funciona completamente con el archivo incluido o los archivos que importes.

Las credenciales que estaban escritas en el script se retiraron. Si siguen vigentes, cámbialas: eliminar una cadena del archivo actual no la elimina del historial de Git.

## Publicar

```bash
npm run build
```

Publica **solo la carpeta `dist/`** en cualquier alojamiento estático. Todos los recursos y rutas son relativos y funcionan también bajo `/webscraping/`. El sitio no necesita servidor de API ni credenciales públicas.

Para GitHub Pages se incluye `.github/workflows/pages.yml`: tras integrar esta rama en `master`, selecciona **GitHub Actions** como origen en **Settings → Pages**. La tarea verifica y construye la web en cada actualización de `master`; también puede ejecutarse manualmente. El scraper se ejecuta por separado en tu equipo. No publiques la raíz del repositorio ni tu `.env`.

El trabajo parte de `master`, la rama que contiene el scraper; `main` solo tenía el README inicial.

## Verificar

```bash
npm test
npm run check
npm run build
npm run test:browser
```

Las pruebas de navegador necesitan las dependencias de Puppeteer y Chrome. `BROWSER_EXECUTABLE_PATH` permite indicar otro ejecutable; `BROWSER_TEST_CONTAINER=true` habilita los argumentos de un contenedor de pruebas aislado. El test inicia y detiene su propio servidor en el puerto 3100 y guarda capturas en `test-results/`.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `index.js`, `scripts/scrape.mjs` | Entrada y captura con Puppeteer |
| `public/lib/racing.js` | Normalización, tiempos, filtros, ranking y CSV |
| `public/app.js`, `public/style.css` | Interfaz e interacciones |
| `public/data/races.json` | Corte normalizado para el navegador |
| `scripts/build.mjs` | Generación de datos y distribución estática |
| `server.mjs` | Servidor local limitado al directorio público |
| `tests/` | Pruebas de datos e interacciones |

## Arte y créditos

La cabecera es fan art generado para este proyecto. GTA: San Andreas, Ryder y sus vehículos pertenecen a sus titulares; este proyecto es una herramienta comunitaria independiente. La tipografía Barlow Condensed es de Jeremy Tribby y se distribuye bajo SIL Open Font License. Consulta `ASSETS.md` para fuentes y detalles del arte.
