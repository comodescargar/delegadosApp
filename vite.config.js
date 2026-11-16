import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Dos páginas: la app (index.html) y la vista del árbitro (arbitro.html, servida en /a/<código>)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        arbitro: resolve(import.meta.dirname, 'arbitro.html'),
      },
    },
  },
  plugins: [{
    // En desarrollo, /a/<código> también abre la página del árbitro
    name: 'ruta-arbitro',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (/^\/a\/[^/]+\/?$/.test(req.url.split('?')[0])) req.url = '/arbitro.html';
        next();
      });
    },
  }],
});
