-- Seed: 25 standard operating procedures for interior design studios.
-- Idempotent: only inserts when the sops table has fewer than 25 rows,
-- so it safely re-runs in dev (already populated) without duplicating data.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM sops) < 25 THEN

    INSERT INTO sops (title, category, description, content, created_by, org_id) VALUES
    (
      'Plywood Selection & Grading',
      'Carpentry & Joinery',
      'Ensure correct plywood grade is used for each application, avoiding warping, delamination, or moisture failure.',
      'PURPOSE: Ensure correct plywood grade is used for the application, avoiding warping, delamination, or moisture failure.

PRE-REQUISITES: Drawings indicate plywood grade and thickness for each application. ISI marking (IS 303 / IS 710) must be verified on every sheet before use.

MATERIALS:
- BWP grade (IS 710) — all wet area joinery (kitchen, bathroom, wardrobes adjacent to bathrooms), all exterior application
- MR grade (IS 303) — all dry area joinery (bedrooms, living, study)
- Thickness as per drawing: 6mm for back panels, 12mm for shelves under 600mm span, 18mm for cabinet carcass and load-bearing shelves, 25mm for countertops and heavy load applications

PROCEDURE:
1. Verify ISI marking on each sheet before cutting. Reject any sheet without marking.
2. Check edges for delamination, warping, or visible voids. Reject defective sheets.
3. Store sheets flat, off the ground, in a dry area until use.
4. Cut with sharp blades to prevent edge chipping.
5. Seal exposed edges immediately after cutting if not being veneered or edge-banded the same day.

ACCEPTANCE CRITERIA:
- ISI marking visible on each piece used (verify by photograph during execution)
- No exposed plywood edges in finished work
- No visible warping in finished cabinets after 30 days
- Moisture content under 12% before any finishing applied

DO NOT: Use MR grade in wet areas. Substitute lower grades without written approval. Use sheets stored on a wet floor. Mix grades within a single piece of furniture.',
      '46833846', NULL
    ),
    (
      'Veneer Application on Plywood',
      'Carpentry & Joinery',
      'Achieve a flat, bubble-free veneer surface with proper grain alignment and edge integrity.',
      'PURPOSE: Achieve a flat, bubble-free veneer surface with proper grain alignment and edge integrity.

PRE-REQUISITES: Substrate must be BWP-grade plywood (minimum 18mm for cabinet faces). Substrate sanded to 180 grit, dust-free, and at room temperature. Veneer conditioned in the same environment for at least 24 hours before application.

MATERIALS:
- Veneer as per project specification — verify species, cut, and thickness against approved sample
- Adhesive: approved brand per project spec, white wood adhesive grade
- Edge banding tape matching veneer

PROCEDURE:
1. Lay out veneer sheets to confirm grain direction per drawing before any glue is applied.
2. Apply adhesive uniformly to substrate using a notched trowel or roller. Avoid pooling.
3. Position veneer carefully — there is no second chance once contact is made.
4. Apply pressure using a press or sandbag method for minimum 4 hours.
5. Apply edge banding before face veneer where edges will remain visible.
6. Inspect for bubbles within 30 minutes of application — slit and re-press if found.
7. Allow 24-hour cure before sanding or finishing.

ACCEPTANCE CRITERIA:
- No bubbles, lifted edges, or open joints
- Grain direction matches drawing on every panel
- Seams between veneer sheets aligned (within 1mm)
- No glue squeeze-out visible on the face surface
- Edges clean, no chip-out

DO NOT: Apply veneer to damp substrate. Use expired adhesive. Stack panels before adhesive has cured. Sand veneer face before 24-hour cure.',
      '46833846', NULL
    ),
    (
      'Cabinet Carcass Construction',
      'Carpentry & Joinery',
      'Build cabinet structures that hold square, support specified loads, and remain rigid over time.',
      'PURPOSE: Build cabinet structures that hold square, support specified loads, and remain rigid over time.

PRE-REQUISITES: Drawings issued with internal dimensions, hardware schedule, and load specifications. Plywood cut and edge-treated before assembly.

MATERIALS:
- Carcass: 18mm BWP or MR plywood per location
- Back panel: 6mm or 9mm plywood, grooved into sides where structural, screwed where not
- Fasteners: confirmat screws or equivalent for joinery
- Hardware: hinges, slides, and lifts per project hardware schedule

PROCEDURE:
1. Verify all panels are cut square (diagonal measurement check, max 2mm variance).
2. Pre-drill all screw locations to prevent splitting.
3. Assemble carcass with screws plus dado/groove joints — no nails alone for structural joints.
4. Back panel grooved into sides for upper cabinets, recessed and screwed for base cabinets.
5. Adjustable shelves on shelf pins minimum two per side per shelf. Fixed shelves dado into sides.
6. Hardware fixing per manufacturer template — pilot holes required.
7. Confirm cabinet sits flat on a level surface with no rocking before finishing.

ACCEPTANCE CRITERIA:
- Cabinet square: diagonal measurements within 2mm of each other
- No visible screw heads on finished faces
- Shelves carry specified load with no visible deflection
- Doors close flush, gaps even (2-3mm) on all sides
- Drawers run smoothly with no rubbing

DO NOT: Use nails alone for structural joints. Substitute hardware brands without approval. Skip pre-drilling. Apply finish to unsquare carcass.',
      '46833846', NULL
    ),
    (
      'PU Polish (Polyurethane) Application',
      'Polishing & Finishing',
      'Apply a durable, even PU finish at the specified sheen with no visible application marks.',
      'PURPOSE: Apply a durable, even PU finish at the specified sheen with no visible application marks.

PRE-REQUISITES: Substrate sanded progressively through 120, 180, 240 grit and fully dust-free. Workspace dust-controlled — no parallel sanding, cutting, or sweeping in the same area during application. Ambient temperature 20-30°C, humidity below 70%.

MATERIALS:
- PU sealer and PU top coat: approved brand, 2K (two-component) system
- Thinner: brand-matched to PU system only — no substitution
- Sheen level per drawing: matte / satin / semi-gloss / gloss
- Sandpaper: 240, 320, 400, 600 grit

PROCEDURE:
1. Final-sand substrate to 240 grit. Wipe clean with tack cloth.
2. Apply PU sealer coat per manufacturer ratio. Allow 4-6 hours drying.
3. Sand sealer coat with 320 grit. Wipe clean.
4. Apply first finish coat. Allow 4-6 hours drying.
5. Sand with 400 grit. Wipe clean.
6. Apply second finish coat. For premium areas, repeat sanding at 600 grit and apply third coat.
7. Allow 7 days full cure before client handover or heavy use.

ACCEPTANCE CRITERIA:
- Sheen uniform across all surfaces of the same finish level
- No brush marks, orange peel texture, runs, or sags
- No dust nibs in the final coat
- Edges and corners coated to same standard as flat surfaces
- No yellowing visible on light-colored surfaces

DO NOT: Apply PU in dusty conditions. Mix different brands of PU. Skip intermediate sanding. Handle work before 24-hour dry. Apply over uncured stain or sealer.',
      '46833846', NULL
    ),
    (
      'Melamine Polish Application',
      'Polishing & Finishing',
      'Apply melamine finish to indoor furniture with proper sealer base and adequate top-coat protection.',
      'PURPOSE: Apply melamine finish to indoor furniture with proper sealer base and adequate top-coat protection.

PRE-REQUISITES: Substrate sanded to 180 grit, dust-free, ambient temperature 20-30°C.

MATERIALS:
- Melamine sealer (NC-based): approved brand
- Melamine top coat: approved brand, sheen per drawing
- Thinner: brand-matched
- Sandpaper: 180, 240, 320 grit

PROCEDURE:
1. Final-sand substrate to 180 grit. Wipe clean.
2. Apply NC sealer coat. Allow 2 hours drying.
3. Sand with 240 grit. Wipe clean.
4. Apply first melamine top coat. Allow 4 hours drying.
5. Sand with 320 grit. Wipe clean.
6. Apply second top coat. Allow 24 hours before handling.

ACCEPTANCE CRITERIA:
- Uniform sheen, no patches
- No brush marks or runs
- Edges fully coated
- Surface hard to fingernail after 24 hours

DO NOT: Use melamine on surfaces exposed to direct sunlight or moisture. Apply over uncured PU or other incompatible base. Mix brand systems.

NOTE: Melamine is suitable for indoor furniture in dry areas only. For wardrobes adjacent to bathrooms, kitchen, or outdoor application, use PU instead.',
      '46833846', NULL
    ),
    (
      'Veneer Polish Finishing',
      'Polishing & Finishing',
      'Finish veneer to the specified open-pore or close-pore finish, preserving grain visibility while providing surface protection.',
      'PURPOSE: Finish veneer to the specified open-pore or close-pore finish, preserving grain visibility while providing surface protection.

PRE-REQUISITES: Veneer fully cured on substrate (minimum 24 hours after application). Surface sanded carefully with 180 then 240 grit — light pressure only to avoid sanding through the veneer face.

MATERIALS:
- Grain filler (for close-pore finish): wood-tone matched, approved brand
- Stain (if specified): water-based or solvent-based per project spec
- Top coat: PU or melamine per drawing
- Sandpaper: 240, 320, 400 grit; 0000 steel wool for final rub

PROCEDURE FOR CLOSE-PORE:
1. Apply grain filler matched to wood tone. Work into grain, remove excess.
2. Allow overnight drying. Sand 320 grit.
3. Apply stain if specified. Allow penetration time per manufacturer.
4. Apply 3 coats of top coat with intermediate 400 grit sanding.
5. Final rub with 0000 steel wool for hand-rubbed premium areas.

PROCEDURE FOR OPEN-PORE:
1. Skip grain filler.
2. Apply stain if specified.
3. Apply 2 coats of matte or satin top coat, sanding 400 grit between coats.
4. Final coat applied thin to preserve open grain texture.

ACCEPTANCE CRITERIA:
- Grain visible per finish type (filled for close-pore, open for open-pore)
- Color uniform across panels — match approved sample
- No sanding burn-through visible
- Top coat even and protective

DO NOT: Sand through veneer face. Apply heavy coats that obscure grain. Mix open-pore and close-pore on the same piece without drawing instruction.',
      '46833846', NULL
    ),
    (
      'Wall Surface Preparation Before Painting',
      'Painting',
      'Prepare wall surfaces so the paint system bonds, covers evenly, and lasts without flaking, blistering, or color variation.',
      'PURPOSE: Prepare wall surfaces so the paint system bonds, covers evenly, and lasts without flaking, blistering, or color variation.

PRE-REQUISITES: Wall plaster fully cured (minimum 28 days from plastering). Moisture content tested below 6%. All civil work complete in the area.

MATERIALS:
- Wall putty: white cement-based, approved brand
- Primer: water-based for emulsion system, solvent-based for enamel system
- Sandpaper: 120, 180, 240 grit

PROCEDURE:
1. Test wall moisture with moisture meter. If above 6%, wait further before proceeding.
2. Remove loose plaster, old paint, dust, grease. Wash if needed and allow full drying.
3. Apply first putty coat. Allow drying per manufacturer (typically 4-6 hours).
4. Sand with 120 grit. Apply second putty coat.
5. Sand with 180 grit. Apply third putty coat where needed for high-finish areas.
6. Final sand with 240 grit. Wipe clean.
7. Apply one coat of primer matched to the paint system. Allow drying.
8. Spot-fill any visible defects, sand, re-prime locally.

ACCEPTANCE CRITERIA:
- Wall flat to within 2mm over a 1m straightedge
- No visible patches, cracks, or pinholes
- No dust nibs
- Primer coat uniform with no patches showing through

DO NOT: Paint on moist walls. Skip putty coats on uneven walls. Use putty as a substitute for plaster repair. Skip primer.',
      '46833846', NULL
    ),
    (
      'Emulsion Paint Application',
      'Painting',
      'Apply interior emulsion paint to achieve uniform color, sheen, and coverage with no application marks.',
      'PURPOSE: Apply interior emulsion paint to achieve uniform color, sheen, and coverage with no application marks.

PRE-REQUISITES: Wall surface prepared per Wall Surface Preparation SOP. Primer coat dry. Area cleared of dust-producing activity.

MATERIALS:
- Emulsion paint: approved brand and product line per project spec
- Sheen per drawing: matte / silk / soft-sheen
- Thinning: water only, ratio per manufacturer (typically 10-20% for first coat, 5-10% for finish coats)
- Tools: brush for cutting in, roller for main field, spray for large continuous areas if specified

PROCEDURE:
1. Stir paint thoroughly. Mix multiple cans of the same color into a single container (boxing) for color uniformity across a wall.
2. Cut in edges and corners with brush.
3. Apply first coat with roller in one direction, then cross-roll to even out.
4. Allow 4-6 hour recoat interval (longer in humid weather).
5. Lightly sand any imperfections with 320 grit.
6. Apply second coat. Two coats minimum on all walls. Third coat where covering deep colors or for premium finish.

ACCEPTANCE CRITERIA:
- Color uniform across each wall (no patches, no roller marks visible)
- Sheen even (no flashing where coats overlap)
- Edges and corners coated to same standard as field
- No drips, runs, or holidays
- No paint on adjacent surfaces (skirting, ceiling, switches)

DO NOT: Recoat before previous coat is dry. Mix different brands or batches without boxing. Apply in direct sunlight on exterior walls. Skip the second coat regardless of how good the first coat looks.',
      '46833846', NULL
    ),
    (
      'Enamel Paint on Wood & Metal',
      'Painting',
      'Apply enamel finish to wood and metal substrates with proper preparation and durable coverage.',
      'PURPOSE: Apply enamel finish to wood and metal substrates with proper preparation and durable coverage.

PRE-REQUISITES: Substrate sanded smooth, dust-free, primed appropriately.

MATERIALS:
- Wood primer or metal primer: matched to substrate, approved brand
- Enamel paint: solvent-based or water-based per project spec
- Thinner: brand-matched
- Sandpaper: 240, 320 grit

PROCEDURE:
1. Sand substrate to 240 grit. Wipe clean.
2. Apply primer suitable for substrate. Allow full drying (typically 8 hours for solvent-based).
3. Sand primer with 320 grit. Wipe clean.
4. Apply first enamel coat. Allow drying per manufacturer.
5. Sand lightly with 400 grit. Wipe clean.
6. Apply second enamel coat. For high-traffic surfaces, apply third coat.

ACCEPTANCE CRITERIA:
- Smooth surface with no brush marks
- Uniform sheen
- No runs, sags, or drips
- Edges and end-grain (wood) fully coated
- No rust bleed-through (metal)

DO NOT: Apply enamel without primer. Use water-based enamel on rust-prone metal without rust-converting primer. Skip intermediate sanding.',
      '46833846', NULL
    ),
    (
      'Plaster of Paris (POP) False Ceiling',
      'Civil & Masonry',
      'Construct a flat, crack-free POP false ceiling that holds level and accepts paint finish.',
      'PURPOSE: Construct a flat, crack-free POP false ceiling that holds level and accepts paint finish.

PRE-REQUISITES: Drawings showing ceiling layout, levels, light cut-outs, AC diffuser positions, and any cove or design feature. Electrical conduits and AC ducting installed and tested above ceiling line.

MATERIALS:
- Framework: GI channels per drawing section, hangers, perimeter angle
- POP boards or POP applied wet over chicken mesh per drawing
- POP powder: ISI-marked, approved brand
- Jointing compound

PROCEDURE:
1. Mark level on perimeter walls using laser level. Confirm matches drawing.
2. Fix perimeter angle at marked level.
3. Install GI channel framework at specified spacing (typically 600mm centers).
4. For board ceiling: fix POP boards to framework with screws, joints staggered.
5. For wet POP: fix chicken mesh, apply POP in layers, finish smooth.
6. Treat all joints with jointing compound. Sand smooth.
7. Apply skim coat over entire ceiling for paint-ready finish.
8. Inspect for cracks before painting. Re-treat as needed.

ACCEPTANCE CRITERIA:
- Ceiling level: variation within 3mm over 3m
- No visible joints or cracks after skim coat
- Cut-outs aligned with light fixtures and diffusers per drawing
- Cove lines straight and even
- All edges sharp where meeting walls

DO NOT: Hang heavy fixtures from POP — use independent fixing through framework to slab. Apply POP over wet substrate. Skip jointing compound treatment. Paint before POP is fully dry (minimum 7 days).',
      '46833846', NULL
    ),
    (
      'Waterproofing in Wet Areas',
      'Civil & Masonry',
      'Apply waterproofing system that prevents water penetration through bathroom and balcony floors and walls.',
      'PURPOSE: Apply waterproofing system that prevents water penetration through bathroom and balcony floors and walls.

PRE-REQUISITES: Substrate (concrete slab or screed) cured, clean, free of cracks. Floor slopes towards drain at 1:80 minimum. All plumbing rough-in complete and pressure-tested.

MATERIALS:
- Waterproofing membrane: cementitious or acrylic-based, approved brand and product
- Fillet at wall-floor junction: cement mortar 1:3 ratio
- Bonding agent: matched to waterproofing system

PROCEDURE:
1. Clean substrate thoroughly — remove dust, oil, loose material.
2. Form fillet (75mm x 75mm) at all wall-floor junctions.
3. Apply bonding agent if required by waterproofing system.
4. Apply first coat of waterproofing per manufacturer thickness (typically 1-1.5mm).
5. Carry coating up walls minimum 300mm in showers, 200mm elsewhere.
6. Allow drying per manufacturer (typically 6-8 hours).
7. Apply second coat perpendicular to first.
8. After full cure (24 hours minimum), conduct ponding test: fill area with 25mm water, hold 24 hours.
9. If no leakage observed in ceiling below, proceed to tiling. If any leak, redo affected area.

ACCEPTANCE CRITERIA:
- Continuous coating with no pinholes or thin spots
- Coverage up walls to specified height
- Ponding test passes with zero leakage
- No tile work begins until ponding test passes

DO NOT: Apply waterproofing over wet substrate. Skip the fillet at junctions. Tile over waterproofing before full cure. Skip ponding test under any circumstances.',
      '46833846', NULL
    ),
    (
      'Tile Laying - Floor',
      'Civil & Masonry',
      'Lay floor tiles level, with consistent joint width, full bedding, and clean grouting.',
      'PURPOSE: Lay floor tiles level, with consistent joint width, full bedding, and clean grouting.

PRE-REQUISITES: Substrate clean, level within tolerance, and properly waterproofed if a wet area. Drawings indicate tile layout, starting point, and joint pattern. All tiles inspected for color/batch matching before laying begins.

MATERIALS:
- Tile adhesive: cement-based, approved brand and grade per tile type
- Tile spacers: 2-3mm for porcelain, 3-5mm for natural stone
- Grout: matched color per drawing
- Sealant for natural stone (if applicable)

PROCEDURE:
1. Mark center of room and chalk-line layout per drawing. Dry-lay perimeter tiles to confirm cut sizes.
2. Mix tile adhesive per manufacturer. Use within working time.
3. Apply adhesive to substrate with notched trowel. Apply adhesive to back of tile (back-buttering) for tiles 600x600 and larger.
4. Set tile firmly, twist into place to bed fully.
5. Use spacers between every tile.
6. Check level frequently with straightedge — adjust before adhesive sets.
7. Clean tile face immediately of adhesive smears.
8. After 24 hours, remove spacers. Grout joints with rubber float, working diagonally.
9. Wipe excess grout with damp sponge. After 30 minutes, polish tile face with dry cloth.

ACCEPTANCE CRITERIA:
- Tile level: variation within 2mm over 2m straightedge
- Joints uniform width throughout — no variation between rows
- Grout uniform color, fully filled, no voids
- No hollow sound when tapped (verify by tapping 10% of tiles randomly)
- Cut tiles clean-edged, full pieces at sight lines per drawing

DO NOT: Lay tiles over uncured screed. Skip back-buttering on large-format tiles. Skip the layout marking — never start from a wall. Walk on tiles before 24-hour adhesive cure. Grout before 24-hour adhesive set.',
      '46833846', NULL
    ),
    (
      'Marble & Stone Installation',
      'Civil & Masonry',
      'Install marble or natural stone with full bedding, no staining, and a polished finish.',
      'PURPOSE: Install marble or natural stone with full bedding, no staining, and a polished finish.

PRE-REQUISITES: Stone slabs inspected on arrival — check for cracks, color match across slabs, and damage. Substrate level and prepared. Drawings specify layout, joint pattern, and any inlay or design.

MATERIALS:
- Bedding mortar: cement-sand 1:3 with white cement for light stones
- Stone sealer: penetrating sealer suitable for stone type
- Polishing compounds graded for stone type

PROCEDURE:
1. Lay out slabs dry to confirm color/vein match per drawing.
2. Wet substrate before applying bedding mortar.
3. Apply bedding mortar to substrate at uniform thickness (typically 20-25mm).
4. Apply slurry of neat cement on back of stone.
5. Set stone, tap with rubber mallet to bed fully. Confirm level.
6. Hold position with wedges until mortar sets initially.
7. After 24 hours, point joints with cement matching stone color.
8. Polish in stages — typically rough cut, intermediate, fine, mirror finish per stone type.
9. Apply penetrating sealer after polishing complete and stone is fully dry.

ACCEPTANCE CRITERIA:
- Joints minimal (1-2mm) and consistent
- Polish even across all surfaces — no swirl marks, no dull patches
- Color and veining matched per drawing layout
- No rust or yellow staining
- Sealer applied evenly with no streaks

DO NOT: Use ferrous (rust-prone) materials near stone before sealing — they will stain. Drag stones across each other. Skip sealer on porous stones (marble, limestone). Apply polish before bedding is fully cured (48 hours minimum).',
      '46833846', NULL
    ),
    (
      'Concealed Wiring Installation',
      'Electrical',
      'Install concealed electrical wiring safely, with proper conduit, junction box placement, and earthing.',
      'PURPOSE: Install concealed electrical wiring safely, with proper conduit, junction box placement, and earthing.

PRE-REQUISITES: Drawings approved showing all circuits, switch positions, light positions, socket positions, and DB layout. Wall chasing complete per drawing. Wall not yet plastered.

MATERIALS:
- Conduit: PVC, ISI marked, diameter per cable count and size
- Wires: ISI-marked, color-coded (red/yellow/blue for live, black for neutral, green for earth)
- Switch and socket back-boxes: metal or PVC per drawing
- Earthing wire: minimum 2.5mm2 for sockets, 4mm2 for high-load circuits

PROCEDURE:
1. Verify chases follow drawing — horizontal at switch height, vertical to DB, no diagonals.
2. Install conduit in chases with bends made with bending spring (no kinks).
3. Mount junction boxes flush with finished wall surface (typically 12mm proud of brickwork to allow plaster thickness).
4. Pull wires through conduit with care — no joints inside conduit, joints only in junction boxes.
5. Maintain color code throughout: red/yellow/blue for live, black for neutral, green for earth.
6. Leave 200mm tail at each box for connection.
7. Test continuity and insulation resistance before chasing is closed.
8. Photograph wiring runs before plastering for record.

ACCEPTANCE CRITERIA:
- Conduit fully concealed, no exposed sections
- Junction box positions match drawing exactly (verified before plastering)
- Color code consistent throughout
- Continuity and insulation tests pass and are documented
- Earth continuity verified at every socket point
- Switch box height: 1200mm from finished floor unless drawing specifies otherwise

DO NOT: Use conduit smaller than specified (causes pulling damage). Join wires inside conduit. Mix earth and neutral. Run circuits without independent earthing. Close chases before testing.',
      '46833846', NULL
    ),
    (
      'Switch & Socket Installation',
      'Electrical',
      'Install switches and sockets at standard heights, aligned, and tested.',
      'PURPOSE: Install switches and sockets at standard heights, aligned, and tested.

PRE-REQUISITES: Wall finishing (paint, wallpaper, panelling) complete in switch/socket areas. Back-boxes installed flush with finished wall surface. Wiring tested.

MATERIALS:
- Switches, sockets, and plates: approved brand and series per project spec
- Cover plates matched to wall finish color where specified
- Screws supplied with hardware

PROCEDURE:
1. Confirm wall is fully cured if recently painted (24 hours minimum).
2. Strip wire ends to required length. Do not nick conductor.
3. Connect per markings — L for live, N for neutral, E for earth. Tighten terminals.
4. Tug-test each wire after tightening to confirm secure.
5. Fit module into mounting plate, then mounting plate to back-box. Confirm flush and level.
6. Fit cover plate.
7. Test every switch and socket with a tester before handover — confirm live, neutral, earth correctly wired and no reverse polarity.

ACCEPTANCE CRITERIA:
- All switch/socket plates level (within 1mm)
- All plates at same height in any one room
- No paint, putty, or dirt on switch faces or plates
- Tester confirms correct wiring at every point
- No loose connections (no flicker on tug-test)
- Cover plates fit flush with no gaps

DO NOT: Tighten over-tight (can damage terminals). Leave loose strands of wire. Mix switch brands within a room. Install before walls are dry and clean.',
      '46833846', NULL
    ),
    (
      'CPVC & UPVC Pipe Installation',
      'Plumbing & Sanitary',
      'Install water supply piping with proper joints, supports, and pressure testing.',
      'PURPOSE: Install water supply piping with proper joints, supports, and pressure testing.

PRE-REQUISITES: Drawings showing pipe routes, sizes, and fixture connections. Pipe chases or concealment routes prepared.

MATERIALS:
- CPVC for hot and cold water lines, ISI-marked
- Solvent cement matched to pipe brand
- Pipe clamps for support
- Pipe brand consistent throughout — no mixing brands or solvents

PROCEDURE:
1. Cut pipe square with proper pipe cutter — no hacksaw.
2. Deburr cut edge.
3. Dry-fit assembly to confirm alignment before cementing.
4. Apply solvent cement to both pipe end and fitting socket per manufacturer.
5. Push fittings together with quarter-turn twist. Hold 30 seconds.
6. Allow joint to set per manufacturer (typically 1 hour for handling, 24 hours before pressure).
7. Support pipe with clamps at maximum 1m intervals for horizontal runs, 1.5m for vertical.
8. Allow expansion clearance at penetrations.
9. Pressure test before concealment: 1.5x working pressure for minimum 1 hour. No drop acceptable.

ACCEPTANCE CRITERIA:
- All joints clean, no excess cement visible
- All supports in place per spacing standard
- Pressure test passes with zero drop documented
- No joints buried in walls without prior pressure test
- Hot water line clearly distinguishable from cold (label or color code)

DO NOT: Mix pipe brands or solvent brands. Apply cement to wet pipe. Move joint before set time. Conceal pipes before pressure test passes. Use hacksaw for cutting.',
      '46833846', NULL
    ),
    (
      'Sanitary Fixture Installation',
      'Plumbing & Sanitary',
      'Install sanitary fixtures level, sealed, and leak-tested.',
      'PURPOSE: Install sanitary fixtures level, sealed, and leak-tested.

PRE-REQUISITES: Wall tiling complete. Water supply lines pressure-tested and capped. Drainage lines connected and tested. Fixtures inspected on arrival for damage.

MATERIALS:
- Fixtures per project specification (WC, washbasin, urinal, sink, shower)
- Silicone sealant: clear or matched to fixture color, sanitary grade
- Wax ring (for WC)
- Brass or stainless fittings — no plated steel
- Concealed cistern fittings (if specified) per cistern manufacturer

PROCEDURE:
1. Confirm fixture position per drawing. Mark mounting points.
2. Drill mounting holes with appropriate bit for tile (carbide-tipped, low speed).
3. Install fixture supports/brackets per fixture type.
4. For WC: set on wax ring or proper seal, level both directions, secure to floor.
5. Connect water supply with shut-off valve at each fixture.
6. Connect drainage — confirm trap is properly seated.
7. Run water and check for leaks at every joint. Run for minimum 10 minutes.
8. Apply silicone sealant where fixture meets wall or floor.

ACCEPTANCE CRITERIA:
- Fixture level both directions (use spirit level)
- No leaks at any joint after 10-minute run
- Shut-off valves accessible
- Sealant clean line with no smears on tile
- Fixture firm — no movement when pressed
- Flush works smoothly (WC), drain runs clear (basin)

DO NOT: Over-tighten fixings — cracks the porcelain. Use plumber''s putty on chrome (causes pitting). Skip leak test. Use sealant as a substitute for proper mechanical seal.',
      '46833846', NULL
    ),
    (
      'AC Indoor Unit Installation',
      'HVAC',
      'Install split AC indoor units securely, with proper drainage and refrigerant pipe routing.',
      'PURPOSE: Install split AC indoor units securely, with proper drainage and refrigerant pipe routing.

PRE-REQUISITES: Wall structural capacity verified. Drainage path planned and slope confirmed. Refrigerant pipe route planned, with no sharp bends. Electrical point installed at unit location.

MATERIALS:
- Indoor unit per project specification
- Mounting plate supplied with unit
- Refrigerant pipes: insulated, brand-matched to outdoor unit
- Drainage pipe: PVC, with continuous slope
- Insulation tape

PROCEDURE:
1. Mark mounting plate position — level, with adequate clearance above (200mm) and at sides (150mm).
2. Drill holes for refrigerant and drainage pipes through wall, with outward slope.
3. Fix mounting plate securely with appropriate anchors for wall type.
4. Route refrigerant pipes from indoor unit through wall, gently bent (no kinks).
5. Run drainage pipe with continuous downward slope (minimum 1:100) — never flat or upward.
6. Insulate all refrigerant pipe joints.
7. Hang indoor unit on mounting plate. Confirm secure.
8. Test drainage by pouring water into drain pan — confirm full flow to outlet.

ACCEPTANCE CRITERIA:
- Unit level and flush against wall
- Drainage flows freely with no pooling
- No exposed refrigerant pipe inside room (must be concealed or in concealed conduit)
- Insulation continuous on refrigerant lines
- Mounting secure — no movement when unit operating

DO NOT: Install with reverse drainage slope. Kink refrigerant pipes. Skip wall sleeve. Use indoor electrical extension cord (must be permanent point).',
      '46833846', NULL
    ),
    (
      'Aluminium Window & Door Installation',
      'Glass & Aluminium',
      'Install aluminium frames square, weather-sealed, and properly anchored.',
      'PURPOSE: Install aluminium frames square, weather-sealed, and properly anchored.

PRE-REQUISITES: Opening verified to be square and to specified dimensions (allow 10-15mm clearance all sides for frame and sealant). Drawing specifies frame section, glass type, and hardware.

MATERIALS:
- Aluminium frames per project specification — anodized or powder-coated
- Glass: thickness and type per drawing (single, double-glazed, toughened, laminated)
- Hardware: hinges, handles, locks per drawing
- Sealant: silicone, structural grade for glazing, weatherproof for perimeter
- Fixing screws and packers

PROCEDURE:
1. Confirm opening dimensions match frame plus clearance. Square check both diagonals.
2. Position frame in opening. Use packers to maintain level and clearance.
3. Drill and fix frame to structure at specified intervals (typically 600mm centers, within 150mm of corners).
4. Confirm frame square after fixing — re-check diagonal.
5. Install glass with appropriate setting blocks. Bed in glazing sealant.
6. Install hardware. Test all movement.
7. Apply weatherproof sealant around frame perimeter, both inside and out. Smooth with finishing tool.

ACCEPTANCE CRITERIA:
- Frame square — diagonals within 2mm
- Opening smooth, no binding
- Locks engage fully
- Glass set with appropriate clearance, no glass-to-frame contact
- Sealant continuous, no gaps
- Water test passes (spray test) — no penetration

DO NOT: Force frame into out-of-square opening. Skip packers. Apply sealant to dirty surfaces. Use silicone where the manufacturer specifies a different sealant.',
      '46833846', NULL
    ),
    (
      'Toughened Glass Installation',
      'Glass & Aluminium',
      'Install toughened glass safely, with proper edge protection and secure fixing.',
      'PURPOSE: Install toughened glass safely, with proper edge protection and secure fixing.

PRE-REQUISITES: Glass dimensions verified before tempering (cannot be modified after). Edges polished. Holes drilled (if needed for hardware) before tempering.

MATERIALS:
- Toughened glass per specification (thickness, edge work)
- Setting blocks: synthetic, appropriate hardness
- Structural sealant where used
- Hardware (clamps, patch fittings, hinges) per drawing
- Protective gloves and corner protection during handling

PROCEDURE:
1. Verify glass dimensions and quality on arrival. Reject any with edge chips, scratches, or roller wave distortion.
2. Handle glass with gloves and edge protection at all times.
3. Position setting blocks at quarter points of bottom edge.
4. Set glass into position with two persons minimum for safety.
5. Install hardware per manufacturer torque specification.
6. Apply sealant only as specified — toughened glass should never be over-constrained.
7. Mark with visibility decals if large glass in walkway (per safety code).

ACCEPTANCE CRITERIA:
- Glass set true and level
- No edge contact with metal frame (always via setting blocks)
- Hardware tight to specification but not over-torqued
- Setting blocks at correct quarter-point positions
- Safety decals visible where required

DO NOT: Attempt to cut or drill toughened glass — it will shatter. Hold glass without edge protection. Allow glass-to-metal contact. Over-tighten clamps.',
      '46833846', NULL
    ),
    (
      'Curtain & Drape Installation',
      'Soft Furnishings',
      'Install curtain tracks/rods and drapes with proper drop, stack, and movement.',
      'PURPOSE: Install curtain tracks/rods and drapes with proper drop, stack, and movement.

PRE-REQUISITES: Window/door installation complete. Wall area painted and dry. Drape fabric inspected and measured against drawings.

MATERIALS:
- Curtain track or rod per drawing (ceiling-mounted, wall-mounted, or recessed)
- Brackets and end caps
- Tie-backs if specified
- Mounting hardware appropriate for wall type

PROCEDURE:
1. Confirm mounting height per drawing — typically 150-200mm above window frame, or ceiling-mounted for full-drop drapes.
2. Mark bracket positions level. Maximum 600mm spacing for tracks supporting heavy fabric.
3. Drill and install brackets with appropriate anchors.
4. Mount track or rod.
5. Confirm operation smooth, no binding.
6. Install drapes from one end to other. Distribute pleats evenly.
7. Allow drape to hang minimum 24 hours before final adjustment — fabric will settle.
8. Pin or adjust hem if needed after settling.

ACCEPTANCE CRITERIA:
- Track or rod level (within 2mm over length)
- Drapes hang straight with no bunching
- Drape just touches floor or has consistent 10mm clearance per drawing
- Operation smooth — open and close without effort
- Stack-back position acceptable (drape clears window when open)
- Tie-backs aligned and at consistent height across windows

DO NOT: Mount brackets only into drywall without anchors — must hit framing or use cavity anchors rated for load. Hem drapes before they have settled. Mix bracket types within a window.',
      '46833846', NULL
    ),
    (
      'Sofa Upholstery Standards',
      'Soft Furnishings',
      'Ensure delivered upholstery meets quality, comfort, and durability standards.',
      'PURPOSE: Ensure delivered upholstery meets quality, comfort, and durability standards.

PRE-REQUISITES: Fabric or leather selection approved and quantity verified. Frame design and dimensions per drawing.

MATERIALS:
- Frame: solid wood (teak, sal, or specified hardwood) — kiln-dried, moisture below 12%
- Webbing: rubber elastic or jute as specified
- Foam: high-density (32-40 density for seats, 25-32 for backs), CMHR for fire safety where required
- Fabric: per project selection, with batch consistency for large pieces
- Stitching: lockstitch, matched thread color

PROCEDURE & STANDARDS:
1. Frame to be made of seasoned hardwood with mortise-tenon or dovetail joinery. No nails as primary structural fastener.
2. Webbing applied taut, evenly spaced.
3. Foam cut precisely to frame dimensions. No gaps, no overhang.
4. Cushions filled to specified density with even distribution.
5. Fabric tensioned evenly during upholstering — no wrinkles when seated.
6. Pattern matching across seams where fabric is patterned.
7. Piping straight and consistent where specified.
8. Zippers used on cushion covers for cleaning access.
9. Legs attached securely — metal threaded inserts, not screws into end-grain.
10. Test by sitting in three positions — confirm support, no frame contact, no squeaking.

ACCEPTANCE CRITERIA:
- Frame rigid, no flex when pressed
- Cushions firm with appropriate softness per design intent
- Fabric tension even — no sagging or wrinkles
- Pattern matching consistent at seams
- No exposed staples or raw fabric edges
- All joints clean — no visible glue or thread tails
- Sit-test passes — comfortable, supportive, silent

DO NOT: Use softwood or low-grade plywood for frame. Use low-density foam (under 28 density) — it will collapse. Skip pattern matching. Use staples where stitching is specified.',
      '46833846', NULL
    ),
    (
      'Site Cleanliness & Safety',
      'Studio Operations',
      'Maintain a clean, safe site that supports good workmanship and protects existing finishes.',
      'PURPOSE: Maintain a clean, safe site that supports good workmanship and protects existing finishes.

PRE-REQUISITES: Drawing or area schedule indicating finishes to protect. Initial site condition photographed.

MATERIALS:
- Floor protection: corrugated cardboard, hardboard, or specialized protection film
- Wall protection: bubble wrap or foam where finishes are vulnerable
- Dust sheets for furniture and fittings to remain in place
- Safety signage and PPE per applicable standards

PROCEDURE:
1. Before any trade enters, protect floors with appropriate covering.
2. Protect existing items remaining in place with dust sheets and wrapping.
3. Establish material storage area away from work zones.
4. Daily cleanup: all debris removed at end of each day. Tools stored, not left in walkways.
5. Wet work areas (paint, plaster, concrete) cordoned off until dry.
6. Sharp materials, exposed wires, and trip hazards eliminated or marked.
7. PPE used by all workers — minimum: safety boots, hard hats in active overhead work, eye protection during cutting/drilling.
8. Weekly site walkthrough by site supervisor with photographic record.

ACCEPTANCE CRITERIA:
- No damage to protected surfaces at handover
- No accumulated debris at end of any day
- No tools or material in walkways
- No exposed wires, sharp edges, or trip hazards
- Workers using PPE as required
- Existing finishes adjacent to work zone undamaged

DO NOT: Allow eating or smoking on site. Permit workers without PPE. Skip daily cleanup. Use power tools without confirming circuit protection. Leave site without locking and securing.',
      '46833846', NULL
    ),
    (
      'Drawing Issue & Revision Control',
      'Studio Operations',
      'Ensure vendors and site teams always work from the current approved drawing — never an outdated version.',
      'PURPOSE: Ensure vendors and site teams always work from the current approved drawing — never an outdated version.

PRE-REQUISITES: All drawings drafted, internally reviewed, and approved before issue.

PROCEDURE:
1. Every drawing has a title block including: project name, drawing title, drawing number, scale, date, revision letter (A, B, C), name of drafter, name of approver.
2. First issue is Revision A. Subsequent changes increment to B, C, etc.
3. Revision cloud and revision note placed on the drawing for every change after Revision A.
4. Drawing register maintained showing all drawings, current revision, date of last issue.
5. When new revision issued, send to all relevant parties (vendors, site team) with email confirming revision supersedes prior version — please destroy prior version.
6. Old paper copies on site collected and destroyed when new revision arrives.
7. Site team and vendors confirm receipt and acknowledge replacement.
8. No work proceeds on a drawing older than what is in the latest register.

ACCEPTANCE CRITERIA:
- Drawing register current and accessible to all
- All site copies match the current revision per register
- Revision history visible on every drawing
- No conflict between drawings on site and drawings in the office

DO NOT: Issue drawings without revision number and date. Make undocumented hand-changes to a drawing on site. Send unapproved drawings to vendors. Skip notifying all parties when a revision is issued.',
      '46833846', NULL
    ),
    (
      'Project Handover Checklist',
      'Studio Operations',
      'Close out a project formally with all documentation, snags closed, and warranties handed to the client.',
      'PURPOSE: Close out a project formally with all documentation, snags closed, and warranties handed to the client.

PRE-REQUISITES: All site work complete. All snags identified, fixed, and re-inspected. All vendor accounts settled per terms.

MATERIALS:
- Handover document file with all warranties, maintenance manuals, contact list
- Final photographs (before-and-after, room-by-room)
- Keys, access cards, remote controls

PROCEDURE:
1. Conduct final walkthrough with site supervisor and senior designer — fix any remaining issues before client walkthrough.
2. Compile handover file containing:
   - Warranty certificates from all relevant vendors
   - Maintenance manuals for all appliances, AC, water purifiers, etc.
   - Care instructions for all finishes (wood, stone, fabric)
   - Paint codes used in each room (for future touch-ups)
   - Contact list of vendors with phone numbers and email
   - Drawing set as-built
3. Conduct walkthrough with client. Note any final observations. Close on spot if minor.
4. Hand over keys, remotes, access cards. Demonstrate operation of major fittings (AC, water filter, audio system, smart lighting).
5. Client signs handover acknowledgment confirming receipt of all materials.
6. Take final photographs after client has moved in (with permission) for portfolio.
7. Schedule 30-day post-handover check-in.

ACCEPTANCE CRITERIA:
- All warranty documents collected and in file
- All snags closed and re-inspected
- All keys/access handed over
- Client signed handover acknowledgment
- 30-day check-in scheduled
- Final photographs taken

DO NOT: Hand over with open snags. Skip vendor warranty collection. Leave the site without client sign-off. Promise post-handover work that has not been specifically agreed.',
      '46833846', NULL
    );

  END IF;
END $$;
