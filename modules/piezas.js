// piezas.js — Modelo de datos de piezas en memoria + importación de archivos.
// No toca el DOM. Solo mantiene el estado y expone funciones puras de acceso/mutación.
// SheetJS (XLSX) se asume cargado globalmente vía CDN en index.html.

let piezas = [];

// Genera un id simple sin depender de librerías externas.
function generarId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Agrega una pieza al listado en memoria.
 * @param {{nombre: string, cantidad: number, ancho: number, alto: number, material?: string}} datos
 * @returns {object} la pieza creada
 */
export function agregarPieza(datos) {
  const pieza = {
    id: generarId(),
    nombre: datos.nombre,
    cantidad: datos.cantidad,
    ancho: datos.ancho,
    alto: datos.alto,
    material: datos.material || ''
  };
  piezas.push(pieza);
  return pieza;
}

// Validación mínima para datos provenientes de archivos importados,
// donde no hay un formulario previo que ya haya validado los campos.
function esPiezaValida(datos) {
  return (
    typeof datos.nombre === 'string' && datos.nombre.trim() !== '' &&
    Number.isFinite(datos.cantidad) && datos.cantidad >= 1 &&
    Number.isFinite(datos.ancho) && datos.ancho > 0 &&
    Number.isFinite(datos.alto) && datos.alto > 0
  );
}

/**
 * Agrega varias piezas de una vez (usado por la importación de archivos).
 * Si alguna no pasa la validación mínima, se saltea y se sigue con el resto.
 * @param {Array} piezasCrudas
 * @returns {Array} las piezas efectivamente agregadas (con id)
 */
export function agregarPiezas(piezasCrudas) {
  const agregadas = [];
  piezasCrudas.forEach(datos => {
    if (!esPiezaValida(datos)) return;
    agregadas.push(agregarPieza(datos));
  });
  return agregadas;
}

/**
 * Elimina una pieza por id.
 * @param {string} id
 */
export function eliminarPieza(id) {
  piezas = piezas.filter(p => p.id !== id);
}

/**
 * Devuelve el array completo de piezas cargadas.
 * @returns {Array}
 */
export function obtenerPiezas() {
  return piezas;
}

/**
 * Vacía el listado de piezas.
 */
export function limpiarPiezas() {
  piezas = [];
}

// ===================== Importación: CSV y Excel (SheetJS) =====================

const ALIAS_NOMBRE = ['nombre', 'name'];
const ALIAS_CANTIDAD = ['cantidad', 'qty', 'quantity'];
const ALIAS_ANCHO = ['ancho', 'width'];
const ALIAS_ALTO = ['alto', 'height'];
const ALIAS_MATERIAL = ['material'];

function encontrarColumna(columnas, alias) {
  return columnas.find(c => alias.includes(c.trim().toLowerCase()));
}

/**
 * Importa piezas desde un archivo CSV o Excel usando SheetJS.
 * @param {File} file
 * @returns {Promise<{piezas: Array, omitidas: number}>}
 */
export async function importarDesdeExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const primeraHoja = workbook.SheetNames[0];
  const hoja = workbook.Sheets[primeraHoja];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

  if (filas.length === 0) {
    throw new Error('El archivo no contiene filas de datos.');
  }

  const columnas = Object.keys(filas[0]);
  const colNombre = encontrarColumna(columnas, ALIAS_NOMBRE);
  const colCantidad = encontrarColumna(columnas, ALIAS_CANTIDAD);
  const colAncho = encontrarColumna(columnas, ALIAS_ANCHO);
  const colAlto = encontrarColumna(columnas, ALIAS_ALTO);
  const colMaterial = encontrarColumna(columnas, ALIAS_MATERIAL);

  if (!colNombre || !colCantidad || !colAncho || !colAlto) {
    throw new Error('El archivo no tiene las columnas esperadas: nombre, cantidad, ancho, alto');
  }

  const piezasNuevas = [];
  let omitidas = 0;

  filas.forEach(fila => {
    const nombreCrudo = String(fila[colNombre] ?? '').trim();
    const cantidadCruda = fila[colCantidad];
    const anchoCrudo = fila[colAncho];
    const altoCrudo = fila[colAlto];

    if (!nombreCrudo || cantidadCruda === '' || anchoCrudo === '' || altoCrudo === '') {
      omitidas++;
      return;
    }

    const cantidad = Number(cantidadCruda);
    const ancho = Number(anchoCrudo);
    const alto = Number(altoCrudo);

    if (!Number.isFinite(cantidad) || !Number.isFinite(ancho) || !Number.isFinite(alto)) {
      omitidas++;
      return;
    }

    piezasNuevas.push({
      nombre: nombreCrudo,
      cantidad,
      ancho,
      alto,
      material: colMaterial ? String(fila[colMaterial] ?? '').trim() : ''
    });
  });

  if (omitidas > 0) {
    console.warn(`importarDesdeExcel: se omitieron ${omitidas} fila(s) por datos inválidos o vacíos.`);
  }

  return { piezas: piezasNuevas, omitidas };
}

// ===================== Importación: SVG =====================

const PX_A_MM = 1 / 3.7795;

/**
 * Detecta si un atributo "d" de un <path> describe un rectángulo simple
 * (4 vértices que coinciden con las esquinas de su bounding box) y
 * devuelve su ancho/alto en px. Devuelve null si no es un rectángulo.
 * @param {string} d
 * @returns {{ancho: number, alto: number}|null}
 */
function extraerRectDePath(d) {
  if (!d) return null;
  const comandos = d.match(/[MLmlZz][^MLZzmlz]*/g);
  if (!comandos) return null;

  const puntos = [];
  comandos.forEach(cmd => {
    const tipo = cmd[0];
    if (tipo !== 'M' && tipo !== 'L') return;
    const valores = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (valores.length === 2 && valores.every(Number.isFinite)) {
      puntos.push({ x: valores[0], y: valores[1] });
    }
  });

  if (puntos.length !== 4) return null;

  const xs = puntos.map(p => p.x);
  const ys = puntos.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const esEsquina = (p) => (p.x === minX || p.x === maxX) && (p.y === minY || p.y === maxY);
  if (!puntos.every(esEsquina)) return null;
  if (maxX - minX <= 0 || maxY - minY <= 0) return null;

  return { ancho: maxX - minX, alto: maxY - minY };
}

/**
 * Importa piezas rectangulares desde un archivo SVG.
 * @param {File} file
 * @returns {Promise<{piezas: Array, omitidas: number}>}
 */
export async function importarDesdeSVG(file) {
  const texto = await file.text();
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('El archivo SVG no se pudo interpretar (XML inválido).');
  }

  const piezasNuevas = [];
  let contador = 0;
  const siguienteNombre = (el) => {
    contador++;
    return el.getAttribute('id') || el.getAttribute('label') || `rect_${contador}`;
  };

  doc.querySelectorAll('rect').forEach(el => {
    const anchoPx = parseFloat(el.getAttribute('width'));
    const altoPx = parseFloat(el.getAttribute('height'));
    if (!Number.isFinite(anchoPx) || !Number.isFinite(altoPx) || anchoPx <= 0 || altoPx <= 0) return;

    piezasNuevas.push({
      nombre: siguienteNombre(el),
      cantidad: 1,
      ancho: Math.round(anchoPx * PX_A_MM * 100) / 100,
      alto: Math.round(altoPx * PX_A_MM * 100) / 100,
      material: ''
    });
  });

  doc.querySelectorAll('path').forEach(el => {
    const rect = extraerRectDePath(el.getAttribute('d'));
    if (!rect) return;

    piezasNuevas.push({
      nombre: siguienteNombre(el),
      cantidad: 1,
      ancho: Math.round(rect.ancho * PX_A_MM * 100) / 100,
      alto: Math.round(rect.alto * PX_A_MM * 100) / 100,
      material: ''
    });
  });

  if (piezasNuevas.length === 0) {
    throw new Error('No se encontraron piezas rectangulares en el SVG.');
  }

  return { piezas: piezasNuevas, omitidas: 0 };
}

// ===================== Importación: DXF =====================

/**
 * Lee una entidad LWPOLYLINE a partir del índice donde empiezan sus pares
 * código/valor (justo después de la línea "0 / LWPOLYLINE").
 * @param {string[]} lineas
 * @param {number} inicio
 * @param {number} numeroPieza
 * @returns {{pieza: object|null, siguienteIndice: number}}
 */
function leerEntidadLWPolyline(lineas, inicio, numeroPieza) {
  let capa = '';
  let cerrada = false;
  const vertices = [];
  let j = inicio;

  while (j < lineas.length) {
    const codigo = lineas[j];
    const valor = lineas[j + 1];

    if (codigo === '0') break; // arrancó la siguiente entidad

    if (codigo === '8') capa = valor;
    if (codigo === '70') cerrada = (parseInt(valor, 10) & 1) === 1;
    if (codigo === '10') vertices.push({ x: parseFloat(valor), y: 0 });
    if (codigo === '20' && vertices.length > 0) {
      vertices[vertices.length - 1].y = parseFloat(valor);
    }

    j += 2;
  }

  if (vertices.length < 2) {
    return { pieza: null, siguienteIndice: j };
  }

  const primero = vertices[0];
  const ultimo = vertices[vertices.length - 1];
  const cerradaPorPuntos =
    Math.abs(primero.x - ultimo.x) < 1e-6 && Math.abs(primero.y - ultimo.y) < 1e-6;

  if (!cerrada && !cerradaPorPuntos) {
    return { pieza: null, siguienteIndice: j };
  }

  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const ancho = Math.max(...xs) - Math.min(...xs);
  const alto = Math.max(...ys) - Math.min(...ys);

  if (!(ancho > 0) || !(alto > 0)) {
    return { pieza: null, siguienteIndice: j };
  }

  return {
    pieza: {
      nombre: capa || `pieza_${numeroPieza}`,
      cantidad: 1,
      ancho: Math.round(ancho * 100) / 100,
      alto: Math.round(alto * 100) / 100,
      material: ''
    },
    siguienteIndice: j
  };
}

/**
 * Importa piezas a partir de contornos cerrados (LWPOLYLINE) de un archivo DXF.
 * Las dimensiones se toman tal cual están en el archivo (se asume que el
 * DXF usa milímetros, que es lo más común en corte láser).
 * @param {File} file
 * @returns {Promise<{piezas: Array, omitidas: number}>}
 */
export async function importarDesdeDXF(file) {
  const texto = await file.text();
  const lineas = texto.split(/\r?\n/).map(l => l.trim());

  const piezasNuevas = [];
  let dentroEntities = false;
  let contadorPiezas = 0;
  let i = 0;

  while (i < lineas.length - 1) {
    const codigo = lineas[i];
    const valor = lineas[i + 1];

    if (codigo === '2' && valor === 'ENTITIES') {
      dentroEntities = true;
      i += 2;
      continue;
    }
    if (codigo === '0' && valor === 'ENDSEC') {
      dentroEntities = false;
      i += 2;
      continue;
    }
    if (dentroEntities && codigo === '0' && valor === 'LWPOLYLINE') {
      contadorPiezas++;
      const resultado = leerEntidadLWPolyline(lineas, i + 2, contadorPiezas);
      if (resultado.pieza) piezasNuevas.push(resultado.pieza);
      i = resultado.siguienteIndice;
      continue;
    }

    i += 2;
  }

  if (piezasNuevas.length === 0) {
    throw new Error('No se encontraron contornos cerrados en el DXF. Asegurate de exportar como LWPOLYLINE desde tu CAD.');
  }

  return { piezas: piezasNuevas, omitidas: 0 };
}

// ===================== Router de importación =====================

/**
 * Detecta el tipo de archivo por su extensión, lo parsea con el importador
 * correspondiente y agrega las piezas resultantes al modelo en memoria.
 * @param {File} file
 * @returns {Promise<{nombreArchivo: string, cantidadAgregadas: number, omitidas: number}>}
 */
export async function importarArchivo(file) {
  const nombreArchivo = file.name;
  const extension = nombreArchivo.split('.').pop().toLowerCase();

  let resultado;
  switch (extension) {
    case 'csv':
    case 'xlsx':
    case 'xls':
      resultado = await importarDesdeExcel(file);
      break;
    case 'svg':
      resultado = await importarDesdeSVG(file);
      break;
    case 'dxf':
      resultado = await importarDesdeDXF(file);
      break;
    default:
      throw new Error('Formato no soportado. Usá CSV, Excel, SVG o DXF.');
  }

  const agregadas = agregarPiezas(resultado.piezas);

  if (agregadas.length === 0) {
    throw new Error(`El archivo "${nombreArchivo}" no contiene piezas válidas para importar.`);
  }

  return {
    nombreArchivo,
    cantidadAgregadas: agregadas.length,
    omitidas: resultado.omitidas || 0
  };
}
