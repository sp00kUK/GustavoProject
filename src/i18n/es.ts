import type { Dictionary } from './en';

/**
 * Spanish. Terminology follows what Spanish-speaking makers actually say:
 * "boquilla" for nozzle, "laminador" for slicer, "rodillo" for roller,
 * "grabado en hueco" for debossing and "en relieve" for embossing.
 */
export const es: Dictionary = {
  'app.title': 'Grabador de Patrones Cilíndricos',
  'app.subtitle': 'Generador paramétrico de patrones para rodillos imprimibles',
  'app.privacy': 'Tu patrón permanece en este equipo; el modelo se genera en el navegador.',
  'app.untitled': 'Rodillo sin título',

  'action.new': 'Nuevo',
  'action.save': 'Guardar',
  'action.load': 'Abrir',
  'action.export': 'Exportar',
  'action.cancel': 'Cancelar',
  'action.close': 'Cerrar',
  'action.apply': 'Aplicar',
  'action.reset': 'Restablecer',
  'action.resetPattern': 'Restablecer patrón',
  'action.resetCamera': 'Restablecer cámara',
  'action.resetSettings': 'Restablecer ajustes',
  'action.fitModel': 'Encuadrar',
  'action.undo': 'Deshacer',
  'action.redo': 'Rehacer',
  'action.loadExample': 'Cargar ejemplo',
  'action.removePattern': 'Quitar',
  'action.openVectorMagic': 'Vectorizar automáticamente con Vector Magic',
  'action.copyDebug': 'Copiar info de depuración',
  'action.copied': 'Copiado',
  'action.setMaxDepth': 'Usar la profundidad máxima segura',
  'action.generateAnyway': 'Generar de todos modos',
  'action.useHigh': 'Usar calidad Alta',
  'action.dismiss': 'Entendido',

  'section.cylinder': 'Cilindro',
  'section.pattern': 'Patrón',
  'section.repeat': 'Repetición',
  'section.transform': 'Transformación',
  'section.adjust': 'Ajustes de imagen',
  'section.relief': 'Relieve',
  'section.quality': 'Calidad',
  'section.export': 'Exportación',
  'section.summary': 'Dimensiones',
  'section.validation': 'Validación',
  'section.debug': 'Depuración',

  'field.projectName': 'Nombre del proyecto',
  'field.diameter': 'Diámetro',
  'field.height': 'Altura',
  'field.boreEnabled': 'Orificio para eje',
  'field.boreDiameter': 'Diámetro del orificio',
  'field.preset': 'Preajuste',
  'field.mode': 'Modo',
  'field.invert': 'Invertir patrón',
  'field.threshold': 'Umbral',
  'field.despeckle': 'Quitar motas',
  'field.brightness': 'Brillo',
  'field.contrast': 'Contraste',
  'field.gamma': 'Gamma',
  'field.blackPoint': 'Punto negro',
  'field.whitePoint': 'Punto blanco',
  'field.blur': 'Desenfoque',
  'field.quantize': 'Cuantizar',
  'field.tileFit': 'Ajuste del mosaico',
  'field.columns': 'Columnas',
  'field.rows': 'Filas',
  'field.offsetX': 'Desplazamiento horizontal',
  'field.offsetY': 'Desplazamiento vertical',
  'field.scaleX': 'Escala horizontal',
  'field.scaleY': 'Escala vertical',
  'field.rotation': 'Rotación',
  'field.mirrorX': 'Reflejar horizontalmente',
  'field.mirrorY': 'Reflejar verticalmente',
  'field.stagger': 'Desfase de fila',
  'field.staggerMode': 'Desfase',
  'field.depth': 'Profundidad',
  'field.direction': 'Dirección',
  'field.edgeTreatment': 'Bordes de la cavidad',
  'field.edgeSoftness': 'Suavizado de bordes',
  'field.topMargin': 'Margen superior',
  'field.bottomMargin': 'Margen inferior',
  'field.previewQuality': 'Calidad de vista previa',
  'field.exportQuality': 'Calidad de exportación',
  'field.customSpacing': 'Espaciado de muestreo',
  'field.format': 'Formato',
  'field.orientation': 'Orientación',
  'field.language': 'Idioma',
  'field.lockAspect': 'Conservar la proporción del patrón',

  'option.binary': 'Binario (borde nítido)',
  'option.grayscale': 'Escala de grises (mapa de altura)',
  'option.deboss': 'En hueco (grabar hacia dentro)',
  'option.emboss': 'En relieve (elevar hacia fuera)',
  'option.sharp': 'Nítido',
  'option.soft': 'Ligeramente redondeado',
  'option.stretch': 'Estirar',
  'option.fit': 'Encajar',
  'option.fill': 'Rellenar',
  'option.staggerNone': 'Ninguno',
  'option.staggerAlternate': 'Filas alternas',
  'option.staggerEvery': 'Todas las filas',
  'option.draft': 'Borrador',
  'option.standard': 'Estándar',
  'option.high': 'Alta',
  'option.ultra': 'Ultra',
  'option.custom': 'Personalizada',
  'option.vertical': 'Vertical (de pie)',
  'option.horizontalX': 'Horizontal, sobre X',
  'option.horizontalY': 'Horizontal, sobre Y',

  'preset.smallTerrain': 'Rodillo de terreno pequeño',
  'preset.standardTerrain': 'Rodillo de terreno estándar',
  'preset.largeClay': 'Rodillo grande para arcilla',
  'preset.grip': 'Funda para mango de herramienta',
  'preset.stamp': 'Cilindro para sellos',
  'preset.customLabel': 'Personalizado',

  'pattern.dropHere': 'Arrastra el diseño aquí, o haz clic para elegir un archivo',
  'pattern.formats': 'PNG, JPG, WEBP o SVG',
  'pattern.source': 'Origen',
  'pattern.original': 'Original',
  'pattern.processed': 'Procesado',
  'pattern.tilePreview': 'Vista previa del mosaico',
  'pattern.tileSize': 'Tamaño del mosaico',
  'pattern.examples': 'Patrones de ejemplo',
  'pattern.none': 'No hay ningún patrón cargado',
  'pattern.vectorMagicProgress': 'Vectorizando automáticamente con Vector Magic…',
  'pattern.vectorMagicImported':
    'El SVG exportado por Vector Magic es ahora el patrón activo.',

  'view.solid': 'Sólido',
  'view.wireframe': 'Malla',
  'view.normals': 'Normales',
  'view.mask': 'Máscara del patrón',
  'view.heatmap': 'Mapa de profundidad',
  'view.front': 'Frente',
  'view.back': 'Detrás',
  'view.left': 'Izquierda',
  'view.right': 'Derecha',
  'view.top': 'Arriba',
  'view.bottom': 'Abajo',
  'view.iso': 'Isométrica',

  'summary.diameter': 'Diámetro',
  'summary.height': 'Altura',
  'summary.circumference': 'Circunferencia',
  'summary.reliefDepth': 'Profundidad del relieve',
  'summary.minRadius': 'Radio mínimo',
  'summary.maxRadius': 'Radio máximo',
  'summary.bore': 'Orificio',
  'summary.minWall': 'Espesor mínimo de pared',
  'summary.tileSize': 'Tamaño del mosaico del patrón',
  'summary.bounds': 'Dimensiones del modelo',
  'summary.triangles': 'Triángulos',
  'summary.vertices': 'Vértices',
  'summary.estimatedStl': 'STL estimado',
  'summary.sampling': 'Muestreo de superficie',
  'summary.segments': 'Segmentos',
  'summary.none': '—',

  'status.idle': 'Listo',
  'status.preview': 'Vista previa',
  'status.generating': 'Generando',
  'status.valid': 'Válido',
  'status.warning': 'Advertencia',
  'status.invalid': 'No válido',
  'status.exporting': 'Exportando',
  'status.modelReady': 'Modelo listo',

  'stage.pattern': 'Preparando el patrón',
  'stage.surface': 'Generando la topología cilíndrica',
  'stage.caps': 'Cerrando las tapas',
  'stage.cleanup': 'Limpiando la geometría',
  'stage.validation': 'Validando la malla',
  'stage.writing': 'Escribiendo el archivo',
  'stage.done': 'Terminado',

  'validation.closed': 'Malla cerrada',
  'validation.winding': 'Normales coherentes hacia fuera',
  'validation.degenerate': 'Sin caras degeneradas',
  'validation.wall': 'Espesor de pared válido',
  'validation.dimensions': 'Dimensiones válidas',
  'validation.ready': 'Listo para exportar',
  'validation.pending': 'Todavía sin generar',

  'warning.nyquist':
    'El patrón tiene más detalle del que puede representar la resolución de malla actual. Aumenta el Detalle de malla para exportar con más nitidez.',
  'warning.lowRes':
    'Patrón de baja resolución. Los detalles finos pueden verse pixelados en la geometría generada.',
  'warning.seam': 'Esta imagen puede mostrar costuras visibles al repetirse.',
  'warning.thinFeature':
    'Los relieves de menos de unos 0,4 mm pueden no reproducirse con nitidez con una boquilla típica de 0,4 mm. Las impresoras de resina admiten mucho más detalle.',
  'warning.deepCavity':
    'Las cavidades muy profundas y estrechas pueden ser difíciles de imprimir con limpieza y de desmoldar de la arcilla.',
  'warning.largeImage':
    'Esta imagen es de {width} x {height} píxeles y puede requerir mucha memoria. Se ha reducido a {target} px para procesarla.',
  'warning.largeExport':
    'La calidad {quality} generará aproximadamente {triangles} triángulos ({size}) y puede requerir mucha memoria. ¿Continuar?',
  'warning.noPattern': 'Carga un patrón para grabar. Ahora mismo el rodillo está liso.',

  'error.title': 'Algo ha fallado',
  'error.exportFailed':
    'No se ha podido generar la exportación con calidad {quality}.\n\nPrueba a:\n• bajar la calidad de exportación\n• reducir las repeticiones del patrón\n• usar una imagen de menor resolución',
  'error.decodeFailed': 'No se ha podido leer ese archivo como imagen.',
  'error.svgFailed': 'No se ha podido rasterizar ese SVG.',
  'error.vectorMagicNotInstalled':
    'No se ha encontrado Vector Magic Desktop. Añádelo en vendor/vector-magic, define VECTOR_MAGIC_EXE o instálalo en Program Files y reinicia el servidor local.',
  'error.vectorMagicAlreadyRunning':
    'Cierra la ventana existente de Vector Magic Desktop y vuelve a intentarlo.',
  'error.vectorMagicBridge': 'La integración con Vector Magic Desktop ha fallado: {message}',
  'error.unsupportedFile':
    '{name} no es un formato admitido. Usa PNG, JPG, WEBP o SVG.',
  'error.webgl':
    'Este navegador no ha podido iniciar WebGL. La vista previa 3D necesita WebGL2: prueba con una versión actual de Chrome, Edge o Firefox.',
  'error.cancelled': 'Cancelado',

  'tooltip.diameter':
    'Diámetro exterior del cuerpo del rodillo sin grabar. El patrón se graba hacia dentro desde esta superficie.',
  'tooltip.height': 'Altura total del rodillo a lo largo de su eje.',
  'tooltip.bore':
    'Un orificio que atraviesa toda la altura del rodillo, para un eje o un mango. Es geometría real, no una forma restada.',
  'tooltip.columns':
    'Número de veces que el patrón se repite alrededor de toda la circunferencia del cilindro.',
  'tooltip.rows': 'Número de veces que el patrón se repite a lo largo de la altura útil.',
  'tooltip.depth':
    'Distancia máxima que se graban hacia dentro las zonas más oscuras del patrón.',
  'tooltip.threshold':
    'Determina qué píxeles se consideran grabados en el modo Binario. Se graban los píxeles más oscuros que este valor.',
  'tooltip.invert':
    'Por defecto el negro graba y el blanco se deja intacto. Activa esto si tu diseño está al revés.',
  'tooltip.mode':
    'Binario produce fondos de cavidad planos y paredes verticales, ideal para logotipos y dibujo lineal. Escala de grises sigue cada tono de forma continua, para relieves orgánicos y esculpidos.',
  'tooltip.stagger':
    'Desplaza lateralmente las filas alternas. Un 50 % produce un aparejo de ladrillo a soga.',
  'tooltip.margins':
    'Franjas en cada extremo que se mantienen al diámetro completo, para que el rodillo conserve un borde limpio.',
  'tooltip.edgeTreatment':
    'Nítido construye geometría escalonada real. Ligeramente redondeado desenfoca antes la máscara, lo que suaviza los bordes de las cavidades pero deja de ser estrictamente binario.',
  'tooltip.quality':
    'Espaciado objetivo entre muestras de la superficie. Cuanto menor, más nítido y más lento. La vista previa y la exportación son independientes.',
  'tooltip.direction':
    'En hueco graba el patrón dentro del rodillo. En relieve lo eleva por encima de la superficie.',
  'tooltip.orientation':
    'Cómo se coloca el rodillo en el archivo exportado. Las exportaciones usan Z hacia arriba, que es lo que esperan los laminadores.',
  'tooltip.tileFit':
    'Cómo se ajusta la imagen de origen dentro de un mosaico cuando sus proporciones son distintas a las del mosaico.',
  'tooltip.vectorMagicDesktop':
    'Ejecuta la aplicación local Vector Magic Desktop de forma invisible en modo totalmente automático, exporta el SVG e importa el resultado real.',

  'help.title': 'Primeros pasos',
  'help.step1': 'Define las dimensiones de tu rodillo.',
  'help.step2': 'Sube un patrón en blanco y negro, o carga un ejemplo.',
  'help.step3': 'Elige cuántas veces se repite.',
  'help.step4': 'Ajusta la profundidad del grabado.',
  'help.step5': 'Exporta el STL listo para imprimir.',
  'help.convention':
    'Las zonas negras se graban hacia dentro. Las blancas se quedan al diámetro completo. Usa Invertir si tu diseño está al revés.',

  'debug.fps': 'FPS',
  'debug.meshTime': 'Tiempo de malla',
  'debug.workerTime': 'Tiempo del worker',
  'debug.patternRes': 'Resolución del patrón',
  'debug.angularSegments': 'Segmentos angulares',
  'debug.verticalSegments': 'Segmentos verticales',
  'debug.manifoldFailures': 'Fallos de variedad (manifold)',
  'debug.memory': 'Memoria estimada',
  'debug.pinchFixes': 'Celdas de pellizco rellenadas',

  'issue.BAD_DIAMETER': 'El diámetro debe ser mayor que 0 mm.',
  'issue.BAD_HEIGHT': 'La altura debe ser mayor que 0 mm.',
  'issue.BAD_DEPTH': 'La profundidad del relieve no puede ser negativa.',
  'issue.BAD_BORE': 'El diámetro del orificio debe ser mayor que 0 mm.',
  'issue.BORE_TOO_LARGE':
    'Un orificio de {bore} mm no cabe dentro de un cilindro de {diameter} mm.',
  'issue.MARGINS_TOO_LARGE':
    'Los márgenes superior e inferior ({margins} mm) no dejan espacio en un rodillo de {height} mm de alto.',
  'issue.DEPTH_BREACHES_BORE_bore':
    'La profundidad de grabado actual llega hasta el orificio del eje.\n\n' +
    'La profundidad máxima segura para estas dimensiones es {maxSafeDepth} mm.\n' +
    'Reduce la profundidad de grabado o disminuye el diámetro del orificio.',
  'issue.DEPTH_BREACHES_BORE_centre':
    'La profundidad de grabado actual llega hasta el centro del rodillo.\n\n' +
    'La profundidad máxima segura para estas dimensiones es {maxSafeDepth} mm.\n' +
    'Reduce la profundidad de grabado.',
  'issue.THIN_WALL':
    'La profundidad del patrón deja solo {minWall} mm de espesor de pared (mínimo recomendado {recommended} mm).',
  'issue.OPEN_EDGES':
    'El casco tiene {count} arista(s) abierta(s), por lo que no encierra un volumen sólido. Un laminador pediría reparar este modelo.',
  'issue.NON_MANIFOLD_EDGES':
    '{count} arista(s) están compartidas por más de dos caras. Normalmente significa que el patrón tiene más detalle del que la malla puede representar: aumenta el Detalle de malla o reduce las repeticiones.',
  'issue.INCONSISTENT_WINDING':
    '{count} arista(s) son recorridas en el mismo sentido por sus dos caras, así que las normales no coinciden.',
  'issue.INVERTED_SHELL':
    'El casco está del revés: todas las normales apuntan hacia el material.',
  'issue.DEGENERATE_TRIANGLES': '{count} triángulo(s) tienen área cero.',
  'issue.DUPLICATE_TRIANGLES': '{count} triángulo(s) están duplicados.',
  'issue.ISOLATED_VERTICES':
    '{count} vértice(s) no están referenciados por ningún triángulo.',
  'issue.NON_FINITE_VERTEX': '{count} posición(es) de vértice son NaN o infinitas.',
  'issue.UNRESOLVED_PINCH':
    'No se han podido separar {count} punto(s) donde el patrón es más fino que una sola celda de malla. Aumenta el Detalle de malla o reduce las repeticiones.',

  'units.mm': 'mm',
  'units.deg': '°',
  'units.px': 'px',
  'units.percent': '%',
};
