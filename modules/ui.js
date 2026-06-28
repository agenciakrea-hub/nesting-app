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

  refs.margenGeneral = document.getElementById('margen-general');
  refs.margenPersonalizado = document.getElementById('margen-personalizado');
  refs.margenLadosGrupo = document.getElementById('margen-lados-grupo');
  refs.margenArriba = document.getElementById('margen-arriba');
  refs.margenDerecha = document.getElementById('margen-derecha');
  refs.margenAbajo = document.getElementById('margen-abajo');
  refs.margenIzquierda = document.getElementById('margen-izquierda');

  refs.inputArchivo = document.getElementById('input-archivo');
  refs.btnImportar = document.getElementById('btn-importar');
  refs.nombreArchivo = document.getElementById('nombre-archivo');
  refs.dxfUnidadGrupo = document.getElementById('dxf-unidad-grupo');
  refs.dxfUnidad = document.getElementById('dxf-unidad');
  refs.dxfMinLado = document.getElementById('dxf-min-lado');
  refs.btnImportarDXF = document.getElementById('btn-importar-dxf');

  refs.listaPiezas = document.getElementById('lista-piezas');
  refs.piezasVacio = document.getElementById('piezas-vacio');
  refs.contadorTotal = document.getElementById('contador-total');

  refs.btnCalcular = document.getElementById('btn-calcular');
  refs.btnLimpiar = document.getElementById('btn-limpiar');

  refs.radioModoRectangular = document.getElementById('modo-rectangular');
  refs.radioModoIrregular = document.getElementById('modo-irregular');
  refs.modoIrregularAviso = document.getElementById('modo-irregular-aviso');
  refs.tiempoMaximoGrupo = document.getElementById('tiempo-maximo-grupo');
  refs.tiempoMaximo = document.getElementById('tiempo-maximo');
  refs.progresoIrregular = document.getElementById('progreso-irregular');
  refs.progresoBarraRelleno = document.getElementById('progreso-barra-relleno');
  refs.progresoTexto = document.getElementById('progreso-texto');
  refs.btnDetenerIrregular = document.getElementById('btn-detener-irregular');

  refs.areaMensajes = document.getElementById('area-mensajes');

  refs.canvasWrap = document.getElementById('canvas-wrap');
  refs.canvas = document.getElementById('canvas-nesting');
  refs.canvasPlaceholder = document.getElementById('canvas-placeholder');
  refs.canvasIndicadores = document.getElementById('canvas-indicadores');
  refs.canvasControles = document.getElementById('canvas-controles');
  refs.btnZoomIn = document.getElementById('btn-zoom-in');
  refs.btnZoomOut = document.getElementById('btn-zoom-out');
  refs.btnZoomReset = document.getElementById('btn-zoom-reset');
  refs.btnPantallaCompleta = document.getElementById('btn-pantalla-completa');
  refs.indAprovechamiento = document.getElementById('ind-aprovechamiento');
  refs.indPiezas = document.getElementById('ind-piezas');
  refs.indPlanchas = document.getElementById('ind-planchas');
  refs.indArea = document.getElementById('ind-area');
  refs.kerfIcono = document.getElementById('kerf-icono');
  refs.indKerf = document.getElementById('ind-kerf');
  refs.piezasNoUbicadas = document.getElementById('piezas-no-ubicadas');
  refs.appHeader = document.getElementById('app-header');

  refs.seccionExportar = document.getElementById('seccion-exportar');
  refs.exportarFormatos = document.getElementById('exportar-formatos');
  refs.btnDescargar = document.getElementById('btn-descargar');

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

  const hayMaterial = piezas.some(p => p.material && p.material.trim());
  const tabla = refs.listaPiezas.closest('.tabla-piezas');
  if (tabla) tabla.classList.toggle('sin-material', !hayMaterial);

  if (piezas.length === 0) {
    refs.piezasVacio.style.display = 'block';
  } else {
    refs.piezasVacio.style.display = 'none';
    const ordenadas = [...piezas].sort((a, b) => (b.ancho * b.alto) - (a.ancho * a.alto));
    ordenadas.forEach(p => {
      const fila = document.createElement('tr');

      const tdNombre = document.createElement('td');
      tdNombre.className = 'col-nombre';
      tdNombre.textContent = p.nombre;

      const tdCantidad = document.createElement('td');
      tdCantidad.textContent = p.cantidad;

      const tdMedidas = document.createElement('td');
      tdMedidas.textContent = `${p.ancho} × ${p.alto} mm`;

      const tdMaterial = document.createElement('td');
      tdMaterial.className = 'col-material';
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
  refs.planchaAncho.value = 400;
  refs.planchaAlto.value = 400;
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

/**
 * Muestra u oculta el selector de unidad DXF según la extensión del archivo.
 * @param {string} extension - 'dxf' para mostrar, cualquier otro para ocultar
 */
export function actualizarSelectorUnidadDXF(extension) {
  if (extension === 'dxf') {
    refs.dxfUnidadGrupo.classList.remove('oculto');
  } else {
    refs.dxfUnidadGrupo.classList.add('oculto');
  }
}

/**
 * Devuelve el factor de escala elegido para el DXF importado.
 * 'auto' → null (el parser lee $INSUNITS), 'mm' → 1, 'cm' → 10, 'in' → 25.4
 * @returns {number|null}
 */
export function obtenerFactorEscalaDXF() {
  const val = refs.dxfUnidad?.value ?? 'auto';
  if (val === 'mm') return 1;
  if (val === 'cm') return 10;
  if (val === 'in') return 25.4;
  return null; // auto
}

/**
 * Devuelve el umbral mínimo de lado para filtrar piezas del DXF (en mm).
 * 0 = sin filtro.
 * @returns {number}
 */
export function obtenerUmbralMinimoDXF() {
  return parseFloat(refs.dxfMinLado?.value) || 0;
}

/**
 * Devuelve el margen configurado para los bordes de la plancha.
 * Si "Personalizar por lado" está activo, devuelve los 4 valores individuales.
 * Si no, aplica el margen general a los 4 lados.
 * @returns {{arriba: number, derecha: number, abajo: number, izquierda: number}}
 */
export function obtenerMargen() {
  if (refs.margenPersonalizado?.checked) {
    return {
      arriba:    parseFloat(refs.margenArriba.value)    || 0,
      derecha:   parseFloat(refs.margenDerecha.value)   || 0,
      abajo:     parseFloat(refs.margenAbajo.value)     || 0,
      izquierda: parseFloat(refs.margenIzquierda.value) || 0
    };
  }
  const g = parseFloat(refs.margenGeneral?.value) || 0;
  return { arriba: g, derecha: g, abajo: g, izquierda: g };
}

// ===================== Modo de nesting (rectangular / irregular) =====================

/**
 * Devuelve el modo de nesting seleccionado actualmente.
 * @returns {'rectangular'|'irregular'}
 */
export function obtenerModoNesting() {
  return refs.radioModoIrregular.checked ? 'irregular' : 'rectangular';
}

/**
 * Deshabilita la opción de nesting irregular (por ejemplo si SVGnest no
 * pudo cargarse) y muestra un aviso explicando por qué solo está
 * disponible el modo rectangular.
 * @param {string} mensaje
 */
export function deshabilitarModoIrregular(mensaje) {
  refs.radioModoIrregular.disabled = true;
  refs.radioModoRectangular.checked = true;
  refs.modoIrregularAviso.textContent = mensaje;
  refs.modoIrregularAviso.classList.remove('oculto');
  ocultarGrupoTiempoMaximo();
}

/**
 * Fuerza la selección del modo rectangular sin disparar el evento change.
 */
export function seleccionarModoRectangular() {
  refs.radioModoRectangular.checked = true;
  refs.radioModoIrregular.checked = false;
  ocultarGrupoTiempoMaximo();
}

/**
 * Devuelve el tiempo máximo de cálculo irregular configurado, en segundos.
 * @returns {number}
 */
export function obtenerTiempoMaximo() {
  return parseInt(refs.tiempoMaximo.value, 10) || 60;
}

/**
 * Muestra el selector de tiempo máximo (solo visible en modo irregular).
 */
export function mostrarGrupoTiempoMaximo() {
  refs.tiempoMaximoGrupo.classList.remove('oculto');
}

/**
 * Oculta el selector de tiempo máximo.
 */
export function ocultarGrupoTiempoMaximo() {
  refs.tiempoMaximoGrupo.classList.add('oculto');
}

/**
 * Cambia el texto del botón principal de cálculo ("Calcular nesting" en
 * modo rectangular, "Iniciar nesting" en modo irregular).
 * @param {string} texto
 */
export function actualizarTextoBotonCalcular(texto) {
  refs.btnCalcular.textContent = texto;
}

/**
 * Habilita o deshabilita el botón principal de cálculo (se deshabilita
 * mientras el nesting irregular está corriendo).
 * @param {boolean} habilitado
 */
export function habilitarBotonCalcular(habilitado) {
  refs.btnCalcular.disabled = !habilitado;
}

/**
 * Muestra la barra de progreso del nesting irregular, reiniciada en 0%.
 */
export function mostrarProgresoIrregular() {
  refs.progresoIrregular.classList.remove('oculto');
  actualizarProgresoIrregular(0);
}

/**
 * Oculta la barra de progreso del nesting irregular.
 */
export function ocultarProgresoIrregular() {
  refs.progresoIrregular.classList.add('oculto');
}

/**
 * Actualiza el porcentaje mostrado en la barra de progreso del nesting irregular.
 * @param {number} porcentaje - 0 a 100
 */
export function actualizarProgresoIrregular(porcentaje) {
  const valor = Math.min(100, Math.max(0, porcentaje || 0));
  refs.progresoBarraRelleno.style.width = `${valor}%`;
  refs.progresoTexto.textContent = `${valor}%`;
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
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;

  if (Array.isArray(pieza.vertices) && pieza.vertices.length >= 3) {
    // Forma irregular (nesting con SVGnest): dibuja el contorno real en vez
    // del rectángulo. Los vértices ya vienen en mm relativos a la plancha,
    // en el mismo sistema de coordenadas que pieza.x/pieza.y.
    ctx.beginPath();
    pieza.vertices.forEach((v, i) => {
      const vx = offsetXPlancha + v.x * factor;
      const vy = offsetYPlancha + v.y * factor;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(w - 1, 0), Math.max(h - 1, 0));
  }

  dibujarEtiquetaPieza(ctx, pieza, x, y, w, h);
}

/**
 * Dibuja todas las planchas de un resultado de nesting (sin zoom/pan, ya
 * aplicado por quien llama vía la transformación del contexto).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}} resultado
 * @param {{ancho: number, alto: number}} plancha
 * @param {number} anchoCss
 * @param {number} altoCss
 */
function dibujarPlanchas(ctx, resultado, plancha, anchoCss, altoCss) {
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

// ===================== Canvas: zoom y desplazamiento =====================

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 12;

let ultimoResultado = null;
let ultimaPlancha = null;
let zoomActual = 1;
let panX = 0;
let panY = 0;
let arrastrando = false;
let arrastreInicio = { x: 0, y: 0 };
let panAlIniciarArrastre = { x: 0, y: 0 };

/**
 * Vuelve a dibujar el último resultado de nesting aplicando el zoom y
 * desplazamiento (pan) actuales sobre el dibujo ya ajustado a la plancha.
 */
function dibujarNestingConTransform() {
  if (!ultimoResultado || !ultimaPlancha) return;
  const { ctx, anchoCss, altoCss } = prepararContexto(refs.canvas);
  ctx.clearRect(0, 0, anchoCss, altoCss);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoomActual, zoomActual);
  dibujarPlanchas(ctx, ultimoResultado, ultimaPlancha, anchoCss, altoCss);
  ctx.restore();
}

/**
 * Acerca o aleja manteniendo fijo el punto del canvas bajo (mouseX, mouseY).
 * @param {number} factor - multiplicador de zoom (>1 acerca, <1 aleja)
 * @param {number} mouseX - posición X relativa al canvas en píxeles CSS
 * @param {number} mouseY - posición Y relativa al canvas en píxeles CSS
 */
function aplicarZoom(factor, mouseX, mouseY) {
  if (!ultimoResultado) return;
  const nuevoZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomActual * factor));
  const factorReal = nuevoZoom / zoomActual;
  panX = mouseX - (mouseX - panX) * factorReal;
  panY = mouseY - (mouseY - panY) * factorReal;
  zoomActual = nuevoZoom;
  dibujarNestingConTransform();
}

function centroCanvas() {
  const rect = refs.canvas.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

function reiniciarZoomYPan() {
  zoomActual = 1;
  panX = 0;
  panY = 0;
}

/**
 * Inicializa los listeners de zoom (rueda), desplazamiento (arrastre),
 * reset, y pantalla completa sobre el canvas de nesting.
 */
function inicializarInteraccionCanvas() {
  refs.canvas.addEventListener('wheel', (ev) => {
    if (!ultimoResultado) return;
    ev.preventDefault();
    const rect = refs.canvas.getBoundingClientRect();
    const mouseX = ev.clientX - rect.left;
    const mouseY = ev.clientY - rect.top;
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    aplicarZoom(factor, mouseX, mouseY);
  }, { passive: false });

  refs.canvas.addEventListener('mousedown', (ev) => {
    if (!ultimoResultado) return;
    ev.preventDefault();
    arrastrando = true;
    arrastreInicio = { x: ev.clientX, y: ev.clientY };
    panAlIniciarArrastre = { x: panX, y: panY };
    refs.canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (ev) => {
    if (!arrastrando) return;
    panX = panAlIniciarArrastre.x + (ev.clientX - arrastreInicio.x);
    panY = panAlIniciarArrastre.y + (ev.clientY - arrastreInicio.y);
    dibujarNestingConTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!arrastrando) return;
    arrastrando = false;
    refs.canvas.style.cursor = ultimoResultado ? 'grab' : 'default';
  });

  refs.canvas.addEventListener('dblclick', () => {
    if (!ultimoResultado) return;
    reiniciarZoomYPan();
    dibujarNestingConTransform();
  });

  refs.btnZoomIn.addEventListener('click', () => {
    const c = centroCanvas();
    aplicarZoom(1.25, c.x, c.y);
  });

  refs.btnZoomOut.addEventListener('click', () => {
    const c = centroCanvas();
    aplicarZoom(1 / 1.25, c.x, c.y);
  });

  refs.btnZoomReset.addEventListener('click', () => {
    if (!ultimoResultado) return;
    reiniciarZoomYPan();
    dibujarNestingConTransform();
  });

  refs.btnPantallaCompleta.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      refs.canvasWrap.requestFullscreen?.().catch(() => {
        mostrarMensaje('No se pudo activar pantalla completa en este navegador.', 'error');
      });
    } else {
      document.exitFullscreen?.();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (ultimoResultado) {
      dibujarNestingConTransform();
    } else {
      dibujarGrillaVacia();
    }
  });
}

/**
 * Dibuja el resultado de calcularNesting(): una o varias planchas apiladas
 * verticalmente, cada una con sus piezas ubicadas a escala. Reinicia el
 * zoom/pan a su estado inicial (ajustado a la plancha) en cada cálculo nuevo.
 * @param {{ubicadas: Array, noUbicadas: Array, totalPlanchas: number}} resultado
 * @param {{ancho: number, alto: number}} plancha
 */
export function renderizarNesting(resultado, plancha) {
  ultimoResultado = resultado;
  ultimaPlancha = plancha;
  reiniciarZoomYPan();
  refs.canvas.style.cursor = 'grab';
  dibujarNestingConTransform();
}

// Kerf (mm) al que se le asigna el espacio visual máximo entre los dos
// rectángulos del ícono; valores mayores quedan topados a ese máximo.
const KERF_ICONO_MAX_MM = 0.5;
const KERF_ICONO_GAP_MAX_PX = 14;

/**
 * Ajusta el espacio entre los dos rectángulos del ícono de kerf de forma
 * proporcional al valor de kerf (0mm = rectángulos pegados, sin espacio).
 * @param {number} kerf
 */
function actualizarIconoKerf(kerf) {
  const proporcion = Math.min(Math.max(kerf, 0) / KERF_ICONO_MAX_MM, 1);
  const gapPx = Math.round(proporcion * KERF_ICONO_GAP_MAX_PX);
  refs.kerfIcono.style.gap = `${gapPx}px`;

  refs.indKerf.textContent = kerf > 0
    ? `Sangría: ${kerf}mm`
    : `Sangría: 0mm (sin sangría)`;
}


/**
 * Actualiza los indicadores numéricos sobre el canvas (aprovechamiento,
 * piezas ubicadas, planchas usadas, área usada/total, kerf) y los hace
 * visibles.
 * @param {object} estadisticas - resultado de calcularEstadisticas()
 * @param {number} totalPiezasOriginal - cantidad total de unidades cargadas
 * @param {number} kerf - sangría de corte usada en el cálculo, en mm
 */
export function actualizarIndicadoresNesting(estadisticas, totalPiezasOriginal, kerf) {
  refs.canvasPlaceholder.style.display = 'none';
  refs.canvasIndicadores.classList.remove('oculto');
  refs.appHeader.classList.add('oculto');

  refs.indAprovechamiento.textContent = `${estadisticas.aprovechamiento}%`;
  refs.indPiezas.textContent = `${estadisticas.piezasUbicadas}/${totalPiezasOriginal}`;
  refs.indPlanchas.textContent = `${estadisticas.totalPlanchas}`;
  refs.indArea.textContent = `${Math.round(estadisticas.areaUsada / 100)} / ${Math.round(estadisticas.areaTotal / 100)}`;
  actualizarIconoKerf(kerf);
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

  // Agrupar por categoría para dar contexto útil en vez de listar todo
  const microformas = noUbicadas.filter(p => p.ancho < 1 && p.alto < 1);
  const delgadas    = noUbicadas.filter(p => !(p.ancho < 1 && p.alto < 1) && Math.min(p.ancho, p.alto) < 5);
  const normales    = noUbicadas.filter(p => Math.min(p.ancho, p.alto) >= 5);

  let html = `<strong>No se pudieron ubicar ${noUbicadas.length} pieza(s):</strong>`;

  if (microformas.length) {
    html += `<br>• ${microformas.length} microforma(s) &lt;1mm — ruido del DXF (filtrá con "Filtrar menores a 1")`;
  }
  if (delgadas.length) {
    html += `<br>• ${delgadas.length} pieza(s) delgadas &lt;5mm — posibles ranuras/finger joints. Usá "Filtrar menores a 5" para ignorarlas`;
  }
  if (normales.length) {
    const muestra = normales.slice(0, 4).map(p => `${p.nombre} (${p.ancho}×${p.alto}mm)`).join(', ');
    const resto = normales.length > 4 ? ` … y ${normales.length - 4} más` : '';
    html += `<br>• ${normales.length} pieza(s) de tamaño normal: ${muestra}${resto}`;
  }

  refs.piezasNoUbicadas.innerHTML = html;
  refs.piezasNoUbicadas.classList.remove('oculto');
}

/**
 * Muestra un mensaje en el placeholder del canvas indicando que el cálculo
 * irregular está en curso y todavía no hay ninguna solución parcial.
 */
export function mostrarEstadoCalculandoIrregular() {
  refs.canvasPlaceholder.style.display = 'block';
  refs.canvasPlaceholder.textContent = 'Calculando… buscando primera solución';
}

/**
 * Vuelve el canvas a su estado vacío: oculta indicadores, aviso y la
 * sección de exportar, muestra el placeholder y redibuja la grilla de fondo.
 */
export function reiniciarCanvas() {
  refs.canvasIndicadores.classList.add('oculto');
  refs.canvasPlaceholder.style.display = 'block';
  refs.canvasPlaceholder.textContent = 'Cargá tus piezas y presioná Calcular';
  refs.piezasNoUbicadas.classList.add('oculto');
  refs.piezasNoUbicadas.innerHTML = '';
  refs.seccionExportar.classList.add('oculto');
  refs.appHeader.classList.remove('oculto');
  ultimoResultado = null;
  ultimaPlancha = null;
  reiniciarZoomYPan();
  refs.canvas.style.cursor = 'default';
  dibujarGrillaVacia();
}

/**
 * Muestra la sección de exportación (solo debe llamarse cuando hay un
 * nesting calculado disponible en window.ultimoNesting).
 */
export function mostrarSeccionExportar() {
  refs.seccionExportar.classList.remove('oculto');
  // Resetear selección de formato al mostrar (nuevo resultado de nesting)
  refs.exportarFormatos?.querySelectorAll('.btn-formato').forEach(b => b.classList.remove('activo'));
  if (refs.btnDescargar) refs.btnDescargar.disabled = true;
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
 * @param {(modo: 'rectangular'|'irregular') => void} callbacks.onCambiarModoNesting
 * @param {() => void} callbacks.onDetenerIrregular
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

  refs.margenPersonalizado.addEventListener('change', () => {
    if (refs.margenPersonalizado.checked) {
      // Inicializar los campos individuales con el valor general actual
      const g = parseFloat(refs.margenGeneral.value) || 0;
      refs.margenArriba.value = g;
      refs.margenDerecha.value = g;
      refs.margenAbajo.value = g;
      refs.margenIzquierda.value = g;
      refs.margenLadosGrupo.classList.remove('oculto');
    } else {
      refs.margenLadosGrupo.classList.add('oculto');
    }
  });

  refs.btnImportar.addEventListener('click', () => {
    refs.inputArchivo.click();
  });

  refs.inputArchivo.addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    mostrarNombreArchivo(file.name);
    const ext = file.name.split('.').pop().toLowerCase();
    actualizarSelectorUnidadDXF(ext);
    if (ext === 'dxf') {
      // DXF: mostrar selector y esperar confirmación manual
      callbacks.onArchivoSeleccionado(file);
    } else {
      callbacks.onImportarArchivo(file);
    }
    refs.inputArchivo.value = '';
  });

  refs.btnImportarDXF?.addEventListener('click', () => {
    callbacks.onImportarDXF();
  });

  refs.dxfUnidad?.addEventListener('change', () => {
    callbacks.onCambiarUnidadDXF?.();
  });

  refs.btnCalcular.addEventListener('click', () => {
    callbacks.onCalcular();
  });

  refs.btnLimpiar.addEventListener('click', () => {
    callbacks.onLimpiarTodo();
  });

  refs.radioModoRectangular.addEventListener('change', () => {
    if (refs.radioModoRectangular.checked) callbacks.onCambiarModoNesting('rectangular');
  });
  refs.radioModoIrregular.addEventListener('change', () => {
    if (refs.radioModoIrregular.checked) callbacks.onCambiarModoNesting('irregular');
  });

  refs.btnDetenerIrregular.addEventListener('click', () => {
    callbacks.onDetenerIrregular();
  });

  refs.exportarFormatos.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-formato');
    if (!btn) return;
    refs.exportarFormatos.querySelectorAll('.btn-formato').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    refs.btnDescargar.disabled = false;
  });
  refs.btnDescargar.addEventListener('click', () => {
    const activo = refs.exportarFormatos.querySelector('.btn-formato.activo');
    if (activo) callbacks.onDescargar(activo.dataset.formato);
  });

  refs.btnAyuda.addEventListener('click', abrirModalAyuda);
  refs.btnCerrarAyuda.addEventListener('click', cerrarModalAyuda);
  refs.modalAyuda.addEventListener('click', (ev) => {
    if (ev.target === refs.modalAyuda) cerrarModalAyuda();
  });

  inicializarInteraccionCanvas();

  reiniciarCanvas();
  mostrarMensaje('Listo para cargar piezas.', 'info');
}
