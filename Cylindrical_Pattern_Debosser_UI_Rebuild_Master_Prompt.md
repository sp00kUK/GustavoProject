# MASTER UI/UX REBUILD SPECIFICATION
## Cylindrical Pattern Debosser — Full Polished CAD-Style Application UI

> **Purpose of this document:**  
> This is a complete visual, interaction, layout, product, and implementation specification for rebuilding the existing Cylindrical Pattern Debosser interface into the polished application shown in the supplied concept image.
>
> The supplied concept image is the **visual source of truth** for the new interface direction.
>
> Do not treat this as a loose inspiration board.
>
> Rework the existing app so it feels like a serious, focused, desktop-class CAD / mesh-processing / manufacturing tool while preserving and integrating the existing geometry functionality.

---

# 0. CORE DIRECTIVE

Completely rework the current UI into the polished interface shown in the reference image.

The new application should feel like a blend of:

- a lightweight CAD package;
- a specialist mesh-processing utility;
- a 3D-print manufacturing tool;
- a professional texture/deboss workflow editor;
- a native desktop application.

The application must **not** look like:

- a generic dashboard;
- an AI-generated SaaS admin panel;
- a web form with a Three.js canvas in the middle;
- a collection of accordions bolted around a viewport;
- an early prototype;
- a game editor;
- a slicer clone;
- Blender;
- Fusion 360;
- BumpMesh copied 1:1.

The goal is a distinct, elegant application built specifically around **3D surface texturing, cylindrical pattern projection, masking, debossing, embossing, mesh preparation, and manufacturing export**.

The reference image already establishes the desired design language.

Implement that language consistently throughout the entire application.

---

# 1. OVERALL VISUAL IMPRESSION

The application uses a **dark, dense, highly polished technical UI**.

The most important qualities are:

- professional;
- calm;
- compact;
- technical;
- precise;
- high information density;
- visually hierarchical;
- strongly viewport-centric;
- responsive;
- desktop-like;
- manufacturing-focused.

The centre 3D workspace is visually dominant.

Everything else exists to support the object being edited.

The interface should feel like a tool someone could spend several hours inside without visual fatigue.

There should be almost no unnecessary decoration.

The interface should use:

- subtle borders;
- low-contrast panel separation;
- small controlled shadows;
- restrained gradients;
- blue accents for active states;
- green for successful validation;
- amber/yellow for warnings;
- red only for destructive/error states.

Avoid huge headings.

Avoid oversized cards.

Avoid excessive rounded corners.

Avoid floating glassmorphism everywhere.

Avoid "AI SaaS" aesthetics.

This should feel like desktop engineering software.

---

# 2. APPLICATION SHELL

The application fills the entire available screen.

The layout is divided into six primary structural zones:

1. **Top application toolbar**
2. **Far-left navigation rail**
3. **Left contextual properties panel**
4. **Central 3D viewport**
5. **Right validation / statistics panel**
6. **Bottom operation editor**
7. **Thin bottom status bar**

The centre viewport remains the largest region.

The UI should scale gracefully on large desktop screens.

The screenshot target is a widescreen desktop composition approximately comparable to 16:9.

---

# 3. TOP APPLICATION TOOLBAR

The top bar spans the entire width of the application.

It should be compact, approximately 56–68 px tall.

Its primary purpose is:

- branding;
- project selection;
- history actions;
- file operations;
- language;
- appearance;
- export.

## 3.1 Left Branding Area

At the far left:

### Logo

A compact circular blue geometric/star/cylindrical icon.

It should feel:

- technical;
- vector-based;
- sharp;
- simple;
- recognizable at 24–32 px.

Next to the icon:

### Product Name

`Cylindrical Pattern Debosser`

Strong white/off-white text.

Below or adjacent in smaller muted text:

`Parametric pattern generator for printable rollers`

The subtitle should be subtle and not compete with the product name.

This branding area should remain fairly compact.

---

# 4. PROJECT SELECTOR

Near the top-left/centre of the toolbar is the current project control.

The reference image shows:

**PROJECT**

then a compact field containing:

`Untitled Roller`

with a dropdown indicator.

This should function as:

- current project name;
- project rename field;
- recent-project dropdown;
- quick project navigation.

The user should be able to click the project name and rename it.

Do not use a giant title input.

It should resemble a professional document/project selector.

---

# 5. UNDO / REDO

Immediately after the project selector:

- Undo
- Redo

Use icon-only compact buttons.

Undo and redo should become globally available application actions.

These should visually disable when unavailable.

They must support future actions including:

- mask brush strokes;
- bucket fills;
- pattern transform changes;
- geometry parameter changes;
- operation reordering;
- operation deletion;
- import/replace artwork;
- projection settings;
- possibly bake actions if the history architecture allows.

Keyboard shortcuts should eventually support:

- Ctrl+Z
- Ctrl+Shift+Z / Ctrl+Y

---

# 6. TOP-RIGHT FILE AND APP ACTIONS

The right side of the toolbar contains:

- New
- Save
- Load
- Language
- Theme / appearance
- Export

## New

Creates a new project.

## Save

Saves the current editable project.

This is **not** the same as exporting STL.

## Load

Loads an existing project.

## Language

Compact dropdown.

Example:

`English`

The architecture should support localisation cleanly.

## Appearance

The reference shows a sun-style icon button.

This can toggle or open appearance settings.

Dark mode remains the primary target design.

## Export

This is the strongest top-level call-to-action.

Use blue.

The reference image uses a split-button approach:

`Export ▼`

This is ideal.

Main click:

- export using current preferred format/settings.

Dropdown:

- STL
- 3MF
- maybe OBJ
- export settings
- possibly "Generate Final Mesh"

The export button should feel important but not oversized.

---

# 7. FAR-LEFT NAVIGATION RAIL

A narrow vertical navigation bar runs down the far-left side.

This is distinct from the contextual settings panel.

It allows major workspace/module switching.

The reference design includes approximately:

- Project
- Model
- Pattern
- Mask
- Operations
- Preview
- Export

Each uses:

- compact technical icon;
- small label;
- selected state.

## Selected State

The active item uses:

- darker/lighter container;
- blue icon;
- blue highlight;
- clearer text.

The reference has **Project** active.

The navigation rail should remain visually minimal.

Do not turn this into a large sidebar.

Think approximately:

70–80 px wide.

---

# 8. NAVIGATION MODEL

Each major mode should change the content of the adjacent contextual left panel.

Suggested structure:

## Project

- project metadata;
- generate/import model;
- recent project settings;
- units.

## Model

- dimensions;
- orientation;
- repair;
- bore/wall;
- base geometry.

## Pattern

- artwork;
- projection;
- repeat layout;
- vector/raster processing.

## Mask

- include/exclude;
- brush;
- bucket;
- angle masks;
- selection controls.

## Operations

- stack management;
- bake;
- modifier settings.

## Preview

- viewport visualisation;
- mesh modes;
- wireframe;
- normals;
- depth;
- clipping;
- transparency.

## Export

- quality;
- decimation;
- validation;
- final formats;
- file size estimate.

The UI should remain coherent even if some of these functions also exist contextually in the bottom editor.

---

# 9. LEFT CONTEXTUAL PANEL

The panel immediately right of the navigation rail is a structured property inspector.

Width target:

approximately 260–310 px.

It should contain vertically stacked parameter groups.

The reference currently shows:

- MODEL
- Cylinder Parameters
- Position & Orientation
- Units

The panel uses:

- dark background;
- subtle separators;
- uppercase group labels;
- compact rows;
- aligned numeric inputs.

Do not use giant accordion headers.

The settings should feel dense and deliberate.

---

# 10. MODEL HEADER / ENTRY MODE

At the top of the contextual panel:

## MODEL

Then two clear mode buttons:

- Generate Cylinder
- Import Model

The selected action in the reference is:

**Generate Cylinder**

shown in blue.

Import Model is dark/inactive.

This communicates the two major entry modes instantly.

---

# 11. CYLINDER PARAMETERS

Below is:

## CYLINDER PARAMETERS

Use aligned labelled rows.

Example fields from the reference:

- Diameter (mm)
- Height (mm)
- Bore Diameter (mm)
- Wall Thickness (mm)
- Open Top
- Open Bottom

Example values shown:

- Diameter: 95.00
- Height: 105.00
- Bore Diameter: 47.20
- Wall Thickness: 23.90

These should be exact numeric inputs.

Where useful, provide:

- direct typing;
- mouse-wheel stepping;
- arrow step controls;
- reset;
- linked/derived values.

### Link Control

The reference shows a small chain/link icon near Diameter.

This indicates useful future parameter relationships.

For example:

- lock wall thickness;
- preserve bore relationship;
- lock aspect where relevant.

Do not add a link icon unless it performs a real useful relationship.

---

# 12. BOOLEAN / TOGGLE DESIGN

The reference uses compact modern switches.

Examples:

- Open Top
- Open Bottom

Switches should:

- be visually small;
- align with numeric fields;
- clearly indicate on/off;
- use blue active state;
- avoid oversized mobile-style controls.

---

# 13. POSITION & ORIENTATION

Next group:

## POSITION & ORIENTATION

Primary button:

**Place on Face**

This is an important mesh/CAD workflow.

The user activates it, then chooses a model face to become the build-plane face.

Below it:

- Rotate X
- Rotate Y
- Rotate Z

All with degree values.

Reference values:

`0.0°`

Provide direct numeric editing.

Then:

**Reset Transform**

This resets orientation/position transforms without destroying model parameters or operations.

---

# 14. UNITS

Bottom group:

## UNITS

Dropdown:

`Millimeters (mm)`

Then:

`Grid Size (mm)`

Example:

`10.00`

Units should affect the application consistently.

Do not silently mix scene units and millimetres.

The entire product is manufacturing-focused.

Millimetres should be the default.

---

# 15. CENTRAL VIEWPORT

The central viewport is the visual heart of the application.

It occupies the majority of screen area.

The viewport background should be dark charcoal / near-black.

The model should have enough tonal contrast to show:

- edges;
- shallow engravings;
- curvature;
- subtle specular response.

Avoid an overly glossy shader.

Avoid flat unlit grey.

Use a neutral technical material similar to clay/CAD preview.

---

# 16. VIEWPORT MODEL APPEARANCE

The reference object is a mug-like cylindrical body with:

- cylindrical wall;
- handle;
- top rim;
- bottom ring/base;
- repeated recessed star patterns.

The geometry should be rendered with:

- smooth shading;
- soft ambient occlusion;
- subtle directional lighting;
- restrained specular highlights;
- enough contrast for debossed edges.

The rendered result should make fine engraving visible without looking like photorealistic plastic.

Think:

**CAD inspection material**, not product render.

---

# 17. GRID / BUILD PLANE

The floor grid is mandatory.

It should:

- sit at Z = 0;
- extend into the scene;
- use subtle dark lines;
- include stronger axis lines;
- not overpower the model.

Axes should use conventional directional colour cues.

In the reference:

- X red;
- Y green;
- Z blue.

Provide a scale marker in the viewport.

The screenshot includes:

`50 mm`

with a small scale line.

This is excellent.

Keep it.

---

# 18. VIEW CUBE

The upper-right area of the viewport contains a compact orientation cube.

Use labels such as:

- FRONT
- RIGHT
- TOP

The cube should rotate with the camera.

Clicking a face should snap the camera to that orthographic view.

Clicking corners can produce:

- isometric;
- angled views.

Keep the cube compact.

Do not make it look like an enormous Autodesk clone.

---

# 19. VIEWPORT CAMERA MODE

Near the upper centre/right:

toggle:

- Perspective
- Orthographic

The reference has **Perspective** highlighted blue.

Switching should preserve approximate viewing orientation.

Orthographic is important for measurement and face inspection.

---

# 20. VIEWPORT TOP TOOLBAR

A compact toolbar floats/anchors along the top-left of the viewport.

The reference shows a sequence of icon buttons representing modelling/selection/navigation tools.

The first active tool is a cursor/selection arrow.

Suggested tools include:

- Select
- Orbit
- Pan
- Move
- Rotate
- Scale
- Place on Face
- Fit Selection
- Measure
- maybe Projection Gizmo

Use icon buttons.

Active tool:

- blue background;
- white icon.

Inactive tools:

- dark button;
- muted icon.

Tooltips are mandatory.

---

# 21. VIEWPORT TOOL POPOVER

In the reference, selecting the cursor/selection tool reveals a vertical contextual popover.

It contains:

- Select
- Brush
- Bucket
- Erase
- Smooth
- Fill Hole
- Measure

This is a very strong interaction model.

Instead of permanently wasting horizontal space, use compact contextual tool palettes.

## Select

General face/object selection.

## Brush

Paint mask directly on faces.

## Bucket

Flood-fill connected surface region using dihedral-angle rules.

## Erase

Remove mask/selection.

## Smooth

Smooth mask boundaries or selected mesh area depending on mode.

## Fill Hole

Mesh repair workflow.

## Measure

Physical measurement.

These must be real tools, not decorative placeholders.

---

# 22. SNAP PANEL

The lower-right area of the viewport contains a floating compact panel:

## Snap

Controls:

- Grid Snap
- Angle Snap
- Seam Snap
- Axis Snap

All shown as compact toggles.

This is excellent because snapping is global viewport behaviour and should not be buried in unrelated settings.

### Grid Snap

Move geometry/controls to grid increments.

### Angle Snap

Rotation in fixed increments.

### Seam Snap

Critical for cylindrical pattern placement.

### Axis Snap

Align projection/model movement to primary axes.

This panel should be collapsible or unobtrusive.

---

# 23. RIGHT INSPECTOR PANEL

The right panel is dedicated primarily to:

- validation;
- dimensions;
- mesh statistics;
- quality.

Width:

approximately 280–320 px.

It should be visually quieter than the central viewport but always readable.

This panel answers:

> Is this model physically safe and ready to manufacture?

---

# 24. VALIDATION HEADER

Top group:

## VALIDATION

Beside it is a status pill.

Reference:

`WARNING`

in amber.

Possible states:

- READY
- WARNING
- ERROR
- PROCESSING

Colour conventions:

### Ready

Green.

### Warning

Amber.

### Error

Red.

### Processing

Blue.

Do not communicate state using colour alone.

Always include text/icon.

---

# 25. VALIDATION CHECKLIST

The reference shows:

- Dimensions valid
- Wall thickness valid
- Closed mesh
- Consistent normals
- No degenerate faces
- Ready to export

Each successful item uses:

- green circular check icon;
- readable compact label.

Problems should appear inline within the same checklist when appropriate.

The status is computed from actual geometry analysis.

---

# 26. WARNING CARD

Below the checklist is an amber warning panel.

Example:

`12 triangle(s) are duplicated.`

Then a secondary informational note:

`Features smaller than about 0.4 mm may not resolve cleanly on a typical 0.4 mm nozzle. Resin printers can resolve much finer detail.`

This is exactly the kind of manufacturing intelligence the app needs.

Warnings should be:

- useful;
- concise;
- actionable.

Do not spam the user with dozens of low-value alerts.

---

# 27. DIMENSIONS SECTION

Next:

## DIMENSIONS

Use a two-column key/value layout.

Labels left.

Values right.

Example data:

- Diameter — 95.00 mm
- Height — 105.00 mm
- Circumference — 298.45 mm
- Relief Depth — 0.50 mm
- Minimum Radius — 47.20 mm
- Maximum Radius — 47.50 mm
- Bore — 47.20 mm
- Minimum Wall — 23.90 mm

Use monospaced or tabular numerals for values where appropriate.

Values should align cleanly.

---

# 28. MESH STATISTICS

Next group:

## MESH STATISTICS

Example:

- Vertices — 1,359,406
- Triangles — 2,719,812
- Estimated STL Size — 148.21 MB
- Surface Area — 12,540.67 cm²

This section helps the user understand whether the mesh is unnecessarily heavy.

Later we may also show:

- shells;
- boundaries;
- non-manifold edges;
- source triangle count;
- evaluated triangle count;
- estimated processing time.

---

# 29. QUALITY PRESET

At the bottom of the right inspector:

## QUALITY PRESET

Dropdown:

`Production (Recommended)`

This is superior to a vague "Ultra".

Potential presets:

- Preview
- Draft
- Standard
- High
- Production
- Custom

Production should be the recommended manufacturing target.

---

# 30. TARGET RESOLUTION

Below preset:

`Target Resolution`

Example:

`0.15 mm`

Then:

`Estimated Triangles`

Example:

`2.7 M`

This is manufacturing language.

Much better than:

`Mesh Quality = 87`

Use actual geometry measurements.

---

# 31. QUALITY SLIDER

The reference uses a horizontal gradient-style scale:

`Coarse → Fine`

with an adjustable handle.

This is good as a secondary intuitive control.

However, the actual numeric physical target must remain visible.

Do not rely on colour alone.

The slider should update:

- target resolution;
- estimated triangle count;
- estimated RAM;
- estimated export size.

---

# 32. BOTTOM OPERATION EDITOR

A large bottom panel runs underneath the viewport and left settings area.

This is one of the most important parts of the redesign.

It transforms the app from:

> one image + one mesh

into:

> a non-destructive operation stack.

The bottom region contains two conceptual sections:

1. Operation Stack
2. Selected Operation Properties

---

# 33. OPERATION STACK

Left side of bottom panel:

## OPERATIONS STACK

Primary blue button:

`+ Add Operation`

Below is an ordered list.

Reference operations:

1. Stars Pattern
2. Bottom Ring
3. Handle Texture

Each row includes:

- index;
- name;
- visibility icon.

Future row controls may include:

- drag handle;
- enable/disable;
- duplicate;
- delete;
- context menu;
- baked indicator;
- warning indicator.

Selected operation uses:

- blue border/highlight;
- subtle blue background.

---

# 34. OPERATION STACK BEHAVIOUR

Operations should eventually support:

- reorder by drag;
- rename;
- duplicate;
- enable/disable;
- delete;
- bake;
- mask;
- solo;
- hide;
- inspect.

Operations are evaluated sequentially.

Conceptually:

Base Model

↓

Operation 1

↓

Operation 2

↓

Operation 3

↓

Evaluated Mesh

The UI should make this understandable without requiring the user to know procedural modelling theory.

---

# 35. SELECTED OPERATION TABS

The central bottom properties area contains tabs.

Reference tabs:

- OPERATION SETTINGS
- TEXTURE
- PATTERN LAYOUT
- MASK
- TRANSFORM

The active reference tab is:

`PATTERN LAYOUT`

Tabs use:

- blue underline;
- blue text for active;
- muted white/grey for inactive.

Do not use huge pill buttons.

This should feel like a professional property editor.

---

# 36. BAKE OPERATION BUTTON

At the upper-right of the bottom operation panel:

`Bake Operation`

with a small icon.

This is a deliberate action.

Baking should:

- evaluate the current operation into actual working geometry;
- optionally create a protected baked region;
- preserve the project operation/history where architecture permits.

Do not bake automatically without user intent.

---

# 37. OPERATION SETTINGS TAB

The reference shows the left portion of the selected operation editor containing:

`Operation Type`

Dropdown value:

`Vector Deboss`

Then:

`Depth (mm)`

Example:

`0.50`

with slider.

Then:

- Invert (Deboss)
- Symmetric

Operation types should ultimately include:

- Vector Deboss
- Vector Emboss
- Raster Deboss
- Raster Emboss
- Texture Displacement
- Cut Through

The UI should adapt based on operation type.

For example:

Vector Deboss does not need all the same texture controls as grayscale displacement.

---

# 38. TEXTURE / ARTWORK PREVIEW

The operation editor includes a square artwork preview.

Reference shows:

a vector star graphic.

Below:

`Replace`

Then filename:

`star-vector.svg`

This is the correct interaction.

The user should always know:

- what asset is being used;
- what its filename is;
- whether it is vector/raster;
- whether it has been processed.

Future metadata may show:

- dimensions;
- SVG path count;
- raster size;
- detected minimum feature size.

---

# 39. PATTERN LAYOUT TAB

This is central to the cylindrical workflow.

The reference contains:

- Around (Columns)
- Rows (Vertical)
- Pattern Scale
- Horizontal Spacing
- Vertical Spacing

Example values:

- Around: 8
- Rows: 5
- Pattern Scale: 100.00%
- Horizontal Spacing: 0.00 mm
- Vertical Spacing: 0.00 mm

Each row combines:

- label;
- numeric input;
- slider.

This is excellent.

Keep exact numeric values alongside intuitive sliders.

---

# 40. SEAMLESS WRAP GROUP

On the right side of Pattern Layout is a dedicated highlighted group:

## SEAMLESS WRAP

This must be treated as a first-class feature.

Controls:

### Snap to Seamless Wrap

Toggle.

### Lock

Dropdown:

`Repetition Count`

Potential options:

- Repetition Count
- Pattern Width
- Free

### Repetitions

Example:

`8`

Then a positive confirmation:

`✓ Seam is perfectly aligned`

in green.

This is excellent feedback.

The user should not need to inspect the seam manually to know whether the pattern mathematically closes.

---

# 41. SEAM LOGIC

When Seamless Wrap is active:

`circumference = π × diameter`

The app should solve pattern width/repetition according to the selected lock mode.

## Repetition Count Locked

User chooses:

`8`

The software determines the exact U width.

## Pattern Width Locked

User chooses physical width.

The software determines the nearest viable integer count.

## Free

No forced periodic closure.

When perfectly aligned:

show green confirmation.

When not aligned:

show amber information, e.g.:

`0.82 mm mismatch at seam`

Then offer:

`Snap`

---

# 42. MASK TAB

The bottom Mask tab should expose operation-specific surface restriction.

Suggested controls:

## Mask Mode

- Exclude
- Include Only

## Tools

- Brush
- Bucket
- Erase
- Clear

## Brush Radius

Physical or screen-space control.

## Bucket Angle

Maximum dihedral angle.

## Edge Transition

- Hard
- Linear
- Smooth
- S-Curve

## Protect Baked Regions

Toggle.

The actual painting happens in the viewport.

The panel contains parameters.

---

# 43. TRANSFORM TAB

Controls should include:

- Size U
- Size V
- Lock Aspect
- Offset U
- Offset V
- Rotation
- projection axis;
- auto-fit;
- reset.

Use millimetres where physically meaningful.

Cylindrical U controls may optionally display both:

- mm;
- degrees.

---

# 44. STATUS BAR

A thin status bar spans the bottom of the entire application.

This contributes significantly to the desktop-tool feel.

Reference includes:

### Left

Green dot:

`Model loaded successfully`

### Middle/right

`✓ Auto-save 10:24:31`

### Right

`Memory Usage: 1.24 GB / 8.00 GB`

### Far Right

`v1.0.0`

This is excellent.

Add contextual status messages here instead of using constant toast popups.

Possible status items:

- generating mesh;
- baking operation;
- validating;
- vectorisation complete;
- project saved;
- autosave;
- RAM usage;
- GPU mode;
- application version.

---

# 45. AUTOSAVE

Autosave should be a real project feature.

Status bar communicates:

`Auto-save 10:24:31`

Do not autosave giant derived mesh caches unnecessarily if doing so causes performance issues.

Persist enough project state to recover work.

---

# 46. MEMORY DISPLAY

Because the application can create millions of triangles, memory is relevant.

Show approximate working memory.

Example:

`Memory Usage: 1.24 GB / 8.00 GB`

If obtaining reliable total process memory is platform-dependent, show the best available meaningful estimate.

This should later feed mesh-generation warnings.

---

# 47. COLOUR SYSTEM

Use a restrained technical colour palette.

## Main Background

Near-black / charcoal.

Example conceptual range:

`#0C1016` → `#121821`

## Panels

Slightly lighter.

Example:

`#111820`
`#151D27`

## Borders

Subtle slate.

Example:

`#27313D`

Never high-contrast bright borders everywhere.

## Primary Accent

Electric/technical blue.

Example family:

`#0B65D8`
`#1478F2`
`#2794FF`

Use for:

- active tool;
- selected tab;
- buttons;
- toggles;
- selected operation.

## Success

Green.

Use for:

- validation passes;
- seam aligned;
- completed operation;
- model ready.

## Warning

Amber.

Use for:

- duplicate triangles;
- resolution warning;
- seam mismatch;
- non-critical issues.

## Error

Red.

Use sparingly.

Only for:

- invalid mesh;
- destructive confirmation;
- export blocked;
- failed geometry processing.

---

# 48. TYPOGRAPHY

Use a modern, neutral UI font.

Examples of desired qualities:

- clear at 11–14 px;
- compact;
- technical;
- no quirky personality;
- excellent numeric legibility.

Good families would be similar in character to:

- Inter;
- Geist;
- IBM Plex Sans;
- system UI.

Do not use decorative display fonts.

Typical sizing:

- Product title: 15–17 px semibold
- Panel headings: 11–12 px uppercase
- Normal UI labels: 11–13 px
- Inputs: 12–13 px
- Status bar: 10–11 px
- Numeric statistics: 11–12 px

Use tabular numerals where appropriate.

---

# 49. SPACING SYSTEM

The design should be dense.

Use a small consistent spacing scale.

For example:

- 4 px
- 6 px
- 8 px
- 12 px
- 16 px
- 24 px

Most control rows should be approximately 28–34 px tall.

Do not use 48–56 px SaaS form controls.

This is desktop software.

---

# 50. BORDER RADIUS

Use restrained radii.

Typical:

- small controls: 4–6 px;
- panel containers: 6–8 px;
- larger floating panels: 8–10 px.

Do not make everything a pill.

Use pills only for:

- compact status badges;
- special states.

---

# 51. ICONOGRAPHY

Use one coherent icon set.

Icons should be:

- line-based;
- geometric;
- technical;
- visually consistent.

Avoid mixing:

- emoji;
- filled material icons;
- random SVG sources;
- different stroke widths.

All major tools need tooltips.

---

# 52. HOVER / ACTIVE / FOCUS STATES

Every interactive element must have polished state behaviour.

## Hover

Slight border/background lift.

## Active

Blue or stronger visual indication.

## Focus

Visible keyboard-accessible focus ring.

## Disabled

Reduced opacity + cursor state.

## Loading

Inline progress/spinner where appropriate.

Avoid dramatic animations.

Use fast 100–180 ms transitions.

---

# 53. RESIZABLE PANELS

Ideally:

- left properties panel width can be adjusted;
- right validation panel can be adjusted;
- bottom operation editor height can be adjusted.

Use thin draggable separators.

Persist layout preference per user/project if reasonable.

But keep sensible default sizes matching the reference image.

---

# 54. COLLAPSIBLE PANELS

The user should be able to reclaim viewport space.

Allow:

- collapse left contextual panel;
- collapse right inspector;
- collapse bottom operations area.

Far-left navigation rail remains accessible.

This is important on smaller screens.

---

# 55. KEYBOARD-FIRST SUPPORT

A polished engineering tool benefits from shortcuts.

Eventually support:

- Ctrl+N — New
- Ctrl+S — Save
- Ctrl+O — Load
- Ctrl+Z — Undo
- Ctrl+Shift+Z — Redo
- F — Fit view
- 1/3/7 style camera shortcuts if desirable
- B — Brush
- G — Bucket / fill
- E — Erase
- M — Measure
- Esc — cancel tool
- Delete — delete selected operation/object where safe

Do not implement shortcuts that conflict with browser/Tauri behaviour without thought.

---

# 56. RESPONSIVE BEHAVIOUR

Primary target:

desktop.

Minimum comfortable width should probably be around:

1280 px.

At smaller widths:

- side inspectors should become collapsible;
- bottom panel may switch to overlay/drawer;
- labels may condense;
- viewport remains usable.

Do not compromise the desktop experience trying to make this a mobile app.

This is not a phone-first application.

---

# 57. INTERACTION PRIORITY

When deciding where a function belongs:

## Viewport-global action

Put near viewport.

Examples:

- camera;
- selection;
- snapping;
- measure.

## Model-level property

Put in left contextual panel.

Examples:

- diameter;
- bore;
- orientation.

## Current operation property

Put in bottom editor.

Examples:

- engraving depth;
- artwork;
- pattern repeat;
- mask.

## Manufacturing validity

Put on right.

Examples:

- wall thickness;
- mesh errors;
- triangle count;
- output resolution.

This rule will prevent UI clutter.

---

# 58. DO NOT DUPLICATE CONTROLS RANDOMLY

The app currently risks growing the same control in multiple panels.

Avoid that.

A parameter should have one clear canonical home.

For example:

- cylinder diameter → Model panel;
- operation depth → Operation Settings;
- camera mode → viewport;
- target export resolution → right quality panel/export;
- mask painting tool → viewport + Mask parameter tab.

Context shortcuts can exist, but not separate conflicting states.

---

# 59. CURRENT APP MIGRATION

The existing application already has functionality and an early interface.

Do not throw away working geometry logic merely to make the interface match the reference.

Refactor.

Create separation between:

- application state;
- geometry engine;
- viewer;
- panel components;
- operation system;
- validation data.

The UI rebuild should be a presentation and interaction architecture upgrade, not a rewrite that breaks geometry.

---

# 60. COMPONENT ARCHITECTURE

A sensible component hierarchy could resemble:

```text
AppShell
├── TopToolbar
├── Workspace
│   ├── NavigationRail
│   ├── ContextInspector
│   │   ├── ModelPanel
│   │   ├── PatternPanel
│   │   ├── MaskPanel
│   │   └── ...
│   ├── MainWorkspace
│   │   ├── Viewport
│   │   │   ├── ViewportToolbar
│   │   │   ├── ToolPopover
│   │   │   ├── ViewCube
│   │   │   ├── CameraModeToggle
│   │   │   ├── SnapPopover
│   │   │   └── ScaleIndicator
│   │   └── OperationEditor
│   │       ├── OperationStack
│   │       ├── OperationTabs
│   │       ├── OperationSettings
│   │       ├── TextureSettings
│   │       ├── PatternLayout
│   │       ├── MaskSettings
│   │       └── TransformSettings
│   └── ValidationInspector
│       ├── ValidationStatus
│       ├── DimensionsPanel
│       ├── MeshStatistics
│       └── QualityPanel
└── StatusBar
```

Do not put the entire interface into one component.

---

# 61. STATE ARCHITECTURE

Separate at least these concepts:

## Project State

- name;
- path;
- save state;
- preferences.

## Base Model State

- source;
- dimensions;
- transforms;
- units.

## Operation State

Array of operations.

Each operation may contain:

- id;
- name;
- enabled;
- type;
- artwork;
- projection;
- depth;
- mask;
- repeat;
- transforms;
- processing settings.

## Viewer State

- camera;
- view mode;
- active tool;
- snap settings;
- display mode.

## Derived Geometry State

- preview mesh;
- final mesh;
- statistics;
- validation.

## UI State

- active module;
- selected operation;
- panel sizes;
- popovers.

Do not mix everything into a giant React object if avoidable.

---

# 62. OPERATION DATA MODEL

A conceptual operation structure:

```ts
type Operation = {
  id: string
  name: string
  enabled: boolean

  type:
    | 'vector-deboss'
    | 'vector-emboss'
    | 'raster-deboss'
    | 'raster-emboss'
    | 'texture-displacement'
    | 'cut-through'

  artwork: {
    sourceId: string
    filename: string
    sourceType: 'svg' | 'png' | 'jpg'
  }

  depthMm: number

  projection: {
    mode: 'cylindrical' | 'planar' | 'triplanar' | 'box' | 'spherical'
    axis: 'x' | 'y' | 'z' | 'custom'
  }

  repeat: {
    columns: number
    rows: number
    scale: number
    spacingUMm: number
    spacingVMm: number
    seamless: boolean
    seamLock: 'repetition-count' | 'pattern-width' | 'free'
  }

  transform: {
    sizeUMm: number
    sizeVMm: number
    offsetU: number
    offsetV: number
    rotationDeg: number
  }

  mask: {
    mode: 'exclude' | 'include-only'
    data: unknown
  }
}
```

This is conceptual.

Adapt it to the existing codebase.

---

# 63. VALIDATION DATA MODEL

The validation inspector should consume structured data.

Example:

```ts
type ValidationResult = {
  overall: 'ready' | 'warning' | 'error' | 'processing'

  checks: {
    dimensionsValid: boolean
    wallThicknessValid: boolean
    closedMesh: boolean
    normalsConsistent: boolean
    noDegenerateFaces: boolean
    readyToExport: boolean
  }

  warnings: Array<{
    id: string
    severity: 'info' | 'warning' | 'error'
    message: string
    action?: string
  }>
}
```

Do not generate validation UI by parsing arbitrary strings.

---

# 64. VIEWPORT DISPLAY MODES

The original application had:

- Solid
- Wireframe
- Normals
- Depth heatmap
- Front
- Right
- Back
- Left
- Top
- Bottom
- Isometric

Do not discard these.

Move them into the new viewport system more elegantly.

For example:

## Display dropdown

- Solid
- Wireframe
- Solid + Wireframe
- Normals
- Depth Heatmap
- Mask
- Curvature

And camera views through:

- View Cube;
- camera dropdown;
- shortcuts.

This reduces the old row of many text buttons.

---

# 65. DEBUG MODE

Do not permanently expose a large `Debug` button to normal users unless it is genuinely useful.

Move developer/debug information behind:

- View → Debug;
- dev setting;
- keyboard shortcut.

Normal users should see manufacturing diagnostics, not engineering internals.

---

# 66. FILE IMPORT EXPERIENCE

When importing a model:

show a clear modal or file workflow.

Then automatically analyse:

- dimensions;
- orientation;
- shell count;
- watertightness;
- triangle count;
- normal consistency.

If the model has problems:

show them in the right Validation panel.

Do not block the import unless the mesh is fundamentally unreadable.

---

# 67. ARTWORK IMPORT EXPERIENCE

When artwork is imported:

show:

- thumbnail;
- filename;
- source format.

If raster:

offer or automatically analyse:

- threshold;
- contrast;
- vectorisation suitability.

If SVG:

preserve vector paths.

Do not silently convert it to low-resolution raster.

---

# 68. SMART OPERATION TYPE SUGGESTION

Optional future UX:

If uploaded artwork is:

- high-contrast;
- logo-like;
- SVG;

suggest:

`Vector Deboss`

If artwork is:

- grayscale;
- photographic;
- texture-like;

suggest:

`Texture Displacement`

This suggestion should never override the user.

---

# 69. MASK WORKFLOW

Mask mode should be obvious when active.

When the user enters mask editing:

- viewport model gets selection overlay;
- mask toolbar becomes prominent;
- left/bottom mask settings appear;
- unrelated tools fade or become less prominent.

Never let the user wonder whether they are editing geometry or painting a mask.

---

# 70. BUCKET TOOL UX

Bucket tool should use surface-angle connectivity.

The UI should expose:

`Maximum Surface Angle`

Example:

`20°`

Clicking a face should flood through adjacent faces while the dihedral threshold remains below the setting.

Add:

- live hover preview if feasible;
- clear undo;
- additive/subtractive modes.

---

# 71. BRUSH TOOL UX

Brush should show a cursor ring over the mesh.

Controls:

- Radius;
- Hardness / falloff where appropriate;
- Add;
- Subtract.

For face masks, hard selection is acceptable.

For displacement-transition masks, soft weights may eventually be useful.

---

# 72. SELECTION FEEDBACK

Selection/mask overlays should remain readable under different lighting.

Potential visual model:

- cyan = included;
- orange = excluded/protected;
- white outline = hover;
- blue = selected operation region.

Do not use subtle grey changes that are impossible to see.

---

# 73. BAKE WORKFLOW

When the user clicks Bake Operation:

1. confirm only if the action is expensive or destructive;
2. show progress;
3. evaluate the operation;
4. update mesh statistics;
5. rerun validation;
6. preserve history if possible;
7. optionally offer:
   - Protect baked region;
   - Continue editing.

Do not freeze the entire UI with no feedback.

---

# 74. PROCESSING FEEDBACK

For heavy operations:

show progress in:

- status bar;
- operation row;
- optional compact progress overlay.

Examples:

`Vectorising artwork…`

`Generating curved cutters…`

`Boolean subtraction…`

`Repairing mesh…`

`Decimating…`

`Validating…`

Avoid fake arbitrary progress bars.

If exact progress is unavailable, use indeterminate state.

---

# 75. EXPORT WORKFLOW

Clicking Export should open or reveal final export settings.

Show:

- format;
- physical dimensions;
- triangle count;
- estimated file size;
- validation state;
- target resolution.

If there are warnings:

allow export if still structurally valid, but clearly explain.

If there are critical errors:

block export.

---

# 76. EXPORT SUCCESS

After export:

show concise confirmation.

Example:

`Exported roller.stl — 148.2 MB`

Do not show a giant celebration modal.

This is a utility.

---

# 77. TOOLTIP SYSTEM

Every icon-only action needs a tooltip.

Tooltip should include shortcut where relevant.

Example:

`Brush Mask (B)`

`Fit View (F)`

`Measure (M)`

Keep delay short but not instant.

---

# 78. CONTEXT MENUS

Right-click can become useful for:

## Operation

- Rename
- Duplicate
- Bake
- Disable
- Delete

## Model

- Place on Face
- Centre
- Reset Transform
- Inspect

## Viewport

- Frame Model
- Camera View
- Display Mode

Use context menus sparingly and never make essential functionality discoverable only by right-click.

---

# 79. PROJECT SAVING

A project must preserve editable state.

Save:

- source model reference/data;
- generated-cylinder parameters;
- operations;
- masks;
- artwork;
- transforms;
- settings.

Do not save only the final STL.

The entire point is returning later and continuing editing.

---

# 80. POLISH DETAILS

Small touches that matter:

- use tabular numerals in dimension panels;
- align decimals;
- avoid layout shift when status changes;
- preserve scroll position;
- animate panel collapse smoothly;
- keep tool icons aligned;
- use consistent divider spacing;
- clamp absurd input values;
- allow Enter to commit numeric values;
- Escape cancels edits/tools;
- highlight modified unsaved project state;
- show file dirty indicator next to project name.

---

# 81. ACCESSIBILITY

Despite dark technical styling:

- text contrast must remain readable;
- keyboard focus must be visible;
- buttons need accessible names;
- colour cannot be the sole signal;
- hover-only information should also be accessible.

Avoid ultra-low-contrast grey text that looks stylish but cannot be read.

---

# 82. PERFORMANCE REQUIREMENTS

The UI should remain smooth even when the model is heavy.

Do not trigger full mesh regeneration for:

- camera orbit;
- panel resize;
- selection of a UI tab;
- opening a dropdown;
- switching statistics display.

Geometry updates should happen only when parameters requiring geometry change.

Debounce continuous sliders intelligently.

Potential interaction:

- drag slider → fast preview;
- release → higher-quality recompute.

---

# 83. CACHING

Cache expensive stages.

For example:

Artwork processing should not rerun because:

- user rotates camera;
- validation panel collapses;
- another UI tab opens.

Pattern geometry should not necessarily rerun vectorisation.

Separate pipeline stages.

---

# 84. DESKTOP / TAURI FEEL

If the application is packaged in Tauri:

make it feel native.

Consider:

- native file dialogs;
- drag/drop;
- application menu;
- keyboard shortcuts;
- persistent window/layout state.

But maintain the same React/WebGL design language.

---

# 85. REFERENCE IMAGE: VISUAL STRUCTURE SUMMARY

The exact composition being targeted is:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ BRAND | PROJECT | UNDO/REDO                          NEW SAVE LOAD ... EXPORT│
├──────┬───────────────┬──────────────────────────────────────┬───────────────┤
│      │               │ Viewport Toolbar    Camera Mode      │ VALIDATION    │
│ NAV  │ MODEL         │                                      │ ✓ checks      │
│ RAIL │ PARAMETERS    │                                      │ warnings      │
│      │               │           LARGE 3D VIEWPORT          │ DIMENSIONS    │
│      │ ORIENTATION   │                                      │ MESH STATS    │
│      │               │                                      │ QUALITY       │
│      │ UNITS         │                             SNAP     │               │
├──────┴───────────────┼──────────────────────────────────────┴───────────────┤
│ OPERATIONS STACK     │ SELECTED OPERATION SETTINGS / PATTERN / MASK / ETC  │
├──────────────────────┴──────────────────────────────────────────────────────┤
│ STATUS                       AUTOSAVE     MEMORY                       v1.0.0 │
└────────────────────────────────────────────────────────────────────────────┘
```

This structure should remain recognisable in the implementation.

---

# 86. WHAT SHOULD CHANGE FROM THE CURRENT SCREENSHOT

The existing UI has many horizontal textual buttons and collapsed sections.

The redesign should change this substantially.

## Replace the old left accordion stack

Old:

- Cylinder
- Mold Assembly
- Operations Stack
- Pattern
- Repeat
- Transform
- Relief
- Quality
- Export

New:

- vertical module rail;
- context-sensitive structured inspector;
- bottom operation editor.

## Replace old viewport text-button row

Old:

- Solid
- Wireframe
- Normals
- Depth heatmap
- Front
- Right
- etc.

New:

- icon-based viewport toolbar;
- camera mode toggle;
- view cube;
- display-mode dropdown/popover.

## Preserve the right validation concept

But make it more polished and structured.

## Move operation editing to bottom

This gives the operation stack and selected-operation controls far more space.

## Make snapping first-class

Floating viewport Snap panel.

## Make selection tools first-class

Cursor tool opens:

- Select
- Brush
- Bucket
- Erase
- Smooth
- Fill Hole
- Measure.

---

# 87. DO NOT MERELY COPY THE MOCKUP PIXEL-FOR-PIXEL

The image is the design target.

But implementation must respect actual application needs.

If a real feature requires:

- another setting;
- warning;
- additional row;
- scroll area;
- modal;

integrate it within the same design system.

Do not force functionality into an impossible layout just to match the screenshot literally.

The goal is:

**same visual quality, same architecture, same hierarchy, real functionality.**

---

# 88. DO NOT REMOVE WORKING FEATURES

During the redesign:

audit the existing app.

Create a checklist of current features.

Ensure each feature is either:

- retained;
- moved;
- intentionally superseded.

Do not accidentally delete useful behaviour because the corresponding old control disappeared.

---

# 89. IMPLEMENTATION PHASES

## Phase 1 — Shell

Build:

- top toolbar;
- nav rail;
- left inspector;
- viewport frame;
- right inspector;
- bottom operations panel;
- status bar.

Do not yet rewrite geometry.

## Phase 2 — Connect Existing State

Wire current:

- cylinder values;
- viewer modes;
- validation;
- statistics;
- pattern settings;
- relief;
- quality;
- export.

## Phase 3 — Operation Stack

Move existing operation concept into the bottom modifier-style panel.

## Phase 4 — Viewport UX

Add:

- toolbar;
- tool popover;
- snap panel;
- view cube;
- orthographic/perspective.

## Phase 5 — Mesh Selection

Add:

- brush;
- bucket;
- erase;
- include/exclude masks.

## Phase 6 — Polishing

- keyboard shortcuts;
- tooltips;
- transitions;
- status bar;
- autosave;
- memory reporting.

## Phase 7 — Advanced Geometry Integration

- remesh;
- bake;
- multi-operation evaluation;
- vector cutter engine;
- precise seam workflow.

---

# 90. ACCEPTANCE CRITERIA — VISUAL

The redesign is successful when:

- the viewport dominates the application;
- the tool looks desktop-class;
- panels are compact;
- spacing is consistent;
- blue accent is restrained;
- the application no longer resembles an early prototype;
- validation feels trustworthy;
- dimensions are easy to scan;
- operations are clearly separated;
- users can immediately understand where model, operation, viewport and export controls live.

---

# 91. ACCEPTANCE CRITERIA — FUNCTIONAL

The redesign is not complete if it is merely beautiful.

At minimum:

- generate cylinder still works;
- imported models still render;
- pattern changes still update geometry;
- depth still affects actual mesh;
- validation still runs;
- dimension statistics still update;
- export still produces geometry;
- existing quality system still functions;
- existing camera views remain available;
- operation editing remains possible.

No regression for aesthetics.

---

# 92. ACCEPTANCE CRITERIA — INTERACTION

Users must be able to:

1. Create/load a project.
2. Generate/import a model.
3. Change model dimensions.
4. Orient the model.
5. Inspect it in the viewport.
6. Change camera modes.
7. Use snapping.
8. Add/select operations.
9. Change operation type.
10. Replace artwork.
11. Configure pattern repetition.
12. Snap a cylindrical pattern seamlessly.
13. Adjust depth.
14. Mask surfaces.
15. Bake operations.
16. See validation.
17. Set target quality.
18. Export.
19. Save and later resume.

---

# 93. UI PERSONALITY

The application should communicate:

> “This tool understands meshes and 3D printing.”

Not:

> “This website has lots of controls.”

The difference comes from:

- physical units;
- mesh stats;
- view cube;
- operation stack;
- validation;
- snap tools;
- build plane;
- precise numeric controls;
- compact technical layout.

---

# 94. FINAL DESIGN RULE

Whenever a UI decision is uncertain, choose the option that makes the application feel more like:

**a focused desktop manufacturing tool**

and less like:

**a conventional website**.

---

# 95. FINAL LLM DIRECTIVE

Rebuild the UI comprehensively.

Do not simply reskin the old accordions.

Do not only change colours.

Do not move three buttons and call it complete.

The information architecture itself has changed.

The final product should have:

- a real application shell;
- strong workspace navigation;
- a large professional viewport;
- context-sensitive property editing;
- operation-stack editing;
- first-class masking tools;
- first-class snapping;
- manufacturing validation;
- real quality controls;
- save/load/export separation;
- persistent status information.

The supplied image represents the intended final product quality.

Match its:

- density;
- hierarchy;
- visual polish;
- panel architecture;
- technical tone;
- CAD-like interaction model.

Then connect every visible control to real application state and real geometry behaviour.

---

# 96. THE END GOAL

A user should open the rebuilt application and immediately feel that this is no longer a prototype.

It should feel like a specialist tool they could genuinely install and use for production work.

They should be able to:

- generate or import a real model;
- select and mask surfaces;
- apply precise vector engravings or grayscale textures;
- repeat them around cylindrical surfaces;
- snap the seam exactly;
- stack multiple operations;
- inspect the mesh;
- validate it;
- control final resolution;
- export a manufacturing-ready model.

The interface should make an advanced 3D workflow feel controlled, understandable and fast.

**The 3D model is the centre of the experience.  
The operation stack describes what happens to it.  
The left side controls what it is.  
The right side tells the user whether it is safe.  
The bottom controls how it is modified.  
The viewport is where the user understands everything.**
