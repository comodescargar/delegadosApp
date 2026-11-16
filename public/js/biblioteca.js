/*
 * Biblioteca precargada de la pizarra táctica.
 *
 * SISTEMAS: coordenadas normalizadas (x 0..1 de izquierda a derecha, y 0..1 de la portería
 * atacada (arriba) a la propia (abajo)). Cada jugador: [dorsal, x, y, puesto].
 *
 * JUGADAS: coordenadas en METROS respecto a la portería que se ataca:
 *   x = metros a la derecha (+) o a la izquierda (-) del centro, mirando hacia la portería atacada.
 *   d = metros desde la línea de gol atacada (0 = línea de gol; el campo crece hacia abajo).
 * Claves de elementos:
 *   aN = jugador/a de nuestro equipo con dorsal N (a1 = portero/a)
 *   rN = rival (r1 = portero/a rival)
 *   b  = balón · kN = cono
 * Cada paso: [texto, movimientos, estilos]. El texto explica lo que ocurre en ese paso.
 * Los movimientos son las nuevas posiciones al terminar el paso. En estilos se indica el golpeo
 * del balón: 'pase' (por defecto), 'centro' (balón aéreo) o 'tiro'.
 * Las flechas se generan solas: balón = pase, jugador con balón = conducción, sin balón = desmarque.
 */
(function () {
  const categorias = {
    corner: 'Córners',
    falta: 'Faltas',
    banda: 'Saques de banda',
    salida: 'Salida de balón',
    ataque: 'Ataque organizado',
    transicion: 'Contraataque',
    defensa: 'Defensa y presión',
    'portero-jugador': 'Portero-jugador',
    'ent-rondos': 'Entreno · Rondos y posesión',
    'ent-tecnica': 'Entreno · Técnica',
    'ent-finalizacion': 'Entreno · Finalización',
    'ent-juegos': 'Entreno · Juegos y situaciones',
    'ent-porteros': 'Entreno · Porteros',
  };

  // ------------------------------------------------------------------ SISTEMAS
  const sistemas = [
    // Fútbol 11
    { id: 'f11-442', mod: 'f11', nombre: '4-4-2', desc: 'Dos líneas de cuatro y dos puntas. Equilibrado y fácil de entender: buen punto de partida en infantil.',
      j: [[1, .5, .95, 'POR'], [2, .88, .78, 'LD'], [4, .62, .8, 'DFC'], [5, .38, .8, 'DFC'], [3, .12, .78, 'LI'], [7, .88, .56, 'MD'], [8, .62, .6, 'MC'], [6, .38, .6, 'MC'], [11, .12, .56, 'MI'], [10, .6, .38, 'DC'], [9, .4, .36, 'DC']] },
    { id: 'f11-433', mod: 'f11', nombre: '4-3-3', desc: 'Pivote, dos interiores y tres delanteros. Favorece la salida de balón y el juego por bandas.',
      j: [[1, .5, .95, 'POR'], [2, .88, .77, 'LD'], [4, .62, .8, 'DFC'], [5, .38, .8, 'DFC'], [3, .12, .77, 'LI'], [6, .5, .65, 'MCD'], [8, .32, .56, 'MC'], [10, .68, .56, 'MC'], [7, .86, .38, 'ED'], [9, .5, .33, 'DC'], [11, .14, .38, 'EI']] },
    { id: 'f11-4231', mod: 'f11', nombre: '4-2-3-1', desc: 'Doble pivote y mediapunta. Muy equilibrado entre ataque y defensa.',
      j: [[1, .5, .95, 'POR'], [2, .88, .77, 'LD'], [4, .62, .8, 'DFC'], [5, .38, .8, 'DFC'], [3, .12, .77, 'LI'], [6, .38, .64, 'MCD'], [8, .62, .64, 'MCD'], [7, .85, .46, 'ED'], [10, .5, .47, 'MCO'], [11, .15, .46, 'EI'], [9, .5, .32, 'DC']] },
    { id: 'f11-4141', mod: 'f11', nombre: '4-1-4-1', desc: 'Un pivote por delante de la defensa y cuatro medios. Sólido sin balón.',
      j: [[1, .5, .95, 'POR'], [2, .88, .78, 'LD'], [4, .62, .8, 'DFC'], [5, .38, .8, 'DFC'], [3, .12, .78, 'LI'], [6, .5, .66, 'MCD'], [7, .88, .52, 'MD'], [8, .63, .53, 'MC'], [10, .37, .53, 'MC'], [11, .12, .52, 'MI'], [9, .5, .34, 'DC']] },
    { id: 'f11-442r', mod: 'f11', nombre: '4-4-2 rombo', desc: 'Centro del campo en rombo: superioridad por dentro, bandas para los laterales.',
      j: [[1, .5, .95, 'POR'], [2, .88, .77, 'LD'], [4, .62, .8, 'DFC'], [5, .38, .8, 'DFC'], [3, .12, .77, 'LI'], [6, .5, .66, 'MCD'], [8, .7, .56, 'MC'], [11, .3, .56, 'MC'], [10, .5, .47, 'MCO'], [9, .4, .33, 'DC'], [7, .6, .33, 'DC']] },
    { id: 'f11-352', mod: 'f11', nombre: '3-5-2', desc: 'Tres centrales y carrileros largos. Exige mucho físico a los carrileros.',
      j: [[1, .5, .95, 'POR'], [3, .28, .79, 'DFC'], [4, .5, .81, 'DFC'], [5, .72, .79, 'DFC'], [2, .9, .57, 'CAD'], [11, .1, .57, 'CAI'], [6, .5, .64, 'MCD'], [8, .68, .55, 'MC'], [10, .32, .55, 'MC'], [9, .4, .34, 'DC'], [7, .6, .34, 'DC']] },
    { id: 'f11-343', mod: 'f11', nombre: '3-4-3', desc: 'Muy ofensivo: tres delanteros y cuatro medios. Arriesgado en defensa.',
      j: [[1, .5, .95, 'POR'], [3, .28, .8, 'DFC'], [4, .5, .81, 'DFC'], [5, .72, .8, 'DFC'], [2, .88, .6, 'MD'], [8, .62, .62, 'MC'], [6, .38, .62, 'MC'], [11, .12, .6, 'MI'], [7, .82, .38, 'ED'], [9, .5, .33, 'DC'], [10, .18, .38, 'EI']] },
    { id: 'f11-532', mod: 'f11', nombre: '5-3-2', desc: 'Cinco defensas. Muy sólido atrás; los laterales suben por turnos.',
      j: [[1, .5, .95, 'POR'], [3, .08, .72, 'LI'], [4, .3, .8, 'DFC'], [5, .5, .82, 'DFC'], [6, .7, .8, 'DFC'], [2, .92, .72, 'LD'], [8, .3, .57, 'MC'], [10, .5, .53, 'MCO'], [7, .7, .57, 'MC'], [9, .4, .35, 'DC'], [11, .6, .35, 'DC']] },

    // Fútbol 7
    { id: 'f7-321', mod: 'f7', nombre: '3-2-1', desc: 'El más habitual en F7: tres atrás, dos medios y un punta. Ocupa bien el campo.',
      j: [[1, .5, .94, 'POR'], [3, .2, .74, 'DFI'], [4, .5, .76, 'DFC'], [2, .8, .74, 'DFD'], [6, .32, .52, 'MC'], [8, .68, .52, 'MC'], [9, .5, .3, 'DC']] },
    { id: 'f7-231', mod: 'f7', nombre: '2-3-1', desc: 'Dos centrales y tres medios. Más control del balón y de las bandas.',
      j: [[1, .5, .94, 'POR'], [4, .32, .75, 'DFC'], [5, .68, .75, 'DFC'], [11, .14, .52, 'MI'], [6, .5, .56, 'MC'], [7, .86, .52, 'MD'], [9, .5, .3, 'DC']] },
    { id: 'f7-312', mod: 'f7', nombre: '3-1-2', desc: 'Pivote defensivo y dos puntas. Directo y con presencia en el área.',
      j: [[1, .5, .94, 'POR'], [3, .2, .74, 'DFI'], [4, .5, .76, 'DFC'], [2, .8, .74, 'DFD'], [6, .5, .55, 'MCD'], [9, .36, .32, 'DC'], [10, .64, .32, 'DC']] },
    { id: 'f7-2121', mod: 'f7', nombre: '2-1-2-1', desc: 'Rombo en el centro del campo. Buenas líneas de pase en todas direcciones.',
      j: [[1, .5, .94, 'POR'], [4, .32, .76, 'DFC'], [5, .68, .76, 'DFC'], [6, .5, .6, 'MCD'], [11, .2, .45, 'EI'], [7, .8, .45, 'ED'], [9, .5, .28, 'DC']] },
    { id: 'f7-33', mod: 'f7', nombre: '3-3', desc: 'Dos líneas de tres. Sencillo para los más pequeños (prebenjamín, benjamín).',
      j: [[1, .5, .94, 'POR'], [3, .2, .72, 'DFI'], [4, .5, .74, 'DFC'], [2, .8, .72, 'DFD'], [11, .2, .42, 'EI'], [9, .5, .38, 'DC'], [7, .8, .42, 'ED']] },
    { id: 'f7-132', mod: 'f7', nombre: '1-3-2', desc: 'Líbero y tres medios. Muy ofensivo, con mucha gente por delante del balón.',
      j: [[1, .5, .94, 'POR'], [4, .5, .77, 'LIB'], [3, .15, .56, 'MI'], [6, .5, .57, 'MC'], [2, .85, .56, 'MD'], [9, .36, .32, 'DC'], [10, .64, .32, 'DC']] },
    { id: 'f7-222', mod: 'f7', nombre: '2-2-2', desc: 'Parejas por líneas. Fácil de explicar y de mantener las distancias.',
      j: [[1, .5, .94, 'POR'], [4, .32, .75, 'DFC'], [5, .68, .75, 'DFC'], [6, .32, .53, 'MC'], [8, .68, .53, 'MC'], [9, .35, .3, 'DC'], [10, .65, .3, 'DC']] },

    // Fútbol sala
    { id: 'sala-121', mod: 'sala', nombre: '1-2-1 (rombo)', desc: 'Cierre, dos alas y pívot. El sistema base del fútbol sala.',
      j: [[1, .5, .94, 'POR'], [4, .5, .74, 'CIE'], [11, .15, .53, 'ALA'], [7, .85, .53, 'ALA'], [9, .5, .28, 'PIV']] },
    { id: 'sala-22', mod: 'sala', nombre: '2-2 (cuadrado)', desc: 'Dos atrás y dos arriba. Sencillo y seguro para empezar.',
      j: [[1, .5, .94, 'POR'], [4, .3, .7, 'CIE'], [5, .7, .7, 'CIE'], [11, .3, .42, 'ALA'], [7, .7, .42, 'ALA']] },
    { id: 'sala-31', mod: 'sala', nombre: '3-1', desc: 'Tres en línea y un pívot. Buena circulación y juego de pívot.',
      j: [[1, .5, .94, 'POR'], [11, .15, .6, 'ALA'], [4, .5, .64, 'CIE'], [7, .85, .6, 'ALA'], [9, .5, .28, 'PIV']] },
    { id: 'sala-40', mod: 'sala', nombre: '4-0', desc: 'Sin pívot fijo: todos rotan. Requiere mucha movilidad y buena técnica.',
      j: [[1, .5, .94, 'POR'], [4, .32, .6, 'CIE'], [8, .68, .6, 'CIE'], [11, .1, .4, 'ALA'], [7, .9, .4, 'ALA']] },
    { id: 'sala-pj32', mod: 'sala', nombre: 'Portero-jugador 3-2', desc: 'Cinco jugadores de campo: el portero sube como jugador. Para remontar al final.',
      j: [[1, .5, .58, 'POR-J'], [11, .12, .5, 'ALA'], [7, .88, .5, 'ALA'], [9, .32, .24, 'PIV'], [10, .68, .24, 'PIV']] },
  ];

  // ------------------------------------------------------------------ JUGADAS
  // Bases reutilizables (en metros)
  const F11_CORNER = {
    b: [33.4, 0.6], a7: [34.6, 1.4],
    a4: [-2, 13], a5: [3, 14], a9: [0, 12], a6: [-7, 12], a10: [-2, 20], a8: [12, 19],
    r1: [0, 1], r2: [4.2, 0.8], r3: [4, 6], r4: [-1, 6.5], r5: [-6, 6], r6: [1.5, 10.5], r7: [-4.5, 11], r8: [9, 8], r9: [0, 19], r10: [25, 6],
  };
  const F11_FALTA_FRONTAL = {
    b: [3, 22],
    r1: [-1.2, 0.8], r2: [0.7, 13.1], r3: [1.4, 13], r4: [2.1, 12.9], r5: [2.8, 12.8], r6: [-6, 10], r7: [8, 10], r8: [-8, 16], r9: [12, 14],
    a10: [1.8, 24.2], a7: [4.6, 24], a9: [3.6, 12.6], a4: [-6, 11], a5: [9, 11.5],
  };
  const F11_FALTA_LATERAL = {
    b: [26, 24], a7: [27.2, 25.4],
    r1: [0, 2], r2: [-8, 12], r3: [-3, 12], r4: [2, 12], r5: [7, 12], r6: [11, 13], r7: [19.5, 17.6], r8: [18.8, 18.4],
    a4: [-6, 13], a5: [-1, 13.2], a9: [4, 13], a6: [9, 13.5], a10: [10, 23],
  };
  const F11_SALIDA = {
    b: [0.8, 101.6], a1: [0, 102.3], a4: [-9, 97], a5: [9, 97], a2: [28, 88], a3: [-28, 88], a6: [0, 86], a8: [-12, 74], a10: [12, 74], a7: [26, 60], a11: [-26, 60], a9: [0, 56],
    r1: [0, 1.5], r9: [-5, 84], r10: [6, 83], r8: [0, 74], r7: [20, 76], r11: [-20, 76], r6: [-8, 64], r5: [8, 64], r2: [-18, 48], r3: [-6, 46], r4: [6, 46],
  };

  const F7_CORNER = {
    b: [19.5, 0.5], a7: [20.6, 1.2], a9: [2, 9], a4: [-3, 10], a10: [4, 12], a8: [-2, 16],
    r1: [0, 0.8], r2: [3.4, 0.6], r3: [2, 5], r4: [-3, 5.5], r5: [0, 10], r6: [14, 4],
  };
  const F7_FALTA_FRONTAL = {
    b: [2, 16], r1: [-1, 0.7], r2: [0.7, 10.1], r3: [1.4, 10], r4: [2.1, 9.9], r5: [-6, 8], r6: [7, 8],
    a10: [1.2, 17.6], a8: [5.5, 17.2], a9: [-5, 9],
  };

  const SALA_CORNER = {
    b: [9.7, 0.3], a7: [10.5, 0.9], a4: [0, 11], a9: [2, 3.5], a11: [-3, 5.5],
    r1: [0, 0.6], r2: [2.6, 2.4], r3: [-2.4, 4.6], r4: [-2, 10], r5: [5.5, 3.5],
  };
  const SALA_BANDA = {
    b: [9.9, 12], a7: [10.6, 12.6], a9: [3, 4], a11: [-5, 9], a4: [0, 15],
    r1: [0, 0.7], r2: [3, 3], r3: [-4, 8], r4: [1, 13], r5: [5, 9.5],
  };
  const SALA_FALTA = {
    b: [0, 11], r1: [0, 0.6], r2: [-0.6, 6.1], r3: [0.6, 6.1], r4: [-5, 7], r5: [5, 6],
    a4: [0, 12.6], a7: [-1.6, 12.4], a11: [6, 11.5], a9: [-4, 6],
  };

  const TIRO = { b: 'tiro' };
  const CENTRO = { b: 'centro' };
  const PASE = { b: 'pase' }; // fuerza "pase" cuando quien pasa sigue al balón (pase y sigue)

  const jugadas = [
    // =============================================================== FÚTBOL 11
    // --- Córners
    { id: 'f11-corner-primer-palo', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner al primer palo con peinada',
      desc: 'Balón tenso al primer palo para que un jugador peine hacia el segundo palo, donde llega otro rematador.',
      el: { ...F11_CORNER },
      pasos: [
        ['Los rematadores arrancan a la vez: el 4 ataca el primer palo, el 9 el punto de penalti y el 5 el segundo palo. El 10 y el 8 se quedan para el rechace.',
          { a4: [6, 4.5], a9: [0, 9], a5: [-5, 5], a6: [-9, 7], r3: [5, 5.5], r4: [0.5, 8], r5: [-5, 6.5] }],
        ['El 7 pone un balón tenso al primer palo, a la cabeza del 4.', { b: [6, 4.8], a7: [33.5, 2] }, CENTRO],
        ['El 4 peina el balón hacia atrás, al segundo palo.', { b: [-5, 4.2], a5: [-5, 4] }],
        ['El 5 remata a gol en el segundo palo.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: arrancar todos a la vez cuando el lanzador levanta el brazo. El balón al primer palo debe ir tenso y a media altura.' },

    { id: 'f11-corner-segundo-palo', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner al segundo palo: llegada desde atrás',
      desc: 'Dos jugadores arrastran a la defensa al primer palo y un central llega lanzado desde fuera del área al segundo palo.',
      el: { ...F11_CORNER, a4: [-14, 19] },
      pasos: [
        ['El 9 y el 5 atacan el primer palo para arrastrar a los defensores. El 4 sale desde fuera del área hacia el segundo palo.',
          { a9: [5, 4.5], a5: [2, 6], a4: [-8, 9], r3: [5, 5], r4: [2, 7.5] }],
        ['El 7 bombea el balón al segundo palo, lejos del portero.', { b: [-6, 6.5], a4: [-6, 6.8], a7: [33.5, 2] }, CENTRO],
        ['El 4 remata de cabeza cruzado.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el rematador debe llegar en carrera, no esperar parado. El centro, lejos del alcance del portero.' },

    { id: 'f11-corner-corto', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner en corto: pared y centro',
      desc: 'Saque en corto, devolución al lanzador y centro desde una posición con mejor ángulo.',
      el: { ...F11_CORNER, a11: [22, 3], r10: [25, 7] },
      pasos: [
        ['El 11 se acerca al lanzador para ofrecer el córner en corto.', { a11: [29, 2.5], r10: [28, 5] }],
        ['El 7 saca en corto al 11.', { b: [29, 2.8] }],
        ['El 7 entra al campo y el 11 se la devuelve de primeras (pared).', { a7: [27, 6], b: [27, 6.4], r10: [29.5, 4] }],
        ['Con mejor ángulo, el 7 centra al punto de penalti, donde atacan el 9 y el 4.', { b: [0, 9], a9: [0, 9.2], a4: [4, 6], a5: [-5, 6] }, CENTRO],
        ['Remate del 9.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: sacar en corto rápido, antes de que la defensa se recoloque. Cambia el ángulo del centro.' },

    { id: 'f11-corner-frontal', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner raso al borde del área',
      desc: 'Todos atacan la portería y el balón va raso atrás para que un jugador dispare desde la frontal.',
      el: { ...F11_CORNER },
      pasos: [
        ['Los rematadores atacan la portería para hundir a la defensa. El 10 espera fuera del área.',
          { a4: [4, 5], a9: [0, 6], a5: [-4, 5], a6: [-8, 6], r6: [2, 7.5], r7: [-3, 8], r9: [7, 12] }],
        ['El 7 saca raso al borde del área.', { b: [1, 18.4], a10: [1, 18.8] }],
        ['El 10 dispara de primeras.', { b: [-2.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el que dispara llega en carrera desde atrás. Golpeo raso y colocado, mejor que fuerte.' },

    { id: 'f11-corner-bloqueo', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Córner con bloqueos para el rematador',
      desc: 'Dos compañeros hacen de pantalla sobre el marcador del mejor rematador para que llegue libre.',
      el: { ...F11_CORNER, a5: [0, 15], r6: [0.5, 13.5], a4: [-1.5, 12.5], a6: [1.5, 12.5], a9: [6, 10] },
      pasos: [
        ['El 4 y el 6 se colocan delante del marcador del 5 para hacer de pantalla (sin agarrar ni empujar).', { a4: [-0.6, 12.6], a6: [1.4, 12.6] }],
        ['El 5 sale por detrás del bloqueo hacia el punto de penalti; su marcador se queda atascado.', { a5: [2.5, 9.5], r6: [0.8, 12.8] }],
        ['El 7 centra al punto de penalti.', { b: [2.5, 9.7] }, CENTRO],
        ['Remate del 5 libre de marca.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el bloqueo es legal si el jugador está parado y no agarra. Sincronizar la salida del rematador con el golpeo.' },

    // --- Faltas
    { id: 'f11-falta-directa', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Falta frontal: amago y disparo directo',
      desc: 'Un jugador amaga el disparo y el lanzador golpea con rosca por encima de la barrera.',
      el: { ...F11_FALTA_FRONTAL },
      pasos: [
        ['El 7 hace el amago: corre hacia el balón y pasa por encima sin tocarlo.', { a7: [1.8, 20.5] }],
        ['El 10 lanza con rosca por encima de la barrera, al palo que tapa la barrera.', { b: [3.2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el amago tiene que ser creíble para que el portero dé un paso. Practicar el golpeo desde 18-22 m.' },

    { id: 'f11-falta-toque-lateral', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Falta frontal: toque lateral y disparo',
      desc: 'Pase corto fuera del ángulo de la barrera para que un compañero dispare con la portería despejada.',
      el: { ...F11_FALTA_FRONTAL, a8: [8, 23] },
      pasos: [
        ['El 10 toca en corto hacia un lado, fuera del ángulo de la barrera.', { b: [7, 21.5], a8: [7, 21.8] }],
        ['El 8 dispara de primeras al palo largo: la barrera ya no tapa.', { b: [-3, -0.3], r5: [4.5, 16] }, TIRO],
      ],
      fin: 'Claves: el pase tiene que ir suave y por delante del que dispara, para golpear de primeras.' },

    { id: 'f11-falta-barrera', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Falta frontal: desmarque desde la barrera',
      desc: 'Dos jugadores se pegan a la barrera; uno gira a la espalda y recibe un pase picado.',
      el: { ...F11_FALTA_FRONTAL, a11: [-0.1, 13.2] },
      pasos: [
        ['El 9 y el 11 se colocan pegados a la barrera. El 7 amaga el disparo.', { a7: [2, 20.6] }],
        ['El 9 gira y se desmarca a la espalda de la barrera.', { a9: [6, 7] }],
        ['El 10 pica el balón por encima de la barrera para el 9.', { b: [6, 7.2] }, CENTRO],
        ['El 9 remata ante el portero.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Claves: cuidado con el fuera de juego; el 9 sale en el momento del golpeo.' },

    { id: 'f11-falta-lateral-segundo-palo', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Falta lateral: centro al segundo palo',
      desc: 'Rematadores en línea a la altura de la defensa; arrancan en el golpeo y el centro va lejos del portero.',
      el: { ...F11_FALTA_LATERAL },
      pasos: [
        ['Los rematadores esperan en línea para no estar en fuera de juego y arrancan en el golpeo, cada uno a una zona.',
          { a9: [4, 6], a5: [-1, 7], a4: [-6, 5], a6: [8, 9], r4: [2.5, 7], r3: [-2, 7.5], r2: [-6.5, 6] }],
        ['El 7 centra cerrado al segundo palo, lejos del portero.', { b: [-6, 5.2] }, CENTRO],
        ['El 4 remata de cabeza hacia el centro de la portería.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: salir todos a la vez y a zonas distintas. Un jugador (10) siempre fuera del área para el rechace.' },

    { id: 'f11-falta-lateral-atras', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Falta lateral: amago de centro y pase atrás',
      desc: 'Todos atacan como si fuera un centro, pero el balón va raso atrás para el disparo desde la frontal.',
      el: { ...F11_FALTA_LATERAL },
      pasos: [
        ['Los rematadores atacan la portería como si fuera un centro; el 10 se queda fuera del área.',
          { a9: [4, 6], a5: [-1, 7], a4: [-6, 5], a6: [8, 9], r4: [2.5, 7], r3: [-2, 7.5], r2: [-6.5, 6], r5: [6, 8] }],
        ['El 7 pasa raso atrás al 10, que llega desde la frontal.', { b: [8, 19], a10: [8, 19.3] }],
        ['Disparo del 10 con la defensa hundida.', { b: [-2.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el engaño funciona si los rematadores atacan de verdad la portería.' },

    // --- Saques de banda
    { id: 'f11-banda-largo', mod: 'f11', cat: 'banda', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Saque de banda largo al área',
      desc: 'Si hay un jugador con saque largo, el saque de banda cerca del área es casi un córner.',
      el: { b: [34.3, 22], a2: [34.8, 22.2], a5: [4, 12], a4: [0, 13], a9: [8, 10], a10: [12, 18], a7: [26, 20],
        r1: [0, 2], r2: [6, 7], r3: [1, 8], r4: [-4, 8], r5: [10, 12], r6: [24, 18], r7: [-2, 15] },
      pasos: [
        ['Los centrales suben al área. El 5 ataca el primer palo para peinar.', { a5: [8, 8], a4: [0, 9], r2: [8.5, 7.5] }],
        ['El 2 lanza largo y tenso al primer palo.', { b: [8, 8.2] }, CENTRO],
        ['El 5 peina hacia el centro del área.', { b: [1, 7.2], a4: [1, 7] }],
        ['El 4 remata.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el saque debe ser tenso, no bombeado. Pies en el suelo y balón por detrás de la cabeza.' },

    { id: 'f11-banda-espalda', mod: 'f11', cat: 'banda', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Saque de banda: amago y desmarque a la espalda',
      desc: 'El receptor viene a pedirla al pie y, cuando su marcador le sigue, cambia de ritmo y ataca la espalda.',
      el: { b: [34.3, 40], a2: [34.8, 40.3], a7: [30, 38], a8: [27, 46], a9: [6, 20], a10: [-4, 28], a11: [-18, 24],
        r1: [0, 1.5], r7: [29.5, 35.5], r2: [5, 18], r3: [18, 22], r4: [-5, 18], r5: [-16, 20], r8: [20, 40] },
      pasos: [
        ['El 7 se acerca al lanzador para pedirla al pie; su marcador le sigue.', { a7: [32, 42], r7: [31, 40.5] }],
        ['Cambio de ritmo: el 7 gira y ataca el espacio a la espalda.', { a7: [31, 28], r7: [30, 37] }],
        ['El 2 saca a la espalda del defensor.', { b: [31, 28.5] }, CENTRO],
        ['El 7 conduce hacia el área.', { a7: [30, 14], b: [30, 14.2] }],
        ['Centro al punto de penalti para el 9.', { b: [0, 10], a9: [0, 10.2], r2: [1.5, 9] }, CENTRO],
      ],
      fin: 'Claves: el amago corto tiene que ser real para que el defensor dé un paso adelante.' },

    // --- Salida de balón
    { id: 'f11-salida-corta', mod: 'f11', cat: 'salida', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Salida en corto con centrales abiertos (4-3-3)',
      desc: 'Los centrales se abren, el pivote baja a ofrecerse y el balón progresa por dentro hasta el extremo.',
      el: { ...F11_SALIDA },
      pasos: [
        ['Los centrales se abren a los lados del área y los laterales suben. El portero tiene el balón.', { a4: [-16, 99], a5: [16, 99], a2: [30, 78], a3: [-30, 78] }],
        ['Pase del portero al central abierto (5).', { b: [15.6, 98.6] }],
        ['El delantero rival presiona al 5; el pivote (6) baja a ofrecer línea de pase por dentro.', { r10: [13, 94], a6: [5, 90], r8: [4, 82] }],
        ['Pase al 6, que recibe perfilado hacia delante.', { b: [5, 89.6] }],
        ['El 6 se gira y encuentra al 10 entre líneas.', { b: [12, 74.6] }],
        ['El 10 conduce hacia la banda.', { a10: [16, 66], b: [16, 65.6], r5: [14, 62] }],
        ['El 10 abre al extremo (7), que encara a su lateral.', { b: [26, 60.4] }],
      ],
      fin: 'Claves: separar mucho a los centrales para estirar la presión. Recibir siempre perfilado.' },

    { id: 'f11-salida-larga', mod: 'f11', cat: 'salida', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Salida en largo y segunda jugada',
      desc: 'Saque largo al delantero; los compañeros rodean la zona de caída para ganar el rechace.',
      el: { ...F11_SALIDA },
      pasos: [
        ['El equipo se adelanta. El 9 se coloca para el duelo aéreo y el 10, el 8 y los extremos rodean la zona de caída.',
          { a9: [6, 52], a10: [12, 58], a8: [0, 60], a7: [20, 50], a11: [-18, 52] }],
        ['Saque largo del portero hacia el 9.', { b: [6, 52.3], r4: [6, 50] }, CENTRO],
        ['El 9 gana el duelo y peina hacia el 7, que ataca la espalda.', { b: [18, 40], a7: [18, 40.3] }],
        ['El 7 conduce hacia el área mientras el 9 y el 11 acompañan.', { a7: [15, 24], b: [15, 23.6], a9: [2, 30], a11: [-12, 30], r3: [-2, 28], r2: [-12, 32], r4: [6, 34] }],
        ['Pase al 9 en la frontal.', { b: [2, 26], a9: [2, 26.3] }],
        ['Disparo del 9.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: la segunda jugada se gana antes de que caiga el balón: estar cerca y orientado.' },

    // --- Ataque
    { id: 'f11-desdoblamiento', mod: 'f11', cat: 'ataque', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Desdoblamiento del lateral',
      desc: 'El extremo conduce hacia dentro y arrastra a su marcador; el lateral dobla por fuera y centra atrás.',
      el: { b: [25.4, 31.4], a7: [26, 32], a2: [26, 46], a10: [10, 28], a9: [0, 18], a11: [-20, 22], a8: [4, 36],
        r1: [0, 1.5], r3: [24, 26], r2: [10, 17], r4: [0, 16.5], r5: [-10, 17], r6: [-22, 20], r7: [10, 30], r8: [-4, 30] },
      pasos: [
        ['El 7 conduce hacia dentro y arrastra a su marcador; el 2 empieza a subir.', { a7: [18, 28], b: [17.6, 27.4], r3: [19, 25], a2: [29, 36] }],
        ['El 2 dobla por fuera aprovechando el pasillo libre.', { a2: [31, 22] }],
        ['El 7 filtra el pase al espacio para el 2.', { b: [31, 19] }],
        ['El 2 conduce hasta línea de fondo; el 9 ataca el área.', { a2: [29, 6], b: [29, 5.6], a9: [2, 12], r4: [5, 5] }],
        ['Pase atrás al 9, que llega al punto de penalti.', { b: [2, 10.4], a9: [2, 10.7] }],
        ['Remate del 9.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el extremo tiene que llevarse a su marcador hacia dentro; si no, no hay pasillo para el lateral.' },

    { id: 'f11-pared', mod: 'f11', cat: 'ataque', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Pared (1-2) en la frontal',
      desc: 'Fijar al defensor conduciendo hacia él, apoyo del delantero de cara y devolución a la espalda.',
      el: { b: [4.4, 29.6], a10: [4, 30.2], a9: [0, 21], a7: [22, 22], a11: [-20, 22],
        r1: [0, 1.5], r8: [4, 24], r4: [-1, 17], r3: [8, 17], r5: [-8, 17], r2: [18, 18] },
      pasos: [
        ['El 10 conduce hacia el defensor para fijarlo.', { a10: [4, 26.6], b: [4.2, 26], r8: [4, 23] }],
        ['Pase al 9, que viene al apoyo de cara.', { b: [0.5, 19.6], a9: [0.5, 20] }],
        ['El 10 ataca la espalda del defensor y el 9 devuelve de primeras (pared).', { a10: [3, 15.5], b: [3, 15.8], r8: [4, 21] }],
        ['Disparo del 10 ante el portero.', { b: [-2.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: pasar y salir en el mismo momento. El que hace la pared toca de primeras.' },

    { id: 'f11-tercer-hombre', mod: 'f11', cat: 'ataque', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Tercer hombre',
      desc: 'El delantero baja a recibir y descarga de primeras para un tercer jugador que ya venía lanzado.',
      el: { b: [-3.6, 50.4], a6: [-4, 51], a9: [0, 40], a10: [10, 40], a8: [-14, 44], a7: [24, 34], a11: [-24, 34],
        r1: [0, 1.5], r4: [-1, 32], r3: [10, 30], r5: [-12, 30], r2: [22, 30], r6: [-4, 42], r7: [8, 42] },
      pasos: [
        ['El 9 baja a recibir y arrastra a su central.', { a9: [-2, 37], r4: [-2, 33.5] }],
        ['El 6 pasa al 9.', { b: [-2, 37.4] }],
        ['El 9 descarga de primeras al 10, que ya venía lanzado a la espalda del central.', { b: [7, 24], a10: [7, 24.3] }],
        ['El 10 conduce hacia portería.', { a10: [4, 14], b: [4, 13.6] }],
        ['Disparo.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el tercer hombre arranca cuando sale el primer pase, no cuando recibe el 9.' },

    { id: 'f11-cambio-orientacion', mod: 'f11', cat: 'ataque', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Cambio de orientación al lado débil',
      desc: 'Cargar el juego por un lado para atraer al rival y cambiar rápido al extremo contrario, que está solo.',
      el: { b: [-27.4, 49.6], a3: [-28, 50], a11: [-26, 36], a8: [-14, 46], a6: [-4, 56], a10: [4, 42], a9: [-6, 30], a7: [28, 40], a2: [24, 60], a4: [-10, 70], a5: [10, 70], a1: [0, 102],
        r1: [0, 1.5], r3: [-24, 32], r4: [-14, 31], r5: [-4, 31], r2: [6, 32], r6: [-22, 44], r8: [-12, 47], r7: [-2, 46], r11: [8, 45], r9: [-10, 60], r10: [2, 62] },
      pasos: [
        ['El equipo carga el juego por la izquierda y el rival bascula. El 3 juega con el 8 por dentro.', { b: [-14, 45.6] }],
        ['El 8 cambia de orientación con un pase largo al 7, solo en el lado débil.', { b: [27.6, 39.6] }, CENTRO],
        ['El rival tiene que bascular. El 7 conduce hacia dentro y el 2 sube por fuera.', { a7: [22, 30], b: [21.6, 29.6], a2: [30, 40], r2: [14, 29], r11: [16, 40] }],
        ['Con el 2 doblando, el 7 elige: encarar o abrir. Aquí abre al 2.', { b: [31, 28], a2: [31, 28.3] }],
      ],
      fin: 'Claves: el cambio debe ser rápido; si tardamos, el rival llega a bascular.' },

    // --- Contraataque
    { id: 'f11-contra-3x2', mod: 'f11', cat: 'transicion', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Contraataque 3 contra 2',
      desc: 'Tras recuperar, el poseedor conduce por el centro para fijar a los centrales y los extremos atacan por fuera.',
      el: { b: [0.4, 61.6], a8: [0, 62], a7: [22, 58], a11: [-22, 58], a4: [-8, 80], a5: [8, 80], a1: [0, 102],
        r1: [0, 1.5], r4: [-6, 40], r5: [6, 40], r8: [4, 66], r9: [-6, 70] },
      pasos: [
        ['Recuperación del 8. Los extremos salen a toda velocidad por fuera.', { a7: [24, 40], a11: [-24, 40], r4: [-5, 32], r5: [5, 32] }],
        ['El 8 conduce por el centro para fijar a los dos centrales.', { a8: [0, 32], b: [0.4, 31.6], a7: [20, 24], a11: [-20, 24], r4: [-3, 24], r5: [3, 24] }],
        ['Un central sale al 8: pase al extremo que queda libre.', { r5: [1.5, 28], b: [19.6, 21], a7: [19.6, 21.3], r4: [-4, 22] }],
        ['El 7 conduce hacia el área; el 8 y el 11 atacan el área.', { a7: [13, 10], b: [12.6, 9.6], a8: [1, 13], a11: [-8, 8], r4: [6, 8] }],
        ['Pase atrás al 8, que llega libre.', { b: [1, 12.6] }],
        ['Gol.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: conducir rápido por el centro y soltar el balón en el momento en que sale un defensor.' },

    // --- Defensa
    { id: 'f11-presion-alta', mod: 'f11', cat: 'defensa', vista: 'completo', nivel: 'Cadete en adelante',
      titulo: 'Presión alta tras saque de portería',
      desc: 'El delantero activa la presión sobre el central y todo el equipo se adelanta tapando las líneas de pase.',
      el: { b: [0.4, 2.6], r1: [0, 2], r4: [-14, 6], r5: [14, 6], r2: [28, 16], r3: [-28, 16], r6: [0, 20], r7: [10, 30], r8: [-10, 30], r9: [0, 50], r10: [14, 40], r11: [-14, 40],
        a9: [-2, 22], a10: [6, 24], a7: [20, 26], a11: [-20, 26], a8: [-8, 34], a6: [2, 36], a4: [-8, 50], a5: [8, 50], a2: [24, 46], a3: [-24, 46], a1: [0, 102] },
      pasos: [
        ['El portero rival juega con su central de este lado.', { b: [13.6, 6.6] }],
        ['Activador: el 9 sale a presionar al central y le cierra el pase al portero; el 7 tapa al lateral y el 10 al pivote. Todo el equipo se adelanta.',
          { a9: [10, 9], a7: [24, 15], a10: [2, 18], a6: [8, 28], a8: [-4, 28], a2: [22, 34], a5: [12, 42], a4: [0, 44], a3: [-16, 40], a11: [-14, 14] }],
        ['Sin pases cortos, el central rival se precipita. El 6 intercepta.', { b: [8.4, 27.6] }],
      ],
      fin: 'Claves: presionar todos a la vez. Si uno no sale, la presión se rompe y el rival sale fácil.' },

    { id: 'f11-basculacion', mod: 'f11', cat: 'defensa', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Basculación en bloque medio (4-4-2)',
      desc: 'Cuando el rival abre a banda, todo el bloque se desplaza hacia el balón manteniendo las distancias.',
      el: { b: [0.4, 48.6], r6: [0, 48], r2: [27, 60], r7: [16, 58], r8: [-14, 58], r9: [-4, 74], r10: [6, 74], r11: [-26, 62], r4: [-10, 40], r5: [10, 40], r3: [-28, 48], r1: [0, 1.5],
        a4: [-7, 80], a5: [7, 80], a3: [-22, 78], a2: [22, 78], a11: [-22, 66], a8: [-7, 66], a6: [7, 66], a7: [22, 66], a9: [-5, 54], a10: [5, 54], a1: [0, 102] },
      pasos: [
        ['El rival abre a la banda.', { b: [26.6, 60.6] }],
        ['Todo el bloque bascula hacia el balón: el 2 sale al poseedor, el 7 cierra por dentro, la línea de cuatro se desplaza y el lado contrario cierra el centro.',
          { a2: [25, 64], a7: [19, 61], a6: [10, 63], a5: [14, 79], a4: [3, 81], a3: [-10, 81], a8: [-1, 66], a11: [-12, 67], a10: [12, 54], a9: [3, 53] }],
        ['Si el rival intenta jugar por dentro, el 6 intercepta.', { b: [10.4, 62.6] }],
      ],
      fin: 'Claves: moverse juntos, como si estuviéramos unidos por cuerdas. El lado débil se cierra hacia dentro.' },

    { id: 'f11-defensa-corner', mod: 'f11', cat: 'defensa', vista: 'defensa', nivel: 'Infantil en adelante',
      titulo: 'Defensa de córner mixta',
      desc: 'Tres jugadores en zona protegen el área pequeña y el resto marca al hombre. Uno se queda arriba para salir.',
      el: { b: [-33.5, 104.4], r7: [-34.6, 103.8], r4: [-2, 92], r5: [3, 91], r9: [0, 93], r6: [-6, 94], r10: [6, 88], r8: [-1, 84],
        a1: [0, 104.2], a11: [-4, 104.3], a4: [-4, 99.6], a5: [0, 99.3], a6: [4, 99.6], a3: [-2, 93.6], a2: [3, 92.6], a8: [-5.5, 95], a9: [-1, 87], a10: [-26, 99], a7: [16, 75] },
      pasos: [
        ['Los rivales atacan la portería; los marcadores les siguen y la zona protege el área pequeña.',
          { r4: [-3, 98], r5: [2, 97.5], r9: [0.5, 99], r6: [-5, 99.5], a3: [-3, 97.6], a2: [2, 96.9], a8: [-5, 98.7] }],
        ['El centro llega al primer palo.', { b: [-3.6, 99.2] }, CENTRO],
        ['El 4 despeja desde su zona y el 7 sale al contraataque.', { b: [-28, 82], a7: [14, 60] }, CENTRO],
      ],
      fin: 'Claves: la zona ataca el balón, no espera. El 11 cubre el primer palo y el 9 los rechaces.' },

    // =============================================================== FÚTBOL 7
    { id: 'f7-corner-primer-palo', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Córner al primer palo',
      desc: 'Un jugador ataca el primer palo para rematar o desviar; otro ataca el centro de la portería.',
      el: { ...F7_CORNER },
      pasos: [
        ['El 9 ataca el primer palo y el 4 el centro de la portería. El 10 y el 8 esperan el rechace fuera del área.',
          { a9: [4, 3.5], a4: [0, 4.5], r3: [3.6, 4.2], r4: [-0.5, 5.2] }],
        ['El 7 pone un balón tenso al primer palo.', { b: [4, 3.7] }, CENTRO],
        ['El 9 remata o desvía hacia el segundo palo.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el que ataca el primer palo tiene que llegar antes que su defensor.' },

    { id: 'f7-corner-corto', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Córner en corto (2 contra 1)',
      desc: 'Saque en corto para crear superioridad junto a la esquina y terminar con pase atrás a la frontal.',
      el: { ...F7_CORNER, a11: [11, 7] },
      pasos: [
        ['El 11 se acerca al lanzador: 2 contra 1 frente al defensor más cercano.', { a11: [16.5, 2.5] }],
        ['Saque en corto al 11.', { b: [16.4, 2.8] }],
        ['El 11 conduce hacia el área y atrae al defensor; el 7 entra al campo.', { a11: [13, 5], b: [12.6, 5.2], r6: [12, 6.5], a7: [17.5, 3] }],
        ['Pase al 7, que ha quedado libre.', { b: [16.6, 4.6], a7: [16.6, 4.3] }],
        ['Pase atrás al 10, que llega a la frontal.', { b: [3, 10.6], a10: [3, 10.9] }],
        ['Disparo del 10.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: en F7 el córner en corto es muy eficaz porque los niños suelen tener poco golpeo largo.' },

    { id: 'f7-corner-frontal', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Córner raso al borde del área',
      desc: 'Todos atacan la portería menos uno, que dispara desde fuera del área.',
      el: { ...F7_CORNER },
      pasos: [
        ['Todos atacan la portería y arrastran a la defensa. El 8 espera fuera del área.',
          { a9: [3, 3], a4: [-2, 4], a10: [1, 6], r3: [3, 4], r4: [-1.5, 4.8], r5: [1, 7] }],
        ['Pase raso del 7 al borde del área.', { b: [1, 13.6], a8: [1, 14] }],
        ['Disparo de primeras del 8.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el pase raso es fácil de ejecutar para todas las edades.' },

    { id: 'f7-corner-cruce', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner con cruce de rematadores',
      desc: 'Dos rematadores se cruzan para que sus marcadores se estorben.',
      el: { ...F7_CORNER },
      pasos: [
        ['El 9 y el 4 se cruzan: el 9 va al segundo palo y el 4 al primero, para que se pierdan los marcadores.',
          { a9: [-4, 3.5], a4: [4, 3.5], r3: [1.5, 4.6], r4: [-0.5, 5.4] }],
        ['El 7 centra al segundo palo.', { b: [-4, 3.8] }, CENTRO],
        ['Remate del 9.', { b: [0.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: cruzarse cerca uno del otro, rozando, para que los defensores choquen.' },

    { id: 'f7-falta-toque', mod: 'f7', cat: 'falta', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Falta frontal: toque y disparo',
      desc: 'Pase corto al lado para disparar sin la barrera delante.',
      el: { ...F7_FALTA_FRONTAL },
      pasos: [
        ['El 10 toca en corto al 8, que llega en carrera.', { b: [5, 15.6], a8: [5, 15.9] }],
        ['Disparo del 8 sin barrera delante.', { b: [-2, -0.3], r4: [3.5, 11] }, TIRO],
      ],
      fin: 'Claves: tocar suave y por delante del que dispara.' },

    { id: 'f7-falta-amago', mod: 'f7', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta frontal: amago y pase al desmarque',
      desc: 'Un jugador amaga el disparo y el lanzador pica el balón para un compañero que se desmarca.',
      el: { ...F7_FALTA_FRONTAL, a8: [3.6, 17.6] },
      pasos: [
        ['El 8 amaga el disparo pasando por encima del balón.', { a8: [1, 14] }],
        ['El 9 se desmarca desde la izquierda a la espalda de la defensa.', { a9: [-3, 5], r5: [-4.5, 7] }],
        ['Pase del 10 al 9.', { b: [-3, 5.3] }, CENTRO],
        ['Remate del 9.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Claves: el 9 no puede salir antes del golpeo (fuera de juego).' },

    { id: 'f7-falta-lateral', mod: 'f7', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta lateral: centro al segundo palo',
      desc: 'Los rematadores arrancan a la vez y el centro va al segundo palo, lejos del portero.',
      el: { b: [16, 14], a7: [17.2, 15.4], r2: [11.5, 10], r3: [3, 8], r4: [-2, 8], r5: [-6, 8.5], r1: [0, 1], r6: [5, 15],
        a9: [3, 9], a4: [-2, 9.2], a10: [-6, 9.5], a8: [6, 17] },
      pasos: [
        ['Los rematadores arrancan a la vez hacia la portería.', { a9: [3, 3.5], a4: [-1, 4.5], a10: [-5, 4], r3: [2.5, 4.5], r4: [-1.5, 5], r5: [-4.5, 5] }],
        ['Centro cerrado al segundo palo.', { b: [-5, 4.2] }, CENTRO],
        ['Remate del 10.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Claves: salir en el golpeo, no antes. El 8 se queda fuera del área para el rechace.' },

    { id: 'f7-banda-pared', mod: 'f7', cat: 'banda', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Saque de banda: pared y desborde',
      desc: 'El receptor devuelve al lanzador, que entra al campo, y ataca el espacio a la espalda del defensor.',
      el: { b: [20.3, 22], a2: [20.8, 22.3], a7: [16, 19], a9: [4, 10], a10: [-4, 16], r3: [15.5, 17.5], r2: [3, 8.5], r4: [-4, 9], r1: [0, 1], r5: [6, 20] },
      pasos: [
        ['El 7 viene a recibir; su defensor le sigue.', { a7: [17, 23], r3: [16.4, 21.2] }],
        ['Saque al pie del 7.', { b: [17, 23.4] }],
        ['El 2 entra al campo y el 7 se la devuelve de primeras.', { a2: [18.5, 19.5], b: [18.5, 19.8] }],
        ['El 7 gira y ataca el espacio; el 2 le devuelve a la espalda del defensor.', { a7: [17, 12], b: [17, 12.3], r3: [16, 18] }],
        ['El 7 centra al 9, que ataca el primer palo.', { b: [2, 4.3], a9: [2, 4], r2: [3, 5.6] }, CENTRO],
        ['Remate.', { b: [-1, -0.3] }, TIRO],
      ],
      fin: 'Claves: quien saca debe entrar al campo enseguida para dar la pared.' },

    { id: 'f7-banda-espalda', mod: 'f7', cat: 'banda', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Saque de banda a la espalda',
      desc: 'Amago de venir al pie y desmarque de ruptura a la espalda del marcador.',
      el: { b: [20.3, 28], a2: [20.8, 28.3], a7: [16, 26], r3: [15, 24], a9: [2, 14], r2: [2, 12], r4: [-6, 13], r1: [0, 1], a10: [-4, 22], r5: [-2, 20] },
      pasos: [
        ['El 7 se acerca para pedirla al pie y arrastra a su marcador.', { a7: [18, 30], r3: [17, 28.5] }],
        ['Cambio de ritmo: el 7 ataca el espacio a la espalda.', { a7: [17, 17], r3: [16.5, 25] }],
        ['Saque largo a la espalda del defensor.', { b: [17, 17.3] }, CENTRO],
        ['El 7 conduce hacia el área.', { a7: [12, 9], b: [12, 9.3] }],
        ['Pase atrás al 9 para el remate.', { b: [1, 7], a9: [1, 7.3], r2: [2, 5] }],
        ['Remate del 9.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el cambio de ritmo es lo que gana la espalda.' },

    { id: 'f7-salida-corta', mod: 'f7', cat: 'salida', vista: 'completo', nivel: 'Benjamín en adelante',
      titulo: 'Salida desde el portero con centrales abiertos (2-3-1)',
      desc: 'Los centrales se abren, el pivote baja y el balón sale por banda hasta encontrar al delantero.',
      el: { b: [0.5, 58], a1: [0, 58.6], a4: [-6, 55], a5: [6, 55], a11: [-15, 42], a6: [0, 44], a7: [15, 42], a9: [0, 26],
        r9: [0, 46], r10: [-8, 40], r11: [8, 40], r6: [0, 30], r3: [-12, 22], r2: [12, 22], r1: [0, 1] },
      pasos: [
        ['Los centrales se abren a la altura del área y el pivote (6) baja a ofrecerse.', { a4: [-13, 55], a5: [13, 55], a6: [0, 49], r9: [0, 50] }],
        ['El portero juega con el central (5).', { b: [12.6, 54.6] }],
        ['Un rival sale a presionar al 5; el 7 baja a dar apoyo por banda.', { a7: [17, 46], r11: [11, 51] }],
        ['Pase del 5 al 7.', { b: [16.6, 45.6] }],
        ['El 6 se ha girado: el 7 juega con él de cara.', { a6: [5, 42], b: [5, 42.4] }],
        ['El 6 busca al 9 en profundidad.', { b: [2, 24.4], a9: [2, 24.6] }],
      ],
      fin: 'Claves: en F7 base hay que premiar salir jugando aunque se cometan errores.' },

    { id: 'f7-desdoblamiento', mod: 'f7', cat: 'ataque', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Desdoblamiento por banda',
      desc: 'El extremo conduce hacia dentro y el compañero dobla por fuera para centrar atrás.',
      el: { b: [14.6, 23.6], a7: [15, 24], a2: [14, 36], a9: [0, 14], a10: [-8, 20], a8: [2, 30],
        r3: [13, 19], r2: [4, 11], r4: [-5, 11], r1: [0, 1], r6: [2, 22] },
      pasos: [
        ['El 7 conduce hacia dentro arrastrando a su defensor; el 2 empieza a subir.', { a7: [9, 21], b: [8.6, 20.6], r3: [10, 18.6], a2: [16, 28] }],
        ['El 2 dobla por fuera.', { a2: [18, 15] }],
        ['Pase al espacio para el 2.', { b: [18, 13] }],
        ['El 2 conduce hasta la línea de fondo; el 9 ataca el área.', { a2: [16, 5], b: [15.6, 4.8], a9: [2, 8], r2: [3, 4] }],
        ['Pase atrás al 9.', { b: [1.5, 6.6], a9: [1.5, 6.9] }],
        ['Remate.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el pase atrás desde la línea de fondo es el centro más eficaz en F7.' },

    { id: 'f7-pared', mod: 'f7', cat: 'ataque', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Pared y tiro',
      desc: 'Fijar al defensor, pase al delantero que viene de cara y devolución a la espalda.',
      el: { b: [2.4, 23.6], a10: [2, 24], a9: [0, 16], a7: [14, 18], a11: [-14, 18], r6: [2, 19.5], r4: [-1, 13.5], r2: [8, 12], r3: [-8, 12], r1: [0, 1] },
      pasos: [
        ['El 10 conduce hacia el defensor para fijarlo.', { a10: [2, 21.4], b: [2.2, 21], r6: [2, 18.4] }],
        ['Pase al 9, que da apoyo de cara.', { b: [0, 16.6], a9: [0, 17] }],
        ['Pared: el 9 devuelve de primeras a la espalda del defensor.', { a10: [1, 11.5], b: [1, 11.8], r6: [2, 16.5] }],
        ['Tiro del 10.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: la pared es el primer gesto colectivo que se enseña en base.' },

    { id: 'f7-contra-2x1', mod: 'f7', cat: 'transicion', vista: 'completo', nivel: 'Benjamín en adelante',
      titulo: 'Contraataque 2 contra 1',
      desc: 'Tras robo, conducir hacia el defensor para fijarlo y pasar al compañero libre.',
      el: { b: [0.4, 34.6], a6: [0, 35], a9: [10, 32], r4: [3, 22], r6: [-3, 40], r1: [0, 1], a1: [0, 58.6] },
      pasos: [
        ['Tras robo, el 6 conduce directo hacia el defensor y el 9 corre en paralelo.', { a6: [-2, 20], b: [-1.6, 19.6], a9: [9, 18], r4: [0, 16] }],
        ['El defensor sale al poseedor: pase al 9, que queda solo.', { b: [8, 13], a9: [8, 13.3], r4: [-1.5, 18] }],
        ['El 9 define ante el portero.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: conducir hacia el defensor, no hacia la banda. Pasar justo cuando se compromete.' },

    { id: 'f7-presion-alta', mod: 'f7', cat: 'defensa', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Presión alta al saque del portero',
      desc: 'Cuando el portero rival juega con un defensa, el jugador más cercano presiona cerrando la vuelta y el resto se acerca a su par.',
      el: { b: [0.5, 2], r1: [0, 1.4], r4: [-10, 5], r5: [10, 5], r6: [0, 12], r7: [14, 16], r8: [-14, 16], r9: [0, 26],
        a9: [0, 15], a11: [-12, 20], a7: [12, 20], a6: [0, 24], a4: [-6, 34], a5: [6, 34], a1: [0, 58.6] },
      pasos: [
        ['El portero rival juega con un defensa abierto.', { b: [9.6, 5.5] }],
        ['El 7 salta a presionar cerrando el pase atrás; el 9 tapa el pase al centro y el resto se acerca a su par.',
          { a7: [8, 8], a9: [3, 11], a6: [4, 16], a11: [-8, 13], a5: [12, 22], a4: [0, 26] }],
        ['Sin línea de pase segura, el rival se precipita y el 5 intercepta.', { b: [11.5, 17.6], a5: [11.5, 18] }],
      ],
      fin: 'Claves: presionar en curva, tapando el pase hacia atrás o hacia dentro.' },

    { id: 'f7-basculacion', mod: 'f7', cat: 'defensa', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Repliegue y basculación (3-2-1)',
      desc: 'El equipo se junta y se desplaza hacia el lado del balón para dejar sin espacio al rival.',
      el: { b: [0.4, 28.6], r6: [0, 28], r7: [15, 38], r11: [-15, 38], r9: [0, 46], r1: [0, 1], r4: [-8, 20], r5: [8, 20],
        a1: [0, 58.6], a3: [-10, 50], a4: [0, 51], a2: [10, 50], a6: [-6, 42], a8: [6, 42], a9: [0, 32] },
      pasos: [
        ['El rival abre a la banda.', { b: [14.6, 38.4] }],
        ['Basculación: el 2 sale a cerrar, el 8 cubre por dentro y el resto se desplaza hacia el balón.', { a2: [13, 42], a8: [9, 40], a4: [4, 50], a3: [-4, 50], a6: [0, 42], a9: [6, 32] }],
        ['El rival queda sin espacio en la banda; robo del 8.', { b: [10, 39.6] }],
      ],
      fin: 'Claves: nadie se queda mirando; el lado contrario cierra hacia el centro.' },

    // =============================================================== FÚTBOL SALA
    { id: 'sala-corner-cierre', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Córner: pase atrás al cierre',
      desc: 'El clásico de sala: dos jugadores atacan la portería y el balón va raso atrás para el disparo del cierre.',
      el: { ...SALA_CORNER },
      pasos: [
        ['El 9 y el 11 atacan la portería y arrastran a sus defensores.', { a9: [2, 1.5], a11: [-1, 2.5], r2: [2.4, 2.2], r3: [-0.8, 3.4] }],
        ['Pase raso atrás al cierre (4), que llega desde fuera.', { b: [2, 8.6], a4: [2, 8.9], r4: [0, 9.5] }],
        ['Disparo del 4; el 9 y el 11 buscan el desvío o el rechace.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el cierre llega en carrera y golpea de primeras. Los de dentro tapan la visión del portero.' },

    { id: 'sala-corner-bloqueo', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: bloqueo para el tirador',
      desc: 'Un compañero bloquea al defensor del tirador, que sale libre hacia el balón.',
      el: { ...SALA_CORNER, a11: [3, 7.5], r3: [2.6, 6.5], r4: [0.6, 9.6] },
      pasos: [
        ['El 11 hace un bloqueo al defensor del 4 (parado y sin empujar).', { a11: [0.9, 8.9], r3: [1.6, 7.6] }],
        ['El 4 sale del bloqueo hacia el lado del balón y queda libre.', { a4: [4, 8.4], r4: [1.2, 9.2] }],
        ['Pase del 7 al 4.', { b: [4, 8.1] }],
        ['Disparo de primeras.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el bloqueo es legal si quien bloquea está parado. Sincronizar el pase con la salida del 4.' },

    { id: 'sala-corner-segundo-palo', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Córner: pase al segundo palo',
      desc: 'Se carga el primer palo y el balón cruza raso para empujar en el segundo palo.',
      el: { ...SALA_CORNER },
      pasos: [
        ['El 9 se mete en el primer palo y arrastra a dos defensores; el 11 se abre al segundo palo.', { a9: [1.5, 1.5], a11: [-5, 3], r2: [2, 2.2], r3: [0.5, 2.6] }],
        ['Pase raso y tenso cruzado al segundo palo.', { b: [-2.5, 1.3], a11: [-2.5, 1.6] }],
        ['El 11 empuja a gol.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el pase tiene que ir raso y fuerte por delante del portero.' },

    { id: 'sala-corner-pared', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: pared con el lanzador',
      desc: 'Saque en corto y devolución al lanzador, que entra al campo y dispara.',
      el: { ...SALA_CORNER, a11: [4, 6], r5: [5, 5.5] },
      pasos: [
        ['El 11 viene a la esquina a recibir en corto.', { a11: [8, 3], r5: [6.5, 4.4] }],
        ['Pase en corto al 11.', { b: [7.8, 2.7] }],
        ['El 7 entra al campo y el 11 se la devuelve (pared).', { a7: [6, 6], b: [6, 6.3] }],
        ['Disparo cruzado del 7.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: hay 4 segundos para sacar; hacerlo rápido sorprende a la defensa.' },

    { id: 'sala-banda-paralela', mod: 'sala', cat: 'banda', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Saque de banda: paralela al pívot',
      desc: 'El pívot sale a la banda a recibir en paralela y descarga para el lanzador, que entra.',
      el: { ...SALA_BANDA },
      pasos: [
        ['El pívot (9) sale hacia la banda a recibir en paralela.', { a9: [8.5, 5], r2: [7.5, 4.2] }],
        ['Pase paralelo a la banda al 9.', { b: [8.5, 5.5] }],
        ['El 9, de espaldas, descarga al 7 que entra por dentro.', { a7: [6, 8.5], b: [6, 8.8] }],
        ['Disparo del 7.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el saque de banda en sala es con el pie y hay 4 segundos.' },

    { id: 'sala-banda-atras', mod: 'sala', cat: 'banda', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Saque de banda: pase atrás al cierre',
      desc: 'Dos jugadores fijan cerca de la portería y el cierre llega para disparar.',
      el: { ...SALA_BANDA },
      pasos: [
        ['El 9 y el 11 fijan a sus defensores cerca de la portería.', { a9: [2, 3], a11: [-3, 4], r2: [2, 2.2], r3: [-2.5, 3.2] }],
        ['Pase atrás al cierre (4), que llega en carrera.', { b: [2, 10.6], a4: [2, 10.9], r4: [1.5, 12.5] }],
        ['Disparo del 4; el 9 busca el desvío.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: disparo raso para que el desvío sea posible.' },

    { id: 'sala-banda-bloqueo', mod: 'sala', cat: 'banda', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Saque de banda: bloqueo y desmarque',
      desc: 'El pívot bloquea al defensor del ala, que sale libre hacia la portería.',
      el: { ...SALA_BANDA, a11: [6, 9], r5: [6.4, 7.8] },
      pasos: [
        ['El 9 sube a hacer un bloqueo al defensor del 11.', { a9: [5.8, 7.2], r2: [5, 6] }],
        ['El 11 sale por detrás del bloqueo hacia la portería; su defensor se queda atascado.', { a11: [4, 3.5], r5: [6.2, 7.6] }],
        ['Pase del 7 al espacio.', { b: [4, 3.8] }],
        ['Remate del 11.', { b: [-0.8, -0.2] }, TIRO],
      ],
      fin: 'Claves: el bloqueo tiene que estar quieto antes del contacto.' },

    { id: 'sala-falta-lateral', mod: 'sala', cat: 'falta', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Falta frontal: amago y pase lateral',
      desc: 'Un jugador amaga el disparo y el balón se toca al lado para un tiro sin barrera.',
      el: { ...SALA_FALTA },
      pasos: [
        ['El 7 amaga el disparo y pasa por encima del balón.', { a7: [1.6, 9.6] }],
        ['El 4 toca en corto al 11, que llega desde la derecha.', { b: [5, 10.2], a11: [5, 10.5] }],
        ['Disparo del 11 al palo largo.', { b: [-1.2, -0.2], r5: [4.5, 8] }, TIRO],
      ],
      fin: 'Claves: en sala la barrera está a 5 m; un toque lateral cambia todo el ángulo.' },

    { id: 'sala-falta-segundo-palo', mod: 'sala', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta frontal: pase al segundo palo',
      desc: 'Un jugador pegado a la barrera gira al segundo palo y recibe un pase raso por el lado.',
      el: { ...SALA_FALTA, a9: [-1.6, 5.8], r4: [-5, 7] },
      pasos: [
        ['El 9, pegado a la barrera, gira hacia el segundo palo.', { a9: [-3, 2.8], r4: [-4, 4.2] }],
        ['Pase raso del 4 por el lado de la barrera.', { b: [-3, 3.1] }],
        ['El 9 empuja a gol.', { b: [-0.8, -0.2] }, TIRO],
      ],
      fin: 'Claves: el 9 tiene que girar justo cuando el lanzador levanta la cabeza.' },

    { id: 'sala-paralela', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Paralela al pívot y descarga',
      desc: 'El ala conduce hacia la banda, el pívot sale a recibir en paralela y descarga para el ala que entra.',
      el: { b: [6.6, 12.6], a7: [7, 13], a11: [-7, 13], a4: [0, 17], a9: [0, 4],
        r1: [0, 0.6], r2: [0, 3], r3: [-6, 10], r4: [6, 10], r5: [0, 13] },
      pasos: [
        ['El 7 conduce hacia la banda; el pívot (9) sale hacia esa banda.', { a7: [8.5, 12], b: [8.2, 11.6], a9: [8, 5], r2: [7, 4.3], r4: [7.5, 10.4] }],
        ['Pase en paralela a la banda.', { b: [8, 5.4] }],
        ['El 9, de espaldas, descarga al 7 que entra por dentro.', { a7: [4, 8], b: [4, 8.3] }],
        ['Disparo del 7.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: tras el pase, el ala ataca el espacio interior inmediatamente.' },

    { id: 'sala-diagonal', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Diagonal al segundo palo',
      desc: 'El ala contrario ataca el segundo palo a la espalda de su defensor y recibe un pase en diagonal.',
      el: { b: [6.6, 11.6], a7: [7, 12], a11: [-7, 12], a4: [0, 17], a9: [2, 4],
        r1: [0, 0.6], r2: [2, 3], r3: [-6, 9.5], r4: [6, 9.5], r5: [0, 13] },
      pasos: [
        ['El 11 (ala contraria) ataca el segundo palo a la espalda de su defensor.', { a11: [-3, 2.5], r3: [-5, 6] }],
        ['Pase en diagonal del 7 al segundo palo.', { b: [-2.8, 2.8] }],
        ['El 11 remata en el segundo palo.', { b: [0, -0.2] }, TIRO],
      ],
      fin: 'Claves: el defensor del lado débil suele mirar el balón; ese es el momento.' },

    { id: 'sala-rotacion-40', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Rotación en 4-0: pasar y atacar el espacio',
      desc: 'Quien pasa ataca el espacio hacia la portería y el compañero de atrás ocupa su hueco.',
      el: { b: [-3.6, 14.6], a4: [-4, 15], a8: [4, 15], a11: [-8, 8], a7: [8, 8],
        r1: [0, 0.6], r2: [-3, 12], r3: [3, 12], r4: [-6, 6], r5: [6, 6] },
      pasos: [
        ['El 4 pasa al 8.', { b: [3.6, 14.6] }],
        ['Tras el pase, el 4 ataca el espacio hacia portería y el 11 baja a ocupar su hueco (rotación).', { a4: [-6, 4.5], a11: [-4, 15], r2: [-4, 9], r4: [-4.5, 12] }],
        ['El 8 juega con el 11, que ya está en el sitio del 4.', { b: [-3.6, 14.6] }],
        ['El 11 busca al 4 en profundidad: llega antes que su defensor.', { b: [-5.6, 4.8] }],
        ['Remate del 4.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: en el 4-0, pase y movimiento siempre. Si nadie se mueve, no hay espacios.' },

    { id: 'sala-bloqueo-continuacion', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Bloqueo y continuación',
      desc: 'El pívot bloquea al defensor del poseedor y, si su defensor cambia, continúa hacia la portería.',
      el: { b: [5.6, 12.6], a7: [6, 13], a9: [1, 5], a11: [-7, 12], a4: [0, 17],
        r1: [0, 0.6], r4: [5, 11], r2: [1, 3.8], r3: [-6, 10], r5: [0, 14] },
      pasos: [
        ['El pívot (9) sube a bloquear al defensor del 7.', { a9: [4.2, 10.2], r2: [2.5, 8.5] }],
        ['El 7 conduce por dentro aprovechando el bloqueo; su defensor se queda atascado.', { a7: [2, 9.5], b: [1.8, 9.1], r4: [4.6, 10.6] }],
        ['El defensor del 9 sale al 7, así que el 9 continúa hacia la portería.', { a9: [4, 4], r2: [1.6, 7.6] }],
        ['Pase del 7 al 9, que está solo.', { b: [4, 4.3] }],
        ['Remate del 9.', { b: [-0.8, -0.2] }, TIRO],
      ],
      fin: 'Claves: leer al defensor: si no cambia, el 7 tira; si cambia, pase al 9.' },

    { id: 'sala-juego-pivot', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Juego de pívot: descarga y tiro',
      desc: 'Pase al pívot de espaldas, que protege y descarga para la llegada de un ala.',
      el: { b: [0, 16.4], a4: [0, 17], a9: [0, 5], a7: [7, 12], a11: [-7, 12],
        r1: [0, 0.6], r2: [0, 3.8], r3: [-6, 10], r4: [6, 10], r5: [2.5, 13] },
      pasos: [
        ['El cierre (4) busca al pívot, que recibe de espaldas.', { b: [0, 5.4] }],
        ['El 9 protege el balón y descarga a la llegada del 11.', { b: [-4, 8], a11: [-4, 8.3], r3: [-5, 9.5] }],
        ['Disparo del 11.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el pívot usa el cuerpo para proteger; la descarga, siempre hacia quien llega de cara.' },

    { id: 'sala-pj-ataque', mod: 'sala', cat: 'portero-jugador', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Ataque 5 contra 4 con portero-jugador (3-2)',
      desc: 'Circulación paciente entre los tres de atrás hasta que la defensa llega tarde, y pase al segundo palo.',
      el: { b: [0.4, 15.6], a1: [0, 16], a11: [-7, 13], a7: [7, 13], a9: [-3, 4], a10: [3, 4],
        r1: [0, 0.6], r2: [-3, 6], r3: [3, 6], r4: [-3, 11], r5: [3, 11] },
      pasos: [
        ['El portero-jugador abre al 7.', { b: [6.6, 12.6] }],
        ['La defensa bascula hacia el balón.', { r5: [5.5, 10.5], r4: [0, 11], r3: [4.5, 5.5], r2: [0, 5.5] }],
        ['Pase atrás al portero-jugador.', { b: [0.4, 15.6] }],
        ['Cambio rápido al 11: la defensa llega tarde.', { b: [-6.6, 12.6], r4: [-2.5, 11], r5: [2, 11] }],
        ['Diagonal del 11 al segundo palo, donde ataca el 10.', { b: [2.6, 2.3], a10: [2.6, 2], r3: [2, 4.5] }],
        ['Gol del 10.', { b: [0.5, -0.2] }, TIRO],
      ],
      fin: 'Claves: no tener prisa. Si se pierde el balón, la portería está vacía: pases seguros.' },

    { id: 'sala-pj-defensa', mod: 'sala', cat: 'portero-jugador', vista: 'defensa', nivel: 'Infantil en adelante',
      titulo: 'Defensa 4 contra 5 en rombo',
      desc: 'Cómo defender al portero-jugador rival: rombo que bascula hacia el balón y cierra los pases interiores.',
      el: { b: [0.4, 24.4], r1: [0, 24], r2: [-7, 27], r3: [7, 27], r4: [-3, 36], r5: [3, 36],
        a1: [0, 39.4], a9: [0, 26], a11: [-5, 30], a7: [5, 30], a4: [0, 34] },
      pasos: [
        ['El portero-jugador rival abre a la banda.', { b: [6.6, 27.4] }],
        ['El rombo bascula: el 7 sale al balón, el 9 cierra el pase interior, el 4 vigila al pívot y el 11 cierra el segundo palo.',
          { a7: [6, 29], a9: [3, 27], a4: [2.5, 34.5], a11: [-1.5, 33] }],
        ['Si arriesga el pase interior al pívot, el 4 lo anticipa.', { b: [3, 34.6], a4: [3, 34.3] }],
      ],
      fin: 'Claves: no salir a por todo; proteger el centro y obligar a pasar por fuera.' },

    { id: 'sala-presion-individual', mod: 'sala', cat: 'defensa', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Presión en toda la pista (individual)',
      desc: 'Cada jugador se pega a su par al saque del portero rival para robar cerca de su portería.',
      el: { b: [0.4, 1.6], r1: [0, 1], r2: [-6, 4], r3: [6, 4], r4: [0, 10], r5: [0, 22],
        a9: [0, 13], a11: [-6, 8], a7: [6, 8], a4: [0, 19], a1: [0, 39.3] },
      pasos: [
        ['Cada jugador se pega a su par al saque del portero rival; el 4 vigila al pívot.', { a11: [-5.5, 5.4], a7: [5.5, 5.4], a9: [0, 11.2], a4: [0, 23.2] }],
        ['El portero rival se la juega al ala; el 7 anticipa y roba.', { b: [5.4, 4.6], a7: [5.4, 4.8] }],
        ['Robo en campo rival y tiro inmediato.', { b: [0.8, -0.2] }, TIRO],
      ],
      fin: 'Claves: estar entre el rival y nuestra portería, mirando balón y par a la vez.' },

    { id: 'sala-defensa-22', mod: 'sala', cat: 'defensa', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Defensa en 2-2 de media pista',
      desc: 'Bloque en media pista que bascula hacia el balón cerrando la paralela y el pase interior.',
      el: { b: [0.4, 14.6], r4: [0, 14], r2: [-7, 24], r3: [7, 24], r5: [0, 34], r1: [0, 1],
        a9: [-3, 22], a10: [3, 22], a4: [-3, 30], a5: [3, 30], a1: [0, 39.3] },
      pasos: [
        ['El rival abre a la banda.', { b: [6.6, 24.4] }],
        ['Basculación: el 10 sale al poseedor, el 5 cierra la banda, el 4 cubre al pívot y el 9 cierra el pase interior.',
          { a10: [5.6, 23], a5: [5.6, 28.6], a4: [1, 32.6], a9: [1.2, 22.6] }],
        ['Si intenta la paralela, el 5 intercepta.', { b: [6.4, 28.4] }],
      ],
      fin: 'Claves: el que sale al balón orienta al rival hacia la banda.' },

    { id: 'sala-salida-portero', mod: 'sala', cat: 'salida', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Saque de portero ante presión',
      desc: 'El ala hace un apoyo para arrastrar a su defensor y ataca la espalda para recibir el saque largo.',
      el: { b: [0.4, 38.3], a1: [0, 38.8], a4: [0, 30], a11: [-8, 28], a7: [8, 28], a9: [0, 16],
        r2: [-1, 27], r4: [-7, 25.5], r5: [7, 25.5], r3: [0, 14.6], r1: [0, 1] },
      pasos: [
        ['El ala (7) hace un desmarque de apoyo hacia su portero; su defensor le sigue.', { a7: [8.5, 33], r5: [7.8, 31] }],
        ['Cambio de ritmo: el 7 se va a la espalda de su defensor.', { a7: [9, 22], r5: [8.3, 29] }],
        ['Saque largo con la mano del portero al 7.', { b: [9, 22.3] }, CENTRO],
        ['El 7 conduce hacia la portería rival; el 9 arrastra a su defensor.', { a7: [6, 14], b: [5.8, 13.6], a9: [-3, 8], r3: [-2, 7] }],
        ['Tiro del 7.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el portero tiene 4 segundos; los apoyos deben moverse antes de que tenga el balón.' },

    { id: 'sala-contra-2x1', mod: 'sala', cat: 'transicion', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Contraataque 2 contra 1 tras parada',
      desc: 'El portero para y saca rápido con la mano; dos jugadores atacan contra un único defensor.',
      el: { b: [0.4, 38.6], a1: [0, 39], a7: [6, 30], a11: [-6, 32], a4: [0, 26],
        r3: [2, 34], r4: [-3, 35], r5: [5, 32], r2: [0, 20], r1: [0, 1] },
      pasos: [
        ['El portero atrapa el balón y los alas salen rápido.', { a7: [6, 18], a11: [-6, 20], r2: [0, 14] }],
        ['Saque rápido con la mano al 7.', { b: [6, 18.3] }, CENTRO],
        ['El 7 conduce hacia el defensor para fijarlo; el 11 corre en paralelo.', { a7: [3, 10], b: [2.8, 9.6], a11: [-5, 8.5], r2: [1.6, 8] }],
        ['Pase al 11, que queda solo.', { b: [-4.6, 6.3], a11: [-4.6, 6.6] }],
        ['Gol del 11.', { b: [0.5, -0.2] }, TIRO],
      ],
      fin: 'Claves: la transición en sala dura 3-4 segundos; hay que salir sin pensar.' },

    // =============================================================== EJERCICIOS DE ENTRENAMIENTO
    // "zonas": rectángulos [x1, d1, x2, d2] que se dibujan en todos los pasos.
    // "encuadre": zona del campo que se muestra al abrir el ejercicio [x1, d1, x2, d2].
    { id: 'ej-rondo-4x1', mod: 'f7', cat: 'ent-rondos', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: 'Rondo 4 contra 1',
      desc: 'Cuatro jugadores en los lados de un cuadrado de 12 x 12 m se pasan el balón; uno en el centro intenta robar.',
      encuadre: [-10, 20, 10, 40], zonas: [[-6, 24, 6, 36]],
      el: { a6: [0, 36.5], a10: [6.5, 30], a8: [0, 23.5], a7: [-6.5, 30], r2: [0, 31], b: [0.4, 35.9] },
      pasos: [
        ['El 6 pasa al 10; el del medio sale a presionar el pase.', { b: [5.9, 30.3], r2: [2.6, 30.8] }],
        ['El 10 juega de primeras con el 8 (máximo 2 toques).', { b: [0.4, 24.1], r2: [1.6, 27.4] }],
        ['El 8 abre al 7, alejando el balón del defensor.', { b: [-5.9, 29.7], r2: [-2.2, 28.2] }],
        ['El 7 busca al 6 por el pasillo que deja libre el defensor.', { b: [-0.4, 35.9], r2: [-1.8, 31] }],
      ],
      fin: 'Reglas: 2 toques; si el del medio toca el balón, cambia con quien lo perdió. Variantes: a 1 toque o 5 contra 2. Duración: 4 series de 2 min.' },

    { id: 'ej-rondo-5x2', mod: 'f11', cat: 'ent-rondos', vista: 'encuadre', nivel: 'Alevín en adelante',
      titulo: 'Rondo 5 contra 2: romper líneas',
      desc: 'Cinco jugadores alrededor de un cuadrado de 16 x 16 m contra dos defensores. Se premia el pase entre los dos defensores.',
      encuadre: [-13, 40, 13, 64], zonas: [[-8, 44, 8, 60]],
      el: { a4: [0, 43.5], a8: [8.5, 48], a7: [8.5, 57], a10: [0, 60.5], a6: [-8.5, 52], r6: [-1, 50], r8: [2, 54], b: [-7.9, 52.3] },
      pasos: [
        ['El 6 juega con el 4; los dos defensores presionan juntos.', { b: [-0.4, 44.1], r6: [-2, 47], r8: [1, 50] }],
        ['El 4 abre al 8.', { b: [7.9, 48.3], r6: [2.5, 47.5], r8: [4.5, 51] }],
        ['El 8 rompe la línea: pase entre los dos defensores hacia el 10.', { b: [0.4, 59.9] }],
        ['El 10 juega con el 7 y los defensores tienen que volver a correr.', { b: [7.9, 56.8], r6: [2, 55], r8: [5, 53.5] }],
      ],
      fin: 'Objetivo: el pase que rompe la línea de los dos defensores. Reglas: 2 toques; el pase entre defensores vale doble. Si roban, sale quien perdió el balón.' },

    { id: 'ej-slalom-tiro', mod: 'f7', cat: 'ent-tecnica', vista: 'ataque', nivel: 'Prebenjamín y benjamín',
      titulo: 'Conducción en slalom y tiro',
      desc: 'Conducción entre conos cambiando de dirección y tiro a portería. Ideal para los más pequeños.',
      el: { k1: [0, 26], k2: [0, 22.5], k3: [0, 19], k4: [0, 15.5], a7: [0, 29.5], b: [0, 28.9], a9: [0, 32], a10: [0, 34], r1: [0, 0.8] },
      pasos: [
        ['Conducción con el interior del pie hacia el primer cono.', { a7: [-1.6, 26], b: [-1.6, 25.5] }],
        ['Cambio de dirección y paso por el otro lado del segundo cono.', { a7: [1.6, 22.5], b: [1.6, 22] }],
        ['Otra vez al lado contrario en el tercer cono.', { a7: [-1.6, 19], b: [-1.6, 18.5] }],
        ['Último cono por el otro lado.', { a7: [1.6, 15.5], b: [1.6, 15] }],
        ['Salida rápida del último cono, levantando la cabeza.', { a7: [1.5, 12.5], b: [1.5, 12] }],
        ['Tiro a portería.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Rotación: quien tira recoge su balón y vuelve a la fila. Variantes: solo con la pierna mala, solo con el exterior, carrera por parejas en dos slaloms.' },

    { id: 'ej-pared-tiro', mod: 'f7', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Finalización: pared con apoyo y tiro',
      desc: 'Conducción, pase a un compañero de apoyo, devolución y tiro. Se trabaja por los dos lados.',
      el: { k1: [-6, 23], k2: [0, 15], a9: [-6, 22.5], b: [-5.6, 22], a10: [0, 14], a11: [-6, 25], a8: [-6, 27], r1: [0, 0.8] },
      pasos: [
        ['El 9 conduce hacia el apoyo.', { a9: [-4, 18.5], b: [-3.6, 18] }],
        ['Pase al 10, que está de apoyo de cara.', { b: [-0.4, 14.4] }],
        ['El 9 ataca el espacio y el 10 devuelve de primeras.', { a9: [-1, 9.5], b: [-1, 9.8] }],
        ['Tiro del 9.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Rotación: el que tira pasa a ser apoyo y el apoyo va a la fila. Cambiar de lado cada 5 minutos.' },

    { id: 'ej-1x1', mod: 'f7', cat: 'ent-juegos', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: '1 contra 1 con portero',
      desc: 'El defensor pasa al atacante y sale a defenderle. El atacante tiene que superarle y tirar.',
      el: { b: [0.4, 13.5], r4: [0, 13], a9: [0, 26], r1: [0, 0.8], k1: [-6, 28], k2: [-4, 28], k3: [4, 28], k4: [6, 28] },
      pasos: [
        ['El defensor pasa al atacante y sale a defenderle.', { b: [0, 25.4], r4: [0, 19] }],
        ['El atacante conduce hacia el defensor.', { a9: [0, 21.5], b: [0, 21], r4: [0, 17.5] }],
        ['Amago hacia un lado y salida por el otro.', { a9: [3.5, 17], b: [3.6, 16.4], r4: [-0.8, 17] }],
        ['Tiro.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Reglas: el atacante tiene 6 segundos. Si el defensor roba, puede marcar en cualquiera de las dos miniporterías de conos.' },

    { id: 'ej-oleadas-2x1', mod: 'f7', cat: 'ent-juegos', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Oleadas 2 contra 1',
      desc: 'Dos atacantes contra un defensor y el portero. Se trabaja fijar al defensor y pasar en el momento justo.',
      el: { a9: [-4, 26], a10: [4, 26], b: [-3.6, 25.5], r4: [0, 14], r1: [0, 0.8] },
      pasos: [
        ['Los dos atacantes avanzan; el que lleva el balón conduce hacia el defensor.', { a9: [-2, 19], b: [-1.8, 18.5], a10: [5, 18], r4: [-0.5, 14.5] }],
        ['El defensor sale al poseedor: pase al compañero libre.', { b: [5, 14.6], a10: [5, 15], r4: [-1, 16] }],
        ['Tiro del 10.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Cuando termina una oleada sale la siguiente. Variante: 3 contra 2 con un defensor que entra con retraso.' },

    { id: 'ej-centros-remate', mod: 'f11', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Centros y remates',
      desc: 'Conducción por banda, centro y llegada de dos rematadores a primer y segundo palo.',
      el: { a7: [26, 40], b: [25.6, 39.5], a9: [0, 26], a10: [-6, 28], r1: [0, 1] },
      pasos: [
        ['El 7 conduce por banda.', { a7: [28, 22], b: [28, 21.5] }],
        ['El 7 sigue conduciendo y los rematadores atacan el área: el 9 al primer palo y el 10 al segundo.', { a7: [28, 14], b: [28, 13.5], a9: [4, 6], a10: [-6, 7] }],
        ['Centro al segundo palo.', { b: [-6, 7.2] }, CENTRO],
        ['Remate del 10.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Rotación por las dos bandas. Variante: añadir un defensor, primero pasivo y luego activo.' },

    { id: 'ej-sala-rondo-3x1', mod: 'sala', cat: 'ent-rondos', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: 'Rondo 3 contra 1 con movilidad',
      desc: 'Tres jugadores en un cuadrado de 8 x 8 m con un defensor. Sin balón hay que moverse al lado libre.',
      encuadre: [-7, 11, 7, 25], zonas: [[-4, 14, 4, 22]],
      el: { a4: [-4.4, 18], a7: [0, 13.6], a11: [4.4, 18], r2: [0, 18.5], b: [-3.9, 18.2] },
      pasos: [
        ['El 4 pasa al 7; el defensor presiona.', { b: [-0.3, 14.1], r2: [-1, 16] }],
        ['El 7 juega con el 11, lejos del defensor. El 4 se mueve al lado libre para dar otra línea de pase.', { b: [3.9, 17.8], r2: [1.6, 16.4], a4: [0, 22.4] }],
        ['El 11 pasa al 4, que ha ocupado el lado libre.', { b: [0.3, 21.9], r2: [1.8, 19.5] }],
      ],
      fin: 'Siempre formar un triángulo con el poseedor. Reglas: 2 toques; prohibido que los dos compañeros queden en línea con el defensor.' },

    { id: 'ej-sala-pase-sigue', mod: 'sala', cat: 'ent-tecnica', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: 'Pase y sigue en triángulo',
      desc: 'Circuito de pase entre tres conos: quien pasa sigue a su balón y ocupa el sitio del receptor.',
      encuadre: [-7, 11, 7, 27],
      el: { k1: [-4, 22], k2: [4, 22], k3: [0, 15], a4: [-4, 22.6], b: [-3.6, 22.1], a7: [4, 22.6], a9: [0, 14.4], a11: [-4, 24.5] },
      pasos: [
        ['El 4 pasa al 9 y sigue su pase hasta el cono del 9.', { b: [-0.3, 14.9], a4: [-0.8, 15.6] }, PASE],
        ['El 9 controla orientado, pasa al 7 y sigue su pase.', { b: [3.6, 22.1], a9: [3.2, 21.6] }, PASE],
        ['El 7 pasa al 11, que espera en la fila del primer cono, y sigue su pase.', { b: [-3.6, 24], a7: [-3.2, 23.6] }, PASE],
      ],
      fin: 'Variantes: a un toque, cambiar el sentido de giro, dos balones a la vez. Control orientado siempre hacia el siguiente pase.' },

    // =============================================================== AMPLIACIÓN (16/11/2026)
    // --- Fútbol 11
    { id: 'f11-corner-pantalla-portero', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Córner cerrado con pantalla al portero',
      desc: 'Un delantero ocupa el espacio del portero para que no pueda salir y el centro va cerrado al área pequeña.',
      el: { ...F11_CORNER, a9: [1, 2] },
      pasos: [
        ['El 9 se coloca delante del portero (sin tocarle). El 4 y el 5 arrancan hacia el área pequeña.', { a4: [-1, 6], a5: [3, 6.5], r4: [-0.5, 7], r3: [3.5, 7] }],
        ['El 7 pone un centro cerrado al borde del área pequeña.', { b: [1.5, 5.5], a4: [1.5, 5.3] }, CENTRO],
        ['El 4 remata de cabeza; el portero no ha podido salir.', { b: [-2.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: quien tapa al portero no puede agarrarle ni empujarle; solo ocupar su espacio. Si el árbitro lo ve como falta, cambiar de jugada.' },

    { id: 'f11-corner-abanico', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner: fila india y salida en abanico',
      desc: 'Cuatro rematadores en fila salen a la vez hacia zonas distintas; el lanzador elige al que queda libre.',
      el: { ...F11_CORNER, a4: [0, 13], a5: [0, 14.2], a9: [0, 15.4], a6: [0, 16.6], r6: [1, 11], r7: [-1, 11.5] },
      pasos: [
        ['Salida en abanico: el 4 al primer palo, el 5 al centro, el 9 al segundo palo y el 6 se queda en el punto de penalti.',
          { a4: [5, 4.5], a5: [0, 5.5], a9: [-5.5, 5], a6: [0, 10.5], r6: [3, 8], r7: [-2, 8] }],
        ['El 7 elige al que ha quedado libre; aquí, el 9 en el segundo palo.', { b: [-5.5, 5.2] }, CENTRO],
        ['Remate del 9.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Claves: la fila confunde a los marcadores. Señal acordada (mano arriba) para salir todos a la vez.' },

    { id: 'f11-falta-raso-barrera', mod: 'f11', cat: 'falta', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Falta frontal: tiro raso bajo la barrera',
      desc: 'Si la barrera salta, el balón raso pasa por debajo.',
      el: { ...F11_FALTA_FRONTAL },
      pasos: [
        ['El 7 amaga el golpeo para que la barrera se prepare a saltar.', { a7: [1.8, 20.5] }],
        ['El 10 golpea raso justo cuando la barrera salta.', { b: [2.6, -0.3] }, TIRO],
      ],
      fin: 'Claves: observar en las primeras faltas si la barrera salta. Si salta siempre, esta es la jugada.' },

    { id: 'f11-saque-centro', mod: 'f11', cat: 'salida', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Saque de centro ensayado: atrás y en largo',
      desc: 'Pase atrás al pivote y balón largo a la espalda del lateral para el extremo, que ya salía en carrera.',
      el: { b: [0, 52.5], a9: [0.8, 52.3], a10: [-1.5, 53], a6: [0, 62], a7: [26, 53], a11: [-26, 53], a8: [-10, 60], a4: [-8, 80], a5: [8, 80],
        r1: [0, 1], r9: [-5, 43], r10: [5, 43], r8: [0, 35], r2: [24, 30], r3: [-24, 30], r4: [-8, 25], r5: [8, 25] },
      pasos: [
        ['El 9 toca hacia atrás para el 6.', { b: [0, 61.4] }],
        ['El 6 envía en largo a la espalda del lateral, donde ataca el 7.', { b: [22, 22], a7: [22, 22.3], r2: [24, 24] }, CENTRO],
        ['El 7 controla y conduce hacia el área.', { a7: [20, 10], b: [19.6, 9.6] }],
      ],
      fin: 'Claves: el 7 sale antes del pase largo; el 6 golpea sin controlar para sorprender.' },

    // --- Fútbol 7
    { id: 'f7-corner-bloqueo', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: bloqueo para el que llega',
      desc: 'Un compañero bloquea al defensor de la frontal y el centrocampista llega libre al punto de penalti.',
      el: { ...F7_CORNER },
      pasos: [
        ['El 10 se pone delante del defensor que vigila la frontal (bloqueo, parado).', { a10: [0.6, 11] }],
        ['El 8 llega libre desde atrás hacia el punto de penalti.', { a8: [2, 8.5], r5: [0.3, 10.3] }],
        ['Centro a media altura al 8.', { b: [2, 8.7] }, CENTRO],
        ['Remate del 8.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el bloqueo es legal si el jugador está quieto. El 8 sale en el momento del golpeo.' },

    { id: 'f7-corner-peinada', mod: 'f7', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: peinada al segundo palo',
      desc: 'Centro tenso al primer palo, peinada hacia atrás y remate en el segundo palo.',
      el: { ...F7_CORNER },
      pasos: [
        ['El 9 ataca el primer palo para peinar; el 4 entra al segundo palo.', { a9: [3.5, 3.5], a4: [-3, 4], r3: [3, 4.6], r4: [-2, 5.2] }],
        ['Centro tenso al primer palo.', { b: [3.5, 3.7] }, CENTRO],
        ['El 9 peina hacia el segundo palo.', { b: [-3, 3.8] }],
        ['El 4 remata.', { b: [0, -0.3] }, TIRO],
      ],
      fin: 'Claves: la peinada se hace con la frente girando el cuello, sin intentar rematar a puerta.' },

    { id: 'f7-falta-lateral-atras', mod: 'f7', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta lateral: pase atrás al borde del área',
      desc: 'Los rematadores atacan la portería y el balón va raso atrás para el disparo.',
      el: { b: [16, 14], a7: [17.2, 15.4], r2: [11.5, 10], r3: [3, 8], r4: [-2, 8], r5: [-6, 8.5], r1: [0, 1], r6: [5, 15],
        a9: [3, 9], a4: [-2, 9.2], a10: [-6, 9.5], a8: [9, 18] },
      pasos: [
        ['Los rematadores atacan la portería para hundir a la defensa.', { a9: [3, 3.5], a4: [-1, 4.5], a10: [-5, 4], r3: [2.5, 4.5], r4: [-1.5, 5], r5: [-4.5, 5] }],
        ['Pase raso atrás al 8, que llega desde la frontal.', { b: [8, 13], a8: [8, 13.3] }],
        ['Disparo del 8.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: alternar con el centro al segundo palo para que la defensa no sepa qué esperar.' },

    { id: 'f7-saque-meta-largo', mod: 'f7', cat: 'salida', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Saque de meta en largo y segunda jugada',
      desc: 'Contra presión alta: balón largo al delantero, que descarga para el extremo.',
      el: { b: [0.5, 58], a1: [0, 58.6], a4: [-6, 54], a5: [6, 54], a6: [0, 44], a7: [15, 40], a11: [-15, 40], a9: [0, 26],
        r9: [0, 46], r10: [-8, 41], r11: [8, 41], r6: [0, 30], r3: [-12, 22], r2: [12, 22], r1: [0, 1] },
      pasos: [
        ['El rival presiona arriba. El 9 baja un poco y los extremos se abren para la segunda jugada.', { a9: [2, 30], a7: [17, 32], a11: [-17, 32], r6: [1, 33] }],
        ['Saque largo del portero hacia el 9.', { b: [2, 30.3] }, CENTRO],
        ['El 9 la deja de cabeza o de pecho para el 7.', { b: [15, 28], a7: [15, 28.3], r2: [8, 24] }],
        ['El 7 conduce hacia el área.', { a7: [12, 14], b: [12, 13.6] }],
        ['Pase al 9, que ha seguido la jugada.', { b: [2, 10], a9: [2, 10.3] }],
        ['Remate del 9.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: si el rival presiona con muchos, el balón largo deja espacio atrás. Acompañar la segunda jugada.' },

    // --- Fútbol sala
    { id: 'sala-corner-falso-tirador', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: falso tirador y pase al pívot',
      desc: 'El cierre baja como si fuera a disparar y el balón va al pívot, que se ha soltado.',
      el: { ...SALA_CORNER },
      pasos: [
        ['El 4 baja como si fuera a disparar y arrastra a su defensor. El 9 se suelta del primer palo hacia el centro.', { a4: [1, 8.5], r4: [0.5, 9], a9: [0, 3.6], r2: [1.2, 2.6] }],
        ['Pase raso al 9.', { b: [0, 3.9] }],
        ['El 9 remata de primeras.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: alternar con el «pase atrás al cierre» para que la defensa dude.' },

    { id: 'sala-corner-cruce', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Córner: cruce en la frontal y disparo',
      desc: 'Dos jugadores se cruzan delante de sus defensores; uno queda libre para el disparo.',
      el: { ...SALA_CORNER },
      pasos: [
        ['El 11 sube y el 4 baja: se cruzan delante de sus defensores.', { a11: [1.5, 9.5], a4: [-1.5, 8], r3: [-1, 7], r4: [0, 9.5] }],
        ['El 7 pasa al 11, que ha quedado libre tras el cruce.', { b: [1.5, 9.2] }],
        ['Disparo del 11.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Claves: cruzarse cerca y rápido; el lanzador mira al que sale por fuera del cruce.' },

    { id: 'sala-falta-banda-segundo-palo', mod: 'sala', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta lateral: pase tenso al segundo palo',
      desc: 'Un jugador fija al portero en el primer palo y el balón cruza raso al segundo palo.',
      el: { b: [8, 9], a7: [8.8, 9.6], r2: [4.7, 5.3], r1: [0, 0.6], r3: [-2, 4], r4: [0, 8], r5: [-4, 9],
        a9: [-1, 3.5], a11: [-4, 6], a4: [0, 13] },
      pasos: [
        ['El 9 fija al portero en el primer palo; el 11 ataca el segundo palo.', { a9: [1.2, 1.8], a11: [-2.8, 2], r3: [-1.5, 3], r1: [0.3, 0.6] }],
        ['Pase raso y tenso al segundo palo.', { b: [-2.6, 1.8] }],
        ['El 11 empuja a gol.', { b: [-0.8, -0.2] }, TIRO],
      ],
      fin: 'Claves: el pase tiene que ir fuerte y raso, por delante del portero.' },

    { id: 'sala-contra-3x2', mod: 'sala', cat: 'transicion', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Contraataque 3 contra 2',
      desc: 'Tras robo, el cierre conduce por el centro, abre a un ala y terminan en el segundo palo.',
      el: { b: [0.4, 30.6], a4: [0, 31], a7: [7, 30], a11: [-7, 30], r2: [-2, 18], r3: [3, 19], r1: [0, 1] },
      pasos: [
        ['Tras el robo, el 4 conduce por el centro y los alas abren el campo.', { a4: [0, 20], b: [0.3, 19.6], a7: [7, 17], a11: [-7, 17], r2: [-2, 13], r3: [2.5, 14] }],
        ['Pase al 7, que fija al defensor de su lado.', { b: [6.6, 13.6], a7: [6.6, 14], r3: [4.5, 11] }],
        ['El 7 pasa en diagonal al 11 en el segundo palo.', { b: [-3, 3], a11: [-3, 3.3], r2: [-1.5, 7] }],
        ['Gol del 11.', { b: [0, -0.2] }, TIRO],
      ],
      fin: 'Claves: ocupar las tres calles (banda, centro, banda) y terminar siempre en el segundo palo.' },

    // --- Entrenamientos
    { id: 'ej-rueda-y', mod: 'f7', cat: 'ent-tecnica', vista: 'encuadre', nivel: 'Alevín en adelante',
      titulo: 'Rueda de pases en Y',
      desc: 'Circuito de pase con apoyo, devolución y pase largo. Cada uno sigue su pase.',
      encuadre: [-9, 22, 9, 44],
      el: { k1: [0, 40], k2: [0, 33], k3: [-5, 26], k4: [5, 26], a4: [0, 40.6], b: [0, 40], a6: [0, 33.6], a8: [-5, 25.4], a10: [5, 25.4], a11: [0, 42.5] },
      pasos: [
        ['El 4 pasa al 6, que viene al apoyo.', { b: [0, 34.2] }, PASE],
        ['El 6 devuelve de primeras al 4.', { b: [0, 39.8] }, PASE],
        ['El 4 juega largo al 8; el 6 gira y sale hacia él.', { b: [-4.6, 26.2], a6: [-2.5, 29] }, PASE],
        ['El 8 descarga al 6, que juega con el 10 al otro lado.', { b: [-2.2, 29.3] }, PASE],
        ['Pase del 6 al 10. Rotación: cada uno ocupa el sitio al que pasó.', { b: [4.6, 26.2], a4: [0, 33.6], a6: [-5, 25.4], a8: [0, 42.5] }, PASE],
      ],
      fin: 'Variantes: a un toque, cambiar de lado, control orientado obligatorio. 3 series de 4 minutos.' },

    { id: 'ej-relevos', mod: 'f7', cat: 'ent-tecnica', vista: 'encuadre', nivel: 'Prebenjamín y benjamín',
      titulo: 'Relevos de conducción',
      desc: 'Dos filas compiten: conducir hasta el cono, girar y volver para dar el relevo.',
      encuadre: [-10, 16, 10, 38],
      el: { k1: [-4, 20], k2: [4, 20], a7: [-4, 32], b: [-4, 31.4], a8: [-4, 34], a9: [-4, 36], r7: [4, 32], b2: [4, 31.4], r8: [4, 34], r9: [4, 36] },
      pasos: [
        ['¡Ya! El primero de cada fila sale conduciendo hacia su cono.', { a7: [-4, 21.5], b: [-4, 21], r7: [4, 22], b2: [4, 21.5] }],
        ['Giran alrededor del cono.', { a7: [-2.6, 19.2], b: [-2.6, 19.6], r7: [2.6, 19.4], b2: [2.6, 19.8] }],
        ['Vuelven conduciendo y dan el relevo al siguiente de su fila.', { a7: [-4, 30.5], b: [-4, 30.9], r7: [4, 31], b2: [4, 31.4] }],
      ],
      fin: 'Gana la fila que antes completa 3 vueltas. Variantes: con la pierna mala, con la planta, ida en zigzag.' },

    { id: 'ej-control-tiro', mod: 'f7', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Control orientado y tiro',
      desc: 'Desmarque de apoyo, control orientado hacia dentro y tiro con el segundo toque.',
      el: { a8: [-8, 20], b: [-7.6, 19.6], a9: [0, 22], a10: [0, 25], a11: [-8, 23], r1: [0, 0.8] },
      pasos: [
        ['El 9 hace un desmarque de apoyo hacia el balón.', { a9: [-1.5, 18] }],
        ['El 8 pasa al pie del 9.', { b: [-1.2, 18.4] }],
        ['Control orientado hacia dentro, sacando el balón hacia el lado libre.', { a9: [1.5, 15.5], b: [1.8, 15] }],
        ['Tiro con el segundo toque.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Rotación: el pasador va a la fila del tirador. Para progresar, añadir un defensor pasivo.' },

    { id: 'ej-pase-atras-tiro', mod: 'f11', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Pase atrás desde línea de fondo y tiro',
      desc: 'Conducción hasta línea de fondo y pase atrás raso para el que llega a la frontal.',
      el: { a7: [24, 14], b: [23.6, 13.6], a10: [0, 26], a8: [-6, 28], r1: [0, 1] },
      pasos: [
        ['El 7 conduce hacia la línea de fondo.', { a7: [24, 4], b: [23.6, 3.6] }],
        ['El 10 llega en carrera a la frontal.', { a10: [2, 19] }],
        ['Pase atrás raso al 10.', { b: [2, 18.6] }],
        ['Disparo de primeras.', { b: [-2.5, -0.3] }, TIRO],
      ],
      fin: 'Rotación por las dos bandas. Variante: dos llegadores (punto de penalti y frontal).' },

    { id: 'ej-2x2-miniporterias', mod: 'f7', cat: 'ent-juegos', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: '2 contra 2 con miniporterías',
      desc: 'Partido reducido en 20 x 20 m. Se marca conduciendo entre los conos de la portería rival.',
      encuadre: [-12, 17, 12, 43], zonas: [[-10, 20, 10, 40]],
      el: { k1: [-3, 20], k2: [3, 20], k3: [-3, 40], k4: [3, 40], a9: [-3, 34], b: [-2.6, 33.6], a10: [4, 33], r4: [-2, 26], r5: [3, 27] },
      pasos: [
        ['El 9 conduce hacia su rival para fijarlo; el 10 se abre.', { a9: [-2, 29], b: [-1.8, 28.6], r4: [-1.5, 25.5], a10: [6, 29] }],
        ['El defensor del 10 duda entre los dos: pase al 10.', { b: [5.6, 28.6], r5: [4, 26.5] }],
        ['El 10 conduce hacia la miniportería.', { a10: [2, 22.5], b: [1.8, 22], r5: [3.5, 24.5] }],
        ['Gol: el balón pasa entre los conos.', { b: [0, 19.8] }, TIRO],
      ],
      fin: 'Reglas: 2 minutos por partido. Variante: el gol solo vale si antes ha habido un pase.' },

    { id: 'ej-oleadas-3x2', mod: 'f7', cat: 'ent-juegos', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Oleadas 3 contra 2',
      desc: 'Tres atacantes contra dos defensores y portero. Fijar, pasar al lado libre y terminar en el segundo palo.',
      el: { a9: [0, 28], b: [0.4, 27.6], a7: [-8, 28], a11: [8, 28], r4: [-3, 15], r5: [3, 15], r1: [0, 0.8] },
      pasos: [
        ['Los tres atacantes avanzan; el del centro conduce.', { a9: [0, 20], b: [0.3, 19.6], a7: [-8, 19], a11: [8, 19], r4: [-3, 13], r5: [3, 13] }],
        ['Un defensor sale al balón: pase al lado libre.', { r5: [1, 16.5], b: [7.6, 16], a11: [7.6, 16.3] }],
        ['El 11 conduce hacia el área; el 9 y el 7 atacan la portería.', { a11: [6, 9], b: [5.6, 8.7], a9: [1, 6], a7: [-4, 6], r4: [-1, 6] }],
        ['Pase al 7 en el segundo palo.', { b: [-4, 6.3] }],
        ['Gol.', { b: [0, -0.3] }, TIRO],
      ],
      fin: 'Cuando termina una oleada, los defensores pasan a atacar. Variante: un tercer defensor entra con retraso.' },

    { id: 'ej-sala-pivot-1x1', mod: 'sala', cat: 'ent-juegos', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: '1 contra 1 del pívot de espaldas',
      desc: 'El pívot recibe de espaldas con el defensor encima, protege, gira y tira.',
      el: { a9: [0, 6], r2: [0, 4.8], a4: [0, 14], b: [0, 13.4], r1: [0, 0.6] },
      pasos: [
        ['El 4 pasa al pívot, que recibe de espaldas con el defensor encima.', { b: [0, 6.6] }],
        ['El 9 protege el balón y gira hacia el lado libre.', { a9: [2, 5], b: [2.2, 4.6], r2: [0.8, 4.2] }],
        ['Tiro cruzado.', { b: [-1, -0.2] }, TIRO],
      ],
      fin: 'Rotación: el atacante pasa a defender. Variante: el pívot puede descargar al 4 que sigue la jugada (2 contra 1).' },

    { id: 'ej-sala-rondo-4x2', mod: 'sala', cat: 'ent-rondos', vista: 'encuadre', nivel: 'Benjamín en adelante',
      titulo: 'Rondo 4 contra 2: abrir el pasillo central',
      desc: 'Cuatro jugadores en un cuadrado de 10 x 10 m mueven el balón hasta que se abre el pase por dentro.',
      encuadre: [-7, 10, 7, 26], zonas: [[-5, 13, 5, 23]],
      el: { a4: [0, 12.4], a7: [5.6, 18], a10: [0, 23.6], a11: [-5.6, 18], r2: [-1, 17], r3: [1.5, 19], b: [0.4, 13] },
      pasos: [
        ['El 4 juega con el 7; los dos defensores tapan el pase por dentro.', { b: [5, 18], r2: [1.5, 16.5], r3: [3, 19] }],
        ['El 7 devuelve al 4 porque el pase interior está cerrado.', { b: [0.4, 13], r2: [0.5, 15], r3: [1.5, 17] }],
        ['El 4 cambia rápido al 11, lejos de los defensores.', { b: [-5, 18], r2: [-1.5, 16], r3: [-1, 18.5] }],
        ['El 11 busca al 10 por el pasillo central que se ha abierto.', { b: [0.4, 23], r2: [-2.5, 17] }],
      ],
      fin: 'Objetivo: mover el balón para abrir el pasillo central. 2 toques; si roban, cambian los papeles.' },

    { id: 'ej-portero-blocaje', mod: 'f7', cat: 'ent-porteros', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Blocaje y saque rápido',
      desc: 'El portero bloca un tiro a media altura y saca rápido con la mano al compañero abierto.',
      el: { a1: [0, 0.8], a9: [-3, 14], b: [-2.6, 13.6], a7: [12, 20], a10: [-3, 17] },
      pasos: [
        ['El 9 dispara a media altura al cuerpo del portero.', { b: [0.6, 0.9] }, TIRO],
        ['El portero bloca y el 7 se abre en banda pidiendo el balón.', { a7: [15, 16] }],
        ['Saque con la mano raso al 7.', { b: [15, 15.6] }],
      ],
      fin: 'Alternar tiros rasos, a media altura y altos. Series de 8 tiros por portero; cambiar de tirador cada serie.' },

    // =============================================================== AMPLIACIÓN 2
    // --- Fútbol 11
    { id: 'f11-corner-izquierda', mod: 'f11', cat: 'corner', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Córner desde la izquierda al punto de penalti',
      desc: 'Desde la banda izquierda: tres zonas de remate y balón cerrado al punto de penalti.',
      el: { b: [-33.4, 0.6], a11: [-34.6, 1.4], a4: [2, 13], a5: [-3, 14], a9: [0, 12], a6: [7, 12], a10: [2, 20], a8: [-12, 19],
        r1: [0, 1], r2: [-4.2, 0.8], r3: [-4, 6], r4: [1, 6.5], r5: [6, 6], r6: [-1.5, 10.5], r7: [4.5, 11], r8: [-9, 8], r9: [0, 19], r10: [-25, 6] },
      pasos: [
        ['El 5 ataca el primer palo, el 9 el punto de penalti y el 4 el segundo palo.', { a5: [-5, 4.8], a9: [0, 8.5], a4: [4, 5.5], r3: [-4.5, 5.6], r4: [0.5, 8] }],
        ['El 11 centra cerrado al punto de penalti.', { b: [0, 8.7] }, CENTRO],
        ['Remate del 9.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: desde la izquierda, un diestro saca el balón cerrado hacia la portería; un zurdo, abierto.' },

    { id: 'f11-banda-pared', mod: 'f11', cat: 'banda', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Saque de banda: pared y centro',
      desc: 'El receptor devuelve de primeras al lanzador, que entra al campo, llega a línea de fondo y centra.',
      el: { b: [34.3, 30], a2: [34.8, 30.3], a7: [30, 27], r3: [29, 25], a9: [4, 14], r4: [2, 12], a10: [-4, 18], r5: [-6, 12], r1: [0, 1.5] },
      pasos: [
        ['El 7 viene a recibir; su defensor le sigue.', { a7: [31, 32], r3: [30, 30] }],
        ['Saque al pie del 7.', { b: [31, 32.4] }],
        ['El 2 entra al campo y el 7 se la devuelve de primeras.', { a2: [31, 27.5], b: [31, 27.8] }],
        ['El 2 conduce hasta cerca de la línea de fondo.', { a2: [30, 10], b: [30, 9.6] }],
        ['Centro al 9, que ataca el primer palo.', { b: [2, 8], a9: [2, 8.3], r4: [3, 6] }, CENTRO],
        ['Remate del 9.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: el lanzador entra al campo en cuanto suelta el balón; si se queda fuera, no hay pared.' },

    { id: 'f11-diagonal-extremo', mod: 'f11', cat: 'ataque', vista: 'ataque', nivel: 'Cadete en adelante',
      titulo: 'Diagonal del extremo y pase filtrado',
      desc: 'El delantero baja y saca de sitio a su central; el extremo ataca ese hueco en diagonal.',
      el: { b: [-0.4, 34.6], a10: [0, 35], a7: [24, 26], a9: [2, 20], a11: [-22, 26], r2: [22, 22], r4: [2, 18], r5: [-4, 18], r3: [-18, 22], r6: [2, 28], r1: [0, 1.5] },
      pasos: [
        ['El 9 baja y se lleva a su central fuera de la zona.', { a9: [-4, 24], r4: [-2, 21] }],
        ['El 7 hace una diagonal desde la banda hacia el hueco que ha dejado el central.', { a7: [10, 16], r2: [18, 18] }],
        ['El 10 filtra el pase a la espalda de la defensa.', { b: [9.6, 15.4] }],
        ['El 7 conduce hacia la portería.', { a7: [6, 10], b: [5.6, 9.6] }],
        ['Tiro.', { b: [-2, -0.3] }, TIRO],
      ],
      fin: 'Claves: la diagonal empieza cuando el central sigue al 9, ni antes ni después.' },

    { id: 'f11-contra-tras-corner', mod: 'f11', cat: 'transicion', vista: 'completo', nivel: 'Infantil en adelante',
      titulo: 'Contraataque tras despejar un córner',
      desc: 'Un jugador se queda arriba en los córners en contra; el despeje va hacia él y salimos en superioridad.',
      el: { b: [-2, 98], a5: [-2, 98.5], a7: [16, 80], a11: [-14, 84], a9: [2, 76], a1: [0, 104], r4: [0, 55], r2: [-6, 96], r3: [3, 95], r1: [0, 1.5] },
      pasos: [
        ['El 5 despeja hacia el 7, que ya salía.', { b: [16, 70], a7: [16, 70.3] }, CENTRO],
        ['El 7 conduce a toda velocidad; el 9 y el 11 acompañan.', { a7: [12, 45], b: [11.6, 44.6], a9: [-4, 46], a11: [-18, 50], r4: [2, 40] }],
        ['Cuando el último defensor sale al 7, pase al 9.', { b: [-4, 30], a9: [-4, 30.3], r4: [4, 34] }],
        ['El 9 conduce solo hacia el portero.', { a9: [-2, 14], b: [-2, 13.6] }],
        ['Tiro.', { b: [2, -0.3] }, TIRO],
      ],
      fin: 'Claves: dejar siempre a uno o dos arriba en los córners en contra obliga al rival a dejar defensores atrás.' },

    { id: 'f11-presion-tras-perdida', mod: 'f11', cat: 'defensa', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Presión tras pérdida (5 segundos)',
      desc: 'Al perder el balón en campo rival, los más cercanos presionan al momento y cierran sus pases.',
      el: { b: [9.6, 22.4], r6: [10, 23], a10: [12, 20], a8: [4, 26], a7: [20, 18], a9: [2, 14], a6: [-2, 32], r7: [0, 30], r8: [18, 32], r2: [24, 24], r1: [0, 1.5] },
      pasos: [
        ['Perdemos el balón: los tres más cercanos saltan a presionar al poseedor y le cierran los pases.', { a10: [10.6, 21.6], a8: [7, 24.5], a7: [14, 25], a6: [1, 29], r7: [2, 32] }],
        ['El rival, encerrado, intenta salir con un pase y el 6 lo intercepta.', { b: [1.4, 29.4] }],
      ],
      fin: 'Claves: los primeros 5 segundos tras perder el balón son los mejores para recuperarlo. Si no se roba, repliegue.' },

    { id: 'f11-defensa-banda', mod: 'f11', cat: 'defensa', vista: 'defensa', nivel: 'Infantil en adelante',
      titulo: 'Defensa en banda: 2 contra 1',
      desc: 'El extremo ayuda al lateral y entre los dos encierran al rival contra la banda.',
      el: { b: [23.6, 70.4], r7: [24, 70], r2: [30, 60], r9: [4, 86], a2: [24, 76], a7: [18, 66], a6: [8, 72], a5: [8, 84], a4: [-6, 85], a1: [0, 104] },
      pasos: [
        ['El extremo rival conduce hacia nuestro lateral.', { r7: [24, 75], b: [23.6, 75.4], a2: [24, 79] }],
        ['El 7 vuelve a ayudar: entre el 2 y el 7 le encierran contra la banda.', { a7: [21, 74], a2: [25, 78] }],
        ['Robo del 7.', { b: [22.6, 76], a7: [22.4, 75.6] }],
        ['Salida rápida hacia el 6 para contraatacar.', { b: [10, 64], a6: [10, 64.3] }],
      ],
      fin: 'Claves: el lateral orienta hacia fuera y el extremo llega por dentro. La banda es el tercer defensor.' },

    // --- Fútbol 7
    { id: 'f7-tercer-hombre', mod: 'f7', cat: 'ataque', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Tercer hombre',
      desc: 'El delantero baja, recibe y descarga de primeras para el extremo, que ya atacaba la espalda.',
      el: { b: [-0.4, 34.6], a6: [0, 35], a9: [0, 24], a7: [12, 26], a11: [-12, 26], r4: [0, 21], r2: [8, 18], r3: [-8, 18], r6: [3, 29], r1: [0, 1] },
      pasos: [
        ['El 9 baja a recibir y arrastra a su defensor.', { a9: [0, 28], r4: [0, 25] }],
        ['El 6 pasa al 9.', { b: [0, 27.4] }],
        ['El 9 descarga de primeras para el 7, que ya atacaba la espalda (tercer hombre).', { b: [9, 14], a7: [9, 14.3] }],
        ['El 7 conduce hacia el portero.', { a7: [5, 7], b: [4.6, 6.6] }],
        ['Tiro.', { b: [-1.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: el 7 arranca cuando sale el primer pase. El 9 juega a un toque.' },

    { id: 'f7-cambio-orientacion', mod: 'f7', cat: 'ataque', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Cambio de orientación',
      desc: 'Atraer al rival por un lado y cambiar rápido al extremo contrario, que está solo.',
      el: { b: [-15.4, 30.4], a11: [-16, 31], a6: [-4, 36], a9: [-6, 20], a7: [16, 26], a4: [-4, 48], a5: [8, 48], a1: [0, 58.6],
        r3: [-12, 22], r6: [-8, 28], r4: [-2, 18], r2: [4, 20], r9: [-10, 36], r1: [0, 1] },
      pasos: [
        ['El 11 juega con el 6, que tiene todo el campo de frente.', { b: [-4, 35.6] }],
        ['Cambio de orientación al 7, solo en el lado contrario.', { b: [15.6, 25.6] }, CENTRO],
        ['El 7 conduce hacia el área.', { a7: [10, 14], b: [9.6, 13.6], r2: [6, 15] }],
        ['Pase atrás al 9.', { b: [-2, 8], a9: [-2, 8.3], r4: [0, 11] }],
        ['Remate del 9.', { b: [1, -0.3] }, TIRO],
      ],
      fin: 'Claves: en F7 el cambio de orientación casi siempre deja a un jugador solo. Hay que mirar antes de recibir.' },

    { id: 'f7-salida-pivote', mod: 'f7', cat: 'salida', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Salida con el pivote entre centrales',
      desc: 'Si dos rivales presionan a los centrales, el pivote baja entre ellos y sale conduciendo por dentro.',
      el: { b: [0.5, 58], a1: [0, 58.6], a4: [-6, 54], a5: [6, 54], a6: [0, 44], a7: [15, 40], a11: [-15, 40], a9: [0, 26],
        r9: [-3, 46], r10: [3, 46], r6: [0, 36], r3: [-12, 22], r2: [12, 22], r1: [0, 1] },
      pasos: [
        ['Dos rivales presionan a los centrales: el pivote (6) baja entre ellos y los centrales se abren.', { a6: [0, 53], a4: [-12, 52], a5: [12, 52], r9: [-9, 50], r10: [9, 50] }],
        ['El portero juega con el 6.', { b: [0.3, 52.4] }],
        ['El 6 conduce hacia delante por el pasillo central que se ha abierto.', { a6: [0, 44], b: [0, 43.6], r6: [2, 40] }],
        ['Pase al 7 en banda.', { b: [14.6, 39.6] }],
      ],
      fin: 'Claves: el pivote recibe perfilado, mirando hacia delante. Si le siguen, los centrales quedan libres.' },

    { id: 'f7-defensa-corner', mod: 'f7', cat: 'defensa', vista: 'defensa', nivel: 'Benjamín en adelante',
      titulo: 'Defensa de córner mixta (F7)',
      desc: 'Dos en zona en el área pequeña, dos marcando al hombre, uno para el rechace y uno arriba para salir.',
      el: { b: [-19.5, 59.5], r7: [-20.6, 58.8], r9: [-2, 50], r4: [2, 49], r10: [0, 46],
        a1: [0, 59.2], a4: [-3, 57.5], a5: [2, 57.5], a6: [-2, 51], a2: [2.5, 50.2], a9: [0, 44], a7: [12, 40] },
      pasos: [
        ['Los rivales atacan la portería; nuestras marcas les acompañan y la zona protege el área pequeña.', { r9: [-3, 55], r4: [2, 54.5], a6: [-3, 54], a2: [2.5, 53.8] }],
        ['El centro llega al primer palo.', { b: [-3, 56.6] }, CENTRO],
        ['El 4 despeja desde su zona y el 7 sale al contraataque.', { b: [-14, 40], a7: [10, 30] }, CENTRO],
      ],
      fin: 'Claves: los de la zona atacan el balón; los marcadores no pierden de vista a su par.' },

    { id: 'f7-falta-directa', mod: 'f7', cat: 'falta', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Falta frontal: amago y disparo con rosca',
      desc: 'Un jugador amaga y el lanzador golpea con rosca por encima de la barrera.',
      el: { ...F7_FALTA_FRONTAL },
      pasos: [
        ['El 8 hace el amago pasando por encima del balón.', { a8: [1.2, 14.5] }],
        ['El 10 golpea con rosca por encima de la barrera.', { b: [2.8, -0.3] }, TIRO],
      ],
      fin: 'Claves: la barrera en F7 está a 6 m; mejor buscar el palo que cubre la barrera.' },

    { id: 'f7-presion-tras-perdida', mod: 'f7', cat: 'defensa', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Presión tras pérdida',
      desc: 'Al perder el balón, el más cercano presiona y los demás cierran las salidas.',
      el: { b: [5.6, 18.4], r6: [6, 19], a10: [7, 16.5], a9: [2, 12], a7: [12, 14], a6: [0, 26], r7: [-6, 26], r5: [12, 24], r1: [0, 1] },
      pasos: [
        ['Perdemos el balón: el más cercano presiona y los demás cierran las salidas.', { a10: [6.6, 18.2], a7: [9, 21], a9: [3, 18], a6: [-3, 25.5] }],
        ['El rival intenta salir por el otro lado y el 6 lo intercepta.', { b: [-2.6, 25.6] }],
      ],
      fin: 'Claves: reaccionar en el primer segundo; quien pierde el balón es el primero en presionar.' },

    // --- Fútbol sala
    { id: 'sala-corner-izquierda', mod: 'sala', cat: 'corner', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Córner desde la izquierda: pase atrás al cierre',
      desc: 'El mismo concepto del pase atrás, ejecutado desde la esquina izquierda.',
      el: { b: [-9.7, 0.3], a11: [-10.5, 0.9], a4: [0, 11], a9: [-2, 3.5], a7: [3, 5.5], r1: [0, 0.6], r2: [-2.6, 2.4], r3: [2.4, 4.6], r4: [2, 10], r5: [-5.5, 3.5] },
      pasos: [
        ['El 9 y el 7 atacan la portería y arrastran a sus defensores.', { a9: [-2, 1.5], a7: [1, 2.5], r2: [-2.4, 2.2], r3: [0.8, 3.4] }],
        ['Pase raso atrás al cierre (4).', { b: [-2, 8.6], a4: [-2, 8.9], r4: [0, 9.5] }],
        ['Disparo del 4.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: practicar los córners por los dos lados, con zurdos y diestros.' },

    { id: 'sala-pared-pivot', mod: 'sala', cat: 'ataque', vista: 'ataque', nivel: 'Todas las edades',
      titulo: 'Pared con el pívot',
      desc: 'El ala pasa al pívot y sigue su pase; el pívot devuelve de primeras para el tiro.',
      el: { b: [-6.6, 12.6], a11: [-7, 13], a9: [0, 5], a7: [7, 13], a4: [0, 17], r2: [0, 3.8], r3: [-6, 10], r4: [6, 10], r5: [0, 14], r1: [0, 0.6] },
      pasos: [
        ['El 11 pasa al pívot.', { b: [-0.4, 5.6] }],
        ['El 11 sigue su pase y el pívot le devuelve de primeras (pared).', { a11: [-3, 6], b: [-3, 6.3], r3: [-5, 8] }],
        ['Tiro del 11.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: pasar y salir en el mismo gesto. El pívot devuelve al espacio, no al pie.' },

    { id: 'sala-pj-41', mod: 'sala', cat: 'portero-jugador', vista: 'ataque', nivel: 'Infantil en adelante',
      titulo: 'Portero-jugador en 4-1: juego con el pívot',
      desc: 'Cuatro en línea y un pívot. Circulación hasta encontrar al pívot, que descarga para el lado débil.',
      el: { b: [-2.1, 13.6], a1: [-2.5, 14], a10: [2.5, 14], a11: [-8, 12], a7: [8, 12], a9: [0, 4],
        r1: [0, 0.6], r2: [-4, 9], r3: [4, 9], r4: [0, 11], r5: [0, 3] },
      pasos: [
        ['El portero-jugador juega con el 10.', { b: [2.1, 13.6] }],
        ['El 10 abre al 7 y la defensa bascula.', { b: [7.6, 12], r3: [6, 9.5], r4: [2.5, 10.5], r2: [-1, 9] }],
        ['Pase al pívot, que recibe de espaldas.', { b: [0, 4.6] }],
        ['El pívot descarga al 11, que llega solo por el lado débil.', { b: [-6, 8], a11: [-6, 8.3], r2: [-3, 8] }],
        ['Tiro del 11.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el balón al pívot obliga a la defensa a cerrarse; la descarga al lado contrario es casi siempre tiro.' },

    { id: 'sala-salida-pivot', mod: 'sala', cat: 'salida', vista: 'completo', nivel: 'Alevín en adelante',
      titulo: 'Salida de presión en 3-1 con apoyo del pívot',
      desc: 'Contra presión, el pívot baja entre líneas, recibe y descarga de cara para un ala.',
      el: { b: [0.4, 30.6], a4: [0, 31], a11: [-8, 26], a7: [8, 26], a9: [0, 14], a1: [0, 39],
        r2: [-2, 28.5], r4: [-7, 23], r5: [7, 23], r3: [0, 11], r1: [0, 1] },
      pasos: [
        ['El pívot baja a dar apoyo entre líneas; su defensor le sigue.', { a9: [0, 20], r3: [0, 17] }],
        ['El cierre (4) pasa al pívot, saltando la primera presión.', { b: [0, 20.6] }],
        ['El pívot descarga de cara al 11, que ataca el espacio.', { b: [-7, 18], a11: [-7, 18.3], r4: [-6, 21] }],
        ['El 11 conduce hacia la portería.', { a11: [-5, 8], b: [-4.8, 7.6] }],
        ['Tiro.', { b: [1, -0.2] }, TIRO],
      ],
      fin: 'Claves: el pívot juega de cara y a un toque; si se gira con el defensor encima, pierde el balón.' },

    { id: 'sala-presion-tras-perdida', mod: 'sala', cat: 'defensa', vista: 'completo', nivel: 'Todas las edades',
      titulo: 'Presión tras pérdida (3 segundos)',
      desc: 'En sala todo pasa muy rápido: presionar al instante y cerrar los pases cercanos.',
      el: { b: [5.6, 10.4], r3: [6, 11], a7: [7, 8.6], a9: [2, 5], a11: [-5, 10], a4: [0, 16], r2: [-6, 14], r4: [0, 20], r5: [-2, 8], r1: [0, 1], a1: [0, 39] },
      pasos: [
        ['Perdemos el balón: el 7 presiona al instante y los demás cierran los pases cercanos.', { a7: [6.6, 10.6], a9: [4, 12], a4: [2, 17.5], a11: [-4, 13.5] }],
        ['El rival se precipita y el 11 intercepta.', { b: [-3.6, 13.8] }],
      ],
      fin: 'Claves: si en 3 segundos no se recupera, todos atrás a la defensa organizada.' },

    // --- Entrenamientos
    { id: 'ej-rondo-6x3', mod: 'f11', cat: 'ent-rondos', vista: 'encuadre', nivel: 'Infantil en adelante',
      titulo: 'Rondo 6 contra 3',
      desc: 'Seis jugadores alrededor de un cuadrado de 20 x 20 m contra tres defensores. Se busca el pase entre líneas.',
      encuadre: [-14, 38, 14, 66], zonas: [[-10, 42, 10, 62]],
      el: { a4: [-10.5, 48], a6: [-10.5, 56], a8: [0, 62.5], a10: [10.5, 56], a7: [10.5, 48], a9: [0, 41.5], r6: [-3, 50], r8: [2, 54], r10: [3, 47], b: [-9.9, 48.3] },
      pasos: [
        ['El 4 juega con el 6; un defensor sale a presionar.', { b: [-9.9, 55.7], r6: [-6, 53] }],
        ['El 6 juega con el 8.', { b: [-0.3, 61.9], r8: [-2, 57] }],
        ['El 8 rompe la línea con un pase entre defensores al 7.', { b: [9.9, 47.7] }],
        ['El 7 juega con el 9 y los defensores vuelven a bascular.', { b: [0.3, 42.1], r10: [2, 45] }],
      ],
      fin: 'Reglas: 2 toques; cada pase entre líneas, un punto. Si roban, entran quien perdió el balón y el que más tiempo lleva fuera.' },

    { id: 'ej-conduccion-cuadrado', mod: 'f7', cat: 'ent-tecnica', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: 'Conducción con cambios de dirección',
      desc: 'Conducir por los lados de un cuadrado cambiando de superficie en cada cono.',
      encuadre: [-8, 22, 8, 38],
      el: { k1: [-5, 25], k2: [5, 25], k3: [5, 35], k4: [-5, 35], a7: [-5, 35.6], b: [-4.6, 35] },
      pasos: [
        ['Conducción con el exterior hacia el primer cono.', { a7: [-5, 25.6], b: [-4.6, 26] }],
        ['Cambio de dirección con la planta y conducción hacia el segundo cono.', { a7: [4.4, 25], b: [4, 25.4] }],
        ['Nuevo cambio, ahora con el interior.', { a7: [5, 34.4], b: [4.6, 34] }],
        ['Último lado con la pierna mala y vuelta al inicio.', { a7: [-4.4, 35], b: [-4, 34.6] }],
      ],
      fin: 'Variantes: cambiar el sentido, añadir una finta en cada cono, hacerlo por parejas a contrarreloj.' },

    { id: 'ej-pase-control-parejas', mod: 'f7', cat: 'ent-tecnica', vista: 'encuadre', nivel: 'Prebenjamín en adelante',
      titulo: 'Pase y control orientado por parejas',
      desc: 'Por parejas, separados 10 m: pase con el interior y control orientado hacia un lado.',
      encuadre: [-9, 25, 9, 36],
      el: { k1: [-5, 28], k2: [-5, 32], k3: [5, 28], k4: [5, 32], a7: [-5, 30], b: [-4.4, 30], a8: [5, 30] },
      pasos: [
        ['El 7 pasa con el interior al 8.', { b: [4.4, 30] }],
        ['El 8 controla orientado hacia un lado, sacando el balón de la línea.', { a8: [5, 31.5], b: [4.8, 31] }],
        ['El 8 devuelve al 7, que vuelve a controlar orientado.', { b: [-4.4, 30.4] }],
      ],
      fin: 'Variantes: control con la pierna mala, control y pase en dos toques, a un toque.' },

    { id: 'ej-centro-remate-f7', mod: 'f7', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Centro y remate en F7',
      desc: 'Conducción por banda y centro con dos rematadores a primer y segundo palo.',
      el: { a7: [15, 24], b: [14.6, 23.6], a9: [0, 20], a10: [-6, 22], r1: [0, 1] },
      pasos: [
        ['El 7 conduce por banda; el 9 ataca el primer palo y el 10 el segundo.', { a7: [16, 8], b: [15.6, 7.6], a9: [3, 8], a10: [-4, 9] }],
        ['Centro al segundo palo.', { b: [-4, 4.5], a10: [-4, 4.8] }, CENTRO],
        ['Remate del 10.', { b: [0, -0.3] }, TIRO],
      ],
      fin: 'Rotación: centrador al primer palo, primer palo al segundo, segundo palo a centrar. Por las dos bandas.' },

    { id: 'ej-tiro-media-distancia', mod: 'f7', cat: 'ent-finalizacion', vista: 'ataque', nivel: 'Alevín en adelante',
      titulo: 'Tiro desde fuera del área',
      desc: 'Conducción rápida hasta la zona de tiro marcada con conos y golpeo con el empeine.',
      el: { a10: [0, 30], b: [0.4, 29.6], k1: [-3, 19], k2: [3, 19], a8: [-3, 33], a6: [3, 33], r1: [0, 1] },
      pasos: [
        ['Conducción rápida hasta la zona de tiro, entre los conos.', { a10: [0, 19.5], b: [0.4, 19] }],
        ['Tiro con el empeine, sin dejar que el balón se aleje.', { b: [2.5, -0.3] }, TIRO],
      ],
      fin: 'Claves: la última conducción corta para tener el balón controlado. Apuntar a los palos y raso.' },

    { id: 'ej-portero-desvio', mod: 'f7', cat: 'ent-porteros', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Portero: desvío y segunda acción',
      desc: 'El portero desvía un tiro al palo y se levanta rápido para el segundo tiro.',
      el: { a1: [0, 0.8], a9: [-4, 12], b: [-3.6, 11.6], a10: [4, 9], b2: [3.6, 8.6] },
      pasos: [
        ['El 9 tira raso al palo; el portero se lanza y desvía fuera.', { b: [-3.3, -0.6], a1: [-2.2, 0.6] }, TIRO],
        ['El portero se levanta rápido y se recoloca en el centro.', { a1: [0, 0.8] }],
        ['Segundo tiro inmediato del 10: el portero tiene que estar ya colocado.', { b2: [1.6, -0.2] }, { b2: 'tiro' }],
      ],
      fin: 'Series de 6 dobles tiros. Trabajar la caída sobre el costado y levantarse sin apoyar las rodillas.' },

    { id: 'ej-portero-1x1', mod: 'f7', cat: 'ent-porteros', vista: 'ataque', nivel: 'Benjamín en adelante',
      titulo: 'Portero: salida al 1 contra 1',
      desc: 'El portero achica espacio con pasos cortos, se planta y espera sin tirarse antes de tiempo.',
      el: { a1: [0, 0.8], a9: [0, 24], b: [0.4, 23.6] },
      pasos: [
        ['El 9 conduce hacia la portería; el portero sale achicando, con pasos cortos.', { a9: [0, 12], b: [0.3, 11.4], a1: [0, 4] }],
        ['El portero se planta y espera, sin tirarse antes de tiempo.', { a9: [2, 9], b: [2.3, 8.6], a1: [1.2, 6.5] }],
        ['El 9 intenta regatear y el portero se lanza a sus pies y bloca.', { b: [1.4, 6.9], a1: [1.4, 7] }, PASE],
      ],
      fin: 'Claves: salir cuando el delantero baja la cabeza o se le va el balón. Cuerpo grande y manos abajo.' },
  ];

  window.BIBLIOTECA = { categorias, sistemas, jugadas };
})();
