// nesting.js — Motor de bin packing (Guillotine con best-fit y rotación 90°).
// Módulo puro: solo recibe arrays/objetos y devuelve arrays/objetos.
// Cero DOM, cero window, cero console.log.

// Tolerancia para descartar espacios libres degenerados (ancho/alto ~0)
// que pueden aparecer por errores de redondeo al cortar rectángulos.
const EPS = 0.001;

/**
 * Expande las piezas según su cantidad en instancias individuales a ubicar.
 * @param {Array} piezas
 * @returns {Array<{piezaId: string, nombre: string, ancho: number, alto: number}>}
 */
function expandirInstancias(piezas) {
  const instancias = [];
  piezas.forEach(p => {
    for (let i = 0; i < p.cantidad; i++) {
      instancias.push({ piezaId: p.id, nombre: p.nombre, ancho: p.ancho, alto: p.alto });
    }
  });
  return instancias;
}

/**
 * Ordena las instancias de mayor a menor área (ancho × alto): las piezas
 * más grandes se ubican primero y las más chicas van rellenando los huecos
 * que van quedando. Empata por el lado más largo descendente.
 * @param {Array} instancias
 */
function ordenarInstancias(instancias) {
  instancias.sort((a, b) => {
    const areaA = a.ancho * a.alto;
    const areaB = b.ancho * b.alto;
    if (areaB !== areaA) return areaB - areaA;
    const altA = Math.max(a.ancho, a.alto);
    const altB = Math.max(b.ancho, b.alto);
    return altB - altA;
  });
}

/**
 * Decide si una instancia entra en un espacio libre rectangular y en qué
 * orientación conviene colocarla. Cuando ambas orientaciones caben, se
 * prefiere la que consume más altura del espacio libre (deja menos espacio
 * desaprovechado abajo), lo que permite mezclar orientaciones de la misma
 * pieza y aprovechar mejor el remanente inferior de cada plancha.
 * @returns {'normal'|'rotada'|null}
 */
function elegirOrientacionParaEspacio(espacio, inst, kerf) {
  const cabeNormal = inst.ancho + kerf <= espacio.ancho && inst.alto + kerf <= espacio.alto;
  const cabeRotada = inst.alto + kerf <= espacio.ancho && inst.ancho + kerf <= espacio.alto;

  if (!cabeNormal && !cabeRotada) return null;
  if (cabeNormal && !cabeRotada) return 'normal';
  if (!cabeNormal && cabeRotada) return 'rotada';

  // Ambas caben: preferir la orientación donde la pieza ocupa más altura
  // del espacio libre, dejando el menor remanente posible debajo.
  // Cuando el remanente inferior es igual, se prefiere 'normal'.
  const remanente_normal = espacio.alto - inst.alto;
  const remanente_rotada = espacio.alto - inst.ancho;
  return remanente_normal <= remanente_rotada ? 'normal' : 'rotada';
}

/**
 * Busca, entre todos los espacios libres de todas las planchas ya abiertas,
 * el más chico (por área) donde la instancia entre — best fit. Permite que
 * una pieza chica vuelva a una plancha anterior si ahí quedó lugar.
 * @param {Array<Array<{x:number,y:number,ancho:number,alto:number}>>} espaciosPorPlancha
 * @param {{ancho:number, alto:number}} inst
 * @param {number} kerf
 * @returns {{planchaIndex: number, espacioIndex: number, orientacion: 'normal'|'rotada'}|null}
 */
function buscarMejorEspacio(espaciosPorPlancha, inst, kerf) {
  let mejor = null;
  let mejorArea = Infinity;

  for (let p = 0; p < espaciosPorPlancha.length; p++) {
    const espacios = espaciosPorPlancha[p];
    for (let e = 0; e < espacios.length; e++) {
      const espacio = espacios[e];
      const orientacion = elegirOrientacionParaEspacio(espacio, inst, kerf);
      if (!orientacion) continue;

      const area = espacio.ancho * espacio.alto;
      if (area < mejorArea) {
        mejorArea = area;
        mejor = { planchaIndex: p, espacioIndex: e, orientacion };
      }
    }
  }

  return mejor;
}

/**
 * Ubica una instancia dentro del espacio libre indicado y aplica el corte
 * guillotine: el espacio usado se reemplaza por dos espacios nuevos, uno a
 * la derecha de la pieza (alto limitado a la pieza) y uno abajo que ocupa
 * todo el ancho original del espacio. Esto hace que el espacio libre se
 * acumule siempre hacia abajo de la plancha en vez de quedar disperso.
 * @param {Array<Array<object>>} espaciosPorPlancha
 * @param {{planchaIndex: number, espacioIndex: number, orientacion: string}} ubicacion
 * @param {object} inst
 * @param {number} kerf
 * @param {Array} ubicadas
 */
function colocarEnEspacio(espaciosPorPlancha, ubicacion, inst, kerf, ubicadas) {
  const { planchaIndex, espacioIndex, orientacion } = ubicacion;
  const espacios = espaciosPorPlancha[planchaIndex];
  const espacio = espacios[espacioIndex];

  const rotada = orientacion === 'rotada';
  const ancho = rotada ? inst.alto : inst.ancho;
  const alto = rotada ? inst.ancho : inst.alto;

  ubicadas.push({
    plancha: planchaIndex,
    piezaId: inst.piezaId,
    nombre: inst.nombre,
    x: espacio.x,
    y: espacio.y,
    ancho,
    alto,
    rotada
  });

  espacios.splice(espacioIndex, 1);

  const anchoDerecha = espacio.ancho - ancho - kerf;
  const altoDerecha = alto + kerf;
  if (anchoDerecha > EPS && altoDerecha > EPS) {
    espacios.push({ x: espacio.x + ancho + kerf, y: espacio.y, ancho: anchoDerecha, alto: altoDerecha });
  }

  const altoAbajo = espacio.alto - alto - kerf;
  if (altoAbajo > EPS && espacio.ancho > EPS) {
    espacios.push({ x: espacio.x, y: espacio.y + alto + kerf, ancho: espacio.ancho, alto: altoAbajo });
  }
}

/**
 * Ubica todas las piezas de una lista de piezas (con cantidad) dentro de
 * planchas del tamaño indicado, usando Guillotine Bin Packing con best-fit
 * y rotación de 90° cuando ayuda.
 * @param {Array} piezas - modelo estándar {id, nombre, cantidad, ancho, alto, material}
 * @param {{ancho: number, alto: number}} plancha
 * @param {number} [kerf=0] - sangría de corte láser en mm; se reserva entre
 *   piezas pero no se incluye en las coordenadas/medidas del resultado.
 * @returns {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}}
 */
export function calcularNesting(piezas, plancha, kerf = 0) {
  if (!plancha || !(plancha.ancho > 0) || !(plancha.alto > 0)) {
    return { ubicadas: [], noUbicadas: [], totalPlanchas: 0 };
  }

  const kerfEfectivo = kerf > 0 ? kerf : 0;

  const instancias = expandirInstancias(piezas);
  ordenarInstancias(instancias);

  const ubicadas = [];
  const noUbicadas = [];
  const espaciosPorPlancha = [];

  function abrirPlanchaNueva() {
    espaciosPorPlancha.push([{ x: 0, y: 0, ancho: plancha.ancho, alto: plancha.alto }]);
    return espaciosPorPlancha.length - 1;
  }

  instancias.forEach(inst => {
    // Si ni siquiera entra sola en una plancha vacía, es imposible ubicarla.
    const entraNormal = inst.ancho <= plancha.ancho && inst.alto <= plancha.alto;
    const entraRotada = inst.alto <= plancha.ancho && inst.ancho <= plancha.alto;
    if (!entraNormal && !entraRotada) {
      noUbicadas.push({ piezaId: inst.piezaId, nombre: inst.nombre, ancho: inst.ancho, alto: inst.alto });
      return;
    }

    // 1. Buscar el espacio libre más chico (best fit) entre todas las
    // planchas ya abiertas, para rellenar huecos antes de abrir una nueva.
    const mejor = buscarMejorEspacio(espaciosPorPlancha, inst, kerfEfectivo);
    if (mejor) {
      colocarEnEspacio(espaciosPorPlancha, mejor, inst, kerfEfectivo, ubicadas);
      return;
    }

    // 2. No entra en ninguna plancha existente: abrir una nueva, si el kerf
    // no hace que la pieza deje de entrar en una plancha vacía.
    const entraEnPlanchaVacia =
      (inst.ancho + kerfEfectivo <= plancha.ancho && inst.alto + kerfEfectivo <= plancha.alto) ||
      (inst.alto + kerfEfectivo <= plancha.ancho && inst.ancho + kerfEfectivo <= plancha.alto);

    if (!entraEnPlanchaVacia) {
      noUbicadas.push({ piezaId: inst.piezaId, nombre: inst.nombre, ancho: inst.ancho, alto: inst.alto });
      return;
    }

    const nuevoIndex = abrirPlanchaNueva();
    const espacioInicial = espaciosPorPlancha[nuevoIndex][0];
    const orientacion = elegirOrientacionParaEspacio(espacioInicial, inst, kerfEfectivo);
    colocarEnEspacio(
      espaciosPorPlancha,
      { planchaIndex: nuevoIndex, espacioIndex: 0, orientacion },
      inst,
      kerfEfectivo,
      ubicadas
    );
  });

  return {
    ubicadas,
    noUbicadas,
    totalPlanchas: ubicadas.length > 0 ? espaciosPorPlancha.length : 0
  };
}

/**
 * Calcula las estadísticas de aprovechamiento de un resultado de nesting.
 * @param {Array} ubicadas - piezas ya ubicadas (output de calcularNesting)
 * @param {{ancho: number, alto: number}} plancha
 * @returns {{aprovechamiento: number, areaUsada: number, areaTotal: number, piezasUbicadas: number, totalPlanchas: number}}
 */
export function calcularEstadisticas(ubicadas, plancha) {
  const totalPlanchas = ubicadas.length === 0 ? 0 : Math.max(...ubicadas.map(u => u.plancha)) + 1;
  const areaTotal = totalPlanchas * plancha.ancho * plancha.alto;
  const areaUsada = ubicadas.reduce((acc, u) => acc + u.ancho * u.alto, 0);
  const aprovechamiento = areaTotal > 0 ? (areaUsada / areaTotal) * 100 : 0;

  return {
    aprovechamiento: Math.round(aprovechamiento * 10) / 10,
    areaUsada,
    areaTotal,
    piezasUbicadas: ubicadas.length,
    totalPlanchas
  };
}
