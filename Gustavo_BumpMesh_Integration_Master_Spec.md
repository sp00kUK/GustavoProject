# Gustavo Project — BumpMesh-Class Mesh Workspace + Precision Cylindrical Engraving System

## Master Product & Engineering Addendum

This document expands the core Gustavo/Ash cylindrical engraving concept into a broader **BumpMesh-class mesh workspace** while keeping the original specialist goal intact:

> Replace the repetitive ZBrush workflow used to create sharp, printable cylindrical engravings with a fast, parametric, manufacturing-focused application.

The application should combine:

- BumpMesh-class mesh preparation, projection, masking, remeshing, baking, and export workflows;
- a purpose-built cylindrical pattern engine;
- raster and vector artwork processing;
- a precision curved deboss/boolean engraving engine;
- a ZBrush-style high-resolution → cut → optimise workflow;
- a fast interactive viewport;
- manufacturing-safe STL/3MF export.

The goal is **not to clone BumpMesh visually**.

The goal is to adopt the strongest proven mesh-editing interactions and combine them with a much more specialised precision engraving system.

---

# 1. THE PRODUCT DIRECTION

Think of the application as:

**BumpMesh-class mesh preparation, selection, projection and baking**

+

**our parametric cylindrical pattern system**

+

**our high-detail raster/vector engraving engine**

+

**our true deboss/boolean manufacturing pipeline**

+

**our ZBrush-style high-resolution → cut → optimise workflow**

BumpMesh is excellent at solving:

> “Where on this existing object should this texture affect?”

Our system must additionally solve:

> “Create exactly this repeated manufactured engraving around this cylindrical object, with sharp vector-quality boundaries and genuinely printable negative geometry.”

These should become two cooperating systems.

---

# 2. TWO ENTRY MODES

The app should support two major starting workflows.

## Generate Cylinder

Create a mathematically defined cylindrical object from real dimensions.

Primary Gustavo workflow.

Parameters can include:

- diameter;
- height;
- bore diameter;
- wall thickness;
- solid/hollow state;
- open/closed ends;
- object preset;
- manufacturing preset;
- optional additional base geometry.

Example real-world dimensions:

- Diameter: 95 mm
- Height: 105 mm

## Import Existing Model

Import external geometry such as:

- STL;
- 3MF;
- OBJ;
- STEP/STP.

This opens the broader mesh texturing and engraving workflow.

STEP should be tessellated at an appropriate processing quality rather than simply rendered.

---

# 3. MODEL ORIENTATION SYSTEM

Imported models need orientation tools before artwork is applied.

Implement:

## Place on Face

The user activates the tool and clicks a model face.

That face becomes the bottom.

The object is rotated and positioned onto the build plane.

Also provide:

- rotate gizmo;
- numeric rotation;
- reset orientation;
- centre object;
- place on build plate;
- fit view.

---

# 4. VIEW MODES

Support both:

- perspective;
- orthographic.

For precise engineering work, orthographic is extremely useful.

For general inspection, perspective is more natural.

Provide a clear toggle.

---

# 5. REAL BUILD PLANE

Keep a slicer-like grid.

The grid establishes:

- orientation;
- Z = 0;
- physical size;
- model placement.

Provide visible XYZ axes.

The object should naturally sit on the build plane.

Changing dimensions must not randomly push part of the model below the floor.

---

# 6. PROJECTION MODES

Although cylindrical engraving is the primary purpose, artwork should use a reusable projection layer.

Support:

## Cylindrical

Primary mode.

## Planar

For flat surfaces.

Potentially support:

- XY;
- XZ;
- YZ;
- interactively positioned projection plane.

## Triplanar

Useful for complex imported geometry.

## Cubic / Box

Useful for geometric objects.

## Spherical

Useful for rounded geometry.

Cylindrical mode receives the most engineering attention.

---

# 7. VISUAL PROJECTION GIZMO

When using cylindrical projection, show a projection cylinder/gizmo in the viewport.

The user must understand:

- where the projection axis is;
- where its centre lies;
- its orientation;
- where 0° begins;
- how the artwork wraps.

Provide:

## Auto Fit

Automatically determine a sensible projection cylinder from the target geometry.

## Reset

Return to the default projection.

## Manual Manipulation

Allow movement and rotation of the projection axis.

This is important for mugs, rollers, cups and imported models whose cylindrical region is not centred on the world origin.

---

# 8. SEAM SNAP

This is mandatory.

Provide:

## Snap to Seamless Wrap

When enabled, pattern width/scaling is adjusted so an integer number of pattern periods fits exactly around the circumference.

There should be:

- no fractional final tile;
- no tiny gap;
- no stretched last pattern;
- no doubled seam.

If:

`circumference = π × diameter`

and pattern physical width is `W`:

`N × W = circumference`

according to whichever constraint the user chooses.

Provide three behaviours:

### Lock Repetition Count

Example:

`8 around circumference`

The system calculates exact artwork width.

### Lock Artwork Width

Example:

`30 mm wide`

The system calculates the nearest seamless repetition count.

### Free Mode

Allow deliberately non-seamless placement.

---

# 9. PHYSICAL U/V SIZING

Do not make artwork sizing only a percentage slider.

Use real millimetres.

Example:

- Width / U: 30.15 mm
- Height / V: 30.15 mm

Provide a lock icon.

### Locked

Preserve source artwork aspect ratio.

### Unlocked

Scale U and V independently.

Also provide:

- Offset U;
- Offset V;
- Rotation.

For cylindrical mode, optionally display angular equivalents.

Example:

- Offset: 18°
- Width: 42°

while showing the corresponding physical width in millimetres.

---

# 10. ARTWORK INPUT

Support:

- PNG;
- JPG/JPEG;
- SVG;
- high-contrast raster images;
- black-and-white masks;
- logos;
- silhouettes;
- names;
- text converted to paths;
- repeating pattern artwork.

SVG must be a first-class format.

Do not immediately rasterise vectors and destroy their precision.

---

# 11. ARTWORK PROCESSING

Raster artwork should include controllable preprocessing.

Provide:

- smoothing/blur;
- threshold;
- contrast;
- invert;
- gamma;
- noise cleanup;
- edge cleanup;
- contour extraction;
- vectorisation;
- contour simplification.

The user should be able to compare:

- Original;
- Processed;
- Pattern/Tiling Preview.

Smoothing should default low for logos.

A leather displacement map may benefit from smoothing.

A five-point star usually does not.

---

# 12. VECTORISATION IS ONLY HALF THE QUALITY SOLUTION

Do not misunderstand the detail problem.

There are two independent quality limits:

## 2D Artwork Resolution

Raster artwork can blur, alias or lose small points.

Vectors preserve mathematically sharp boundaries.

## 3D Geometry Resolution

Even perfect vector artwork will engrave badly if the final curved cutter or base mesh does not contain enough geometry.

Therefore:

**Vector artwork + inadequate 3D tessellation = still bad.**

And:

**Dense 3D geometry + poor source raster = still potentially bad.**

The production pipeline must solve both.

---

# 13. TRUE INVERT

Provide direct operation modes:

## Positive

Push/extrude outward.

## Negative

Cut/deboss inward.

The user should not need to manually invert the source artwork.

---

# 14. SYMMETRIC DISPLACEMENT

For general grayscale displacement workflows, support symmetric interpretation:

- black = inward;
- 50% grey = unchanged;
- white = outward.

This is useful for organic textures.

Precision logo engraving should normally use binary/contour-based debossing instead.

---

# 15. SURFACE MASKING

The user should not need to modify the original mesh simply to define where artwork may affect it.

Provide two behaviours:

## Exclude

Normal state is editable.

Painted areas are protected.

## Include Only

Normal state is protected.

Only painted areas may receive the current operation.

---

# 16. BRUSH SELECTION

Implement a direct mesh-selection brush.

The user clicks/drags across the model.

Affected faces become selected or masked.

Controls:

- brush radius;
- optional soft strength;
- clear selection;
- erase modifier;
- visible mask colour.

A tiny brush can effectively target individual triangles.

A large brush covers broader areas.

---

# 17. FLOOD-FILL / PAINT BUCKET

Implement a paint-bucket tool.

The user clicks one face.

The selection spreads across connected faces until it encounters sufficiently sharp geometry.

Key parameter:

## Maximum Surface Angle / Dihedral Threshold

Example values:

- 5°
- 10°
- 20°
- 45°
- 80°

This lets the user click the wall of a mug and select the smooth cylindrical region while stopping at the handle, rim or other sharp boundary.

---

# 18. BRUSH + BUCKET MUST WORK TOGETHER

Expected workflow:

1. Bucket the broad region.
2. Brush corrections.
3. Erase unwanted areas.
4. Bucket another connected region if needed.
5. Continue until the selection is correct.

These tools should share one persistent selection state.

---

# 19. MASK VISUALISATION

Use obvious temporary viewport colours.

Example:

- Excluded surface = orange/red;
- Included-only surface = green/cyan;
- Normal surface = neutral model material.

These are editor overlays only.

They must never be baked into the STL.

---

# 20. ANGLE-BASED MASKING

Provide automatic masking based on face orientation.

Examples:

## Bottom Faces

Protect downward-facing surfaces.

## Top Faces

Protect upward-facing surfaces.

Useful for:

- keeping build surfaces flat;
- preserving mating faces;
- protecting top rims;
- excluding mug bottoms.

---

# 21. SMOOTH MASK TRANSITIONS

A mask boundary does not always need to create a hard geometric cliff.

Provide transition distance.

Then transition profile:

- Linear;
- S-Curve;
- Ease-In.

For precision engraved logos, hard boundaries should remain available and often be the default.

For organic textures, smooth falloff is valuable.

---

# 22. PRESERVE UNTOUCHED SURFACES

If the user masks out:

- a mug handle;
- threaded region;
- base;
- mating face;
- decorative rim;

then remeshing or decimation should optionally leave that region untouched.

Provide:

## Lock Unmodified Geometry

When enabled:

vertices outside the current operation region should not move unless required at the operation boundary.

---

# 23. MULTIPLE TEXTURES / MULTIPLE OPERATIONS

A project should not be limited to:

`one image + one engraving`.

Introduce an:

# Operation Stack

Example:

## Operation 1

Crown pattern  
Deboss  
0.75 mm  
5 rows × 8 columns

## Operation 2

Customer name  
Deboss  
1.20 mm  
Front only

## Operation 3

Grip texture  
Emboss  
0.35 mm  
Handle only

## Operation 4

Logo  
Deboss  
0.60 mm  
Bottom band only

Each operation contains:

- artwork;
- processing settings;
- projection;
- transform;
- depth;
- target mask;
- quality settings.

---

# 24. BAKE OPERATION

Provide:

## Bake Operation

or:

## Commit to Mesh

The current operation becomes real geometry.

The resulting mesh becomes the new evaluated base for later operations.

However, project history should preferably remain editable.

Conceptually:

Base Model

↓

Operation A

↓

Operation B

↓

Operation C

↓

Final Evaluated Mesh

This behaves more like a modifier stack than destructive modelling.

---

# 25. PROTECT BAKED REGIONS

After baking an operation, optionally allow:

## Protect This Region From Later Operations

Example:

1. Bake a customer name.
2. Protect the name.
3. Add leather displacement around it.
4. The texture does not destroy the lettering.

---

# 26. MESH DIAGNOSTICS ON IMPORT

Immediately analyse imported geometry.

Check:

- open boundaries;
- disconnected shells;
- non-manifold regions;
- degenerate triangles;
- duplicated faces where possible;
- inconsistent normals.

Show:

`✓ Healthy`

or:

`⚠ Source mesh issues detected`

Problem regions should ideally be highlightable in the viewport.

---

# 27. REMESHING / REGULARISATION

Simply subdividing poor triangles is not always enough.

Long sliver triangles can remain bad displacement surfaces.

The app should support remeshing towards a more regular triangle distribution inside processing regions.

Target:

approximately equilateral triangles of appropriate physical scale.

Our production pipeline becomes:

**IMPORT / GENERATE**

↓

**REPAIR / REMESH WHERE NEEDED**

↓

**SUBDIVIDE / REFINE**

↓

**ENGRAVE**

↓

**CLEAN**

↓

**DECIMATE**

↓

**VALIDATE**

---

# 28. ADAPTIVE SUBDIVISION

Do not blindly subdivide the entire model.

Subdivision should respond to:

- requested physical resolution;
- artwork complexity;
- selected region;
- curvature;
- sharp creases;
- engraving boundaries.

Our precision vector engine should heavily refine near true contour boundaries.

Large untouched surfaces do not require the same density as a 2 mm star.

---

# 29. THE ZBRUSH QUALITY MODEL

The proven concept is:

# SUBDIVIDE HIGH → PERFORM DETAIL WORK → REDUCE AFTERWARD

Our automated version should follow the same principle.

## Stage A — Create Sufficient Working Resolution

Use enough geometric density to represent the smallest intended features.

## Stage B — Perform the Engraving

Perform the real geometric operation at high quality.

## Stage C — Clean

Remove unnecessary, invalid or duplicate geometry.

## Stage D — Decimate

Reduce polygon count after the engraving exists.

## Stage E — Preserve Important Features

Protect:

- engraving contours;
- sharp corners;
- silhouettes;
- cylinder boundaries;
- holes;
- top/bottom rims;
- mating surfaces.

The goal is not the lowest polygon count.

The goal is:

> The smallest practical mesh that is visually and mechanically indistinguishable from the high-resolution result.

---

# 30. OVERHANG PROTECTION

For positive displacement/emboss workflows, provide:

## Preserve Printability

Optional behaviour:

- prevent newly created displacement from moving downward in Z;
- avoid creating tiny unsupported islands.

Most useful for:

- stippling;
- grip textures;
- organic surface texture;
- positive emboss.

Less important for straight inward cylindrical engraving.

---

# 31. KEEP THE BOTTOM FLAT

Provide:

## Preserve Build Surface

Protect bed-contact surfaces from:

- displacement;
- remesh movement;
- decimation distortion.

Vertices very close to Z = 0 may optionally snap back to the build plane.

---

# 32. QUALITY RECOMMENDATION ENGINE

Do not only offer:

- Low;
- Medium;
- High;
- Ultra.

Calculate a physical recommendation.

Inputs:

- model dimensions;
- smallest artwork feature;
- texture scale;
- engraving depth;
- output mode;
- curvature;
- selected area.

Output example:

`Recommended geometric resolution: 0.18 mm`

`Estimated production mesh: 1.4M triangles`

---

# 33. EXPORT RESOLUTION IN MILLIMETRES

Expose meaningful physical controls.

Examples:

- 0.50 mm;
- 0.25 mm;
- 0.15 mm;
- 0.10 mm.

Show:

`Coarse ←→ Fine`

And estimated complexity:

- 750K triangles;
- 1.8M triangles;
- 4.2M triangles.

---

# 34. HARD MEMORY SAFETY

Never let the user accidentally generate an absurd mesh and crash the application.

Provide:

- safe triangle ceiling;
- RAM estimation;
- warnings;
- cancellable workers;
- automatic fallback.

Example warning:

> Requested resolution may require approximately 18.7M triangles and ~3.4 GB of working memory.

Options:

- Continue;
- Use Recommended;
- Cancel.

---

# 35. SMART DECIMATION

Use feature-aware simplification.

Protect:

- boundaries;
- creases;
- engraved contours;
- masked borders;
- holes;
- top/bottom edges;
- functional mating surfaces.

Reject simplification operations that:

- invert normals;
- destroy topology;
- collapse important edges;
- destroy engraving shapes.

Vector engraving boundaries should receive especially strong protection.

---

# 36. REDUCE SIMPLE FLAT REGIONS

After reaching the nominal triangle target, large flat or near-flat regions can often be simplified further.

Spend polygons where geometry matters.

Remove them where they contribute nothing.

---

# 37. PREVIEW VS FINAL GEOMETRY

Keep preview and final manufacturing geometry conceptually separate.

## GPU / Interactive Preview

Optimised for:

- fast updates;
- orbiting;
- zooming;
- pattern adjustments;
- immediate feedback.

May use displacement or other rendering approximations where useful.

## Production Geometry

Triggered when:

- baking;
- generating;
- exporting.

Can perform:

- vector tessellation;
- remeshing;
- adaptive subdivision;
- curved cutter generation;
- boolean operations;
- cleanup;
- decimation;
- validation.

A responsive 60 FPS preview and a slower but accurate export is preferable to one compromised system.

---

# 38. UNDO / REDO

Undo and redo should cover:

- brush strokes;
- bucket fills;
- mask erasing;
- transforms;
- artwork changes;
- projection changes;
- cylinder dimensions;
- operation reordering;
- operation deletion;
- bake actions where technically possible.

---

# 39. RESET AT THREE LEVELS

Provide:

## Reset Parameter

Restore one slider/value to default.

## Reset Operation

Restore the selected operation.

## Reset Project

Start over.

For numeric sliders, double-click reset is useful.

---

# 40. NUMERIC INPUT + SLIDER

Every important slider should also have an exact numeric field.

Examples:

`Depth: 0.750 mm`

`Size U: 30.150 mm`

`Angle: 57°`

Users making real manufactured objects need exact numbers.

---

# 41. SAVE PROJECT

Do not only export STL.

Create a project file format.

Store:

- base model;
- generated cylinder parameters;
- operation stack;
- source artwork;
- masks;
- transforms;
- projection state;
- export settings;
- optional viewport state.

Provide:

## Save Project

Everything.

## Save Preset / Settings

Settings without the model.

---

# 42. LOCAL-FIRST ARCHITECTURE

Heavy processing should remain local wherever practical.

Advantages:

- customer models remain private;
- no giant STL uploads;
- no cloud processing bill;
- works well inside Tauri;
- potentially offline;
- fast local geometry processing.

This fits a desktop app direction extremely well.

---

# 43. OUR MAJOR DIFFERENCE FROM BUMPMESH

Do not simply turn the application into a BumpMesh clone.

We need two different geometry philosophies.

# Surface Displacement Mode

Best for:

- wood;
- leather;
- noise;
- knurling;
- roughness;
- organic textures.

Input:

grayscale displacement map.

Result:

mesh displacement.

# Precision Engraving Mode

Our specialist feature.

Best for:

- logos;
- names;
- stars;
- badges;
- text;
- icons;
- customer branding;
- repeated graphics.

Input:

SVG or vectorised raster.

Result:

precise curved cutter geometry and real negative boolean geometry.

This is what allows tiny stars, lettering and sharp edges to remain crisp.

---

# 44. TWO GEOMETRY ENGINES, SHARED UX

Architecturally, think:

# Surface Displacement Engine

Grayscale → displacement.

# Precision Engraving Engine

Vector paths → curved cutters → boolean.

Both share:

- model importer;
- projection system;
- masking;
- operation stack;
- viewport;
- selection tools;
- diagnostics;
- remeshing;
- subdivision;
- optimisation;
- export.

This shared architecture is key.

---

# 45. OPERATION TYPES

Operations may eventually include:

- Texture Displacement;
- Vector Deboss;
- Vector Emboss;
- Raster Deboss;
- Raster Emboss;
- Cut Through.

All should share the same projection, masking, stack and export framework.

---

# 46. TRUE CURVED GEOMETRY

Never simply place a flat extruded logo against the tangent of a cylinder.

The engraving must conform to cylindrical curvature.

Every point in the artwork must map to the curved surface.

For a circular cylinder:

`C = π × D`

A useful mapping model is:

`theta = 2π × u`

`x = R × cos(theta)`

`z = R × sin(theta)`

`y = vertical position`

The exact axis convention may differ internally.

The physical behaviour must be correct.

---

# 47. ENGRAVING DEPTH IS LOCAL/RADIAL

For cylindrical debossing, depth is not one global Cartesian movement.

It should be measured relative to the local cylindrical surface.

If outside radius is `R` and depth is `d`:

`engraved radius ≈ R - d`

This ensures designs on every side of the cylinder engrave correctly.

---

# 48. CREATE REAL CUTTER SOLIDS

Each precision artwork region should become a curved volumetric cutter.

Conceptually:

OUTER SURFACE

↓

CURVED ARTWORK REGION

↓

EXTRUDE/INSET ALONG LOCAL SURFACE DIRECTION

↓

CREATE CLOSED CUTTER SOLID

↓

BOOLEAN SUBTRACT

↓

REAL RECESSED GEOMETRY

Do not leave engraving as infinitely thin surfaces.

---

# 49. DO NOT RELY ONLY ON EXISTING CYLINDER VERTICES

This was a key failure mode.

If engraving only moves existing cylinder vertices, tiny artwork details become limited by vertex spacing.

A small star becomes rounded.

A thin line becomes mushy.

Precision engraving needs enough topology to represent the artwork itself.

---

# 50. 360° SEAM BEHAVIOUR

Treat the cylinder as a continuous periodic surface.

There must be:

- no gap;
- no double geometry;
- no clipped artwork;
- no compressed last tile;
- no stretched final tile;
- no mismatch.

Artwork crossing 359° → 0° must continue correctly.

The first and last columns are physically adjacent.

---

# 51. PATTERN REPETITION

The user must be able to define:

## Around the Cylinder

Examples:

- 1;
- 2;
- 3;
- 4;
- 6;
- 8;
- 10;
- etc.

## Along the Height

Examples:

- 1 row;
- 3 rows;
- 5 rows;
- 10 rows.

Also support:

- pattern scale;
- horizontal spacing;
- vertical spacing;
- angular/circumferential offset;
- vertical offset;
- rotation;
- optional staggered rows.

---

# 52. SHOW PHYSICAL PATTERN SIZE

If the repeated graphic is physically:

`23.5 mm × 31.2 mm`

show that.

The user should understand how large each logo will actually be when printed.

---

# 53. WALL THICKNESS SAFETY

For hollow cylinders:

`available wall = outer radius - inner radius`

If the selected engraving depth leaves dangerously little material:

warn the user.

If the engraving fully penetrates:

make that extremely obvious.

A through-cut should only happen intentionally.

---

# 54. MODEL VALIDATION

Before showing:

`MODEL READY`

validate:

- dimensions;
- watertightness;
- boundaries;
- normals;
- degenerate faces;
- duplicate faces where possible;
- wall thickness;
- seam integrity;
- non-manifold edges;
- self-intersections where feasible.

After decimation:

run validation again.

---

# 55. DIMENSION REPORTING

Show useful production information:

- outside diameter;
- height;
- circumference;
- engraving depth;
- inner/bore diameter;
- minimum radius;
- maximum radius;
- minimum wall thickness;
- bounding box.

Numbers matter.

---

# 56. GEOMETRY STATISTICS

Useful advanced information:

- vertex count;
- triangle count;
- surface area;
- estimated STL size;
- generation time;
- quality level;
- working-memory estimate.

---

# 57. EXAMPLE IDEAL WORKFLOW

Gustavo loads a mug.

He chooses:

**Include Only**

He uses the bucket tool.

He clicks the cylindrical wall.

The body lights up.

The handle and rim remain protected.

He imports the customer's crest.

The application recognises it as logo-style artwork.

It recommends:

**Precision Vector Engraving**

He accepts.

Vectorisation runs.

He selects:

- 8 Around;
- 5 Rows;
- 0.75 mm Deep.

He presses:

**Snap Seam**

The repetition spacing becomes exact.

He moves the pattern slightly downward using Offset V.

He zooms into tiny stars.

They remain sharp.

He clicks:

**Bake Operation**

Then he imports the customer's name.

He selects the front area.

He adds one large name at 1.0 mm deep.

He bakes it.

Then he imports a leather height map.

He switches to:

**Texture Displacement**

He applies that only to the handle.

Emboss: 0.30 mm.

He bakes it.

The application validates the finished model.

It remeshes/refines only where needed.

It generates production geometry.

It decimates simple regions.

It protects engraving boundaries.

It validates again.

It exports STL/3MF.

No ZBrush.

---

# 58. QUALITY REGRESSION TESTS

Use real difficult artwork.

## Small Stars

Ensure five-point stars remain recognisable and sharp.

## Lettering

Test:

- narrow gaps;
- curved text;
- sharp corners;
- internal counters such as A, B, D, O, P and R.

## Repeating Crown

Excellent for:

- sharp points;
- curves;
- holes;
- repetition;
- seam handling.

## Complex Badge

Use a crest with:

- outside contour;
- stripes;
- stars;
- internal text.

## Simple Silhouette

Ensures raster masks still work.

## Brick Pattern

Check seamless spacing and wrap.

## 360° Seam Test

Force artwork across the seam.

Check:

- no cracks;
- no duplicates;
- no flipped normals;
- no visible mismatch.

## Wall Thickness Test

Push depth close to the available wall.

Verify warnings.

## Decimation Test

Compare high-resolution and reduced geometry.

Ensure important engraving boundaries survive.

## Dimension Test

A 95 mm diameter × 105 mm height cylinder must export at approximately those real dimensions.

---

# 59. WHAT NOT TO BUILD

Do not give us:

- a texture wrapped around a Three.js cylinder;
- a shader pretending there is engraving;
- a normal map;
- a low-poly cylinder with vertices pushed inward;
- an SVG rasterised to a low-resolution bitmap;
- a giant uniformly subdivided model with no performance strategy;
- a beautiful viewer that creates bad STL files;
- a non-manifold export;
- an export whose dimensions drift;
- a system that silently destroys tiny details;
- a workflow that still requires ZBrush afterward.

---

# 60. PRODUCT PRIORITIES

Development priority:

1. Correct physical dimensions.
2. Correct cylindrical mapping.
3. Correct 360° seam behaviour.
4. Real negative geometry.
5. Artwork detail preservation.
6. Reliable boolean operations.
7. Watertight output.
8. Masking and mesh-selection UX.
9. Remeshing and adaptive detail.
10. Intelligent decimation.
11. Multi-operation baking/stack.
12. Fast interactive preview.
13. UI polish.

Never sacrifice manufacturing correctness for presentation.

---

# 61. CORE DEVELOPMENT ARCHITECTURE

Separate:

## UI Layer

Controls, panels, project workflow.

## Viewer

Rendering, camera, projection gizmos, masks.

## Artwork Processor

Raster cleanup, vectorisation, contour handling.

## Selection / Masking Engine

Brush, bucket, angle masks, transitions.

## Pattern Engine

Rows, columns, offsets, seam snapping.

## Projection Engine

Cylindrical, planar, triplanar, cubic, spherical.

## Geometry Kernel

Base geometry, curved cutters, booleans, mesh operations.

## Remesh / Refinement Engine

Regularisation and adaptive subdivision.

## Validation Engine

Mesh diagnostics and manufacturing checks.

## Optimisation Engine

Feature-aware decimation.

## Export Engine

STL/3MF generation.

## Worker Layer

Heavy background computation.

The geometry kernel is the valuable core.

Do not bury everything inside one giant frontend function.

---

# 62. FINAL MENTAL MODEL

Do not think:

> “How can we put an image onto a cylinder?”

Think:

> “How can we automatically reproduce the geometric result that an experienced ZBrush user would create by subdividing a model heavily, projecting precise artwork onto its curved surface, physically carving that artwork into the model, cleaning the result, reducing the mesh while preserving the detail, validating it, and exporting it for 3D printing?”

Then add:

> “How can we give that user BumpMesh-class projection, masking, brush, bucket, baking, remeshing and mesh-management tools so the same workflow also works on imported models and more complex surfaces?”

That is the product.

---

# 63. DEFINITION OF DONE

The system is successful when a user can:

1. Generate or import a model.
2. Orient it on a real build plane.
3. Select the exact surfaces to affect.
4. Use brush and bucket masking.
5. Import raster or vector artwork.
6. Choose precision engraving or surface displacement.
7. Configure projection.
8. Snap a cylindrical pattern perfectly around the seam.
9. Set real physical size and depth.
10. Create multiple independent operations.
11. Bake or stack operations.
12. Preserve functional surfaces.
13. Generate sufficient working topology.
14. Perform true geometry operations.
15. Validate the mesh.
16. Optimise it without destroying detail.
17. Export a correctly scaled printable STL/3MF.
18. Open it in a slicer with no repair workflow.
19. Print it.
20. Do all of this without requiring ZBrush.

The final generated geometry is the source of truth.
