# MASTER PRODUCT & ENGINEERING PROMPT

## Parametric Cylindrical Pattern Engraving, Debossing and Manufacturing System

You are helping us design and build a serious production application for generating **3D-printable cylindrical objects with repeated artwork physically engraved into their curved surfaces**.

Read this entire specification before making architectural decisions.

Do not simplify this concept into an image texture mapper, bump-map previewer, displacement shader, decal tool or basic Three.js cylinder demo.

The purpose of this application is to replace a repetitive manual ZBrush manufacturing workflow with a purpose-built parametric tool.

The final output must be **real printable geometry**.

---

# 1. THE PRODUCT IN ONE SENTENCE

The user imports a 2D design, defines a real-world cylindrical object in millimetres, chooses how the design repeats around and along the cylinder, chooses how deeply it should cut into the surface, previews the exact result in 3D, and exports a clean manufacturing-ready STL containing the actual engraved geometry.

---

# 2. THE REAL PROBLEM WE ARE SOLVING

The existing manual workflow is approximately:

1. Create or import a cylinder.
2. Set its physical dimensions.
3. Give the cylinder an extremely dense polygon mesh.
4. Import a black-and-white logo, graphic, pattern or mask.
5. Prepare that artwork as a mask/projection.
6. Position it on the cylinder.
7. Repeat it around the circumference.
8. Repeat it vertically when required.
9. Project it onto the curved surface.
10. Cut the design physically into the cylinder.
11. Inspect whether small details survived.
12. Increase subdivisions and repeat if necessary.
13. Perform cleanup.
14. Reduce/decimate the resulting geometry.
15. Preserve the engraving while reducing polygon count.
16. Validate the object.
17. Export it.
18. Import it into a slicer.
19. Print it.

This is unnecessarily slow when producing many personalised designs.

The application we are creating should turn that process into something closer to:

**IMPORT ARTWORK -> ENTER DIMENSIONS -> SET PATTERN -> SET DEPTH -> PREVIEW -> EXPORT STL**

The difficult 3D work happens automatically.

---

# 3. FUNDAMENTAL PRODUCT PRINCIPLE

The most important distinction is:

## The artwork must modify geometry.

A dark shape displayed over a cylinder is not enough.

A normal map is not enough.

A displacement shader is not enough.

A texture is not enough.

An image that merely appears engraved in the renderer is not enough.

When a 1.0 mm engraving depth is selected, the resulting STL must contain an actual approximately 1.0 mm physical recess in the solid geometry.

If that STL is opened in another CAD application or slicer with all textures removed, the engraving must still exist.

---

# 4. PRIMARY APPLICATION

The main use case is a cylindrical object such as:

- a texture roller;
- clay roller;
- pottery roller;
- embossing/debossing roller;
- cylindrical stamp;
- personalised cylindrical component;
- cup or mug-like cylindrical body;
- cylindrical mould;
- other 3D-printable cylindrical products.

The same underlying geometry engine should be reusable across these object types.

The primary feature being solved first is **negative engraving/debossing**.

Positive embossing may also be supported, but negative cutting is the central workflow.

---

# 5. REAL-WORLD PARAMETRIC CYLINDER

Everything must exist in real physical dimensions.

Units are **millimetres**.

At minimum allow the user to define:

- outside diameter;
- height;
- hollow/solid state;
- central bore diameter when applicable;
- wall thickness or derived wall thickness;
- engraving depth.

For example, one real production size currently used is approximately:

- Diameter: 95 mm
- Height: 105 mm

The application cannot treat dimensions as arbitrary scene units.

The viewport, geometry, measurements and exported STL must all agree.

---

# 6. THE 3D OBJECT MUST SIT ON A REAL GROUND PLANE

The viewport should contain a visible grid representing the ground/build surface.

The bottom of the generated object should sit at Z = 0.

Changing its dimensions must not randomly move part of the object below the floor.

Think of this similarly to the build plate in a slicer.

The object can be inspected and moved where appropriate, but its default generated position should be mechanically sensible and predictable.

---

# 7. ARTWORK INPUT

The software should be designed primarily around the type of artwork actually used in this manufacturing workflow:

- black-and-white PNG;
- JPG/JPEG;
- high-contrast raster images;
- silhouettes;
- logos;
- names;
- text converted to shapes;
- SVG/vector artwork;
- repeating patterns.

SVG should be treated as a first-class format.

Raster artwork should also remain fully supported.

---

# 8. IMPORTANT: VECTORISATION IS NOT THE ENTIRE SOLUTION

Do not misunderstand the quality problem.

We discovered two related but separate issues.

### Artwork resolution

Raster artwork can blur, alias or lose tiny points.

Vector artwork can preserve mathematically sharp boundaries.

### 3D geometry resolution

Even perfect vector artwork can produce poor engraving if the final curved cutter or cylinder is represented using insufficient geometry.

Therefore:

**SVG/vector artwork + inadequate 3D geometry = still inadequate.**

And:

**Extremely dense geometry + bad raster artwork = still potentially inadequate.**

The production pipeline must solve both sides.

---

# 9. ARTWORK PROCESSING PIPELINE

For raster input, provide a processing stage.

Conceptually:

INPUT IMAGE

↓

grayscale / luminance analysis

↓

threshold or mask extraction where appropriate

↓

noise removal / contour cleanup

↓

optional smoothing

↓

contour extraction

↓

optional vectorisation

↓

usable engraving paths/masks

The user should be able to see at least:

- Original
- Processed
- Pattern/Tiling Preview

Do not silently destroy small artwork features.

Small stars, narrow letters, crown tips and thin logo details are important.

---

# 10. VECTOR WORKFLOW

When SVG/vector artwork is available, preserve its paths for as long as technically possible.

Do not convert an SVG to a low-resolution bitmap and then treat it like raster data.

That would defeat the purpose.

Curves should be flattened/tessellated according to a controllable tolerance appropriate for physical manufacturing.

Sharp corners should remain sharp.

Circles should remain smooth.

Small stars should retain their points.

Text converted to paths should retain its lettering.

---

# 11. CYLINDRICAL MAPPING MODEL

Treat the outside of the cylinder mathematically as an unwrapped rectangular surface.

The horizontal coordinate corresponds to circumference:

**C = π × D**

Moving from the left side to the right side of the unwrapped surface represents travelling exactly 360 degrees around the cylinder.

The vertical coordinate corresponds to physical cylinder height.

A useful mapping model is:

theta = 2π × u

x = R × cos(theta)

z = R × sin(theta)

y = vertical position

where `u` represents horizontal position across the unwrapped cylindrical surface.

The exact coordinate convention can differ internally, but the physical behaviour must be correct.

---

# 12. THE 360-DEGREE SEAM IS CRITICAL

The cylinder should behave like a continuous periodic surface.

There must not be:

- an unexplained vertical gap;
- doubled geometry;
- clipped artwork;
- compressed artwork;
- stretched artwork;
- overlapping patterns;
- a visible discontinuity;
- a malformed seam.

Artwork crossing 359 degrees to 0 degrees must continue correctly.

The first and last sections of a repeating pattern must align mathematically.

Do not treat the seam like the edge of an ordinary flat image.

It is the same physical point on a continuous cylinder.

---

# 13. PATTERN REPETITION

The user must be able to decide how many copies of the artwork appear:

## Around the cylinder

For example:

1, 2, 3, 4, 6, 8 or more repetitions around the circumference.

## Vertically

The user must also select how many rows appear up the height of the cylinder.

For example:

1 row

3 rows

5 rows

10 rows

etc.

The software then calculates actual physical spacing from the cylinder dimensions.

The pattern must remain consistently sized and positioned.

---

# 14. PATTERN LAYOUT

The pattern system should support a production-friendly set of controls.

At minimum:

- columns / repetitions around circumference;
- rows / vertical repetitions;
- pattern scale;
- horizontal spacing;
- vertical spacing;
- vertical position;
- circumferential/angular offset;
- rotation;
- invert engraving mask.

A staggered/offset row mode can be provided for patterns where alternating rows should shift horizontally.

These controls should operate in understandable real units wherever practical.

---

# 15. SHOW THE USER THE ACTUAL PHYSICAL PATTERN SIZE

Do not make repetition completely abstract.

If a repeated graphic occupies approximately:

23.5 mm × 31.2 mm

the application should be capable of showing that information.

The user should understand how physically large each logo will be when printed.

---

# 16. TRUE CURVED GEOMETRY

A major requirement:

Do not simply paste a flat extruded logo against the tangent of the cylinder.

The engraving must conform to cylindrical curvature.

Every part of the pattern must follow the curved surface.

A logo covering 30 degrees of circumference must itself bend through those 30 degrees.

Its cutter geometry therefore needs to follow the cylinder.

---

# 17. ENGRAVING DIRECTION

Engraving depth should be measured relative to the local cylindrical surface.

For a standard circular cylinder, this means movement is fundamentally radial.

If the outside radius is R and engraving depth is d, a completely engraved area moves approximately toward:

**R - d**

rather than simply being moved along one global Cartesian axis.

This is essential.

Otherwise designs on the front may engrave properly while designs on the sides behave incorrectly.

---

# 18. CREATE REAL CUTTER GEOMETRY

Conceptually, each artwork region becomes a curved 3D cutter.

For negative engraving:

OUTER SURFACE

↓

curved artwork region

↓

extrude/inset inward along the local surface direction

↓

create a closed cutter solid

↓

boolean subtract cutter from base object

↓

obtain real recessed geometry

Do not leave the artwork as infinitely thin surfaces.

Boolean operations require valid volumetric cutters.

---

# 19. DO NOT DEPEND ONLY ON PRE-EXISTING CYLINDER VERTICES

This was one of the key quality failures.

If engraving is created merely by moving existing vertices of a cylinder, then small details are limited by the cylinder's vertex spacing.

A small five-point star might only receive a handful of vertices and become a rounded blob.

This is unacceptable.

The engraving geometry needs enough topology to represent the artwork.

---

# 20. THE ZBRUSH QUALITY MODEL

The known workflow that produces excellent results is essentially:

**SUBDIVIDE HIGH -> PERFORM DETAIL WORK -> REDUCE AFTERWARD**

Our application should reproduce the useful principle behind that automatically.

### Stage A - Generate sufficiently dense working geometry

Before performing detailed cuts, use enough geometric resolution to represent the smallest artwork features.

### Stage B - Perform the engraving at production quality

The actual geometry operation happens while sufficient resolution exists.

### Stage C - Clean the resulting mesh

Remove unnecessary internal or duplicate geometry.

### Stage D - Decimate/reduce

Reduce polygon count after the engraving exists.

### Stage E - Preserve important boundaries

Decimation must protect:

- engraving contours;
- sharp corners;
- silhouettes;
- cylinder boundaries;
- holes;
- top and bottom rims.

The target is not "lowest polygon count".

The target is:

**the smallest practical mesh that is visually and mechanically indistinguishable from the high-resolution result.**

---

# 21. ADAPTIVE DETAIL IS PREFERABLE TO BLIND GLOBAL SUBDIVISION

A naïve solution would create millions of polygons everywhere.

That may work but wastes memory and processing time.

A better system should, where feasible, allocate additional geometry mainly around:

- engraving boundaries;
- curves;
- tiny artwork;
- high curvature;
- intersections created by boolean operations.

Large untouched cylindrical regions do not require the same density as a 2 mm star.

The internal implementation is flexible, but output quality is not.

---

# 22. SEPARATE PREVIEW QUALITY FROM EXPORT QUALITY

This is an important architectural principle.

The viewport must remain responsive.

The exported manufacturing model must remain detailed.

Those goals do not require using exactly the same mesh at all times.

Use different quality stages if useful.

For example:

### Interactive Preview

Optimised for:

- fast updates;
- orbiting;
- zooming;
- changing rows;
- changing columns;
- changing depth;
- moving the pattern;
- immediate visual feedback.

### Production/Export Calculation

Triggered when the user requests final generation/export.

Optimised for:

- precise geometry;
- full artwork detail;
- accurate booleans;
- mesh repair;
- validation;
- decimation;
- printable STL generation.

The preview can intelligently approximate the final geometry.

The export cannot.

---

# 23. QUALITY PRESETS

Provide understandable detail levels.

For example:

- Draft
- Normal
- High
- Ultra
- Production Export

But these presets should affect meaningful parameters rather than merely arbitrary labels.

Possible underlying variables include:

- angular tessellation;
- vertical tessellation;
- SVG curve tolerance;
- contour simplification;
- boolean resolution;
- adaptive subdivision tolerance;
- decimation tolerance.

"Ultra" should actually produce better geometry.

---

# 24. AUTOMATIC QUALITY SELECTION

Where possible, estimate an appropriate minimum quality from:

- cylinder circumference;
- cylinder height;
- number of repeated patterns;
- physical size of each pattern;
- complexity of artwork;
- smallest detected feature.

For example:

A 95 mm diameter cylinder has a circumference of approximately 298.45 mm.

If 10 logos are arranged around it, each occupies only part of roughly 29.8 mm of circumferential space.

Tiny 1 mm stars inside that logo demand much finer geometry than a single 100 mm-wide brick pattern.

The application should understand this difference.

---

# 25. WARN WHEN ARTWORK IS PHYSICALLY TOO SMALL

There is eventually a physical printing limit.

If artwork contains extremely tiny details, inform the user.

Do not simply destroy them silently.

Example:

"Some features may be below the practical printable resolution at the selected model size."

The application can advise the user without arbitrarily removing those features.

---

# 26. ENGRAVING DEPTH

The user needs direct control over negative depth in millimetres.

For example:

0.25 mm

0.50 mm

0.75 mm

1.00 mm

1.50 mm

2.00 mm

etc.

Changes should be visible in preview.

The system must also ensure that engraving depth does not unintentionally pass through the complete cylinder wall.

---

# 27. WALL THICKNESS SAFETY

For hollow cylinders:

outer radius

minus

inner radius

equals available wall thickness.

If engraving would leave dangerously little material, warn the user.

If engraving would completely penetrate the wall, make that extremely obvious and prevent accidental invalid output unless there is a deliberate through-cut mode.

---

# 28. OPTIONAL POSITIVE RELIEF / EMBOSS MODE

The same engine can logically support the opposite operation.

### Deboss

Artwork cuts inward.

### Emboss

Artwork extends outward.

Deboss/negative engraving remains the primary workflow.

The architecture should avoid making positive relief impossible later.

---

# 29. MANUFACTURING-ORIENTED 3D VIEWPORT

The viewport is not just decoration.

It is the primary inspection tool.

Provide:

- perspective/orbit view;
- zoom;
- pan where useful;
- fit model;
- front;
- back;
- left;
- right;
- top;
- bottom;
- isometric.

The ground grid should provide scale/context.

The model should be easy to inspect closely for tiny engraving defects.

---

# 30. USEFUL INSPECTION MODES

The application can provide different render/debug modes.

Examples:

- solid;
- wireframe;
- solid + wireframe;
- normals;
- depth visualization;
- engraving mask visualization.

These are particularly valuable while diagnosing poor topology.

They should not change the actual model.

---

# 31. PARAMETRIC, NON-DESTRUCTIVE WORKFLOW

Changing a setting should not require starting from zero.

The user should be free to modify:

- diameter;
- height;
- bore;
- engraving depth;
- artwork;
- scale;
- repetitions;
- rows;
- pattern offset;
- processing method;
- detail quality.

The app regenerates the result from parameters.

Think of the project as a recipe rather than a manually edited mesh.

---

# 32. PREVIEW BEFORE COMMIT

One of the core concepts is that the user sees the result before the expensive/final geometry process is committed.

The workflow should feel like:

Adjust

↓

Preview

↓

Inspect

↓

Adjust again if necessary

↓

Generate final model

↓

Validate

↓

Export

There should never be a requirement to blindly export an STL just to discover what the pattern looks like.

---

# 33. MODEL VALIDATION

Before calling a model "ready", perform useful checks.

At minimum aim to validate:

- dimensions are valid;
- model is watertight/closed;
- no unexpected open boundaries;
- normals are consistent;
- no obviously degenerate faces;
- no accidental duplicate faces;
- cylinder wall remains valid;
- engraving has not destroyed the model;
- no invalid geometry at the 360-degree seam.

Where technically possible also check:

- non-manifold edges;
- self-intersections;
- minimum remaining wall thickness.

The UI should clearly distinguish between:

**MODEL READY**

and

**MODEL HAS PROBLEMS**

---

# 34. DIMENSION REPORTING

Display useful resulting model information such as:

- outside diameter;
- height;
- circumference;
- engraving depth;
- inner/bore diameter;
- minimum radius;
- maximum radius;
- minimum wall thickness;
- model bounding box.

This is manufacturing software.

Numbers matter.

---

# 35. GEOMETRY STATISTICS

Useful advanced information may include:

- vertex count;
- triangle count;
- surface area;
- estimated STL size;
- generation time;
- current quality level.

These metrics help diagnose unnecessarily heavy files.

---

# 36. DECIMATION MUST OCCUR AFTER DETAIL CREATION

Never optimise the model so early that engraving detail disappears.

Correct conceptual order:

BASE GEOMETRY

↓

HIGH-QUALITY CUT

↓

BOOLEAN/CLEANUP

↓

VALIDATE

↓

DECIMATE

↓

REVALIDATE

↓

EXPORT

Not:

LOW-POLY CYLINDER

↓

TRY TO FORCE TINY LOGO INTO EXISTING VERTICES

↓

EXPORT BLURRY RESULT

---

# 37. REVALIDATE AFTER OPTIMISATION

A model being valid before decimation does not guarantee that it remains valid afterward.

After optimisation:

- check manifoldness again;
- check normals again;
- check boundaries again;
- ensure the bore still exists;
- ensure engravings have not collapsed;
- ensure the seam remains correct.

---

# 38. EXPORT

The primary manufacturing output is STL.

Exported STL must:

- use the correct real-world dimensions;
- contain actual geometry;
- contain the engravings;
- import correctly into common slicers;
- not depend on textures/materials;
- be watertight when the intended model is closed;
- preserve sufficient detail;
- avoid unnecessary file size.

The exported result is the product.

The viewport is merely the tool used to create it.

---

# 39. PERFORMANCE

Complex exports may involve very large meshes.

Do not freeze the application unnecessarily.

Heavy geometry processing should run away from the main UI thread when possible.

For a web-based frontend this means using Web Workers or equivalent background processing.

The interface should remain capable of:

- showing progress;
- cancelling when technically possible;
- displaying generation state;
- reporting errors clearly.

---

# 40. CACHE WORK THAT DOES NOT NEED TO BE REPEATED

If artwork processing/vectorisation has already been completed and the source artwork has not changed, cache the processed representation.

Changing the camera should obviously not regenerate geometry.

Changing a display mode should not regenerate geometry.

Changing engraving depth may require geometry regeneration, but should not necessarily require running image vectorisation again.

Architect the pipeline in stages with sensible cache boundaries.

---

# 41. RECOMMENDED INTERNAL PIPELINE

Think approximately in these stages:

## Stage 1 - Input

Load cylinder/project parameters.

Load artwork.

## Stage 2 - Artwork preprocessing

Decode.

Threshold/process.

Extract contours if needed.

Vectorise if enabled.

Clean paths.

## Stage 3 - Pattern layout

Determine rows.

Determine circumferential repetitions.

Calculate physical artwork size.

Calculate offsets.

Create wrapped positions.

## Stage 4 - Surface mapping

Map artwork coordinates to cylindrical coordinates.

Handle the periodic 360-degree seam.

## Stage 5 - Cutter generation

Create valid curved volumetric cutting geometry.

## Stage 6 - High-resolution geometry generation

Generate or locally refine sufficient topology.

## Stage 7 - Boolean operation

Subtract cutters for deboss.

Union geometry for emboss.

## Stage 8 - Mesh cleanup

Remove invalid/duplicate/degenerate geometry.

Correct orientation.

## Stage 9 - Validation

Check the model.

## Stage 10 - Optimisation

Decimate while preserving engraving boundaries.

## Stage 11 - Validation again

Ensure optimisation did not damage the mesh.

## Stage 12 - STL generation

Produce final manufacturing file.

These stages should remain conceptually separated.

Do not build one unmaintainable function containing the entire pipeline.

---

# 42. ARCHITECTURE PRINCIPLE

Separate:

### UI

Controls, buttons, project management.

### Viewer

Rendering, camera and visualization.

### Artwork Processor

Raster/vector input and path generation.

### Pattern Engine

Rows, columns, spacing and cylindrical positioning.

### Geometry Kernel

Cylinder creation, cutters, booleans, mesh operations.

### Validation Engine

Mesh diagnostics.

### Export Engine

STL generation.

### Worker Layer

Heavy asynchronous computation.

This separation is extremely important because the geometry engine is the valuable core of the product.

---

# 43. DESKTOP APPLICATION TARGET

The current direction is compatible with a web technology frontend such as:

- Vite;
- React;
- WebGL;
- Web Workers.

The program can then be packaged as a lightweight desktop application.

Tauri is a strong target because maintaining a small, responsive executable is desirable.

However:

**Do not compromise geometry correctness merely to remain inside a particular JavaScript library.**

If a more robust native/WASM geometry kernel is required for production-quality boolean operations, use an architecture that permits that.

The product requirement outranks implementation convenience.

---

# 44. USER INTERFACE MODEL

A practical desktop layout is:

## LEFT PANEL

Creation parameters.

Examples:

- object/preset;
- diameter;
- height;
- bore;
- pattern importer;
- artwork processing;
- engraving depth;
- pattern repetition;
- spacing;
- quality.

## CENTRE

Large 3D viewport.

This receives the majority of screen space.

## RIGHT PANEL

Validation and model statistics.

Examples:

- Model Ready;
- dimensions;
- wall thickness;
- mesh status;
- vertex/triangle counts;
- estimated STL size;
- generation information.

## TOP TOOLBAR

Project and viewport actions.

Examples:

- New;
- Save;
- Open;
- language;
- export;
- view modes.

Do not make the UI feel like a generic AI-generated dashboard.

It should feel like a focused CAD/manufacturing utility.

---

# 45. IMPORTANT PRODUCT EXPERIENCE

A person who knows how to prepare artwork but barely knows ZBrush should still be able to produce a good cylindrical engraving.

The application is intended to hide the repetitive technical work.

The user should not need to understand:

- topology;
- vertex normals;
- UV mathematics;
- CSG implementation;
- tessellation;
- polygon winding;
- mesh repair.

The software understands those things on the user's behalf.

The controls exposed to the user should correspond primarily to manufacturing intentions:

"Make this 95 mm wide."

"Repeat this logo eight times."

"Use six rows."

"Cut this 0.75 mm deep."

"Make the details sharper."

"Export this for printing."

That is the product philosophy.

---

# 46. EXAMPLE REAL WORKFLOW

A user wants to manufacture a personalised cylindrical object.

They create a black-on-white customer logo.

They launch the application.

They select a cylindrical preset.

They enter:

Diameter: 95 mm

Height: 105 mm

They import the logo.

The software processes it.

If vectorisation is enabled, clean contours are generated.

The user sees:

Original

Processed

Tiling Preview

They set:

Columns: 8

Rows: 5

Engraving depth: 0.75 mm

The central viewport updates.

They rotate around the entire cylinder.

They inspect the 360-degree seam.

They zoom into tiny stars inside the logo.

They notice one star is too soft.

They select a higher quality mode.

The preview improves.

They click Generate/Export.

The production geometry pipeline creates a high-resolution version.

The engraving is physically subtracted.

The mesh is cleaned.

The mesh is validated.

The mesh is intelligently reduced.

The reduced mesh is validated again.

The UI reports:

MODEL READY

The user exports STL.

They open it in their slicer.

The logo exists as real recessed geometry.

The size is correct.

The stars are sharp.

No ZBrush workflow was required.

That is success.

---

# 47. CRITICAL QUALITY TEST: SMALL STARS

One of our important failure cases is artwork containing tiny stars or similarly sharp details.

A weak implementation turns:

★ ★ ★

into rounded lumps.

A successful implementation retains recognisable points.

This should become an actual regression test.

Do not judge quality only using simple circles and large squares.

---

# 48. CRITICAL QUALITY TEST: LETTERING

Test:

- small lettering;
- narrow internal gaps;
- curved lettering;
- sharp corners;
- counters inside letters such as A, B, D, O, P and R.

Engraving must not accidentally fill those gaps.

---

# 49. CRITICAL QUALITY TEST: CROWN

A repeated crown is another excellent regression asset because it includes:

- thin regions;
- sharp points;
- curved sections;
- holes/gaps;
- repeated geometry.

A dense repeated crown pattern should remain crisp around the full cylinder.

---

# 50. CRITICAL QUALITY TEST: COMPLEX BADGE

Use a crest/badge containing:

- outside contour;
- stripes;
- stars;
- internal text.

It should expose failures in:

- small-feature preservation;
- vector contour processing;
- boolean precision;
- tiling;
- curvature;
- seam handling.

---

# 51. CRITICAL QUALITY TEST: SIMPLE SILHOUETTE

Also test simple artwork such as an animal silhouette.

This proves that the application does not require unusually clean vector logos to function.

Raster masks remain important.

---

# 52. CRITICAL QUALITY TEST: REPEATING BRICK PATTERN

Use a simple brick pattern.

Verify:

- spacing remains even;
- horizontal rows align correctly;
- wrap seam does not create a double-width brick;
- the final column meets the first column correctly.

This is particularly useful for testing continuous textures.

---

# 53. CRITICAL GEOMETRY TEST: 360-DEGREE WRAP

Create an obvious pattern that intentionally crosses the seam.

Inspect the geometry at exactly 0/360 degrees.

There must be no:

- crack;
- duplicated face;
- paper-thin wall;
- open edge;
- flipped normal;
- visible mismatch.

---

# 54. CRITICAL WALL TEST

Create a hollow cylinder.

Increase engraving depth close to the remaining wall thickness.

The system should correctly detect the problem.

It should not happily export a broken non-manifold shell.

---

# 55. CRITICAL DECIMATION TEST

Generate a complex high-resolution engraved cylinder.

Record its geometry.

Decimate it heavily.

Compare the important engraving boundaries.

The final production optimisation should demonstrate large polygon reduction without obvious degradation of the design.

If engraving points disappear, the simplifier is too aggressive or insufficiently feature-aware.

---

# 56. CRITICAL DIMENSION TEST

A cylinder configured as:

95 mm diameter

105 mm high

must export as approximately:

95 mm × 95 mm × 105 mm

before considering any deliberate outward embossed geometry.

Do not allow unit conversion mistakes.

---

# 57. WHAT NOT TO BUILD

Do not give us:

### A texture wrapped around a Three.js cylinder

Wrong.

### A shader pretending there is engraving

Wrong.

### A normal map

Wrong.

### A low-poly cylinder whose existing vertices are pushed inward

Insufficient.

### A solution where SVG is rasterised to 512 × 512 and loses its advantage

Wrong.

### A giant uniformly subdivided mesh with no consideration for performance

Crude and undesirable.

### A beautiful viewer that produces unusable STL files

Failure.

### An STL that looks right but is non-manifold

Failure.

### An export that changes dimensions unexpectedly

Failure.

### A system that destroys tiny artwork without warning

Failure.

### A solution that requires returning to ZBrush for every model

That defeats the entire reason this application exists.

---

# 58. DO NOT CONFUSE PREVIEW WITH MANUFACTURING GEOMETRY

It is acceptable for the interactive preview to use approximations.

It is not acceptable for the export to do so.

If necessary:

PREVIEW ENGINE ≠ FINAL GEOMETRY ENGINE

That is completely acceptable.

A fluid 60 FPS preview and a high-quality 3-second or 10-second export are better than forcing both operations through the same compromised representation.

---

# 59. DO NOT OVERFOCUS ON "AI"

This is fundamentally a computational geometry/manufacturing application.

AI can assist with things such as:

- artwork cleanup;
- image recognition;
- automatic parameter suggestions;
- file naming.

But AI is not the geometry solution.

Deterministic geometry code should calculate:

- dimensions;
- circumference;
- positions;
- cylindrical mapping;
- cutters;
- boolean operations;
- wall thickness;
- mesh validity;
- STL output.

The manufacturing result must not depend on an LLM guessing geometry.

---

# 60. LONG-TERM PRODUCT MODEL

The most valuable part of this project is not any single UI.

It is the reusable cylindrical manufacturing engine underneath it.

Conceptually:

**2D ARTWORK**

↓

**PROCESS / VECTORISE**

↓

**PARAMETRIC PATTERN**

↓

**WRAP ONTO PHYSICAL CYLINDRICAL SURFACE**

↓

**CONVERT INTO CURVED 3D CUTTER**

↓

**BOOLEAN / RELIEF OPERATION**

↓

**VALIDATE**

↓

**OPTIMISE**

↓

**MANUFACTURING-READY 3D MODEL**

That engine can later power many workflows.

But do not dilute the first implementation with unrelated features.

Get this core pipeline extremely reliable first.

---

# 61. DEVELOPMENT PRIORITY

Priority order should be:

## PRIORITY 1

Correct physical dimensions.

## PRIORITY 2

Correct cylindrical mapping.

## PRIORITY 3

Correct 360-degree seam behaviour.

## PRIORITY 4

Real negative geometry.

## PRIORITY 5

Artwork detail preservation.

## PRIORITY 6

Reliable boolean operations.

## PRIORITY 7

Watertight valid output.

## PRIORITY 8

Intelligent high-resolution generation and decimation.

## PRIORITY 9

Fast interactive preview.

## PRIORITY 10

Excellent UX/polish.

Never reverse these priorities and sacrifice manufacturing correctness for visual polish.

---

# 62. DEFINITION OF DONE

The core system is successful when a person can:

1. Open the program.
2. Define a cylinder in millimetres.
3. Import black-and-white PNG artwork or an SVG.
4. Preview its processed form.
5. Choose repetitions around the cylinder.
6. Choose the number of rows.
7. Adjust scale and positioning.
8. Choose engraving depth.
9. Inspect the complete cylinder in real time.
10. See the artwork correctly crossing the 360-degree seam.
11. Generate actual negative geometry.
12. Preserve tiny stars and sharp logo features.
13. Create a valid closed model.
14. Optimise the geometry without destroying those details.
15. Export a correctly sized STL.
16. Open the STL in a normal slicer.
17. Print it.

And most importantly:

## They do all of this without needing ZBrush.

---

# 63. THE MENTAL MODEL YOU MUST KEEP THROUGHOUT DEVELOPMENT

Do not think:

> "How can I put this image on a cylinder?"

Think:

> "How can I automatically manufacture the same geometric result that an experienced user would create by carefully subdividing a cylindrical model in ZBrush, wrapping/projecting precise artwork onto its curved surface, carving that artwork physically into the model, cleaning the resulting topology, reducing the mesh while preserving the new detail, validating it, and exporting it for 3D printing?"

That distinction is the entire project.

Build around that mental model.

---

# 64. FINAL DIRECTIVE

Treat this application as a small specialised CAD/CAM-style manufacturing tool, not as an image editor with a 3D preview.

Every major technical decision should ultimately answer one question:

**Will this produce a more accurate, faster, more reliable, manufacturing-ready engraved cylindrical model for the user?**

If yes, pursue it.

If it only makes the preview prettier while compromising the actual STL, reject it.

The final generated geometry is the source of truth.