# NestingApp — Contexto del Proyecto

## Qué es esto
App web de nesting para corte láser. El usuario final es un operador de máquina láser que necesita optimizar cómo acomoda piezas dentro de una plancha de material para desperdiciar lo menos posible.

No es un SaaS, no tiene backend, no tiene base de datos. Todo corre en el browser. Se deploya como sitio estático en Cloudflare Pages.

## Stack

* HTML + CSS + JS vanilla. Sin frameworks, sin bundlers, sin npm.
* Librerías externas via CDN únicamente:
   * SheetJS (`xlsx`) para leer y escribir Excel/CSV
   * jsPDF para exportar PDF
* Canvas HTML5 para la visualización del nesting
* Sin TypeScript, sin React, sin Vite, sin Node

## Estructura de archivos

```
/
├── index.html          # App completa, una sola página
├── style.css           # Estilos globales
├── app.js              # Inicialización y coordinación entre módulos
└── modules/
    ├── ui.js           # Manejo del DOM, eventos, mensajes de error/éxito
    ├── piezas.js       # Modelo de datos, importación de archivos
    ├── nesting.js      # Algoritmo de bin packing y lógica de cálculo
    └── exportar.js     # Exportación a SVG, PDF, PNG, DXF, Excel
```

## Modelo de datos

Una pieza siempre tiene esta forma:

```js
{
  id: string,        // generado automáticamente (uuid simple)
  nombre: string,
  cantidad: number,
  ancho: number,     // en mm
  alto: number,      // en mm
  material: string   // opcional
}
```

Una plancha tiene esta forma:

```js
{
  ancho: number,     // en mm
  alto: number       // en mm
}
```

El output del nesting es:

```js
[
  {
    plancha: number,   // índice de plancha (0, 1, 2...)
    piezaId: string,
    nombre: string,
    x: number,        // posición en mm desde esquina superior izquierda
    y: number,
    ancho: number,
    alto: number,
    rotada: boolean   // si el algoritmo la rotó 90°
  }
]
```

## Fases de desarrollo

### Fase 1 — UI base ✅
Layout dos paneles: izquierdo para carga de piezas, derecho para canvas. Formulario de carga manual. Lista de piezas. Campo de tamaño de plancha. Sin lógica todavía.

### Fase 2 — Importación de archivos
* CSV y Excel con SheetJS
* SVG: parsear `<rect>` y `<path>` simples
* DXF: parsear entidades `LWPOLYLINE` y `LINE`

### Fase 3 — Motor de nesting
Algoritmo FFDH (First Fit Decreasing Height) para rectángulos. Soporte de rotación 90°. Múltiples planchas si no entra todo. Visualización en canvas con colores por pieza, etiquetas, % de aprovechamiento.

### Fase 4 — Exportación
* SVG limpio (para mandar a la láser)
* PDF con jsPDF
* PNG del canvas
* DXF con entidades LWPOLYLINE
* Excel con SheetJS

## Decisiones técnicas importantes

¿Por qué vanilla JS? El usuario final puede que abra esto desde cualquier lado. Sin build step, sin dependencias que romper, fácil de mantener.

¿Por qué todo en el browser? Cero costo de hosting, cero backend que mantener, funciona offline si hace falta.

¿Por qué no SVGnest para irregulares? Fuera del scope de v1. Si se implementa en el futuro, va como módulo opcional sin tocar el resto.

Unidades: todo internamente en mm. El canvas escala para visualización pero los datos siempre son mm reales.

DWG y RVT: fuera de scope permanente. Son formatos propietarios de Autodesk. Si el cliente tiene archivos en esos formatos, debe exportarlos como DXF o SVG desde su programa.

## Reglas de código

* Cada módulo exporta funciones puras donde sea posible
* `ui.js` es el único que toca el DOM directamente
* `nesting.js` no sabe nada de DOM ni de archivos, solo recibe arrays y devuelve arrays
* `exportar.js` recibe el output de nesting y genera descargas, sin side effects en la UI
* Errores siempre visibles en la interfaz, nunca solo en consola
* Comentarios en español

## Estética

Diseño oscuro, denso, técnico. Como software industrial real, no como landing page. Sin bordes redondeados exagerados, sin gradientes decorativos, sin animaciones innecesarias. El canvas es el protagonista visual. Tipografía monoespaciada para números y medidas.

## Lo que NO hacer

* No agregar librerías que no estén listadas arriba sin preguntar
* No crear archivos adicionales fuera de la estructura definida
* No usar `alert()` ni `confirm()` del browser, toda la UI de feedback va en el DOM
* No inventar features fuera de las 4 fases
* No usar `localStorage` para persistir datos entre sesiones (v1 es stateless)
