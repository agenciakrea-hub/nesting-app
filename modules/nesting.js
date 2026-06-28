// nesting.js — Motor de bin packing (MaxRects con Bottom-Left Fit y rotación 90°).
// Módulo puro: solo recibe arrays/objetos y devuelve arrays/objetos.
// Cero DOM, cero window, cero console.log.
//
// Algoritmo MaxRects: mantiene la lista completa de rectángulos libres
// "maximales" (no se pueden agrandar sin solapar con una pieza). Cuando se
// coloca una pieza, todos los rectángulos libres que se superponen con ella
// se dividen en hasta 4 franjas, y luego se eliminan los que quedan
// contenidos dentro de otro. Esto permite aprovechar mejor los huecos que
// el corte guillotine no puede reutilizar.

const EPS = 0.001;

/**
 * Expande las piezas según su cantidad en instancias individuales a ubicar.
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
 * Ordena las instancias de mayor a menor área; empata por lado mayor descendente.
 * Las piezas grandes van primero para que las chicas rellenen los huecos.
 */
function ordenarInstancias(instancias) {
  instancias.sort((a, b) => {
    const dArea = b.ancho * b.alto - a.ancho * a.alto;
    if (Math.abs(dArea) > EPS) return dArea;
    return Math.max(b.ancho, b.alto) - Math.max(a.ancho, a.alto);
  });
}

// ─── MaxRects helpers ────────────────────────────────────────────────────────

function intersectan(a, b) {
  return a.x < b.x + b.ancho - EPS &&
         a.x + a.ancho > b.x + EPS &&
         a.y < b.y + b.alto - EPS &&
         a.y + a.alto > b.y + EPS;
}

function contieneA(grande, chico) {
  return chico.x >= grande.x - EPS &&
         chico.y >= grande.y - EPS &&
         chico.x + chico.ancho <= grande.x + grande.ancho + EPS &&
         chico.y + chico.alto <= grande.y + grande.alto + EPS;
}

/**
 * Divide un rectángulo libre alrededor de la zona ocupada por una pieza.
 * Genera hasta 4 franjas (izquierda, derecha, arriba, abajo); solo las que
 * tienen área positiva después del solapamiento.
 * Si no hay solapamiento, devuelve el rectángulo intacto.
 */
function dividirLibre(libre, pieza) {
  if (!intersectan(libre, pieza)) return [libre];

  const nuevos = [];

  // Franja izquierda
  const anchoIzq = pieza.x - libre.x;
  if (anchoIzq > EPS) {
    nuevos.push({ x: libre.x, y: libre.y, ancho: anchoIzq, alto: libre.alto });
  }
  // Franja derecha
  const xDerPieza = pieza.x + pieza.ancho;
  const anchoDer = (libre.x + libre.ancho) - xDerPieza;
  if (anchoDer > EPS) {
    nuevos.push({ x: xDerPieza, y: libre.y, ancho: anchoDer, alto: libre.alto });
  }
  // Franja superior (Y menor = más arriba en pantalla)
  const altoArr = pieza.y - libre.y;
  if (altoArr > EPS) {
    nuevos.push({ x: libre.x, y: libre.y, ancho: libre.ancho, alto: altoArr });
  }
  // Franja inferior
  const yAbajoPieza = pieza.y + pieza.alto;
  const altoAbaj = (libre.y + libre.alto) - yAbajoPieza;
  if (altoAbaj > EPS) {
    nuevos.push({ x: libre.x, y: yAbajoPieza, ancho: libre.ancho, alto: altoAbaj });
  }

  return nuevos;
}

/**
 * Elimina rectángulos que están completamente contenidos dentro de otro
 * (serían redundantes porque el más grande ya cubre todas sus posiciones).
 */
function purgarContenidos(libres) {
  return libres.filter((r, i) => {
    for (let j = 0; j < libres.length; j++) {
      if (i !== j && contieneA(libres[j], r)) return false;
    }
    return true;
  });
}

/**
 * Busca la mejor ubicación para una instancia entre todos los rectángulos
 * libres de todas las planchas. Criterio Bottom-Left: mínimo Y (más arriba
 * posible), luego mínimo X (más a la izquierda); las planchas posteriores
 * tienen penalización alta para rellenar primero la plancha actual.
 * Cuando ambas orientaciones caben, prefiere la que deja menos remanente
 * vertical (consume más altura del espacio, mejor compactación).
 */
function buscarMejor(espaciosPorPlancha, inst, kerf) {
  let mejor = null;
  let mejorPuntaje = Infinity;

  for (let p = 0; p < espaciosPorPlancha.length; p++) {
    const libres = espaciosPorPlancha[p];
    for (let e = 0; e < libres.length; e++) {
      const libre = libres[e];

      const cabeN = inst.ancho + kerf <= libre.ancho && inst.alto + kerf <= libre.alto;
      const cabeR = inst.alto  + kerf <= libre.ancho && inst.ancho + kerf <= libre.alto;
      if (!cabeN && !cabeR) continue;

      // Puntaje Bottom-Left: penalizar planchas tardías > altura > columna
      const puntaje = p * 1e12 + libre.y * 1e6 + libre.x;
      if (puntaje >= mejorPuntaje) continue;

      // Orientación: preferir la que deja menos remanente en Y
      let orientacion;
      if (cabeN && cabeR) {
        const remN = libre.alto - inst.alto - kerf;
        const remR = libre.alto - inst.ancho - kerf;
        orientacion = remN <= remR ? 'normal' : 'rotada';
      } else {
        orientacion = cabeN ? 'normal' : 'rotada';
      }

      mejorPuntaje = puntaje;
      mejor = { planchaIndex: p, espacioIndex: e, orientacion };
    }
  }

  return mejor;
}

/**
 * Coloca una instancia en el rectángulo libre indicado y actualiza la lista
 * de rectángulos libres de esa plancha con el algoritmo MaxRects:
 * divide TODOS los rectángulos que se superponen con la zona ocupada y luego
 * purga los que quedan contenidos en otro.
 */
function colocarEnEspacio(espaciosPorPlancha, ubicacion, inst, kerf, ubicadas) {
  const { planchaIndex, espacioIndex, orientacion } = ubicacion;
  const libre = espaciosPorPlancha[planchaIndex][espacioIndex];

  const rotada = orientacion === 'rotada';
  const ancho = rotada ? inst.alto : inst.ancho;
  const alto  = rotada ? inst.ancho : inst.alto;

  ubicadas.push({
    plancha: planchaIndex,
    piezaId: inst.piezaId,
    nombre: inst.nombre,
    x: libre.x,
    y: libre.y,
    ancho,
    alto,
    rotada
  });

  // La zona ocupada incluye el kerf para reservar la sangría de corte
  const zona = { x: libre.x, y: libre.y, ancho: ancho + kerf, alto: alto + kerf };

  // Dividir todos los rectángulos libres de esta plancha
  const nuevosLibres = [];
  for (const r of espaciosPorPlancha[planchaIndex]) {
    nuevosLibres.push(...dividirLibre(r, zona));
  }

  espaciosPorPlancha[planchaIndex] = purgarContenidos(nuevosLibres);
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Ubica todas las piezas dentro de planchas del tamaño indicado usando
 * MaxRects Bin Packing con Bottom-Left Fit y rotación de 90°.
 * @param {Array} piezas - modelo estándar {id, nombre, cantidad, ancho, alto, material}
 * @param {{ancho: number, alto: number}} plancha
 * @param {number} [kerf=0] - sangría de corte láser en mm
 * @param {{arriba:number, derecha:number, abajo:number, izquierda:number}|null} [margen=null]
 * @returns {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}}
 */
export function calcularNesting(piezas, plancha, kerf = 0, margen = null) {
  if (!plancha || !(plancha.ancho > 0) || !(plancha.alto > 0)) {
    return { ubicadas: [], noUbicadas: [], totalPlanchas: 0 };
  }

  const kerfEfectivo = kerf > 0 ? kerf : 0;
  const mg = margen || { arriba: 0, derecha: 0, abajo: 0, izquierda: 0 };
  const areaX = mg.izquierda || 0;
  const areaY = mg.arriba || 0;
  const areaAncho = plancha.ancho - (mg.izquierda || 0) - (mg.derecha || 0);
  const areaAlto  = plancha.alto  - (mg.arriba  || 0) - (mg.abajo  || 0);

  if (!(areaAncho > 0) || !(areaAlto > 0)) {
    return { ubicadas: [], noUbicadas: [], totalPlanchas: 0 };
  }

  const instancias = expandirInstancias(piezas);
  ordenarInstancias(instancias);

  const ubicadas = [];
  const noUbicadas = [];
  const espaciosPorPlancha = [];

  function abrirPlanchaNueva() {
    espaciosPorPlancha.push([{ x: areaX, y: areaY, ancho: areaAncho, alto: areaAlto }]);
    return espaciosPorPlancha.length - 1;
  }

  instancias.forEach(inst => {
    // Verificar si la pieza puede entrar en alguna plancha (sin considerar kerf)
    const entraNormal = inst.ancho <= plancha.ancho && inst.alto <= plancha.alto;
    const entraRotada = inst.alto <= plancha.ancho && inst.ancho <= plancha.alto;
    if (!entraNormal && !entraRotada) {
      noUbicadas.push({ piezaId: inst.piezaId, nombre: inst.nombre, ancho: inst.ancho, alto: inst.alto });
      return;
    }

    // Buscar en todas las planchas abiertas (Bottom-Left Fit)
    const mejor = buscarMejor(espaciosPorPlancha, inst, kerfEfectivo);
    if (mejor) {
      colocarEnEspacio(espaciosPorPlancha, mejor, inst, kerfEfectivo, ubicadas);
      return;
    }

    // No entra en ninguna plancha existente: abrir una nueva
    const entraEnVacia =
      (inst.ancho + kerfEfectivo <= plancha.ancho && inst.alto + kerfEfectivo <= plancha.alto) ||
      (inst.alto  + kerfEfectivo <= plancha.ancho && inst.ancho + kerfEfectivo <= plancha.alto);

    if (!entraEnVacia) {
      noUbicadas.push({ piezaId: inst.piezaId, nombre: inst.nombre, ancho: inst.ancho, alto: inst.alto });
      return;
    }

    abrirPlanchaNueva();
    const mejorNueva = buscarMejor(espaciosPorPlancha, inst, kerfEfectivo);
    if (mejorNueva) {
      colocarEnEspacio(espaciosPorPlancha, mejorNueva, inst, kerfEfectivo, ubicadas);
    }
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
