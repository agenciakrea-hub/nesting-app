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
  mostrarSeccionExportar
} from './modules/ui.js';
import { calcularNesting, calcularEstadisticas } from './modules/nesting.js';
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
    const resultado = await importarArchivo(file);
    refrescarLista();
    invalidarNesting();
    let mensaje = `Se importaron ${resultado.cantidadAgregadas} pieza(s) desde "${resultado.nombreArchivo}".`;
    if (resultado.omitidas > 0) {
      mensaje += ` Se omitieron ${resultado.omitidas} fila(s) por datos inválidos o vacíos.`;
    }
    mostrarMensaje(mensaje, 'exito');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
}

function manejarCalcular() {
  const piezas = obtenerPiezas();
  if (piezas.length === 0) {
    mostrarMensaje('Cargá al menos una pieza antes de calcular.', 'error');
    return;
  }

  const plancha = obtenerDimensionesPlancha();
  if (!Number.isFinite(plancha.ancho) || plancha.ancho <= 0 || !Number.isFinite(plancha.alto) || plancha.alto <= 0) {
    mostrarMensaje('Las dimensiones de la plancha deben ser mayores a 0.', 'error');
    return;
  }

  const kerfLeido = obtenerKerf();
  const kerf = Number.isFinite(kerfLeido) && kerfLeido > 0 ? kerfLeido : 0;

  const resultado = calcularNesting(piezas, plancha, kerf);
  const estadisticas = calcularEstadisticas(resultado.ubicadas, plancha);
  const totalPiezasOriginal = piezas.reduce((acc, p) => acc + p.cantidad, 0);

  renderizarNesting(resultado, plancha);
  actualizarIndicadoresNesting(estadisticas, totalPiezasOriginal);
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
  onExportarExcel: manejarExportarExcel
});

refrescarLista();
