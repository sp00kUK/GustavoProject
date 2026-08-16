/**
 * English strings - the reference locale.
 *
 * Every other locale is typed against this object, so adding a key here and
 * forgetting to translate it is a compile error rather than a blank label.
 * Placeholders are `{name}` and are substituted by `t()`.
 */
export const en = {
  'app.title': 'Cylindrical Pattern Debosser',
  'app.subtitle': 'Parametric pattern generator for printable rollers',
  'app.privacy': 'Your pattern stays on this computer; model generation runs in your browser.',
  'app.untitled': 'Untitled Roller',

  'action.new': 'New',
  'action.save': 'Save',
  'action.load': 'Load',
  'action.export': 'Export',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.apply': 'Apply',
  'action.reset': 'Reset',
  'action.resetPattern': 'Reset Pattern',
  'action.resetCamera': 'Reset Camera',
  'action.resetSettings': 'Reset Settings',
  'action.fitModel': 'Fit',
  'action.undo': 'Undo',
  'action.redo': 'Redo',
  'action.loadExample': 'Load Example',
  'action.removePattern': 'Remove',
  'action.openVectorMagic': 'Auto-vectorize with Vector Magic',
  'action.copyDebug': 'Copy Debug Info',
  'action.copied': 'Copied',
  'action.setMaxDepth': 'Set Maximum Safe Depth',
  'action.generateAnyway': 'Generate Anyway',
  'action.useHigh': 'Use High Quality',
  'action.dismiss': 'Got it',

  'section.cylinder': 'Cylinder',
  'section.pattern': 'Pattern',
  'section.repeat': 'Repeat',
  'section.transform': 'Transform',
  'section.adjust': 'Image Adjustments',
  'section.relief': 'Relief',
  'section.quality': 'Quality',
  'section.export': 'Export',
  'section.summary': 'Dimensions',
  'section.validation': 'Validation',
  'section.debug': 'Debug',

  'field.projectName': 'Project name',
  'field.diameter': 'Diameter',
  'field.height': 'Height',
  'field.boreEnabled': 'Axle bore',
  'field.boreDiameter': 'Bore diameter',
  'field.preset': 'Preset',
  'field.mode': 'Mode',
  'field.invert': 'Invert pattern',
  'field.threshold': 'Threshold',
  'field.despeckle': 'Despeckle',
  'field.brightness': 'Brightness',
  'field.contrast': 'Contrast',
  'field.gamma': 'Gamma',
  'field.blackPoint': 'Black point',
  'field.whitePoint': 'White point',
  'field.blur': 'Blur',
  'field.quantize': 'Quantise',
  'field.tileFit': 'Tile fit',
  'field.columns': 'Columns',
  'field.rows': 'Rows',
  'field.offsetX': 'Horizontal offset',
  'field.offsetY': 'Vertical offset',
  'field.scaleX': 'Horizontal scale',
  'field.scaleY': 'Vertical scale',
  'field.rotation': 'Rotation',
  'field.mirrorX': 'Mirror horizontally',
  'field.mirrorY': 'Mirror vertically',
  'field.stagger': 'Row offset',
  'field.staggerMode': 'Stagger',
  'field.depth': 'Depth',
  'field.direction': 'Direction',
  'field.edgeTreatment': 'Cavity edges',
  'field.edgeSoftness': 'Edge softness',
  'field.topMargin': 'Top margin',
  'field.bottomMargin': 'Bottom margin',
  'field.previewQuality': 'Preview quality',
  'field.exportQuality': 'Export quality',
  'field.customSpacing': 'Sample spacing',
  'field.format': 'Format',
  'field.orientation': 'Orientation',
  'field.language': 'Language',
  'field.lockAspect': 'Preserve pattern aspect ratio',

  'option.binary': 'Binary (hard edge)',
  'option.grayscale': 'Grayscale (heightmap)',
  'option.deboss': 'Deboss (carve in)',
  'option.emboss': 'Emboss (raise out)',
  'option.sharp': 'Sharp',
  'option.soft': 'Slightly rounded',
  'option.stretch': 'Stretch',
  'option.fit': 'Fit',
  'option.fill': 'Fill',
  'option.staggerNone': 'None',
  'option.staggerAlternate': 'Alternate rows',
  'option.staggerEvery': 'Every row',
  'option.draft': 'Draft',
  'option.standard': 'Standard',
  'option.high': 'High',
  'option.ultra': 'Ultra',
  'option.custom': 'Custom',
  'option.vertical': 'Vertical (stands on end)',
  'option.horizontalX': 'Horizontal, along X',
  'option.horizontalY': 'Horizontal, along Y',

  'preset.smallTerrain': 'Small terrain roller',
  'preset.standardTerrain': 'Standard terrain roller',
  'preset.largeClay': 'Large clay roller',
  'preset.grip': 'Tool grip sleeve',
  'preset.stamp': 'Stamp barrel',
  'preset.customLabel': 'Custom',

  'pattern.dropHere': 'Drop artwork here, or click to browse',
  'pattern.formats': 'PNG, JPG, WEBP or SVG',
  'pattern.source': 'Source',
  'pattern.original': 'Original',
  'pattern.processed': 'Processed',
  'pattern.tilePreview': 'Tiling preview',
  'pattern.tileSize': 'Tile size',
  'pattern.examples': 'Example patterns',
  'pattern.none': 'No pattern loaded',
  'pattern.vectorMagicProgress': 'Vectorizing automatically with Vector Magic…',
  'pattern.vectorMagicImported': 'The SVG exported by Vector Magic is now the active pattern.',

  'view.solid': 'Solid',
  'view.wireframe': 'Wireframe',
  'view.normals': 'Normals',
  'view.mask': 'Pattern mask',
  'view.heatmap': 'Depth heatmap',
  'view.front': 'Front',
  'view.back': 'Back',
  'view.left': 'Left',
  'view.right': 'Right',
  'view.top': 'Top',
  'view.bottom': 'Bottom',
  'view.iso': 'Isometric',

  'summary.diameter': 'Diameter',
  'summary.height': 'Height',
  'summary.circumference': 'Circumference',
  'summary.reliefDepth': 'Relief depth',
  'summary.minRadius': 'Minimum radius',
  'summary.maxRadius': 'Maximum radius',
  'summary.bore': 'Bore',
  'summary.minWall': 'Minimum wall',
  'summary.tileSize': 'Pattern tile size',
  'summary.bounds': 'Model bounds',
  'summary.triangles': 'Triangles',
  'summary.vertices': 'Vertices',
  'summary.estimatedStl': 'Estimated STL',
  'summary.sampling': 'Surface sampling',
  'summary.segments': 'Segments',
  'summary.none': '—',

  'status.idle': 'Ready',
  'status.preview': 'Preview',
  'status.generating': 'Generating',
  'status.valid': 'Valid',
  'status.warning': 'Warning',
  'status.invalid': 'Invalid',
  'status.exporting': 'Exporting',
  'status.modelReady': 'Model ready',

  'stage.pattern': 'Preparing pattern',
  'stage.surface': 'Generating cylindrical topology',
  'stage.caps': 'Closing end caps',
  'stage.cleanup': 'Cleaning geometry',
  'stage.validation': 'Validating mesh',
  'stage.writing': 'Writing file',
  'stage.done': 'Done',

  'validation.closed': 'Closed mesh',
  'validation.winding': 'Consistent outward normals',
  'validation.degenerate': 'No degenerate faces',
  'validation.wall': 'Wall thickness valid',
  'validation.dimensions': 'Dimensions valid',
  'validation.ready': 'Ready to export',
  'validation.pending': 'Not generated yet',

  'warning.nyquist':
    'Pattern contains finer detail than the current mesh resolution. Increase Mesh Detail for a sharper export.',
  'warning.lowRes':
    'Low-resolution pattern. Fine details may appear pixelated in the generated geometry.',
  'warning.seam': 'This image may show visible repetition seams.',
  'warning.thinFeature':
    'Relief features below about 0.4 mm may not reproduce clearly with a typical 0.4 mm nozzle. Resin printers can go much finer.',
  'warning.deepCavity':
    'Very deep, narrow cavities may be difficult to print cleanly and hard to release from clay.',
  'warning.largeImage':
    'This image is {width} x {height} pixels and may require significant memory. It has been downsampled to {target} px for processing.',
  'warning.largeExport':
    '{quality} quality will generate approximately {triangles} triangles ({size}) and may require significant memory. Continue?',
  'warning.noPattern': 'Load a pattern to carve. Right now the roller is blank.',

  'error.title': 'Something went wrong',
  'error.exportFailed':
    'Export could not be generated at {quality} quality.\n\nTry:\n• a lower export quality\n• fewer pattern repetitions\n• a lower source resolution',
  'error.decodeFailed': 'That file could not be read as an image.',
  'error.svgFailed': 'That SVG could not be rasterised.',
  'error.vectorMagicNotInstalled':
    'Vector Magic Desktop was not found. Add it under vendor/vector-magic, set VECTOR_MAGIC_EXE, or install it in Program Files, then restart the local server.',
  'error.vectorMagicAlreadyRunning':
    'Close the existing Vector Magic Desktop window, then try again.',
  'error.vectorMagicBridge': 'Vector Magic Desktop integration failed: {message}',
  'error.unsupportedFile': '{name} is not a supported format. Use PNG, JPG, WEBP or SVG.',
  'error.webgl':
    'This browser could not start WebGL. The 3D preview needs WebGL2 - try a current version of Chrome, Edge or Firefox.',
  'error.cancelled': 'Cancelled',

  'tooltip.diameter':
    'Outer diameter of the untouched roller body. The pattern is carved inward from this surface.',
  'tooltip.height': 'Overall height of the roller along its axis.',
  'tooltip.bore':
    'A hole running the full height of the roller, for an axle or handle. It is real geometry, not a subtracted shape.',
  'tooltip.columns':
    "Number of times the source pattern repeats around the cylinder's full circumference.",
  'tooltip.rows': 'Number of times the pattern repeats up the usable height.',
  'tooltip.depth':
    'Maximum distance the darkest areas of the pattern are carved inward.',
  'tooltip.threshold':
    'Determines which pixels count as carved in Binary mode. Pixels darker than this are carved.',
  'tooltip.invert':
    'By default black carves and white is left untouched. Turn this on if your artwork is the other way round.',
  'tooltip.mode':
    'Binary gives flat cavity floors and vertical walls, for logos and line art. Grayscale follows every shade continuously, for organic and sculpted relief.',
  'tooltip.stagger':
    'Shifts alternate rows sideways. 50% gives a running-bond brick layout.',
  'tooltip.margins':
    'Bands at each end that stay at the full diameter, so the roller keeps a clean rim.',
  'tooltip.edgeTreatment':
    'Sharp builds true stepped geometry. Slightly rounded blurs the mask first, which softens cavity edges but is no longer strictly binary.',
  'tooltip.quality':
    'Target spacing between surface samples. Smaller is sharper and slower. Preview and export are independent.',
  'tooltip.direction':
    'Deboss carves the pattern into the roller. Emboss raises it above the surface.',
  'tooltip.orientation':
    'How the roller is laid out in the exported file. Exports are Z-up, which is what slicers expect.',
  'tooltip.tileFit':
    'How the source image maps into one repeat tile when its proportions differ from the tile.',
  'tooltip.vectorMagicDesktop':
    'Runs the local Vector Magic Desktop application invisibly in Fully Automatic mode, exports SVG, and imports its real output.',

  'help.title': 'Getting started',
  'help.step1': 'Set your roller dimensions.',
  'help.step2': 'Upload a black-and-white pattern, or load an example.',
  'help.step3': 'Choose how many times it repeats.',
  'help.step4': 'Set the carving depth.',
  'help.step5': 'Export the printable STL.',
  'help.convention':
    'Black areas carve inward. White areas stay at the full diameter. Use Invert if your artwork is the other way round.',

  'debug.fps': 'FPS',
  'debug.meshTime': 'Mesh time',
  'debug.workerTime': 'Worker time',
  'debug.patternRes': 'Pattern resolution',
  'debug.angularSegments': 'Angular segments',
  'debug.verticalSegments': 'Vertical segments',
  'debug.manifoldFailures': 'Manifold failures',
  'debug.memory': 'Estimated memory',
  'debug.pinchFixes': 'Pinch cells filled',

  'issue.BAD_DIAMETER': 'Diameter must be greater than 0 mm.',
  'issue.BAD_HEIGHT': 'Height must be greater than 0 mm.',
  'issue.BAD_DEPTH': 'Relief depth cannot be negative.',
  'issue.BAD_BORE': 'Bore diameter must be greater than 0 mm.',
  'issue.BORE_TOO_LARGE':
    'A {bore} mm bore does not fit inside a {diameter} mm cylinder.',
  'issue.MARGINS_TOO_LARGE':
    'Top and bottom margins ({margins} mm) leave no room on a {height} mm tall roller.',
  'issue.DEPTH_BREACHES_BORE_bore':
    'The current carving depth reaches the axle bore.\n\n' +
    'Maximum safe depth for these dimensions is {maxSafeDepth} mm.\n' +
    'Reduce the carving depth or decrease the bore diameter.',
  'issue.DEPTH_BREACHES_BORE_centre':
    'The current carving depth reaches the centre of the roller.\n\n' +
    'Maximum safe depth for these dimensions is {maxSafeDepth} mm.\n' +
    'Reduce the carving depth.',
  'issue.THIN_WALL':
    'Pattern depth leaves only {minWall} mm of wall thickness (recommended minimum {recommended} mm).',
  'issue.OPEN_EDGES':
    'The shell has {count} open edge(s), so it does not enclose a solid volume. A slicer would ask to repair this model.',
  'issue.NON_MANIFOLD_EDGES':
    '{count} edge(s) are shared by more than two faces. This usually means pattern detail is finer than the mesh can represent - increase Mesh Detail or reduce pattern repeats.',
  'issue.INCONSISTENT_WINDING':
    '{count} edge(s) are traversed the same way by both of their faces, so surface normals disagree.',
  'issue.INVERTED_SHELL': 'The shell is inside out - every normal points into the material.',
  'issue.DEGENERATE_TRIANGLES': '{count} triangle(s) have zero area.',
  'issue.DUPLICATE_TRIANGLES': '{count} triangle(s) are duplicated.',
  'issue.ISOLATED_VERTICES': '{count} vertex/vertices are not referenced by any triangle.',
  'issue.NON_FINITE_VERTEX': '{count} vertex position(s) are NaN or infinite.',
  'issue.UNRESOLVED_PINCH':
    '{count} location(s) where the pattern is finer than a single mesh cell could not be separated. Increase Mesh Detail or reduce pattern repeats.',

  'units.mm': 'mm',
  'units.deg': '°',
  'units.px': 'px',
  'units.percent': '%',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
