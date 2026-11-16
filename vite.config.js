import { defineConfig } from 'vite';
import { resolve, join, relative } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const raiz = import.meta.dirname;

// Genera dist/sw.js con la lista de archivos de esta versión y una versión que cambia si cambia cualquiera
function serviceWorker() {
  return {
    name: 'service-worker',
    apply: 'build',
    closeBundle() {
      const dist = join(raiz, 'dist');
      const archivos = [];
      const recorrer = (dir) => {
        for (const n of readdirSync(dir)) {
          const p = join(dir, n);
          if (statSync(p).isDirectory()) recorrer(p);
          else if (!/^(sw\.js|_headers|_redirects)$/.test(n)) archivos.push(p);
        }
      };
      recorrer(dist);
      const hash = createHash('sha256');
      const rutas = archivos.map((p) => { hash.update(readFileSync(p)); return '/' + relative(dist, p).split('\\').join('/'); }).sort();
      const plantilla = readFileSync(join(raiz, 'scripts', 'sw-plantilla.js'), 'utf8');
      hash.update(plantilla);
      writeFileSync(join(dist, 'sw.js'), plantilla
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__ARCHIVOS__', JSON.stringify(rutas, null, 2)));
      console.log(`sw.js generado con ${rutas.length} archivos`);
    },
  };
}

// Dos páginas: la app (index.html) y la vista del árbitro (arbitro.html, servida en /a/<código>)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(raiz, 'index.html'),
        arbitro: resolve(raiz, 'arbitro.html'),
      },
    },
  },
  plugins: [
    serviceWorker(),
    {
      // En desarrollo, /a/<código> también abre la página del árbitro
      name: 'ruta-arbitro',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (/^\/a\/[^/]+\/?$/.test(req.url.split('?')[0])) req.url = '/arbitro.html';
          next();
        });
      },
    },
  ],
});
