// nesting-irregular.js — Motor de nesting para formas irregulares usando
// SVGnest (lib/svgnest/), que corre íntegramente en el browser vía Web
// Workers. Convive con nesting.js (rectangular) sin reemplazarlo.
//
// SVGnest no tiene una condición de "terminado": es un algoritmo genético
// iterativo que sigue mejorando indefinidamente hasta que se lo detiene.
// Por eso el flujo es: calcularNestingIrregular() arranca el cálculo y va
// reportando mejoras parciales por onProgress(); cuando el usuario decide
// frenar, detenerNestingIrregular() corta el cálculo y entrega el último
// resultado conocido por onResult().

let onResultCallbackActual = null;
let ultimoResultadoConvertido = null;
let metadatosInstanciasActual = {};
let dimensionesPorPiezaActual = {};
let contadorIteraciones = 0;
let contadorMejoras = 0;
let tiempoInicioActual = 0;
let tiempoMaximoActualMs = 60000;
let timeoutAutoStop = null;

/**
 * Porcentaje de progreso basado en tiempo transcurrido vs el tiempo máximo
 * configurado (no en iteraciones, que no tienen techo natural).
 * @returns {number} 0 a 100
 */
function calcularPorcentajeTiempo() {
  const transcurridoMs = Date.now() - tiempoInicioActual;
  return Math.min(100, Math.round((transcurridoMs / tiempoMaximoActualMs) * 100));
}

/**
 * Indica si SVGnest está disponible (los scripts de lib/svgnest/ cargaron
 * correctamente). Debe consultarse antes de ofrecer el modo irregular en la UI.
 * @returns {boolean}
 */
export function svgNestDisponible() {
  return typeof window !== 'undefined' && typeof window.SvgNest !== 'undefined';
}

/**
 * Construye el SVG de entrada para SVGnest: un <rect id="bin"> con el
 * tamaño de la plancha como primer elemento, seguido de una instancia por
 * cada unidad de cada pieza (las piezas con cantidad > 1 se repiten como
 * elementos separados). Las piezas con vértices se vuelcan como <polygon>,
 * las rectangulares como <rect>. 1 unidad SVG = 1mm.
 * @param {Array} piezas
 * @param {{ancho: number, alto: number}} plancha
 * @param {object} metadatosInstancias - se llena con instanciaId -> {piezaId, nombre}
 * @returns {string}
 */
function construirSVG(piezas, plancha, metadatosInstancias) {
  const partes = ['<svg xmlns="http://www.w3.org/2000/svg">'];
  partes.push(`<rect id="bin" x="0" y="0" width="${plancha.ancho}" height="${plancha.alto}"/>`);

  piezas.forEach(pieza => {
    for (let i = 0; i < pieza.cantidad; i++) {
      const instanciaId = `${pieza.id}__${i}`;
      metadatosInstancias[instanciaId] = { piezaId: pieza.id, nombre: pieza.nombre };

      if (Array.isArray(pieza.vertices) && pieza.vertices.length >= 3) {
        const puntos = pieza.vertices.map(v => `${v.x},${v.y}`).join(' ');
        partes.push(`<polygon id="${instanciaId}" points="${puntos}"/>`);
      } else {
        partes.push(`<rect id="${instanciaId}" x="0" y="0" width="${pieza.ancho}" height="${pieza.alto}"/>`);
      }
    }
  });

  partes.push('</svg>');
  return partes.join('');
}

/**
 * Extrae los vértices locales (sin transformar) de un elemento <rect> o
 * <polygon> tal como los devuelve SVGnest dentro de cada <g> de resultado.
 * @param {SVGElement} elemento
 * @returns {Array<{x:number, y:number}>}
 */
function extraerPuntosLocales(elemento) {
  const tag = elemento.tagName.toLowerCase();

  if (tag === 'rect') {
    const x = parseFloat(elemento.getAttribute('x')) || 0;
    const y = parseFloat(elemento.getAttribute('y')) || 0;
    const w = parseFloat(elemento.getAttribute('width')) || 0;
    const h = parseFloat(elemento.getAttribute('height')) || 0;
    return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  }

  if (tag === 'polygon') {
    const crudos = (elemento.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean);
    return crudos.map(par => {
      const [px, py] = par.split(',').map(Number);
      return { x: px, y: py };
    });
  }

  return [];
}

/**
 * Aplica la transformación "translate(tx ty) rotate(deg)" de SVGnest a un
 * punto local: primero rota alrededor del origen, después traslada (así
 * es como SVG compone esa lista de transforms sobre un punto).
 */
function rotarYTrasladar(punto, gradosRotacion, tx, ty) {
  const rad = (gradosRotacion * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: punto.x * cos - punto.y * sin + tx,
    y: punto.x * sin + punto.y * cos + ty
  };
}

/**
 * Convierte el resultado crudo de SVGnest (array de <svg>, uno por plancha
 * usada) al formato estándar { ubicadas, noUbicadas, totalPlanchas }.
 * @param {SVGElement[]} svgList
 * @param {object} metadatosInstancias
 * @param {object} dimensionesPorPieza - piezaId -> {ancho, alto} originales
 * @returns {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}}
 */
function convertirResultado(svgList, metadatosInstancias, dimensionesPorPieza) {
  const ubicadas = [];
  const idsColocados = new Set();

  svgList.forEach((svgElemento, planchaIndex) => {
    Array.from(svgElemento.children)
      .filter(el => el.tagName.toLowerCase() === 'g')
      .forEach(grupo => {
        const transform = grupo.getAttribute('transform') || '';
        const match = /translate\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)\s*rotate\(\s*([-\d.eE]+)\s*\)/.exec(transform);
        if (!match) return;

        const tx = parseFloat(match[1]);
        const ty = parseFloat(match[2]);
        const rot = parseFloat(match[3]);

        const elementoPieza = grupo.firstElementChild;
        if (!elementoPieza) return;

        const instanciaId = elementoPieza.getAttribute('id');
        const meta = metadatosInstancias[instanciaId];
        if (!meta) return;

        idsColocados.add(instanciaId);

        const esRectangulo = elementoPieza.tagName.toLowerCase() === 'rect';
        const puntosMundo = extraerPuntosLocales(elementoPieza).map(p => rotarYTrasladar(p, rot, tx, ty));

        const xs = puntosMundo.map(p => p.x);
        const ys = puntosMundo.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        ubicadas.push({
          plancha: planchaIndex,
          piezaId: meta.piezaId,
          nombre: meta.nombre,
          x: Math.round(minX * 100) / 100,
          y: Math.round(minY * 100) / 100,
          ancho: Math.round((maxX - minX) * 100) / 100,
          alto: Math.round((maxY - minY) * 100) / 100,
          rotada: Math.abs(((rot % 360) + 360) % 360) > 0.01,
          // Contorno real en mm relativo a la plancha; solo se incluye para
          // piezas no rectangulares (un rectángulo rotado 0/90/180/270 ya
          // queda perfectamente descripto por x/y/ancho/alto).
          vertices: esRectangulo
            ? null
            : puntosMundo.map(p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }))
        });
      });
  });

  const noUbicadas = [];
  Object.keys(metadatosInstancias).forEach(instanciaId => {
    if (idsColocados.has(instanciaId)) return;
    const meta = metadatosInstancias[instanciaId];
    const dims = dimensionesPorPieza[meta.piezaId] || { ancho: 0, alto: 0 };
    noUbicadas.push({ piezaId: meta.piezaId, nombre: meta.nombre, ancho: dims.ancho, alto: dims.alto });
  });

  return {
    ubicadas,
    noUbicadas,
    totalPlanchas: svgList.length
  };
}

/**
 * Inicia el nesting irregular vía SVGnest. No es bloqueante: corre en
 * Web Workers y va llamando a onProgress() cada vez que encuentra una
 * mejora, hasta que se llama a detenerNestingIrregular() o se cumple el
 * tiempo máximo configurado (se detiene solo y entrega el mejor resultado).
 * @param {Array} piezas - modelo estándar, algunas pueden tener `vertices`
 * @param {{ancho: number, alto: number}} plancha
 * @param {number} kerf - sangría en mm, se pasa como `spacing` a SVGnest
 * @param {number} tiempoMaximoSegundos - tope de tiempo antes de detenerse solo
 * @param {(porcentaje: number, resultadoParcial: object|null) => void} onProgress
 * @param {(resultadoFinal: object) => void} onResult
 */
export function calcularNestingIrregular(piezas, plancha, kerf, tiempoMaximoSegundos = 60, onProgress, onResult) {
  if (!svgNestDisponible()) {
    onResult({
      error: 'SVGnest no está disponible (no se pudieron cargar los scripts de lib/svgnest/). Usá el modo rectangular.',
      ubicadas: [],
      noUbicadas: [],
      totalPlanchas: 0
    });
    return;
  }

  metadatosInstanciasActual = {};
  dimensionesPorPiezaActual = {};
  piezas.forEach(p => { dimensionesPorPiezaActual[p.id] = { ancho: p.ancho, alto: p.alto }; });

  ultimoResultadoConvertido = null;
  contadorIteraciones = 0;
  contadorMejoras = 0;
  onResultCallbackActual = onResult;

  tiempoInicioActual = Date.now();
  tiempoMaximoActualMs = Math.max(1, tiempoMaximoSegundos) * 1000;
  if (timeoutAutoStop) clearTimeout(timeoutAutoStop);
  timeoutAutoStop = setTimeout(() => {
    detenerNestingIrregular();
  }, tiempoMaximoActualMs);

  const svgString = construirSVG(piezas, plancha, metadatosInstanciasActual);

  const svgParseado = window.SvgNest.parsesvg(svgString);
  const binElement = svgParseado.querySelector('#bin');
  window.SvgNest.setbin(binElement);
  window.SvgNest.config({
    spacing: kerf > 0 ? kerf : 0,
    rotations: 4,
    populationSize: 20,
    mutationRate: 10
  });

  window.SvgNest.start(
    () => {
      contadorIteraciones++;
      if (onProgress) {
        onProgress(calcularPorcentajeTiempo(), ultimoResultadoConvertido);
      }
    },
    (svgList, porcentajeColocado, piezasColocadas, piezasTotales) => {
      if (!svgList) return; // sin mejora en esta evaluación
      contadorMejoras++;
      ultimoResultadoConvertido = convertirResultado(svgList, metadatosInstanciasActual, dimensionesPorPiezaActual);
      if (onProgress) {
        onProgress(calcularPorcentajeTiempo(), ultimoResultadoConvertido);
      }
    }
  );
}

/**
 * Detiene el cálculo en curso (manual o por tiempo máximo agotado) y
 * entrega el último resultado conocido a través del onResult pasado a
 * calcularNestingIrregular().
 */
export function detenerNestingIrregular() {
  if (timeoutAutoStop) {
    clearTimeout(timeoutAutoStop);
    timeoutAutoStop = null;
  }

  if (svgNestDisponible()) {
    window.SvgNest.stop();
  }

  if (!onResultCallbackActual) return;

  const resultadoFinal = ultimoResultadoConvertido || { ubicadas: [], noUbicadas: [], totalPlanchas: 0 };
  resultadoFinal.iteraciones = contadorIteraciones;
  resultadoFinal.mejoras = contadorMejoras;
  onResultCallbackActual(resultadoFinal);
  onResultCallbackActual = null;
}
