// app.js — Punto de entrada de la app. Inicializa la UI y conecta los
// callbacks de eventos con las funciones del modelo de datos (piezas.js).
// El motor de nesting (nesting.js) y la exportación (exportar.js) se
// conectan en fases posteriores.

import { agregarPieza, eliminarPieza, obtenerPiezas, limpiarPiezas, importarArchivo } from './modules/piezas.js';
import {
  inicializarUI,
  renderizarPiezas,
  mostrarMensaje,
  reiniciarCamposPlancha,
  reiniciarCanvas,
  obtenerDimensionesPlancha,
  obtenerKerf,
  renderizarNesting,
  actualizarIndicadoresNesting,
  mostrarPiezasNoUbicadas,
  mostrarSeccionExportar,
  obtenerModoNesting,
  obtenerTiempoMaximo,
  deshabilitarModoIrregular,
  seleccionarModoRectangular,
  actualizarTextoBotonCalcular,
  habilitarBotonCalcular,
  mostrarProgresoIrregular,
  ocultarProgresoIrregular,
  actualizarProgresoIrregular,
  mostrarGrupoTiempoMaximo,
  ocultarGrupoTiempoMaximo,
  mostrarEstadoCalculandoIrregular,
  obtenerFactorEscalaDXF
} from './modules/ui.js';
import { calcularNesting, calcularEstadisticas } from './modules/nesting.js';
import { calcularNestingIrregular, detenerNestingIrregular, svgNestDisponible } from './modules/nesting-irregular.js';
import { exportarSVG, exportarDXF, exportarPDF, exportarExcel } from './modules/exportar.js';

function refrescarLista() {
  renderizarPiezas(obtenerPiezas(), manejarEliminarPieza);
}

// El nesting calculado deja de ser válido en cuanto cambian las piezas
// cargadas: se descarta el resultado anterior y el canvas vuelve al estado vacío.
function invalidarNesting() {
  window.ultimoNesting = null;
  reiniciarCanvas();
}

function manejarAgregarPieza(datos) {
  agregarPieza(datos);
  refrescarLista();
  invalidarNesting();
  mostrarMensaje(`Pieza "${datos.nombre}" agregada.`, 'exito');
}

function manejarEliminarPieza(id) {
  eliminarPieza(id);
  refrescarLista();
  invalidarNesting();
  mostrarMensaje('Pieza eliminada.', 'info');
}

async function manejarImportarArchivo(file) {
  try {
    const esDXF = file.name.toLowerCase().endsWith('.dxf');
    const opciones = esDXF ? { factorEscalaDXF: obtenerFactorEscalaDXF() } : {};
    const resultado = await importarArchivo(file, opciones);
    refrescarLista();
    invalidarNesting();
    let mensaje = `Se importaron ${resultado.cantidadAgregadas} pieza(s) desde "${resultado.nombreArchivo}".`;
    if (resultado.unidadDetectada) {
      mensaje += ` Unidad: ${resultado.unidadDetectada}.`;
    }
    if (resultado.omitidas > 0) {
      mensaje += ` Se omitieron ${resultado.omitidas} fila(s) por datos inválidos o vacíos.`;
    }
    mostrarMensaje(mensaje, 'exito');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

// Valida piezas/plancha y devuelve {piezas, plancha, kerf} o null si hay
// un error (ya mostrado en el área de mensajes). Común a ambos modos.
function validarAntesDeCalcular() {
  const piezas = obtenerPiezas();
  if (piezas.length === 0) {
    mostrarMensaje('Cargá al menos una pieza antes de calcular.', 'error');
    return null;
  }

  const plancha = obtenerDimensionesPlancha();
  if (!Number.isFinite(plancha.ancho) || plancha.ancho <= 0 || !Number.isFinite(plancha.alto) || plancha.alto <= 0) {
    mostrarMensaje('Las dimensiones de la plancha deben ser mayores a 0.', 'error');
    return null;
  }

  const kerfLeido = obtenerKerf();
  const kerf = Number.isFinite(kerfLeido) && kerfLeido > 0 ? kerfLeido : 0;

  return { piezas, plancha, kerf };
}

function manejarCalcular() {
  if (obtenerModoNesting() === 'irregular') {
    manejarCalcularIrregular();
  } else {
    manejarCalcularRectangular();
  }
}

function manejarCalcularRectangular() {
  const datos = validarAntesDeCalcular();
  if (!datos) return;
  const { piezas, plancha, kerf } = datos;

  const resultado = calcularNesting(piezas, plancha, kerf);
  const estadisticas = calcularEstadisticas(resultado.ubicadas, plancha);
  const totalPiezasOriginal = piezas.reduce((acc, p) => acc + p.cantidad, 0);

  renderizarNesting(resultado, plancha);
  actualizarIndicadoresNesting(estadisticas, totalPiezasOriginal, kerf);
  mostrarPiezasNoUbicadas(resultado.noUbicadas);
  mostrarSeccionExportar();

  window.ultimoNesting = {
    ubicadas: resultado.ubicadas,
    noUbicadas: resultado.noUbicadas,
    totalPlanchas: resultado.totalPlanchas,
    estadisticas,
    plancha,
    kerf
  };

  if (resultado.noUbicadas.length > 0) {
    mostrarMensaje(
      `Se ubicaron ${resultado.ubicadas.length} de ${totalPiezasOriginal} piezas. ${resultado.noUbicadas.length} no entraron en ninguna plancha.`,
      'error'
    );
  } else {
    mostrarMensaje(
      `Nesting calculado: ${estadisticas.totalPlanchas} plancha(s), ${estadisticas.aprovechamiento}% de aprovechamiento.`,
      'exito'
    );
  }
}

// El nesting irregular (SVGnest) es iterativo: no termina solo, sigue
// mejorando hasta que el usuario presiona "Detener". Cada mejora parcial
// se dibuja en el canvas para que se vea el progreso en vivo.
function manejarCalcularIrregular() {
  // Punto 3: verificación defensiva en el momento del click, no solo al inicio
  if (!svgNestDisponible()) {
    deshabilitarModoIrregular('SVGnest no se pudo cargar. Solo está disponible el modo rectangular.');
    seleccionarModoRectangular();
    actualizarTextoBotonCalcular('Calcular nesting');
    mostrarMensaje('SVGnest no está disponible. Cambiando a modo rectangular.', 'error');
    return;
  }

  const datos = validarAntesDeCalcular();
  if (!datos) return;
  const { piezas, plancha, kerf } = datos;
  const tiempoMaximo = obtenerTiempoMaximo();

  habilitarBotonCalcular(false);
  mostrarProgresoIrregular();
  // Punto 2: mensaje inicial mientras no hay solución parcial
  mostrarEstadoCalculandoIrregular();
  mostrarMensaje('Nesting irregular en curso… se detiene automáticamente al llegar al tiempo máximo.', 'info');

  calcularNestingIrregular(
    piezas,
    plancha,
    kerf,
    tiempoMaximo,
    (porcentaje, parcial) => {
      actualizarProgresoIrregular(porcentaje);
      if (parcial) {
        renderizarNesting(parcial, plancha);
        const totalPiezasOriginal = piezas.reduce((acc, p) => acc + p.cantidad, 0);
        const estadisticasParciales = calcularEstadisticas(parcial.ubicadas, plancha);
        actualizarIndicadoresNesting(estadisticasParciales, totalPiezasOriginal, kerf);
        mostrarPiezasNoUbicadas(parcial.noUbicadas);
      } else {
        // Punto 2: todavía sin solución parcial, mantener mensaje de búsqueda
        mostrarEstadoCalculandoIrregular();
      }
    },
    (final) => manejarResultadoIrregularFinal(final, piezas, plancha, kerf)
  );
}

function manejarResultadoIrregularFinal(final, piezas, plancha, kerf) {
  ocultarProgresoIrregular();
  habilitarBotonCalcular(true);

  if (final.error) {
    mostrarMensaje(final.error, 'error');
    return;
  }

  const estadisticas = calcularEstadisticas(final.ubicadas, plancha);
  const totalPiezasOriginal = piezas.reduce((acc, p) => acc + p.cantidad, 0);

  renderizarNesting(final, plancha);
  actualizarIndicadoresNesting(estadisticas, totalPiezasOriginal, kerf);
  mostrarPiezasNoUbicadas(final.noUbicadas);
  mostrarSeccionExportar();

  window.ultimoNesting = {
    ubicadas: final.ubicadas,
    noUbicadas: final.noUbicadas,
    totalPlanchas: final.totalPlanchas,
    estadisticas,
    plancha,
    kerf
  };

  const resumenIteraciones = `(${final.iteraciones || 0} iteraciones, ${final.mejoras || 0} mejoras)`;
  if (final.noUbicadas.length > 0) {
    mostrarMensaje(
      `Nesting irregular detenido ${resumenIteraciones}: ${final.ubicadas.length} de ${totalPiezasOriginal} piezas ubicadas. ${final.noUbicadas.length} no entraron.`,
      'error'
    );
  } else {
    mostrarMensaje(
      `Nesting irregular detenido ${resumenIteraciones}: ${estadisticas.totalPlanchas} plancha(s), ${estadisticas.aprovechamiento}% de aprovechamiento.`,
      'exito'
    );
  }
}

function manejarDetenerIrregular() {
  detenerNestingIrregular();
}

function manejarCambiarModoNesting(modo) {
  if (modo === 'irregular') {
    actualizarTextoBotonCalcular('Iniciar nesting');
    mostrarGrupoTiempoMaximo();
  } else {
    actualizarTextoBotonCalcular('Calcular nesting');
    ocultarGrupoTiempoMaximo();
    ocultarProgresoIrregular();
    habilitarBotonCalcular(true);
  }
}

function sinNestingCalculado() {
  if (window.ultimoNesting) return false;
  mostrarMensaje('Calculá el nesting antes de exportar', 'error');
  return true;
}

async function manejarExportarSVG() {
  if (sinNestingCalculado()) return;
  try {
    await exportarSVG(window.ultimoNesting);
    mostrarMensaje('SVG exportado correctamente', 'exito');
  } catch (err) {
    mostrarMensaje(`Error al exportar SVG: ${err.message}`, 'error');
  }
}

async function manejarExportarDXF() {
  if (sinNestingCalculado()) return;
  try {
    await exportarDXF(window.ultimoNesting);
    mostrarMensaje('DXF exportado correctamente', 'exito');
  } catch (err) {
    mostrarMensaje(`Error al exportar DXF: ${err.message}`, 'error');
  }
}

function manejarExportarPDF() {
  if (sinNestingCalculado()) return;
  try {
    exportarPDF(window.ultimoNesting);
    mostrarMensaje('PDF exportado correctamente', 'exito');
  } catch (err) {
    mostrarMensaje(`Error al exportar PDF: ${err.message}`, 'error');
  }
}

function manejarExportarExcel() {
  if (sinNestingCalculado()) return;
  try {
    exportarExcel(window.ultimoNesting);
    mostrarMensaje('Excel exportado correctamente', 'exito');
  } catch (err) {
    mostrarMensaje(`Error al exportar Excel: ${err.message}`, 'error');
  }
}

function manejarLimpiarTodo() {
  limpiarPiezas();
  refrescarLista();
  reiniciarCamposPlancha();
  window.ultimoNesting = null;
  reiniciarCanvas();
  mostrarMensaje('Se limpiaron las piezas y la configuración.', 'info');
}

inicializarUI({
  onAgregarPieza: manejarAgregarPieza,
  onEliminarPieza: manejarEliminarPieza,
  onCalcular: manejarCalcular,
  onLimpiarTodo: manejarLimpiarTodo,
  onImportarArchivo: manejarImportarArchivo,
  onExportarSVG: manejarExportarSVG,
  onExportarDXF: manejarExportarDXF,
  onExportarPDF: manejarExportarPDF,
  onExportarExcel: manejarExportarExcel,
  onCambiarModoNesting: manejarCambiarModoNesting,
  onDetenerIrregular: manejarDetenerIrregular
});

// El modo irregular depende de SVGnest (lib/svgnest/); si no cargó bien,
// se deshabilita esa opción y queda disponible solo el modo rectangular.
if (!svgNestDisponible()) {
  deshabilitarModoIrregular('SVGnest no se pudo cargar. Solo está disponible el modo rectangular.');
}

refrescarLista();
