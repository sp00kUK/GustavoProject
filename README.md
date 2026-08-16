# Generador y Grabador Paramétrico de Cilindros (Cylindrical Pattern Debosser)

Convierte arte 2D en relieves cilíndricos negativos imprimibles en 3D — rodillos de textura para escenografía y wargames, rodillos de arcilla y cerámica, sellos, empuñaduras y moldes cilíndricos.

Todo se ejecuta directamente en el navegador. Sin cuentas, sin backend y sin subir archivos a servidores externos: tu diseño artístico y tus modelos 3D nunca salen de tu máquina.

---

## Guía de Inicio Rápido (Quickstart)

```bash
# 1. Clonar el repositorio
git clone https://github.com/sp00kUK/GustavoProject.git
cd GustavoProject

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor local de desarrollo
npm run dev        # http://localhost:5173

# Comandos de verificación y compilación:
npm run test       # Ejecuta la suite de pruebas unitarias y validación geométrica (Vitest)
npm run build      # Compila TypeScript y empaqueta la aplicación web para producción en dist/
npm run fixtures   # Genera los archivos STL de referencia y prueba geométrica en fixtures-out/
```

---

## La idea fundamental en la que se basa este proyecto

**No sustraigas una textura de un cilindro mediante operaciones booleanas. Genera directamente el cilindro texturizado.**

El enfoque habitual —restar mediante operaciones booleanas (CSG) miles de pequeños sólidos de un cilindro base— es exactamente lo que esta herramienta evita. Las operaciones CSG repetidas sobre mallas detalladas generan bordes no conformes (non-manifold), caras coplanares, normales invertidas, triángulos de área cero y autointersecciones, además de ser lo suficientemente lentas como para bloquear la pestaña del navegador.

En este sistema, el radio exterior final es una **función matemática directa** de la posición:

```
theta = 2 * pi * u
y     = -H/2 + H * v
mask  = pattern(u, v)              0 = intacto, 1 = profundidad total
r     = R - depth * mask           (R + depth * mask al grabar en relieve positivo/emboss)

x = r * cos(theta)
z = r * sin(theta)
```

La superficie se emite directamente a ese radio y luego se cierra con tapas terminales reales y una pared interior para el eje. **No hay operaciones CSG en ninguna parte del pipeline.** Por eso el sistema es capaz de generar millones de triángulos en milisegundos y los archivos exportados son 100% cerrados y herméticos (*watertight / 2-manifold*) por construcción, sin requerir reparaciones posteriores.

---

## Convención de la Máscara de Grabado

```
BLANCO (255)  ->  máscara 0    ->  radio = R              superficie base intacta
NEGRO (0)     ->  máscara 1    ->  radio = R - depth      profundidad máxima tallada
Gris 50%      ->  máscara 0.5  ->  mitad de profundidad
```

La relación es `máscara = 1 - luminosidad`, por lo que las zonas oscuras se tallan hacia el interior. El botón **Invertir (Invert)** intercambia la polaridad instantáneamente, eliminando la necesidad de reeditar imágenes en programas externos.

La luminosidad se calcula siguiendo el estándar Rec.709 (`0.2126R + 0.7152G + 0.0722B`) sobre sRGB normalizado. Los píxeles transparentes se componen sobre fondo blanco antes del cálculo, de modo que un píxel negro transparente se interpreta como superficie intacta y no como un pozo profundo.

---

## Sistema de Coordenadas

| Entorno | Sistema de Coordenadas |
|---|---|
| **Kernel / Visor 3D** | **El eje Y es el eje del cilindro**, X/Z es el plano radial, `theta = atan2(z, x)`, modelo centrado en el origen `(0, 0, 0)`. |
| **Archivos Exportados** | **Z-up (Z hacia arriba)**, alineado con el estándar de los laminadores/slicers 3D. |

La función `orientMesh` realiza la conversión entre ambos sistemas mediante rotaciones ortogonales puras ($\det = +1$), preservando la orientación del bobinado de los triángulos y las normales hacia el exterior. La pieza exportada se traslada automáticamente para que su punto más bajo descanse exactamente en $Z = 0$.

---

## Los Dos Generadores de Relieve

### 1. Relieve Continuo (`grayscaleRelief.ts`)

Genera una malla regular de `Nu x (Nv+1)` vértices, con un vértice por muestra y el radio modulado directamente por la máscara. Incluye cálculo de normales suaves. Es el modo óptimo para mapas de elevación, superficies de piedra, erosión y relieves orgánicos.

La circunferencia se cierra de forma **aritmética** (`(i + 1) % Nu`). No existen columnas de costura duplicadas, garantizando una unión perfecta a 0°/360° sin discontinuidades por redondeo de coma flotante.

### 2. Relieve Binario Nítido (`binaryRelief.ts`)

La superficie se estructura como una cuadrícula de celdas en `(theta, y)`. Cada celda se ubica exactamente en uno de dos radios posibles, y las celdas adyacentes con niveles distintos se conectan mediante una **pared vertical real**:

* Celda base → `r = R`
* Celda de relieve → `r = R - depth`
* Discrepancia en límite $\theta$ → Pared radial en un plano axial.
* Discrepancia en límite $y$ → Pared anular en un plano horizontal.

El resultado ofrece un fondo de cavidad completamente plano, un borde superior recto y un escalón vertical nítido: un auténtico grabado de precisión.

Para garantizar la estanqueidad (*manifoldness*) se solucionaron tres retos geométricos:
1. **Reducción de Triángulos**: Cada columna angular se fusiona verticalmente mediante *run-length encoding* (RLE). Un rodillo liso colapsa a solo 2 triángulos por columna. Un tablero de 8×10 en un rodillo de 50×100 mm a calidad Alta genera ~29,500 triángulos en lugar de 1.3 millones.
2. **Eliminación de T-Junctions**: Las cadenas laterales compartidas entre columnas vecinas se subdividen en cada transición de nivel de la columna adyacente, eliminando microhuecos.
3. **Corrección de Estrangulamientos Diagonales (*Pinches*)**: Donde dos celdas del mismo nivel se tocan únicamente por una esquina, una celda diagonal se rellena al nivel base para preservar una topología 2-manifold válida.

### Tapas Terminales y Collarín (`endCaps.ts`)
Para evitar discontinuidades donde el grabado llega a los extremos superior o inferior, el borde se conecta primero a un **anillo de collarín** regular al radio mínimo presente, y este anillo plano se une limpiamente con el orificio central.

### Orificio Central / Eje (`bore.ts`)
Geometría cilíndrica interior real (no una sustracción booleana). Las normales apuntan hacia el eje central ("hacia afuera del material"), garantizando compatibilidad total con laminadores 3D.

---

## Orden de Transformación UV

El orden de aplicación es estricto y determinista:

```
 1. UV Cilíndrico       u alrededor del perímetro [0, 1], v a lo largo de la altura útil [0, 1]
 2. Repetición          tu = u * columnas,  tv = v * filas
 3. Escalonado          Desplazamiento horizontal en filas alternas (patrones entrelazados)
 4. UV Local de Celda   pu = frac(tu), pv = frac(tv)
 5. Escala              Escalado relativo al centro de la celda
 6. Rotación            Rotación angular sobre el centro de la celda
 7. Desplazamiento      Offset (X, Y) dentro de la celda
 8. Espejo              Inversión por eje (Horizontal / Vertical)
 9. Ajuste de Celda     Stretch (estirar), Fit (ajustar) o Fill (rellenar)
10. Muestreo            Nearest neighbour (binario) o bilineal (grises), con envoltura circular continua
```

---

## Calidad y Resolución

La resolución se define por **espaciado físico de muestreo en milímetros**, permitiendo un control intuitivo adaptado a la impresión 3D:

| Perfil de Calidad | Espaciado de Muestreo |
|---|---|
| **Draft (Borrador)** | 1.00 mm |
| **Standard (Estándar)** | 0.50 mm |
| **High (Alta)** | 0.25 mm |
| **Ultra (Máxima)** | 0.15 mm |

```
radialSegments   = ceil(pi * D / espaciado)
verticalSegments = ceil(H / espaciado)
```

La calidad de previsualización en pantalla y la de exportación son independientes.

---

## Validación Geométrica Automática

Cada generación se somete a una auditoría estricta antes de declararse lista para exportar:
1. **Cada arista no dirigida es compartida por exactamente 2 triángulos** (garantía de malla cerrada sin huecos ni auto-toques).
2. **Cada arista dirigida aparece exactamente 1 vez** (orientación y bobinado consistente en toda la superficie).
3. **Volumen con signo positivo** (la carcasa no está invertida).
4. **Sin caras de área cero, sin coordenadas NaN o infinitas, sin vértices aislados.**
5. **Verificación de espesor seguro**: Si `R - depth` interseca el orificio central, la exportación se bloquea indicando la profundidad máxima segura y ofreciendo un botón de corrección automática.

---

## Arquitectura del Código

```
src/
  types/          Definiciones TypeScript y la interfaz PatternSampler
  geometry/       Kernel de geometría puro (sin dependencias de React, Three.js o DOM)
    mesh/           MeshBuilder (indexación entera de vértices), operaciones de malla
    cylinder/       Tapas terminales y orificio interior
    relief/         Generadores binario y continuo, campo de relieve
    validation/     Auditoría geométrica manifold
    normals/        Cálculo de normales con detección de aristas vivas (creased normals)
    constraints.ts  Cálculo de espesor de pared y profundidad máxima segura
    quality.ts      Cálculo de segmentos y estimación de triángulos / peso de archivo
  pattern/        Procesamiento de imagen, muestreadores, patrones procedurales, análisis de costura
  exporters/      Generadores de STL binario y 3MF nativo (empaquetado ZIP OPC)
  workers/        Web Worker dedicado, cliente con control de versiones y cancelación
  state/          Store global con Zustand y persistencia en localStorage
  viewport/       Visor 3D interactivo con Three.js
  components/     Paneles de control, configuración, información y diálogos
  i18n/           Diccionarios en Español e Inglés
```

---

## Guía de Integración (React / Electron / Node.js)

El proyecto está diseñado de forma modular para permitir extraer o integrar el motor geométrico y el visor 3D en aplicaciones externas:

### 1. Kernel Geométrico Headless (TypeScript Puro)

El núcleo en `src/geometry/` es independiente de la interfaz gráfica y puede ejecutarse en Node.js, procesos principales de Electron o scripts automatizados:

```ts
import { generateCylinderRelief } from './src/geometry/generateCylinderRelief';
import { checkerboardSampler } from './src/pattern/procedural';
import { writeBinarySTL } from './src/exporters/stl';

// Generar geometría cilíndrica hermética
const result = generateCylinderRelief({
  cylinder: {
    diameter: 50,     // 50 mm de diámetro exterior
    height: 100,      // 100 mm de altura
    boreEnabled: true,
    boreDiameter: 8,  // 8 mm de orificio interior para eje
  },
  relief: {
    depth: 2,         // 2 mm de profundidad de grabado
    direction: 'deboss',
    edgeTreatment: 'sharp',
    edgeSoftness: 0,
    bottomMargin: 2,  // 2 mm de margen liso de seguridad en la base
    topMargin: 2,
  },
  mode: 'binary',     // 'binary' para paredes rectas o 'grayscale' para relieve suave
  sampler: checkerboardSampler(8, 10),
  resolution: {
    radialSegments: 315,
    verticalSegments: 200,
  },
  audit: true,        // Ejecuta auditoría geométrica 2-manifold
});

// Serializar directamente a un buffer STL binario (1 unidad = 1 mm, Z-up)
const stlBytes = writeBinarySTL(result.mesh, 'rodillo');
```

### 2. Pipeline con Web Worker (Sin Bloqueo de UI)

```ts
import { MeshWorkerClient } from './src/workers/MeshWorkerClient';

const workerClient = new MeshWorkerClient(() => {
  return new Worker(
    new URL('./src/workers/mesh.worker.ts', import.meta.url),
    { type: 'module' }
  );
});

// Solicitar generación asíncrona con cancelación automática y caché de cálculo
workerClient.requestPreview({
  cylinder,
  relief,
  pattern,
  transform,
  tiling,
  resolution,
  onSuccess: (mesh, stats, issues) => {
    console.log(`Generados ${stats.triangleCount} triángulos en ${stats.buildTimeMs} ms`);
  },
  onError: (err) => console.error(err),
});
```

### 3. Componente de Visor 3D para React

```tsx
import React from 'react';
import { Viewport } from './src/viewport/Viewport';

export function MiApp3D() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Viewport />
    </div>
  );
}
```

---

## Guía Rápida de Parámetros (Para Gustavo)

¡Bienvenido, Gustavo! Aquí tienes un resumen claro y directo de todos los controles de la aplicación para que puedas empezar a diseñar de inmediato:

### 1. Dimensiones del Cilindro (*Cylinder*)
* **Diámetro ($D$)**: Diámetro exterior del rodillo en milímetros (ej. 50 mm).
* **Altura ($H$)**: Longitud total del rodillo en milímetros (ej. 100 mm).
* **Orificio Central (*Bore*)**: Diámetro del agujero central para insertar una varilla, eje o rodamiento. Si se desmarca la casilla, se genera un cilindro macizo.
* **Márgenes (*Margins*)**: Franja lisa superior e inferior en milímetros para evitar que el grabado llegue al borde exacto si necesitas apoyo para rodamientos.

### 2. Modos de Relieve (*Relief Mode*)
* **Binario (*Binary*)**: Crea un grabado nítido con paredes 100% verticales y suelo plano. Es el modo perfecto para rodillos de texturas de escenografía (ladrillos, adoquines, runas, tablas de madera, mallas metálicas) y sellos de arcilla.
* **Escala de Grises (*Grayscale*)**: Modula la profundidad de forma suave y continua según el tono del píxel. Ideal para texturas de terreno natural, roca, olas, cuero o piel orgánica.

### 3. Profundidad y Polaridad (*Depth & Polarity*)
* **Profundidad (*Depth*)**: Milímetros que penetra el relieve. La aplicación te avisa y protege automáticamente para no perforar el orificio central.
* **Dirección**:
  * **Deboss (Hundido)**: Talla hacia adentro de la superficie base ($R - \text{depth}$).
  * **Emboss (En relieve)**: Sobresale hacia afuera de la superficie base ($R + \text{depth}$).
* **Invertir (*Invert*)**: 
  * Por defecto: **Negro = grabado profundo**; **Blanco = superficie exterior intacta**.
  * Si tu diseño tiene los colores al revés, activa este botón en lugar de editar el archivo.

### 4. Repetición y Posicionamiento UV (*Tiling & Placement*)
* **Columnas / Filas (*Columns / Rows*)**: Cuántas veces se repite el dibujo alrededor de la circunferencia y a lo largo de la altura.
* **Escalonado (*Stagger*)**: Desplaza filas alternas para crear tramas entrelazadas (típico aparejo de ladrillos o patrón panal).
* **Rotación y Desplazamiento**: Permite girar y centrar el motivo con precisión milimétrica.

### 5. Exportación e Impresión 3D
* **Formatos Disponibles**:
  * **STL Binario**: Máxima compatibilidad con cualquier laminador (escala 1 unidad = 1 mm).
  * **3MF**: Formato moderno y compacto con metadatos XML completos.
* **Orientación Z-up**: Se exporta de pie sobre la base ($Z = 0$), listo para colocar en la cama de impresión sin tener que rotar la pieza manualmente.
* **Compatibilidad Total**: Compatible de forma directa con **Bambu Studio, OrcaSlicer, PrusaSlicer y Cura** sin avisos de mallas no conformes ni necesidad de reparación.

---

## Formatos de Exportación

* **STL Binario**: Encabezado de 80 bytes, recuento de triángulos uint32 y 50 bytes por faceta con cálculo de normales desde la geometría.
* **3MF**: Paquete OPC nativo con compresión zip (`[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`) mediante la API estándar `CompressionStream`.

---

## Pruebas y Validación

```bash
npm run test       # Ejecuta 66 tests con Vitest
npm run fixtures   # Genera 9 piezas STL de referencia en fixtures-out/
```

Las pruebas cubren precisión dimensional, polaridad de máscaras, continuidad en la costura 0°/360°, integridad de orificios, empaquetado STL/3MF y pruebas de propiedades aleatorias (*property-based testing*).

---

## Licencia y Créditos

Desarrollado como una solución de ingeniería geométrica de alto rendimiento para diseño y fabricación aditiva de rodillos y sellos cilíndricos.
