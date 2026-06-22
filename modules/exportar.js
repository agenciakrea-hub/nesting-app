// exportar.js — Generación de descargas (SVG, DXF, PDF, Excel) a partir de
// window.ultimoNesting. No conoce el algoritmo de nesting, solo recibe el
// resultado ya calculado. No toca el DOM salvo para crear el <a> temporal
// de descarga. SheetJS (XLSX) y jsPDF (window.jspdf) se asumen cargados
// globalmente vía CDN en index.html.

/**
 * Espera la cantidad de milisegundos indicada (usado para espaciar
 * descargas consecutivas de múltiples archivos).
 * @param {number} ms
 */
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crea un Blob con el contenido dado y dispara su descarga mediante un
 * elemento <a> temporal. Única función de exportar.js que toca el DOM.
 * @param {string|Blob} contenido
 * @param {string} nombre
 * @param {string} mimeType
 */
function descargarArchivo(contenido, nombre, mimeType) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escapa caracteres especiales para que el nombre de la pieza sea válido
 * dentro de un <text> de SVG.
 * @param {string} texto
 */
function escaparXML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Limpia el nombre de una pieza para usarlo como nombre de capa DXF o
 * parte de un nombre de archivo: sin acentos, espacios ni caracteres
 * especiales, reemplazados por guión bajo.
 * @param {string} texto
 */
const DIACRITICOS = new RegExp('[̀-ͯ]', 'g');

function limpiarNombre(texto) {
  const limpio = String(texto)
    .normalize('NFD').replace(DIACRITICOS, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpio || 'pieza';
}

// ===================== SVG =====================

function generarSVGPlancha(piezas, plancha) {
  const lineas = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plancha.ancho}mm" height="${plancha.alto}mm" viewBox="0 0 ${plancha.ancho} ${plancha.alto}">`,
    `  <rect x="0" y="0" width="${plancha.ancho}" height="${plancha.alto}" fill="#ffffff"/>`
  ];

  piezas.forEach(p => {
    lineas.push(`  <rect x="${p.x}" y="${p.y}" width="${p.ancho}" height="${p.alto}" fill="none" stroke="#000000" stroke-width="0.1"/>`);
    lineas.push(`  <text x="${p.x + p.ancho / 2}" y="${p.y + p.alto / 2}" font-size="4" fill="#000000" text-anchor="middle" dominant-baseline="middle">${escaparXML(p.nombre)}</text>`);
  });

  lineas.push('</svg>');
  return lineas.join('\n');
}

/**
 * Exporta un archivo SVG por cada plancha del nesting (descargas
 * consecutivas espaciadas 300ms si hay más de una).
 * @param {object} ultimoNesting
 */
export async function exportarSVG(ultimoNesting) {
  const { ubicadas, totalPlanchas, plancha } = ultimoNesting;

  for (let p = 0; p < totalPlanchas; p++) {
    const piezasPlancha = ubicadas.filter(u => u.plancha === p);
    const svg = generarSVGPlancha(piezasPlancha, plancha);
    descargarArchivo(svg, `nesting_plancha_${p + 1}.svg`, 'image/svg+xml');
    if (p < totalPlanchas - 1) await esperar(300);
  }
}

// ===================== DXF =====================

function generarDXFPlancha(piezas) {
  const lineas = ['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];

  piezas.forEach(p => {
    const x1 = p.x, y1 = p.y;
    const x2 = p.x + p.ancho, y2 = p.y;
    const x3 = p.x + p.ancho, y3 = p.y + p.alto;
    const x4 = p.x, y4 = p.y + p.alto;

    lineas.push(
      '0', 'LWPOLYLINE',
      '8', limpiarNombre(p.nombre),
      '90', '4',
      '70', '1',
      '10', String(x1), '20', String(y1),
      '10', String(x2), '20', String(y2),
      '10', String(x3), '20', String(y3),
      '10', String(x4), '20', String(y4)
    );
  });

  lineas.push('0', 'ENDSEC', '0', 'EOF');
  return lineas.join('\n');
}

/**
 * Exporta un archivo DXF por cada plancha del nesting (una LWPOLYLINE
 * cerrada por pieza, descargas espaciadas 300ms si hay más de una).
 * @param {object} ultimoNesting
 */
export async function exportarDXF(ultimoNesting) {
  const { ubicadas, totalPlanchas } = ultimoNesting;

  for (let p = 0; p < totalPlanchas; p++) {
    const piezasPlancha = ubicadas.filter(u => u.plancha === p);
    const dxf = generarDXFPlancha(piezasPlancha);
    descargarArchivo(dxf, `nesting_plancha_${p + 1}.dxf`, 'application/dxf');
    if (p < totalPlanchas - 1) await esperar(300);
  }
}

// ===================== PDF =====================

/**
 * Exporta un único PDF con una página por plancha, a escala real (1mm = 1
 * unidad jsPDF), usando jsPDF cargado globalmente como window.jspdf.
 * @param {object} ultimoNesting
 */
export function exportarPDF(ultimoNesting) {
  const { jsPDF } = window.jspdf;
  const { ubicadas, totalPlanchas, plancha, estadisticas } = ultimoNesting;

  // jsPDF asume orientación "portrait" por defecto y si no se indica
  // explícitamente invierte ancho/alto cuando la plancha es más ancha que
  // alta. Se fuerza la orientación según la proporción real de la plancha.
  const orientacion = plancha.ancho > plancha.alto ? 'l' : 'p';
  const doc = new jsPDF({ unit: 'mm', format: [plancha.ancho, plancha.alto], orientation: orientacion });

  for (let p = 0; p < totalPlanchas; p++) {
    if (p > 0) doc.addPage([plancha.ancho, plancha.alto], orientacion);

    doc.setFontSize(8);
    doc.text(`Plancha ${p + 1} de ${totalPlanchas} — Aprovechamiento: ${estadisticas.aprovechamiento}%`, 2, 5);

    ubicadas
      .filter(u => u.plancha === p)
      .forEach(pieza => {
        doc.rect(pieza.x, pieza.y, pieza.ancho, pieza.alto);
        doc.setFontSize(6);
        doc.text(pieza.nombre, pieza.x + pieza.ancho / 2, pieza.y + pieza.alto / 2, { align: 'center' });
      });
  }

  doc.save('nesting.pdf');
}

// ===================== Excel =====================

/**
 * Exporta un único archivo Excel con dos hojas: "Resumen" (detalle de cada
 * pieza ubicada) y "Estadísticas" (totales del nesting), usando SheetJS
 * cargado globalmente como XLSX.
 * @param {object} ultimoNesting
 */
export function exportarExcel(ultimoNesting) {
  const { ubicadas, noUbicadas, estadisticas } = ultimoNesting;
  const fecha = new Date().toLocaleDateString('es-AR');

  const filasResumen = [
    [`Plan de Corte — ${fecha}`],
    [],
    ['Plancha', 'Pieza', 'Ancho (mm)', 'Alto (mm)', 'Pos. X (mm)', 'Pos. Y (mm)', 'Rotada']
  ];

  [...ubicadas]
    .sort((a, b) => a.plancha - b.plancha)
    .forEach(u => {
      filasResumen.push([u.plancha + 1, u.nombre, u.ancho, u.alto, u.x, u.y, u.rotada ? 'Sí' : 'No']);
    });

  const filasEstadisticas = [
    ['Total de planchas usadas', estadisticas.totalPlanchas],
    ['Total de piezas ubicadas', estadisticas.piezasUbicadas],
    ['Aprovechamiento promedio (%)', estadisticas.aprovechamiento],
    ['Área usada (cm²)', Math.round(estadisticas.areaUsada / 100)],
    ['Área total disponible (cm²)', Math.round(estadisticas.areaTotal / 100)],
    ['Piezas no ubicadas', noUbicadas.length > 0 ? noUbicadas.map(p => p.nombre).join(', ') : 'Ninguna']
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasResumen), 'Resumen');
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasEstadisticas), 'Estadísticas');

  XLSX.writeFile(libro, 'nesting.xlsx');
}
