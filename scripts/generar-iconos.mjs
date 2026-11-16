// Genera los iconos PNG de la app (campo de fútbol visto desde arriba) sin dependencias.
// Uso: node scripts/generar-iconos.mjs  → public/icons/*.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const salida = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(salida, { recursive: true });

const FONDO = [11, 18, 32];      // #0b1220
const CESPED = [22, 163, 74];    // #16a34a
const CESPED2 = [21, 148, 68];   // franjas
const LINEA = [255, 255, 255];

// CRC32 para los bloques PNG
const TABLA = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloque(tipo, datos) {
  const t = Buffer.from(tipo, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
  return Buffer.concat([len, t, datos, crc]);
}
function png(ancho, alto, rgba) {
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;
    rgba.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas, { level: 9 })), bloque('IEND', Buffer.alloc(0))]);
}

// Color de un punto (coordenadas 0..1). margen = hueco alrededor del campo; redondeo = esquinas del fondo.
function color(x, y, { margen, redondeo }) {
  // Fondo con esquinas redondeadas (transparente fuera)
  if (redondeo) {
    const r = redondeo;
    const cx = Math.min(Math.max(x, r), 1 - r); const cy = Math.min(Math.max(y, r), 1 - r);
    if (Math.hypot(x - cx, y - cy) > r) return null;
  }
  // Campo vertical
  const m = margen; const w = 1 - 2 * m; const h = w * 1.3;
  const x0 = m; const y0 = 0.5 - h / 2;
  if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) return FONDO;
  const u = (x - x0) / w; const v = (y - y0) / h;
  const g = 0.028; // grosor de línea relativo al ancho
  const gv = g * (w / h);
  const borde = u < g || u > 1 - g || v < gv || v > 1 - gv;
  const medio = Math.abs(v - 0.5) < gv / 2;
  const dc = Math.hypot((u - 0.5) * w, (v - 0.5) * h) / w;
  const circulo = Math.abs(dc - 0.17) < g / 2;
  const punto = dc < 0.035;
  const areaA = (v < 0.17 || v > 0.83) && u > 0.25 && u < 0.75;
  const areaB = (Math.abs(v - 0.17) < gv / 2 || Math.abs(v - 0.83) < gv / 2) && u > 0.25 && u < 0.75;
  const areaL = (Math.abs(u - 0.25) < g / 2 || Math.abs(u - 0.75) < g / 2) && (v < 0.17 || v > 0.83);
  if (borde || medio || circulo || punto || areaB || areaL) return LINEA;
  void areaA;
  return Math.floor(v * 8) % 2 ? CESPED2 : CESPED;
}

function dibujar(tam, opciones) {
  const datos = Buffer.alloc(tam * tam * 4);
  const ss = 4; // supermuestreo para suavizar bordes
  for (let py = 0; py < tam; py++) {
    for (let px = 0; px < tam; px++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = color((px + (sx + 0.5) / ss) / tam, (py + (sy + 0.5) / ss) / tam, opciones);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
      }
      const n = ss * ss; const i = (py * tam + px) * 4;
      const cobertura = a / 255;
      datos[i] = cobertura ? Math.round(r / cobertura) : 0;
      datos[i + 1] = cobertura ? Math.round(g / cobertura) : 0;
      datos[i + 2] = cobertura ? Math.round(b / cobertura) : 0;
      datos[i + 3] = Math.round(a / n);
    }
  }
  return png(tam, tam, datos);
}

const iconos = [
  ['icon-192.png', 192, { margen: 0.2, redondeo: 0.18 }],
  ['icon-512.png', 512, { margen: 0.2, redondeo: 0.18 }],
  // «maskable»: sin transparencia y con más margen, para que el sistema lo recorte en círculo o gota
  ['icon-maskable-512.png', 512, { margen: 0.27, redondeo: 0 }],
  // iPhone: sin transparencia (iOS pone fondo negro a lo transparente)
  ['apple-touch-icon.png', 180, { margen: 0.2, redondeo: 0 }],
];
for (const [nombre, tam, op] of iconos) {
  writeFileSync(join(salida, nombre), dibujar(tam, op));
  console.log('generado', nombre);
}
