// ui.js — Único módulo que toca el DOM. Maneja eventos, renderizado de la lista
// de piezas y el área de mensajes. No conoce el algoritmo de nesting, solo recibe
// callbacks desde app.js para ejecutar la lógica correspondiente.

const refs = {};

function cachearRefs() {
  refs.formPieza = document.getElementById('form-pieza');
  refs.inputNombre = document.getElementById('pieza-nombre');
  refs.inputCantidad = document.getElementById('pieza-cantidad');
  refs.inputAncho = document.getElementById('pieza-ancho');
  refs.inputAlto = document.getElementById('pieza-alto');
  refs.inputMaterial = document.getElementById('pieza-material');

  refs.planchaAncho = document.getElementById('plancha-ancho');
  refs.planchaAlto = document.getElementById('plancha-alto');
  refs.planchaKerf = document.getElementById('plancha-kerf');

  refs.inputArchivo = document.getElementById('input-archivo');
  refs.btnImportar = document.getElementById('btn-importar');
  refs.nombreArchivo = document.getElementById('nombre-archivo');

  refs.listaPiezas = document.getElementById('lista-piezas');
  refs.piezasVacio = document.getElementById('piezas-vacio');
  refs.contadorTotal = document.getElementById('contador-total');

  refs.btnCalcular = document.getElementById('btn-calcular');
  refs.btnLimpiar = document.getElementById('btn-limpiar');

  refs.areaMensajes = document.getElementById('area-mensajes');

  refs.canvas = document.getElementById('canvas-nesting');
  refs.canvasPlaceholder = document.getElementById('canvas-placeholder');
  refs.canvasIndicadores = document.getElementById('canvas-indicadores');
  refs.indAprovechamiento = document.getElementById('ind-aprovechamiento');
  refs.indPiezas = document.getElementById('ind-piezas');
  refs.indPlanchas = document.getElementById('ind-planchas');
  refs.indArea = document.getElementById('ind-area');
  refs.piezasNoUbicadas = document.getElementById('piezas-no-ubicadas');

  refs.seccionExportar = document.getElementById('seccion-exportar');
  refs.btnExportarSVG = document.getElementById('btn-exportar-svg');
  refs.btnExportarDXF = document.getElementById('btn-exportar-dxf');
  refs.btnExportarPDF = document.getElementById('btn-exportar-pdf');
  refs.btnExportarExcel = document.getElementById('btn-exportar-excel');

  refs.btnAyuda = document.getElementById('btn-ayuda');
  refs.modalAyuda = document.getElementById('modal-ayuda');
  refs.btnCerrarAyuda = document.getElementById('btn-cerrar-ayuda');
}

/**
 * Muestra un mensaje en el área de mensajes fija (nunca usar alert/confirm).
 * @param {string} texto
 * @param {'error'|'exito'|'info'} tipo
 */
export function mostrarMensaje(texto, tipo = 'info') {
  refs.areaMensajes.innerHTML = '';
  const div = document.createElement('div');
  div.className = `mensaje mensaje--${tipo}`;
  div.textContent = texto;
  refs.areaMensajes.appendChild(div);
}

/**
 * Lee y valida los campos del formulario de "Agregar pieza".
 * @returns {{datos: object|null, error: string|null}}
 */
function leerFormularioPieza() {
  const nombre = refs.inputNombre.value.trim();
  const cantidad = parseInt(refs.inputCantidad.value, 10);
  const ancho = parseFloat(refs.inputAncho.value);
  const alto = parseFloat(refs.inputAlto.value);
  const material = refs.inputMaterial.value.trim();

  if (!nombre) {
    return { datos: null, error: 'El nombre de la pieza es obligatorio.' };
  }
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { datos: null, error: 'La cantidad debe ser un número entero mayor o igual a 1.' };
  }
  if (!Number.isFinite(ancho) || ancho <= 0) {
    return { datos: null, error: 'El ancho debe ser un número mayor a 0.' };
  }
  if (!Number.isFinite(alto) || alto <= 0) {
    return { datos: null, error: 'El alto debe ser un número mayor a 0.' };
  }

  return { datos: { nombre, cantidad, ancho, alto, material }, error: null };
}

function limpiarFormularioPieza() {
  refs.formPieza.reset();
  refs.inputCantidad.value = 1;
  refs.inputNombre.focus();
}

/**
 * Vuelve a dibujar la tabla de piezas a partir del array actual.
 * @param {Array} piezas
 * @param {(id: string) => void} onEliminar callback al presionar eliminar
 */
export function renderizarPiezas(piezas, onEliminar) {
  refs.listaPiezas.innerHTML = '';

  if (piezas.length === 0) {
    refs.piezasVacio.style.display = 'block';
  } else {
    refs.piezasVacio.style.display = 'none';
    piezas.forEach(p => {
      const fila = document.createElement('tr');

      const tdNombre = document.createElement('td');
      tdNombre.className = 'col-nombre';
      tdNombre.textContent = p.nombre;

      const tdCantidad = document.createElement('td');
      tdCantidad.textContent = p.cantidad;

      const tdMedidas = document.createElement('td');
      tdMedidas.textContent = `${p.ancho} x ${p.alto}`;

      const tdMaterial = document.createElement('td');
      tdMaterial.textContent = p.material || '—';

      const tdAcciones = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-eliminar';
      btn.textContent = 'Eliminar';
      btn.addEventListener('click', () => onEliminar(p.id));
      tdAcciones.appendChild(btn);

      fila.append(tdNombre, tdCantidad, tdMedidas, tdMaterial, tdAcciones);
      refs.listaPiezas.appendChild(fila);
    });
  }

  const totalUnidades = piezas.reduce((acc, p) => acc + p.cantidad, 0);
  refs.contadorTotal.textContent = totalUnidades;
}

/**
 * Limpia los campos de plancha a sus valores por defecto.
 */
export function reiniciarCamposPlancha() {
  refs.planchaAncho.value = 1220;
  refs.planchaAlto.value = 2440;
  refs.planchaKerf.value = 0.2;
}

/**
 * Devuelve las dimensiones de plancha configuradas actualmente.
 * @returns {{ancho: number, alto: number}}
 */
export function obtenerDimensionesPlancha() {
  return {
    ancho: parseFloat(refs.planchaAncho.value),
    alto: parseFloat(refs.planchaAlto.value)
  };
}

/**
 * Devuelve el valor de kerf (sangría de corte) configurado, sin sanitizar.
 * @returns {number}
 */
export function obtenerKerf() {
  return parseFloat(refs.planchaKerf.value);
}

/**
 * Muestra el nombre del último archivo importado debajo del botón de importar.
 * @param {string} nombre
 */
export function mostrarNombreArchivo(nombre) {
  refs.nombreArchivo.textContent = nombre;
}

// ===================== Canvas: nesting =====================

/**
 * Ajusta la resolución interna del canvas a su tamaño real en pantalla
 * (considerando devicePixelRatio) y devuelve el contexto ya escalado más
 * el ancho/alto en píxeles "lógicos" (CSS) para dibujar con esas medidas.
 */
function prepararContexto(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const anchoCss = rect.width || canvas.clientWidth || 600;
  const altoCss = rect.height || canvas.clientHeight || 400;

  canvas.width = Math.round(anchoCss * dpr);
  canvas.height = Math.round(altoCss * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { ctx, anchoCss, altoCss };
}

/**
 * Dibuja una grilla sutil tipo "papel milimetrado oscuro" para el estado
 * vacío del canvas (sin nesting calculado todavía).
 */
function dibujarGrillaVacia() {
  const { ctx, anchoCss, altoCss } = prepararContexto(refs.canvas);
  ctx.clearRect(0, 0, anchoCss, altoCss);

  const paso = 24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;

  for (let x = 0.5; x < anchoCss; x += paso) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, altoCss);
    ctx.stroke();
  }
  for (let y = 0.5; y < altoCss; y += paso) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(anchoCss, y);
    ctx.stroke();
  }
}

/**
 * Genera un color hsla estable a partir del piezaId (hash simple),
 * para que cada pieza tenga siempre el mismo color en el canvas.
 */
function colorDesdeId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsla(${hue}, 65%, 55%, 0.7)`;
}

/**
 * Dibuja el nombre y las dimensiones reales de una pieza centrados sobre
 * su rectángulo. Si no entran las dos líneas, prueba con una sola; si
 * tampoco entra ninguna, no dibuja texto.
 */
function dibujarEtiquetaPieza(ctx, pieza, x, y, w, h) {
  const lineaNombre = pieza.nombre;
  const lineaMedidas = `${Math.round(pieza.ancho)}×${Math.round(pieza.alto)}mm`;
  const margen = 4;
  const interlineado = 13;

  ctx.fillStyle = '#f0f0f0';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = '11px "JetBrains Mono", monospace';

  const anchoDisponible = w - margen * 2;
  const cabeNombre = ctx.measureText(lineaNombre).width <= anchoDisponible;
  const cabeMedidas = ctx.measureText(lineaMedidas).width <= anchoDisponible;

  if (cabeNombre && cabeMedidas && h >= interlineado * 2 + margen) {
    ctx.fillText(lineaNombre, x + w / 2, y + h / 2 - interlineado / 2);
    ctx.fillText(lineaMedidas, x + w / 2, y + h / 2 + interlineado / 2);
  } else if (cabeNombre && h >= interlineado) {
    ctx.fillText(lineaNombre, x + w / 2, y + h / 2);
  } else if (cabeMedidas && h >= interlineado) {
    ctx.fillText(lineaMedidas, x + w / 2, y + h / 2);
  }
}

function dibujarPieza(ctx, pieza, offsetXPlancha, offsetYPlancha, factor) {
  const x = offsetXPlancha + pieza.x * factor;
  const y = offsetYPlancha + pieza.y * factor;
  const w = pieza.ancho * factor;
  const h = pieza.alto * factor;

  ctx.fillStyle = colorDesdeId(pieza.piezaId);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(w - 1, 0), Math.max(h - 1, 0));

  dibujarEtiquetaPieza(ctx, pieza, x, y, w, h);
}

/**
 * Dibuja el resultado de calcularNesting(): una o varias planchas apiladas
 * verticalmente, cada una con sus piezas ubicadas a escala.
 * @param {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}} resultado
 * @param {{ancho: number, alto: number}} plancha
 */
export function renderizarNesting(resultado, plancha) {
  const { ctx, anchoCss, altoCss } = prepararContexto(refs.canvas);
  ctx.clearRect(0, 0, anchoCss, altoCss);

  const totalPlanchas = Math.max(resultado.totalPlanchas, 1);
  const gap = 16;

  // Se reserva un margen superior fijo para que el panel de indicadores
  // (posicionado absoluto arriba a la derecha) nunca tape el dibujo de la
  // plancha, sin importar su proporción ancho/alto.
  const margenSuperior = 110;
  const altoDisponibleTotal = Math.max(altoCss - margenSuperior, 50);

  const factorAncho = (anchoCss * 0.9) / plancha.ancho;
  const espacioVerticalDisponible = altoDisponibleTotal * 0.9 - gap * (totalPlanchas - 1);
  const factorAlto = espacioVerticalDisponible > 0
    ? espacioVerticalDisponible / (totalPlanchas * plancha.alto)
    : factorAncho;
  const factor = Math.min(factorAncho, factorAlto) || 0.01;

  const anchoPlanchaPx = plancha.ancho * factor;
  const altoPlanchaPx = plancha.alto * factor;
  const altoTotalPx = totalPlanchas * altoPlanchaPx + gap * (totalPlanchas - 1);

  const offsetX = (anchoCss - anchoPlanchaPx) / 2;
  const offsetY = margenSuperior + (altoDisponibleTotal - altoTotalPx) / 2;
  const colorAcento = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#ff7a1a';

  for (let p = 0; p < totalPlanchas; p++) {
    const planchaX = offsetX;
    const planchaY = offsetY + p * (altoPlanchaPx + gap);

    ctx.fillStyle = '#161616';
    ctx.fillRect(planchaX, planchaY, anchoPlanchaPx, altoPlanchaPx);
    ctx.strokeStyle = colorAcento;
    ctx.lineWidth = 1;
    ctx.strokeRect(planchaX + 0.5, planchaY + 0.5, anchoPlanchaPx - 1, altoPlanchaPx - 1);

    resultado.ubicadas
      .filter(u => u.plancha === p)
      .forEach(pieza => dibujarPieza(ctx, pieza, planchaX, planchaY, factor));
  }
}

/**
 * Actualiza los indicadores numéricos sobre el canvas (aprovechamiento,
 * piezas ubicadas, planchas usadas, área usada/total) y los hace visibles.
 * @param {object} estadisticas - resultado de calcularEstadisticas()
 * @param {number} totalPiezasOriginal - cantidad total de unidades cargadas
 */
export function actualizarIndicadoresNesting(estadisticas, totalPiezasOriginal) {
  refs.canvasPlaceholder.style.display = 'none';
  refs.canvasIndicadores.classList.remove('oculto');

  refs.indAprovechamiento.textContent = `${estadisticas.aprovechamiento}%`;
  refs.indPiezas.textContent = `${estadisticas.piezasUbicadas}/${totalPiezasOriginal}`;
  refs.indPlanchas.textContent = `${estadisticas.totalPlanchas}`;
  refs.indArea.textContent = `${Math.round(estadisticas.areaUsada / 100)} / ${Math.round(estadisticas.areaTotal / 100)}`;
}

/**
 * Muestra (o limpia) el aviso de piezas que no pudieron ubicarse en ninguna
 * plancha, debajo del canvas.
 * @param {Array} noUbicadas
 */
export function mostrarPiezasNoUbicadas(noUbicadas) {
  if (!noUbicadas || noUbicadas.length === 0) {
    refs.piezasNoUbicadas.classList.add('oculto');
    refs.piezasNoUbicadas.innerHTML = '';
    return;
  }

  const detalle = noUbicadas.map(p => `${p.nombre} (${p.ancho}×${p.alto}mm)`).join(', ');
  refs.piezasNoUbicadas.innerHTML =
    `<strong>No se pudieron ubicar ${noUbicadas.length} pieza(s):</strong>${detalle}`;
  refs.piezasNoUbicadas.classList.remove('oculto');
}

/**
 * Vuelve el canvas a su estado vacío: oculta indicadores, aviso y la
 * sección de exportar, muestra el placeholder y redibuja la grilla de fondo.
 */
export function reiniciarCanvas() {
  refs.canvasIndicadores.classList.add('oculto');
  refs.canvasPlaceholder.style.display = 'block';
  refs.piezasNoUbicadas.classList.add('oculto');
  refs.piezasNoUbicadas.innerHTML = '';
  refs.seccionExportar.classList.add('oculto');
  dibujarGrillaVacia();
}

/**
 * Muestra la sección de exportación (solo debe llamarse cuando hay un
 * nesting calculado disponible en window.ultimoNesting).
 */
export function mostrarSeccionExportar() {
  refs.seccionExportar.classList.remove('oculto');
}

// ===================== Modal de ayuda =====================

function abrirModalAyuda() {
  refs.modalAyuda.classList.remove('oculto');
}

function cerrarModalAyuda() {
  refs.modalAyuda.classList.add('oculto');
}

/**
 * Inicializa todos los listeners de la UI.
 * @param {object} callbacks
 * @param {(datos: object) => void} callbacks.onAgregarPieza
 * @param {(id: string) => void} callbacks.onEliminarPieza
 * @param {() => void} callbacks.onCalcular
 * @param {() => void} callbacks.onLimpiarTodo
 * @param {(file: File) => void} callbacks.onImportarArchivo
 * @param {() => void} callbacks.onExportarSVG
 * @param {() => void} callbacks.onExportarDXF
 * @param {() => void} callbacks.onExportarPDF
 * @param {() => void} callbacks.onExportarExcel
 */
export function inicializarUI(callbacks) {
  cachearRefs();

  refs.formPieza.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const { datos, error } = leerFormularioPieza();
    if (error) {
      mostrarMensaje(error, 'error');
      return;
    }
    callbacks.onAgregarPieza(datos);
    limpiarFormularioPieza();
  });

  refs.btnImportar.addEventListener('click', () => {
    refs.inputArchivo.click();
  });

  refs.inputArchivo.addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    mostrarNombreArchivo(file.name);
    callbacks.onImportarArchivo(file);
    refs.inputArchivo.value = '';
  });

  refs.btnCalcular.addEventListener('click', () => {
    callbacks.onCalcular();
  });

  refs.btnLimpiar.addEventListener('click', () => {
    callbacks.onLimpiarTodo();
  });

  refs.btnExportarSVG.addEventListener('click', () => callbacks.onExportarSVG());
  refs.btnExportarDXF.addEventListener('click', () => callbacks.onExportarDXF());
  refs.btnExportarPDF.addEventListener('click', () => callbacks.onExportarPDF());
  refs.btnExportarExcel.addEventListener('click', () => callbacks.onExportarExcel());

  refs.btnAyuda.addEventListener('click', abrirModalAyuda);
  refs.btnCerrarAyuda.addEventListener('click', cerrarModalAyuda);
  refs.modalAyuda.addEventListener('click', (ev) => {
    if (ev.target === refs.modalAyuda) cerrarModalAyuda();
  });

  reiniciarCanvas();
  mostrarMensaje('Listo para cargar piezas.', 'info');
}
