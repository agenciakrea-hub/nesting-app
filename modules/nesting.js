// nesting.js — Motor de bin packing (FFDH con estantes y rotación 90°).
// Módulo puro: solo recibe arrays/objetos y devuelve arrays/objetos.
// Cero DOM, cero window, cero console.log.

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
 * Ordena las instancias de mayor a menor según el lado más largo (altura
 * efectiva pensando en que la pieza puede rotarse). Si dos instancias tienen
 * la misma altura efectiva, desempata por el lado restante descendente.
 * @param {Array} instancias
 */
function ordenarInstancias(instancias) {
  instancias.sort((a, b) => {
    const altA = Math.max(a.ancho, a.alto);
    const altB = Math.max(b.ancho, b.alto);
    if (altB !== altA) return altB - altA;
    const restoA = Math.min(a.ancho, a.alto);
    const restoB = Math.min(b.ancho, b.alto);
    return restoB - restoA;
  });
}

/**
 * Decide si una instancia entra en un estante existente, en orientación
 * normal o rotada. Prefiere la orientación normal si ambas entran.
 * El kerf se suma al ancho ocupado (espacio que reserva la pieza más el
 * corte láser); la altura se compara contra la altura real del estante,
 * que ya quedó fijada por la primera pieza que lo abrió.
 * @returns {'normal'|'rotada'|null}
 */
function elegirOrientacionParaEstante(estante, inst, anchoPlancha, kerf) {
  const cabeNormal = estante.xActual + inst.ancho + kerf <= anchoPlancha && inst.alto <= estante.alturaMaxima;
  if (cabeNormal) return 'normal';
  const cabeRotada = estante.xActual + inst.alto + kerf <= anchoPlancha && inst.ancho <= estante.alturaMaxima;
  if (cabeRotada) return 'rotada';
  return null;
}

/**
 * Decide la orientación para abrir un estante nuevo, dado el espacio
 * vertical disponible en la plancha actual. El kerf se suma tanto al
 * ancho como al alto efectivos de la pieza.
 * @returns {'normal'|'rotada'|null}
 */
function elegirOrientacionNuevoEstante(inst, anchoPlancha, espacioVerticalDisponible, kerf) {
  const cabeNormal = inst.ancho + kerf <= anchoPlancha && inst.alto + kerf <= espacioVerticalDisponible;
  if (cabeNormal) return 'normal';
  const cabeRotada = inst.alto + kerf <= anchoPlancha && inst.ancho + kerf <= espacioVerticalDisponible;
  if (cabeRotada) return 'rotada';
  return null;
}

/**
 * Ubica todas las piezas de una lista de piezas (con cantidad) dentro de
 * planchas del tamaño indicado, usando First Fit Decreasing Height con
 * estantes y rotación de 90° cuando ayuda.
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

  let planchaIndex = 0;
  let estantes = [];
  let yUsada = 0;

  function colocarEnEstante(estante, inst, orientacion) {
    const rotada = orientacion === 'rotada';
    const anchoFinal = rotada ? inst.alto : inst.ancho;
    const altoFinal = rotada ? inst.ancho : inst.alto;
    ubicadas.push({
      plancha: planchaIndex,
      piezaId: inst.piezaId,
      nombre: inst.nombre,
      x: estante.xActual,
      y: estante.y,
      ancho: anchoFinal,
      alto: altoFinal,
      rotada
    });
    estante.xActual += anchoFinal + kerfEfectivo;
  }

  function abrirEstante(y, alturaMaxima) {
    const estante = { y, alturaMaxima, xActual: 0 };
    estantes.push(estante);
    return estante;
  }

  instancias.forEach(inst => {
    // Si ni siquiera entra sola en una plancha vacía, es imposible ubicarla.
    const entraNormal = inst.ancho <= plancha.ancho && inst.alto <= plancha.alto;
    const entraRotada = inst.alto <= plancha.ancho && inst.ancho <= plancha.alto;
    if (!entraNormal && !entraRotada) {
      noUbicadas.push({ piezaId: inst.piezaId, nombre: inst.nombre, ancho: inst.ancho, alto: inst.alto });
      return;
    }

    // 1. Probar en los estantes existentes de la plancha actual.
    for (const estante of estantes) {
      const orientacion = elegirOrientacionParaEstante(estante, inst, plancha.ancho, kerfEfectivo);
      if (orientacion) {
        colocarEnEstante(estante, inst, orientacion);
        return;
      }
    }

    // 2. Probar abrir un estante nuevo en la plancha actual.
    let orientacion = elegirOrientacionNuevoEstante(inst, plancha.ancho, plancha.alto - yUsada, kerfEfectivo);
    if (orientacion) {
      const alturaReal = orientacion === 'rotada' ? inst.ancho : inst.alto;
      const estante = abrirEstante(yUsada, alturaReal);
      yUsada += alturaReal + kerfEfectivo;
      colocarEnEstante(estante, inst, orientacion);
      return;
    }

    // 3. No entra en la plancha actual: abrir una plancha nueva.
    planchaIndex++;
    estantes = [];
    yUsada = 0;
    orientacion = elegirOrientacionNuevoEstante(inst, plancha.ancho, plancha.alto, kerfEfectivo);
    const alturaReal = orientacion === 'rotada' ? inst.ancho : inst.alto;
    const estante = abrirEstante(0, alturaReal);
    yUsada = alturaReal + kerfEfectivo;
    colocarEnEstante(estante, inst, orientacion);
  });

  return {
    ubicadas,
    noUbicadas,
    totalPlanchas: ubicadas.length > 0 ? planchaIndex + 1 : 0
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
