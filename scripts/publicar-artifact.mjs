// Genera dist-artifact/ para publicar la app como página de claude.ai (modo local, sin Supabase).
// Uso: npm run publicar:artifact
// - Quita la cabecera <!doctype>/<html>/<head>/<body> (la plataforma la añade al publicar).
// - Quita lo marcado con data-solo-local (descargas que el visor no permite)
//   y data-solo-nube (la parte de Supabase, que allí no puede cargarse).
// - Cambia las rutas /js/… por rutas relativas.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist-artifact');
mkdirSync(dist, { recursive: true });

const lineas = readFileSync(join(raiz, 'index.html'), 'utf8').split(/\r?\n/);
const fuera = /^\s*(<!doctype html>|<html[^>]*>|<\/html>|<head>|<\/head>|<body>|<\/body>|<meta charset[^>]*>|<meta name="viewport"[^>]*>)\s*$/i;
const salida = [];
for (const l of lineas) {
  if (fuera.test(l)) continue;
  if (l.includes('data-solo-local') || l.includes('data-solo-nube')) {
    if (salida.length && /^\s*<hr>\s*$/.test(salida[salida.length - 1])) salida.pop();
    continue;
  }
  salida.push(l.replace(/src="\/js\//g, 'src="'));
}
writeFileSync(join(dist, 'index.html'), salida.join('\n'));
for (const f of ['biblioteca.js', 'pizarra.js', 'fichas.js', 'secciones.js']) copyFileSync(join(raiz, 'public', 'js', f), join(dist, f));
console.log('dist-artifact/ generado:', salida.length, 'líneas en index.html');
