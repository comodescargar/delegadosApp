// Supabase falso en memoria para probar src/sync.js en el navegador sin tocar la base de datos real.
// Implementa solo lo que usa la app: from().select/insert/upsert/update/delete con eq/order/limit/single,
// y storage.from().upload/download/remove/createSignedUrls. falso.offline = true simula sin conexión.
export function crearSbFalso(inicial = {}) {
  const db = { jugadoras: [], fichas: [], partidos: [], convocatorias: [], eventos: [], enlaces_arbitro: [], entrenamientos: [], asistencias: [], ...inicial };
  const archivos = new Map();
  const log = [];
  let reloj = Date.now();
  const ahora = () => new Date(reloj++).toISOString();
  const nuevoId = () => crypto.randomUUID();
  const claves = { convocatorias: ['partido_id', 'ficha_id'], asistencias: ['entrenamiento_id', 'ficha_id'], enlaces_arbitro: ['token'] };
  const pk = (t) => claves[t] || ['id'];
  const mismaFila = (t, a, b) => pk(t).every((k) => a[k] === b[k]);
  const sinConexion = () => ({ data: null, error: { message: 'Failed to fetch (sin conexión simulada)' } });

  class Consulta {
    constructor(tabla) { Object.assign(this, { tabla, op: 'select', filtros: [], orden: null, limite: null, unico: false, datos: null, cols: '' }); }
    select(cols = '*') { this.cols = cols; return this; }
    insert(d) { this.op = 'insert'; this.datos = d; return this; }
    upsert(d) { this.op = 'upsert'; this.datos = d; return this; }
    update(d) { this.op = 'update'; this.datos = d; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filtros.push((r) => r[c] === v); return this; }
    in(c, vs) { this.filtros.push((r) => vs.includes(r[c])); return this; }
    is(c, v) { this.filtros.push((r) => (r[c] ?? null) === v); return this; }
    order(c, { ascending = true } = {}) { this.orden = [c, ascending]; return this; }
    limit(n) { this.limite = n; return this; }
    single() { this.unico = true; return this; }
    maybeSingle() { this.unico = true; return this; }
    then(ok, ko) { return Promise.resolve().then(() => this.ejecutar()).then(ok, ko); }
    ejecutar() {
      if (falso.offline) return sinConexion();
      log.push(`${this.op} ${this.tabla}`);
      const T = db[this.tabla];
      const pasa = (r) => this.filtros.every((f) => f(r));
      const conJoins = (r) => {
        const fila = { ...r };
        if (this.cols.includes('jugadoras(')) fila.jugadoras = { nombre: db.jugadoras.find((j) => j.id === r.jugadora_id)?.nombre };
        return fila;
      };
      let filas = [];
      if (this.op === 'select') {
        filas = T.filter(pasa);
        if (this.orden) {
          const [c, asc] = this.orden;
          filas = [...filas].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
        }
        if (this.limite) filas = filas.slice(0, this.limite);
        filas = filas.map(conJoins);
      } else if (this.op === 'insert' || this.op === 'upsert') {
        for (const d of [].concat(this.datos)) {
          const porDefecto = this.tabla === 'fichas' ? { activa: true, tipo: 'jugadora', cargo: null } : {};
          const fila = { creado_en: ahora(), creada_en: ahora(), ...porDefecto, ...d };
          if (!pk(this.tabla).every((k) => fila[k])) {
            if (this.tabla === 'enlaces_arbitro') fila.token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
            else fila.id = nuevoId();
          }
          const i = T.findIndex((r) => mismaFila(this.tabla, r, fila));
          if (i >= 0 && this.op === 'insert') return { data: null, error: { message: 'duplicate key' } };
          if (i >= 0) T[i] = { ...T[i], ...d }; else T.push(fila);
          filas.push(i >= 0 ? T[i] : fila);
        }
      } else if (this.op === 'update') {
        T.filter(pasa).forEach((r) => { Object.assign(r, this.datos); filas.push(r); });
      } else if (this.op === 'delete') {
        filas = T.filter(pasa);
        db[this.tabla] = T.filter((r) => !pasa(r));
      }
      return { data: this.unico ? filas[0] ?? null : filas, error: null };
    }
  }

  const falso = {
    offline: false,
    db: () => db,
    archivos,
    log,
    from: (t) => new Consulta(t),
    storage: {
      from: () => ({
        async upload(ruta, blob) { if (falso.offline) return sinConexion(); archivos.set(ruta, blob); log.push(`subir ${ruta}`); return { data: { path: ruta }, error: null }; },
        async download(ruta) { if (falso.offline) return sinConexion(); return archivos.has(ruta) ? { data: archivos.get(ruta), error: null } : { data: null, error: { message: 'no existe' } }; },
        async remove(rutas) { if (falso.offline) return sinConexion(); rutas.forEach((r) => archivos.delete(r)); return { data: rutas, error: null }; },
        async createSignedUrls(rutas) { if (falso.offline) return sinConexion(); return { data: rutas.map((p) => ({ path: p, signedUrl: `https://firmada.test/${p}`, error: null })), error: null }; },
      }),
    },
  };
  return falso;
}
