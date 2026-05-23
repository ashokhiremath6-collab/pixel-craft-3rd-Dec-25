-- Migration 0006: Update 25 SOPs to v2 deep-content versions
-- Generated from: attached_assets/sops_v2_1779473180866.md
-- Operations: 16 UPDATEs (title unchanged, content replaced),
--             9 DELETEs (old title replaced by renamed v2 title),
--             9 INSERTs (new v2 titles)
-- Idempotent: UPDATE/DELETE are safe to re-run; INSERTs use WHERE NOT EXISTS.
-- All within a single transaction — full rollback on any error.

DO $$
BEGIN

  -- Step 1: Delete 9 old titles replaced by v2 renames
  DELETE FROM sops WHERE title = 'AC Indoor Unit Installation';
  DELETE FROM sops WHERE title = 'CPVC & UPVC Pipe Installation';
  DELETE FROM sops WHERE title = 'Concealed Wiring Installation';
  DELETE FROM sops WHERE title = 'Marble & Stone Installation';
  DELETE FROM sops WHERE title = 'PU Polish (Polyurethane) Application';
  DELETE FROM sops WHERE title = 'Plaster of Paris (POP) False Ceiling';
  DELETE FROM sops WHERE title = 'Project Handover Checklist';
  DELETE FROM sops WHERE title = 'Sofa Upholstery Standards';
  DELETE FROM sops WHERE title = 'Tile Laying - Floor';

  -- Step 2: Update 16 existing rows with v2 content
  UPDATE sops
    SET category    = 'Carpentry & Joinery',
        description = 'Achieve a flat, bubble-free veneer surface with proper grain alignment and edge integrity that remains stable over decades.',
        content     = $sop0$**Purpose:** Achieve a flat, bubble-free veneer surface with proper grain alignment and edge integrity that remains stable over decades. Veneer failures (bubbling, lifting, telegraphing of substrate joints) become visible only after months and are nearly impossible to repair invisibly — the entire panel must be re-veneered.

**System acceptability:**

- **Veneer:** Natural wood veneer 0.5mm minimum thickness. Reconstituted veneers (engineered veneer like Tabu, Alpi) acceptable where consistency of grain matters more than natural variation. Reject any veneer below 0.5mm — it telegraphs every substrate imperfection.
- **Adhesive:** Fevicol SH (white wood adhesive), Fevicol Marine for damp areas, Fevicol Probond for premium furniture. Polyurethane glue (PU glue) for difficult bonds.
- **Substrate:** Only BWP-grade plywood for any veneer work in residential. MR grade is unacceptable — it absorbs ambient moisture and causes veneer to bubble within 1-2 monsoons.
- **Forbidden:** Synthetic resin glues sold loose. PVA glues unsuitable for furniture. Reclaimed plywood with delamination, no matter how well-faced.

**Pre-conditions:**

1. Substrate must be BWP-grade plywood (minimum 18mm for cabinet faces, 12mm minimum elsewhere). Verify ISI marking visible. Photograph stamp.
2. Substrate sanded to 180 grit, dust-free. Critical: any sanding ridges, fastener heads, or filler patches will telegraph through veneer within weeks.
3. Substrate moisture content: maximum 12%. Test before laying.
4. Veneer conditioned in the same environment as the work area for minimum 24 hours before application. Veneer brought from an AC showroom and laid in a non-AC site will buckle as it equilibrates.
5. Workspace temperature 20-30°C. Adhesive will not cure properly outside this range.

**Procedure:**

1. **Layout planning.** Lay out all veneer sheets dry before any glue is applied. Confirm:
   - Grain direction matches drawing (vertical for tall doors, horizontal for drawer fronts unless drawing specifies otherwise)
   - Color and figure match across adjacent panels (veneer comes in flitches — sequential sheets from the same log; book-matching and slip-matching require sheets from the same flitch)
   - Joints between veneer sheets are planned at points where the eye expects a break (panel edges, door joints), never random
   
   This planning step is what separates premium work from average — photograph the dry layout for record.

2. **Substrate preparation.** Sand to 180 grit. Fill any nail holes with matched wood filler, allow to dry, sand flush. Tack-cloth.

3. **Adhesive application.** Apply Fevicol SH uniformly using a notched trowel (3mm notch) or roller. Coverage should be visible by light reflection — no missed areas, no pooling. Apply to substrate only, not to back of veneer (back-coating causes veneer to curl).

4. **Open time.** Allow glue to become tacky (typically 5-10 minutes depending on conditions). Touch test: a finger should not stick but should feel slight tack. Applying veneer too wet causes bubbles; too dry causes adhesion failure.

5. **Veneer placement.** Position veneer carefully — once it touches glue, there is no second chance. Use cauls (flat boards) and clamps to apply uniform pressure across the entire surface. Pressure must be maintained for minimum 4 hours, ideally overnight.

6. **Edge banding before face veneer.** If edges will be visible, apply edge band tape first, trim flush, then apply face veneer overlapping the edge band by 1-2mm. Trim after curing with a sharp paring chisel — never a router (chips face veneer).

7. **Inspect for bubbles within 30 minutes** of application. Run hand over surface — any springiness indicates a bubble. Slit the bubble with a sharp blade along the grain, inject glue with a syringe, re-press immediately. Bubbles detected later cannot be repaired invisibly.

8. **Cure 24 hours minimum** before sanding or trimming. Cure 48 hours before applying any finish.

**Things vendors skip if not watched:**

1. **Dry layout step.** Vendors will lay veneer panel-by-panel without overall planning, resulting in mismatched grain at joints and book-match failures. Require a photograph of the full dry layout before any glue is applied. No exceptions.

2. **Veneer conditioning.** Vendors arrive on site with veneer just unloaded from the truck and start work immediately. Result: bubbling within weeks as the veneer equilibrates. Require veneer to sit on site, stacked flat with weight, for minimum 24 hours before use. Photograph the conditioning.

3. **Open-time discipline.** Vendors either skip the tack-up time (apply veneer to wet glue, causing bubbles) or wait too long (causing adhesion failure). Site supervisor to verify by touch-test before each panel goes down.

4. **Back-side treatment.** A veneered panel must have something applied to the back — either a backing veneer (preferred) or at minimum a sealer coat — to balance moisture absorption. A panel with veneer only on the show face will warp. Require photographic evidence of back-side treatment for every panel.

**Inspection points:**

- **24 hours after application:** Tap every panel. Listen for hollow spots — these are bubbles. Mark and repair before any further work.
- **Before finishing:** Side-light the surface. Any ridges, depressions, or telegraphed substrate joints must be addressed before finish is applied. After finish goes on, defects become permanent.
- **After 30 days:** Re-inspect for delayed bubbling. If any panel shows defects at 30 days, the entire piece is suspect — re-veneer rather than patch.

**Acceptance criteria:**

- No bubbles, lifted edges, or hollow spots detected by tap test
- Grain direction matches drawing on every panel
- Seams between veneer sheets aligned within 1mm
- No glue squeeze-out visible on the face surface or in seams
- Edges clean, no chip-out
- Book-matching or slip-matching consistent per design intent
- Back-side balanced (backing veneer or sealer applied)

**Do NOT:**

- Apply veneer to damp substrate (above 12% moisture)
- Use expired or thickened adhesive
- Skip back-side treatment — unbalanced panels will warp
- Stack panels before adhesive has cured 24 hours
- Sand veneer face before 24-hour cure
- Use a router to trim edges — always paring chisel or hand sanding
- Mix veneer flitches without checking color/figure match
- Lay veneer over unsanded filler patches or visible substrate defects$sop0$,
        updated_at  = NOW()
    WHERE title = 'Veneer Application on Plywood';

  UPDATE sops
    SET category    = 'Painting',
        description = 'Prepare wall surfaces so the paint system bonds, covers evenly, and remains free from peeling, blistering, efflorescence, and color variation for 7+ years.',
        content     = $sop1$**Purpose:** Prepare wall surfaces so the paint system bonds, covers evenly, and remains free from peeling, blistering, efflorescence, and color variation for 7+ years. The single biggest cause of paint failure in Indian residential work is rushed wall preparation — paint that looks excellent at handover and fails at the first monsoon.

**System acceptability:**

- **Wall putty:** Birla White (acrylic-modified white cement putty) — premium. JK White, Asian Paints Tractor Putty — standard. Forbidden: unbranded "white cement putty" sold loose.
- **Primer:** Match to paint system. For emulsion: water-based primer (Asian Paints Decoprime, Berger Bison, Dulux Primer). For enamel: solvent-based oil primer. Cement primer for fresh plaster only.
- **Sandpaper:** 120, 180, 240, 320 grit. Use aluminum oxide papers (sharper, longer-lasting than silicon carbide for wall work).

**Pre-conditions:**

1. Wall plaster fully cured: 28 days minimum from plastering, longer in monsoon. Painting before plaster cure causes peeling and efflorescence (salt deposits surfacing through paint).
2. Moisture content tested below 6% using a pin-type or pinless moisture meter. **Mumbai-specific:** during and after monsoon, walls retain moisture longer than other regions. A wall that reads 6% in February may read 9% in August. Test on the day of painting.
3. All civil work, electrical chasing, plumbing penetrations, AC pipe runs, and false ceiling work complete in the area. Painting first and then chasing causes touch-up patches that never match the original coat.
4. Window glazing and door fitting complete to prevent ingress of rain or dust during painting.

**Procedure:**

1. **Surface assessment.** Inspect wall for cracks (hairline vs structural), holes, loose plaster, efflorescence (white powdery deposits from salt), and existing finish residues. Photograph any structural cracks for the structural engineer — do not paint over.

2. **Crack treatment.**
   - Hairline cracks (under 0.5mm): widen with a V-cutter to create a 3mm V-groove, fill with crack-filler putty, sand flush after cure.
   - Cracks 0.5-2mm: widen, fill with cement-sand-water mortar with bonding agent, allow to cure 7 days before further work.
   - Cracks over 2mm or running diagonally across walls: stop work, refer to structural engineer.

3. **Efflorescence treatment.** White powdery deposits indicate salts migrating through plaster. Brush off thoroughly. If recurring, the wall has a moisture source that must be eliminated before painting. Painting over efflorescence guarantees paint failure within months.

4. **Removal of existing finish.** If repainting over old emulsion that is sound, sanding with 120 grit is sufficient. If old finish is flaking, chalking, or distemper, it must be completely removed by wire brushing and washing. Distemper especially must be fully removed — emulsion will not bond to it.

5. **First putty coat.** Apply Birla White Cement Putty thinly using a putty knife, working into all minor depressions. Coverage approximately 14-18 sqm per kg per coat. Allow drying — 4-6 hours in good conditions, longer in monsoon. Do not exceed 1mm thickness per coat (thicker coats crack).

6. **Sand with 120 grit.** Remove all ridges, knife marks, and high spots. Wall should feel uniformly smooth.

7. **Second putty coat.** Apply over the first, focusing on remaining low spots and imperfections. Sand with 180 grit after drying.

8. **Third putty coat (premium work only).** For high-finish walls receiving silk or soft-sheen emulsion, a third coat ensures the wall is mirror-flat. Sand with 240 grit.

9. **Final sand with 320 grit** for the finish coat to come. Wipe wall clean with damp cloth, allow to dry.

10. **Primer application.** Apply one coat of primer matched to the paint system. Premium emulsion systems require primer specifically designed for the topcoat. The primer is not optional — it is the bonding layer between the alkaline putty/plaster and the paint film.

11. **Spot inspection.** Side-light the primed wall. Any visible defects (pinholes, ridges, putty knife marks) must be addressed now by local spot-filling, sanding, and re-priming. After top coat, defects are permanent.

**Things vendors skip if not watched:**

1. **Moisture testing.** Vendors will skip the moisture meter and rely on touch ("feels dry"). Walls that feel dry to touch can still be at 8-10% moisture. **Require** photograph of the moisture meter reading at multiple points on each wall on the day of painting.

2. **Third putty coat on visible walls.** Vendors apply two coats and call it done. The third coat is what makes a wall mirror-flat under raking light. Require it on all walls where light grazes the surface (walls facing windows, walls behind table lamps).

3. **Cracks treated by putty alone.** Putty is not a structural filler. Vendors fill 1mm cracks with putty and the cracks return within months because the underlying movement is unaddressed. **Require:** all cracks above hairline must be V-cut and filled with mortar before any putty work begins.

4. **Primer dilution.** Vendors dilute primer with excessive water to extend coverage. Result: primer film too thin to bond properly. **Require:** primer dilution per manufacturer specification only, and verify by checking the labeled container has not been topped up with water.

**Inspection points:**

- **After second putty coat:** Check wall flatness with a 1m straightedge — variation must be under 2mm. Re-putty any low spots.
- **After final putty coat:** Pinholes test. Side-light the wall at low angle. Pinholes (small holes from trapped air in putty) will appear as black dots. All must be filled before primer.
- **After primer:** Touch test. Primer should feel uniformly smooth and slightly powdery, never glossy or patchy. Patches of bare putty showing through indicate insufficient primer — apply additional coat in those areas.

**Acceptance criteria:**

- Wall flat to within 2mm over a 1m straightedge
- No visible patches, cracks, pinholes, or putty ridges
- No dust nibs visible under side-lighting
- Primer coat uniform with no patches showing through
- No paint, putty, or dust on adjacent surfaces (skirting, ceiling, switches, frames)
- Moisture content documented as below 6% on day of paint application

**Do NOT:**

- Paint on moist walls — guaranteed to fail
- Skip putty coats to save time
- Use putty thicker than 1mm per coat (cracks)
- Use cement-only filler in place of branded acrylic putty (poor bonding)
- Skip primer because "the wall looks white anyway"
- Apply primer over efflorescence
- Sand without dust extraction or masking — dust contaminates adjacent surfaces and ruins polish work in nearby rooms$sop1$,
        updated_at  = NOW()
    WHERE title = 'Wall Surface Preparation Before Painting';

  UPDATE sops
    SET category    = 'Civil & Masonry',
        description = 'Eliminate water penetration from bathrooms, balconies, and terraces into the structure below.',
        content     = $sop2$**Purpose:** Eliminate water penetration from bathrooms, balconies, and terraces into the structure below. Waterproofing failure is the single most expensive defect in residential interior work — discovery typically requires breaking up finished floors below to access the failed membrane. A bathroom that leaks at month 18 costs more to repair than the entire bathroom cost.

**System acceptability:**

- **Premium systems (recommended for all residential):** Sika SikaLastic, BASF Mastertop, Fosroc Brushbond — cementitious flexible waterproofing membranes.
- **Standard:** Pidilite Dr. Fixit URP (Universal Roof Pack), Asian Paints SmartCare Damp Sheath — acrylic-cement systems.
- **Crystalline systems:** Penetron, Xypex — added to the screed itself rather than applied as a membrane. Suitable as a secondary system but not as the only line of defense.
- **Forbidden:** Bitumen-based products (smell, yellowing, incompatible with tile adhesives). Unbranded "waterproofing chemicals" sold loose. Single-component cement slurry as primary waterproofing.

**Pre-conditions:**

1. Substrate (concrete slab or screed) cured minimum 28 days, longer if monsoon. Wet substrate cannot be properly waterproofed.
2. Substrate must be structurally sound — no cracks above 0.5mm. Any cracks must be V-cut and filled with bonding mortar before waterproofing begins.
3. Floor slopes towards drain at minimum 1:80 (12.5mm per meter). Drainage slope tested by water flow — pour water at the farthest corner and verify it reaches the drain without ponding. **Critical:** waterproofing applied over a poorly sloped floor will still leak through the slope failure.
4. All plumbing rough-in complete and pressure-tested. Drainage pipes installed and tested with smoke. Any leaks in plumbing must be addressed before waterproofing begins — waterproofing is the last line of defense, not the first.
5. All MEP penetrations (drainage, water supply, AC drainage) sleeved with appropriate collars.
6. Substrate cleaned: no dust, no oil, no loose particles, no laitance (the weak surface layer of cement slurry that forms during concrete curing — must be ground off).

**Procedure:**

1. **Fillet at junctions.** Form a 75mm × 75mm coved fillet at all wall-floor junctions and at junctions between vertical surfaces. Use cement-sand mortar 1:3 with bonding agent. The fillet eliminates the 90° corner where water sits and waterproofing membranes fail. **Critical:** any waterproofing applied without a fillet at junctions will fail at those junctions within 2-3 years.

2. **Substrate primer (if specified by system).** Some systems require a primer coat or bonding agent. Apply per manufacturer instructions.

3. **First coat of waterproofing.**
   - Mix per manufacturer specification — typically a 2-component cementitious system has a strict ratio that cannot be eyeballed. Mix only what can be applied in the pot life window.
   - Apply with brush or trowel at the specified thickness — typically 1-1.5mm per coat for cementitious systems.
   - Carry the coating up walls: minimum 300mm in showers, 200mm elsewhere. For wet showers (no shower enclosure), carry up to ceiling.
   - Coverage on every square millimeter — pay special attention to corners, edges, around drains and pipe penetrations.

4. **Reinforcement at vulnerable points.** Embed fiberglass mesh or polyester fabric in the first coat at:
   - All wall-floor junctions over the fillet
   - All corners
   - Around all drain bodies
   - Around all pipe penetrations
   - Across any visible cracks or substrate joints
   This reinforcement bridges movement and prevents cracking of the membrane.

5. **Allow drying** per manufacturer (typically 6-8 hours between coats).

6. **Second coat.** Apply perpendicular to the first (if first was horizontal strokes, apply second vertical). This ensures complete coverage with no thin spots. Same thickness as first coat.

7. **Third coat (premium work).** A third coat is recommended for showers, terraces, and any area receiving heavy water exposure. Bathrooms with only handwash basins can be done with two coats.

8. **Full cure: 24-48 hours** before any testing or further work, per manufacturer.

9. **Ponding test.** This is the single most important step. Block the drain. Fill the entire bathroom floor with 25mm depth of water. Mark the water level. Leave for 24 hours. After 24 hours:
   - Water level should not have dropped by more than 2mm (acceptable for evaporation)
   - No leakage should be visible in the ceiling of the room below
   - No damp patches on adjacent walls
   - No water visible at the perimeter outside the bathroom
   
   If any of these fail, the entire waterproofing must be redone. There is no acceptable partial repair.

10. **Photographic record.** Photograph the ponding test in progress, the water level marking, and the inspection of the ceiling below. These photographs are part of the project record — keep them.

11. **Protection coat.** Apply a thin cement-sand protective screed (10-15mm) over the cured waterproofing before tiling. This protects the membrane from damage during tile laying.

12. **Only after ponding test passes** and protection screed is laid, proceed to tiling.

**Things vendors skip if not watched:**

1. **The fillet.** This is the single most-skipped step. The 75mm × 75mm coved fillet at wall-floor junctions is what prevents the membrane from cracking at the 90° corner where water collects. Vendors will apply waterproofing into a sharp corner and call it done. **Require** photographic evidence of every fillet before waterproofing begins.

2. **The ponding test.** Vendors will declare waterproofing complete after the second coat dries and pressure to proceed to tiling. They will say "we'll do the test after tiling" — by which point a failure is unfixable without breaking the tiles. **The ponding test is non-negotiable and must happen before tiling.** No exceptions for schedule pressure.

3. **Reinforcement at vulnerable points.** The fiberglass mesh embedded at junctions and around penetrations is invisible after the second coat and vendors skip it routinely. **Require** photographic evidence of mesh placement during the first coat before the second coat is applied.

4. **Coverage at penetrations.** Around drain bodies and pipe collars, the waterproofing must be applied thickly and overlap the collar by at least 50mm. Vendors apply thin coats that fail at exactly the points where water concentrates. Inspect every penetration personally.

5. **Wall coverage height.** Vendors apply waterproofing only at the floor and the bottom 100mm of walls. Showers need full coverage to ceiling. Other wet areas need minimum 200mm. Specify the height in the drawing and verify by measurement.

**Inspection points:**

- **Before first coat:** Verify fillets at every junction. Photograph each.
- **Between coats:** Verify reinforcement mesh at vulnerable points. Photograph each.
- **After full cure:** Conduct ponding test. Document with photographs and water level markings.
- **Below ceiling:** Inspect ceiling of room below during ponding test. Damp patches indicate failure — find the source.
- **At penetrations:** Verify thick coating around every drain and pipe.

**Acceptance criteria:**

- Continuous coating with no pinholes, thin spots, or unfilled corners
- Coverage up walls to specified heights (300mm minimum, more in showers)
- Fillets visible and intact at every wall-floor junction
- Reinforcement mesh visible (in photographs) at all vulnerable points
- Ponding test passes with zero leakage below and water level drop under 2mm
- Photographic record of all coats, mesh placement, and ponding test
- Protection screed applied before tiling

**Do NOT:**

- Apply waterproofing over wet substrate
- Apply waterproofing over uncured plaster or screed
- Skip the fillet at wall-floor junctions — guaranteed failure
- Skip the reinforcement mesh at corners and penetrations
- Skip the ponding test under any circumstances
- Tile over waterproofing before ponding test passes
- Tile over waterproofing before protection screed is applied (tiles will puncture the membrane)
- Accept "we'll test after the tiles are down" — this is the most common excuse for waterproofing failure$sop2$,
        updated_at  = NOW()
    WHERE title = 'Waterproofing in Wet Areas';

  UPDATE sops
    SET category    = 'Plumbing & Sanitary',
        description = 'Install sanitary fixtures level, properly sealed, and leak-tested with attention to long-term water integrity.',
        content     = $sop3$**Purpose:** Install sanitary fixtures level, properly sealed, and leak-tested with attention to long-term water integrity. Sanitary installation defects (slow leaks at concealed pipe joints, failed wax seals on WCs, water damage from improperly sealed fixtures) cause progressive water damage that may not be visible for months but compromises the entire bathroom.

**System acceptability:**

- **Fixtures:** Premium — Kohler, Toto, Duravit, Villeroy & Boch, Roca, Hansgrohe. Standard — Jaquar, Cera, Hindware (premium ranges), American Standard. Match to project specification.
- **Concealed cisterns:** Geberit, Grohe, Roca, Jaquar (premium models). Forbidden: locally manufactured concealed cisterns without service-life warranty.
- **Sealant:** Silicone, sanitary-grade, mold-resistant (Dow Corning 786, Wacker Elastosil 600, Pidilite Roff Sealant). Color matched to fixture. Forbidden: bath sealant or general-purpose silicone (not mold-resistant in wet areas).
- **WC seal:** Wax ring or rubber gasket per WC manufacturer specification. Never both, never neither.
- **Water connection fittings:** Brass or stainless steel — never plated steel (corrodes within a year). PTFE tape on threaded joints, not on compression joints.
- **Forbidden:** Locally fabricated fittings. Aluminum drainage components in sight lines. Reused sealant tubes that have been opened more than 30 days.

**Pre-conditions:**

1. Wall and floor tiling complete in the bathroom. **Critical:** Sanitary fixtures must be installed last in the bathroom sequence, after all wet work is fully cured. Fixtures installed before tiling complete will be damaged or contaminated.
2. Water supply lines pressure-tested and capped at fixture points. Verify pressure test report.
3. Drainage lines connected and tested with smoke test (smoke pumped into the drainage line should not emerge anywhere except the intended terminations).
4. Fixtures inspected on arrival for damage. Check:
   - Glazing intact (no cracks, chips, or "stars" in the ceramic)
   - Drilled holes correctly positioned for the chosen tapware
   - All packaging components present (mounting hardware, gaskets, instruction manuals)
   - For concealed cisterns: all internal components present and functional
   Photograph any damage on arrival. Reject damaged fixtures before unpacking.
5. Wall waterproofing test (ponding test) passed. Sanitary work proceeding before waterproofing is verified means any fixture-area leak goes undetected until structural damage occurs.

**Procedure:**

1. **Position confirmation.** Mark the exact fixture position per drawing. Verify:
   - Centerline alignment (basin centered on vanity, WC centered on the back wall, etc.)
   - Height per design specification — basins at 850-900mm rim height, WC seats at 400-420mm seat height from floor
   - Clearances (basin minimum 200mm from any wall, WC minimum 350mm from any side wall)
   - Tapware position aligned with fixture
   Mark mounting points on the wall.

2. **Drilling for wall-mounted fixtures.**
   - Use carbide-tipped drill bit appropriate for the tile type (porcelain needs specifically rated bits; ceramic tile is more forgiving).
   - Drill speed: low, with no hammer action. Hammer action cracks tile.
   - Apply masking tape over the drill point first to prevent bit walking.
   - Use water spray to cool the drill bit and lubricate the cut.
   - Drill through the tile first, then switch to a masonry bit for the wall behind. Switching bits prevents the masonry bit from cracking the tile face.

3. **Wall plug insertion.**
   - Use plastic wall plugs sized for the wall material — concrete uses different plugs than brick or block.
   - Hammer plugs flush with the wall — never proud, never recessed.
   - Verify plug holds by attempting to pull out with pliers — should require significant force.

4. **Fixture mounting.**
   - **For wall-mounted WCs and basins:** Mount the carrier frame or bracket first, level it both directions, secure to the wall. Then hang the fixture on the carrier. The carrier takes the load; the fixture sits in position.
   - **For floor-mounted WCs:** Set the wax seal or rubber gasket on the floor drain flange. Lower the WC onto the seal evenly — never tilt. Press down firmly to seat the seal. Secure with floor bolts but do not over-tighten (cracks the porcelain).
   - **For basins on vanity tops:** Apply a continuous bead of clear silicone around the basin cutout. Lower the basin into position, press down firmly, remove excess silicone immediately.

5. **Water connection.**
   - Install a quarter-turn shut-off valve at every fixture supply. The valve must be accessible — typically inside the cabinet or behind a removable panel. Inaccessible shut-offs mean future repairs require shutting off the main water supply.
   - Use flexible braided stainless steel supply lines (preferred) or rigid copper supply lines. Never reused supply lines.
   - PTFE tape on threaded joints — 3-4 wraps in the direction of thread engagement.
   - Compression joints: hand-tight plus 1/4 turn with a wrench. Over-tightening damages the olive (ferrule).
   - Test for leaks immediately after connection. Open the supply, observe for 5 minutes minimum. Wipe joints dry — any moisture indicates a leak.

6. **Drainage connection.**
   - Match the drainage outlet to the fixture (32mm for basins, 40mm for sinks, 100mm for WCs).
   - Verify the P-trap (or S-trap, per fixture) has water in it after testing — the water seal prevents sewer gas.
   - For basins: install the pop-up waste mechanism before connecting the trap. Test the pop-up action.
   - For WCs: connect the soil pipe with proper sealing — no gaps, no exposed waste pipe.

7. **WC cistern installation.**
   - For close-coupled cisterns: install the cistern on the WC pan with the manufacturer-supplied gasket. Tighten the cistern bolts evenly — alternating sides — to avoid cracking the porcelain.
   - For concealed cisterns: install before tiling. Frame must be square and level. Cistern access panel must be accessible after tiling.
   - Fill the cistern and verify the inlet valve shuts off properly. Verify the flush valve seals without leaking from cistern to bowl.
   - Adjust the fill level per the cistern's mark.

8. **Sealing.**
   - Apply silicone sealant where fixture meets wall and floor. Single continuous bead.
   - Tool the bead with a wet finger or silicone tool for a clean concave profile. Wipe away excess immediately.
   - **Critical:** Silicone needs 24 hours to cure before the area is exposed to water. Do not use the bathroom during this period.

9. **Leak test.**
   - Run the fixture for minimum 10 minutes.
   - Check every joint visually and by feel (run a dry tissue along each joint — any moisture shows up).
   - Open and close the shut-off valves repeatedly to verify operation.
   - Flush the WC multiple times to verify full flush action and no leaks at the cistern-to-bowl joint, the WC-to-floor joint, and the soil pipe connection.
   - Fill the basin to overflow level and let it drain — verify the overflow works and the drainage is fast.

10. **Final cleanup.**
    - Wipe down all fixtures with appropriate cleaner.
    - Remove all packaging, debris, and tools from the bathroom.
    - Test all functions one final time with the project supervisor present.

**Things vendors skip if not watched:**

1. **Quarter-turn shut-off valves at every fixture.** Vendors will run pipes direct to fixtures without isolation valves. This means any future fixture replacement requires shutting off the entire bathroom's water (or the entire flat's water). **Require** a shut-off valve at every fixture point, accessible without removing tiles.

2. **WC wax seal application.** Vendors will set a WC on cement mortar instead of a proper wax seal. The cement-mortar seal cracks within months as the WC moves slightly under use, and sewer gas leaks into the bathroom. **Require** the manufacturer-specified wax ring or rubber gasket. Inspect before WC is set.

3. **Drainage slope at trap and connections.** Vendors will install P-traps without ensuring the outgoing drain pipe has adequate slope. The trap holds water (as designed) but the outgoing pipe doesn't drain properly, causing slow drainage and gurgling. **Verify** the drainage slope downstream of every fixture.

4. **Tightening method on threaded joints.** Vendors will use pipe wrenches with maximum force on chrome or brass joints — leaving tool marks and over-stressing threads. Threads damaged on installation leak slowly over years. **Require** proper tools — adjustable spanners with smooth jaws for chrome fittings, never pipe wrenches.

5. **Sealant quality.** Vendors substitute general-purpose silicone for sanitary-grade. General-purpose silicone grows mold and discolors within months in a wet environment. **Verify** the sealant brand on the tube.

6. **Leak observation time.** Vendors will turn on water, see no immediate drip, and declare done. Slow leaks at compression joints can take 30 minutes to show. **Require** a documented 30-minute observation period after every supply connection.

7. **Concealed cistern access.** Vendors will install the cistern access panel improperly so it cannot be removed for service. When the cistern needs repair (typically 5-7 years in for the inlet or flush valve), the entire wall has to be broken. **Verify** the access panel can be removed and reinstalled cleanly before final wall finishing.

**Inspection points:**

- **Before fixtures arrive:** Confirm tiling complete, waterproofing tested, drainage lines tested.
- **At fixture arrival:** Inspect for damage before unpacking.
- **At mounting:** Spirit level on every fixture — both axes.
- **After supply connection:** 30-minute leak observation, dry tissue test on every joint.
- **After drainage connection:** Smoke test or water test to verify no leaks.
- **After 24-hour sealant cure:** Final leak check before use.

**Acceptance criteria:**

- All fixtures level both directions
- No leaks at any joint after 30-minute test and again at 24 hours
- All shut-off valves accessible and operational
- All concealed cistern access panels accessible
- Sealant beads clean, continuous, no gaps, color matched to fixture
- Fixtures firm — no movement or wobble when pressed
- All flush actions work smoothly with full flush volume
- All drains run clear with no slow drainage
- All overflow drains functional
- WC seat fits properly without rocking
- Tapware operates smoothly with no drips when closed

**Do NOT:**

- Set a WC without proper wax seal or rubber gasket
- Use general-purpose silicone on bathroom fixtures
- Skip the shut-off valve at any fixture
- Over-tighten porcelain fixings (cracks the ceramic)
- Use pipe wrenches on chrome or brass fittings
- Connect drainage without verifying downstream slope
- Tile over the concealed cistern access panel
- Test for leaks for only 1-2 minutes
- Reuse old supply lines, gaskets, or sealants
- Install fixtures over uncured silicone$sop3$,
        updated_at  = NOW()
    WHERE title = 'Sanitary Fixture Installation';

  UPDATE sops
    SET category    = 'Glass & Aluminium',
        description = 'Install aluminium frames that are square, weather-sealed against rain and wind, properly anchored, and operate smoothly for decades.',
        content     = $sop4$**Purpose:** Install aluminium frames that are square, weather-sealed against rain and wind, properly anchored, and operate smoothly for decades. Window and door installation defects are the single biggest source of monsoon water ingress into Mumbai homes — defects manifest only during heavy rain, when discovery and repair are extremely difficult.

**System acceptability:**

- **Frames:** Premium — Schueco, Reynaers, Aluk, AluPlast. Standard — Aluplast (Indian), Domal (Hindalco), Jindal Aluminium. Match section profile to specification — different profiles have different thermal performance, water resistance, and structural capacity.
- **Glass:** As per drawing — typically 5mm or 6mm clear for single glazed, 5+12+5 double glazed for thermal/acoustic performance, toughened for safety where panels are large or in walking zones.
- **Glazing sealant:** Structural silicone for structural glazing (Dow Corning 995, GE SilPruf), weatherseal silicone for general glazing (Dow Corning 791, Wacker Silres).
- **Perimeter sealant:** Polyurethane weatherproof sealant (Sika Sikaflex, Bostik Seal'n Flex) — never plain silicone for perimeter sealing (silicone doesn't bond to concrete reliably).
- **Fixing:** Stainless steel or galvanized fixings, never plated steel (rusts and stains the frame).
- **Hardware:** Premium — Hopper, GU, Maco, Roto. Standard — Domal, Bracket. Match to project budget tier.
- **Forbidden:** Locally fabricated frames without certified section dimensions. Plated steel fixings. Generic silicone for perimeter weatherproofing.

**Pre-conditions:**

1. Structural opening dimensioned per drawing. Verify by measurement:
   - Width and height within ±10mm of specified
   - Diagonals equal within 5mm (square check)
   - Lintel and sill flat and level
   - Reveal depth consistent
   - **Critical:** Out-of-square openings cannot be corrected during installation. Either the wall must be re-formed or the frame must be undersized to fit, leaving large gaps that compromise weatherproofing.
2. Frame supplier confirmation that the delivered frames match the structural opening (frames are manufactured to specific dimensions and cannot be modified on site without compromising the section integrity).
3. Drawing specifies: frame section, glass type, hardware schedule, opening direction (inward, outward, sliding), and weatherproofing standard.
4. The wall around the opening is structurally complete — no further chasing, drilling, or major work will happen near the frame after installation.

**Procedure:**

1. **Frame inspection on arrival.**
   - Verify section profile matches specification (compare against drawing).
   - Check for transit damage — scratches, dents, bent corners.
   - Verify all hardware items are included.
   - Check glass on arrival for cracks, scratches, and edge damage.
   - Reject damaged components before installation. Photograph any damage.

2. **Opening preparation.**
   - Remove any debris, loose mortar, or projections from the opening.
   - The opening should have a clean perimeter with no protruding bricks or mortar globs.
   - Verify the substrate around the opening will hold fixings — solid concrete or properly mortared brick. Areas of weak mortar must be made good.
   - Apply a primer/sealer to the opening perimeter if the wall material is porous (concrete is fine; some brick types absorb sealants).

3. **Frame positioning.**
   - Place the frame in the opening using packers (typically wood or PVC packers, never metal — corrosion risk).
   - Packers positioned at the corners and at intermediate points along each edge — typically every 600mm.
   - Use the packers to:
     - Center the frame in the opening (equal gap left and right)
     - Plumb the frame vertically (both jambs)
     - Level the frame horizontally (head and sill)
     - Square the frame (diagonals equal)
   - Verify with spirit level on every face of the frame.
   - The gap between frame and opening should be 10-15mm all around — this is the sealant gap.

4. **Fixing the frame.**
   - Drill fixing holes through the frame into the substrate.
   - Use the manufacturer's specified fixing type and size — typically stainless steel screws into wall plugs, or expansion anchors for concrete.
   - Fixing positions per manufacturer: typically 600mm centers, with fixings within 150mm of every corner.
   - Tighten fixings firmly but not excessively — over-tightening distorts the frame.
   - **Critical:** After every fixing is in, re-check frame square. Diagonals should still be within 2mm.

5. **Glass installation.**
   - Verify glass dimensions and type before installation.
   - Use setting blocks at the bottom edge of every glass pane — synthetic setting blocks at quarter-points (25% in from each bottom corner). Never glass directly on aluminium — vibration cracks the glass over years.
   - For dry-glazed systems (gaskets only): seat the glass into the inner gasket, fit the outer gasket, ensure both gaskets are continuous with no gaps at corners.
   - For wet-glazed systems (silicone): apply structural silicone bead per manufacturer specification, set the glass into the bead, tool the silicone to ensure full contact.

6. **Hardware installation and adjustment.**
   - Install all hinges, handles, locks, and stays per drawing.
   - Verify operation: doors swing freely, windows open and close smoothly, locks engage without forcing.
   - Adjust hinges to align the panel within the frame — equal gap on all sides when closed.
   - For sliding systems: verify the rollers run smoothly with no scraping. Adjust roller height as needed.

7. **Perimeter weatherproofing.**
   - This is the most critical step for water-tightness.
   - Apply backer rod (closed-cell foam round profile) in the gap between frame and opening. Backer rod compressed to 50% diameter.
   - Apply polyurethane weatherproof sealant over the backer rod, both inside and outside the opening.
   - Tool the sealant for a clean, slightly concave bead.
   - **Critical:** The sealant bead must be continuous with no gaps. Any gap allows water ingress during driving rain.

8. **Drainage provision.**
   - Modern aluminium frames have drainage slots at the bottom of the frame — water that gets past the gaskets exits through these slots to the outside.
   - Verify these slots are open and not blocked by sealant or debris.
   - The drainage path must drain to the exterior, never into the building cavity.

9. **Water test.**
   - After all sealants have cured (24-48 hours per sealant), conduct a water test:
     - Spray the frame and surrounding wall with water at moderate pressure (garden hose, not pressure washer) for 5 minutes.
     - From the inside, check for any water ingress at the frame, the perimeter, or anywhere on the surrounding wall.
     - Any water inside indicates a sealing failure that must be located and corrected.
   - Repeat the water test from different angles to simulate driving rain in different directions.
   - Mumbai-specific: this test should be done at higher pressure to simulate monsoon conditions.

10. **Final adjustment and cleanup.**
    - Final hardware adjustment after the frame has settled.
    - Remove protective films from frame and glass.
    - Clean glass and frame.
    - Verify all keys, remote controls (for motorized systems), and operating instructions are handed over.

**Things vendors skip if not watched:**

1. **Squaring the frame.** Vendors will fix the frame to the opening without verifying square — relying on the opening being square. Out-of-square frames result in doors and windows that don't close properly, locks that don't engage, and gaps where water enters. **Require** diagonal measurement before and after fixing.

2. **Packers behind every fixing.** Without packers, the fixings pull the frame inward and distort it. Vendors will skip packers to save time. **Verify** packer placement before any fixing is driven.

3. **Setting blocks under glass.** Without setting blocks, glass rests directly on aluminium and cracks from vibration over months. Vendors will skip setting blocks because they're small and easily lost. **Require** photographs of setting block placement before glass is installed.

4. **Backer rod in the sealant joint.** Without backer rod, the sealant fills the entire depth of the joint and adheres on three sides instead of two. Three-sided adhesion causes sealant failure as the joint moves seasonally. **Require** backer rod installation — verify by inspection before sealant is applied.

5. **Sealant continuity.** Vendors apply sealant in sections and miss the corners where one section ends and another begins. The corners are where water gets in. **Inspect** every corner after sealant is applied. Any visible gap requires immediate touch-up.

6. **Drainage slot blockage.** Vendors will fill the drainage slots with sealant during the weatherproofing step. The slots are essential for the frame's designed drainage — blocking them means water has nowhere to go and ingresses inward. **Verify** drainage slots are open after sealant application.

7. **Skipping the water test.** Vendors will resist the water test because it's the test that catches their mistakes. **Require** the water test as part of acceptance. Do not pay the final installment until the water test has been conducted with the project supervisor present.

8. **Sealant on dirty surfaces.** Vendors apply sealant over dust and debris in the joint. Sealant doesn't bond to dust and the joint fails within months. **Require** thorough cleaning of the joint before sealant.

**Inspection points:**

- **Before fixing:** Frame square verified (diagonals equal within 2mm).
- **After fixing:** Frame square re-verified.
- **Glass installation:** Setting blocks visible at correct positions.
- **Sealant application:** Backer rod visible, sealant continuous with no gaps at corners.
- **Drainage:** Slots open and clear.
- **Water test:** Conducted with supervisor present, no water ingress observed.

**Acceptance criteria:**

- Frame square (diagonals within 2mm)
- All openings (doors, windows, sashes) operate smoothly with no binding
- All locks engage fully without forcing
- Glass set with setting blocks, no glass-to-frame contact
- Sealant continuous, no gaps, tooled cleanly
- Drainage slots open and functioning
- Water test passes — no ingress under moderate spray for 5 minutes from multiple directions
- Hardware all functioning, keys handed over
- Glass and frame clean, no scratches
- Protective films removed
- Visual: frame sits cleanly in opening with uniform reveal all around

**Do NOT:**

- Force a frame into an out-of-square opening — either correct the opening or remake the frame
- Skip packers
- Skip setting blocks
- Use plain silicone for perimeter weatherproofing — must be polyurethane
- Skip backer rod (three-sided adhesion fails)
- Block drainage slots with sealant
- Apply sealant to dirty surfaces
- Skip the water test
- Accept "we'll do the water test in monsoon" — by then, fixing problems is much harder
- Use plated steel fixings (corrode and stain the frame)
- Tile or finish the surrounding wall before water test passes$sop4$,
        updated_at  = NOW()
    WHERE title = 'Aluminium Window & Door Installation';

  UPDATE sops
    SET category    = 'Glass & Aluminium',
        description = 'Install toughened glass safely, with proper edge protection, setting blocks, and secure fixing that doesn''t fail catastrophically.',
        content     = $sop5$**Purpose:** Install toughened glass safely, with proper edge protection, setting blocks, and secure fixing that doesn't fail catastrophically.

**System acceptability:**

- **Glass:** Toughened to IS 2553 standard. Verified by markings (typically etched on the glass with manufacturer, thickness, "T" for toughened).
- **Setting blocks:** Synthetic (typically EPDM or Neoprene), appropriate hardness (Shore A 80-90).
- **Structural sealant (where used):** Dow Corning 995, GE SilPruf, Sika SikaSil — structural-grade silicone.
- **Hardware:** Hopper, Dorma, Geze (premium). Ozone, Yale (standard).
- **Forbidden:** Annealed (non-toughened) glass where toughened is specified (safety risk). Field-modification of toughened glass (cutting or drilling) — must be done before tempering.

**Pre-conditions:**

1. Glass dimensions verified before tempering. Once toughened, the glass cannot be cut or drilled — any modification shatters the glass.
2. Holes drilled (if needed for hardware) before tempering.
3. Edges polished — toughened glass with rough edges has a higher risk of spontaneous breakage from edge defects.
4. Frame or fixing system installed and ready to receive glass.

**Procedure:**

1. **Verify glass on arrival.**
   - Check dimensions against specification.
   - Inspect edges for chips, scratches, or roller wave distortion (a manufacturing defect visible under reflected light).
   - Verify the toughening mark.
   - Reject damaged glass before installation.

2. **Handling.**
   - Use suction cups for moving large panels.
   - Workers wear gloves and safety boots.
   - Edge protection during handling — toughened glass that breaks shatters into many small pieces but can still injure.
   - Two-person minimum for any glass over 1m² .

3. **Setting block placement.**
   - Place setting blocks at the bottom edge of the glass.
   - Position blocks at quarter-points: 25% of the width in from each bottom corner.
   - Block dimensions appropriate for the glass weight (typically 100mm × glass thickness × 10mm for residential).
   - **Never set glass directly on aluminium or steel** — vibration cracks the glass.

4. **Glass placement.**
   - Lower glass carefully onto setting blocks.
   - Two persons for any glass over 1m².
   - Verify the glass sits firmly on both setting blocks (not just one).

5. **Hardware installation.**
   - Tighten hardware (clamps, patch fittings) to manufacturer's torque specification — not maximum force.
   - Over-tightening creates stress concentrations that lead to spontaneous breakage.
   - Glass should be held firmly but not over-constrained.

6. **Sealant application (where specified).**
   - Apply structural silicone bead per manufacturer for the system.
   - Tool the bead for clean appearance and full contact.
   - Toughened glass should never be fully sealed all around — must have provision for movement.

7. **Safety markings.**
   - Large glass panels in walking zones must have visibility markings (etched dots, frosted bands, or applied film at 1500mm height) per safety codes — prevents people from walking into the glass.

**Things vendors skip if not watched:**

1. **Setting blocks.** Vendors will set glass directly on the metal frame. Vibration causes spontaneous breakage within months. **Require** setting blocks visible at quarter points.

2. **Edge protection.** Vendors will drag glass across other glass or against metal during handling. Edge chips create stress points that cause spontaneous breakage. **Verify** edges intact on installation.

3. **Over-tightening hardware.** Vendors over-torque clamps because "tighter is better." Toughened glass under stress fails unpredictably. **Verify** torque against manufacturer specification.

4. **Substitution of annealed for toughened.** In safety-critical positions (shower doors, balcony railings, walking-zone partitions), vendors substitute cheaper annealed glass. **Verify** toughening mark on every panel.

5. **Sealant where it shouldn't be.** Vendors fully seal around toughened glass, preventing thermal movement. The constraint causes spontaneous breakage. **Verify** the sealant pattern matches the system specification.

**Acceptance criteria:**

- Glass set true and level
- No edge contact with metal frame — always via setting blocks
- Setting blocks at correct quarter-point positions
- Hardware tight to specification, not over-torqued
- Toughening mark visible
- Safety decals or films visible where required
- No spontaneous breakage in first 30 days (toughened glass typically fails early if there's a manufacturing defect)

**Do NOT:**

- Attempt to cut or drill toughened glass after tempering
- Handle glass without edge protection
- Allow direct glass-to-metal contact
- Over-tighten clamps
- Substitute annealed for toughened glass
- Skip safety markings on walking-zone panels$sop5$,
        updated_at  = NOW()
    WHERE title = 'Toughened Glass Installation';

  UPDATE sops
    SET category    = 'Painting',
        description = 'Apply interior emulsion paint to achieve uniform color, sheen, and coverage with no application marks.',
        content     = $sop6$**Purpose:** Apply interior emulsion paint to achieve uniform color, sheen, and coverage with no application marks.

**System acceptability:**

- **Premium emulsion:** Asian Paints Royale (Luxury, Aspira, Health Shield), Berger Silk, Dulux Velvet Touch.
- **Standard:** Asian Paints Tractor Emulsion, Berger Bison Emulsion, Dulux Promise.
- **Exterior:** Apex Ultima, Berger Weathercoat, Dulux Weathershield.
- **Sheen levels per drawing:** Matte, soft sheen, silk, semi-gloss.
- **Forbidden:** Distemper (limewash) — not paint. Unbranded "emulsion" sold loose.

**Pre-conditions:**

- Wall surface prepared per Wall Surface Preparation SOP.
- Primer coat dry minimum 4 hours.
- Area cleared of dust-producing activity.

**Procedure:**

1. **Stir paint thoroughly.** Mix multiple cans of the same color into a single container ("boxing") for color uniformity across a wall. Color variation between cans of the same shade and batch is real and visible.

2. **Cutting in.** Cut in edges, corners, and around switches with a quality brush (Asian Paints Premier or Wagner brushes). Keep a wet edge — work from cut-in into the field.

3. **Roller application.**
   - First coat: roll in one direction, then cross-roll to even out.
   - Use a quality roller (Asian Paints Roller or Wooster roller) sized for the surface — 7" for fields, 4" for trim and tight areas.
   - Maintain a wet edge — never roll over a partially dried section.

4. **Recoat interval.** 4-6 hours minimum (longer in humid weather). Recoating before the previous coat is dry causes pulling, lap marks, and color streaking.

5. **Inter-coat sanding.** Light sanding (320 grit) only on any imperfections — runs, drips, or dust nibs.

6. **Second coat.** Apply per the same technique. **Two coats minimum on all walls.** Third coat where covering deep colors or for premium finish areas.

**Mumbai-specific note:** During monsoon, recoat intervals extend significantly due to humidity. Force-drying with fans is acceptable; force-drying with heat lamps is not.

**Things vendors skip if not watched:**

1. **Boxing of paint.** Vendors will use one can at a time, resulting in subtle color variations as new cans are opened. **Require** boxing for all walls and rooms.

2. **Two coats.** Vendors will apply one heavy coat to save time. The result looks good for a few weeks but lacks the durability and color depth of two proper coats. **Require** two coats minimum on every wall.

3. **Wet edge maintenance.** Vendors will leave a wall half-painted, take a break, and return to find a hard lap mark when they continue. **Require** that any single wall is completed in one session.

4. **Edge cutting quality.** Vendors will cut edges with a worn brush, leaving wavy lines at the ceiling and corners. **Inspect** all edge cuts under raking light.

**Acceptance criteria:**

- Color uniform across each wall (no patches, no roller marks visible)
- Sheen even (no flashing where coats overlap)
- Edges and corners cut cleanly
- No drips, runs, or holidays
- No paint on adjacent surfaces (skirting, ceiling, switches)
- Coverage complete — no primer visible through finish

**Do NOT:**

- Recoat before previous coat is dry
- Mix different brands or different batches without boxing
- Apply in direct sunlight on exterior walls (causes drying defects)
- Skip the second coat regardless of how good the first coat looks
- Paint with windows open if humidity is over 80% (paint won't cure properly)$sop6$,
        updated_at  = NOW()
    WHERE title = 'Emulsion Paint Application';

  UPDATE sops
    SET category    = 'Painting',
        description = 'Apply enamel finish to wood trim, doors, frames, and metal surfaces with proper preparation and durable coverage.',
        content     = $sop7$**Purpose:** Apply enamel finish to wood trim, doors, frames, and metal surfaces with proper preparation and durable coverage.

**System acceptability:**

- **Wood enamel:** Asian Paints Apcolite Premium Enamel, Berger Luxol, Dulux Aquanamel (water-based).
- **Metal enamel:** Asian Paints Apcolite for metal, Berger Synthetic Enamel.
- **Primers:** Wood primer (oil-based or water-based depending on enamel type), metal primer (zinc chromate or red oxide for ferrous metal).

**Pre-conditions:**

- Substrate sanded smooth, dust-free.
- Metal substrates: any rust removed mechanically or chemically. Wire brushing for surface rust, sand-blasting for heavy rust.
- Primed appropriately.

**Procedure:**

1. Sand substrate to 240 grit. Wipe clean with tack cloth.
2. Apply primer suitable for substrate. Allow full drying — typically 8 hours for solvent-based, 4 hours for water-based.
3. Sand primer with 320 grit. Wipe clean.
4. Apply first enamel coat with quality brush or spray.
5. Sand lightly with 400 grit. Wipe clean.
6. Apply second enamel coat. Apply third coat for high-traffic surfaces (doors, frames, handrails).

**Things vendors skip if not watched:**

1. **Skipping primer on metal.** Vendors will paint metal directly. Within 6 months, rust bleeds through.
2. **Skipping primer on woodwork.** Without primer, enamel doesn't bond well and peels at edges.
3. **Inter-coat sanding.** Coarse finish results.

**Acceptance criteria:**

- Smooth surface with no brush marks
- Uniform sheen
- No runs, sags, or drips
- Edges and end-grain (wood) fully coated
- No rust bleed-through (metal)

**Do NOT:**

- Apply enamel without primer
- Use water-based enamel on rust-prone metal without rust-converting primer first
- Skip intermediate sanding
- Paint over rust without proper removal$sop7$,
        updated_at  = NOW()
    WHERE title = 'Enamel Paint on Wood & Metal';

  UPDATE sops
    SET category    = 'Carpentry & Joinery',
        description = 'Ensure correct plywood grade is used for each application, preventing warping, delamination, or moisture failure.',
        content     = $sop8$**Purpose:** Ensure correct plywood grade is used for each application, preventing warping, delamination, or moisture failure. Plywood substitution (lower grade than specified) is one of the most common cost-cutting tricks by vendors and is invisible until failure occurs.

**System acceptability:**

- **BWP grade (IS 710):** All wet area joinery (kitchen, bathroom, wardrobes adjacent to bathrooms), all exterior application. Acceptable brands: Greenply 710 BWP, Century Sainik 710, Kitply Marine, Anchor 710, Archidply 710.
- **MR grade (IS 303):** All dry area joinery (bedrooms, living, study). Acceptable brands: Greenply Club Prime, Century Bond 700, Kitply MR, Anchor Boilo MR.
- **HDHMR (High Density High Moisture Resistant):** Acceptable substitute for MR in some applications — Action Tesa HDHMR, Greenpanel HDHMR.
- **Thickness per application:**
  - 6mm — Back panels of cabinets only, where structural integrity comes from the frame
  - 9mm — Back panels in higher-quality work, drawer bottoms
  - 12mm — Shelves under 600mm span, light-duty partitions
  - 18mm — Cabinet carcass, structural shelves, doors
  - 25mm — Countertops, heavy load applications
- **Forbidden:** Unbranded plywood. Plywood without visible ISI mark. Commercial plywood (not graded BWP or MR) in any application beyond formwork. Recycled plywood from previous projects.

**Procedure:**

1. **Verification on arrival.**
   - ISI marking visible on every sheet — photograph the stamps.
   - IS number visible (710 for BWP, 303 for MR).
   - Manufacturer's name visible.
   - Production date visible — sheets older than 6 months may have lost some properties.
   - Reject any sheet without all markings.

2. **Physical inspection.**
   - Edges intact — no delamination visible at edges.
   - Faces uniform — no large patches, no visible voids, no surface defects.
   - Sheet flat — no warping. Lay sheet on a known flat surface; sheet should sit flat without rocking.
   - Tap test — sheet should sound solid throughout, no hollow spots.

3. **Storage.**
   - Store flat, off the floor, in a dry covered area.
   - Sheets stacked with weight on top to prevent warping.
   - Never store leaning vertically against a wall — develops permanent bend.

4. **Cutting.**
   - Use sharp blades — fine-tooth blade for finished cuts.
   - Cut face-up on a circular saw, face-down on a track saw.
   - Score the cut line with a sharp knife before cutting to prevent chip-out.

5. **Edge sealing.**
   - All cut edges sealed within 24 hours of cutting if not being veneered or edge-banded.
   - Seal with a thin coat of the same adhesive used for veneer or with a dedicated edge sealer.
   - Unsealed edges absorb moisture and cause the panel to warp.

**Things vendors skip if not watched:**

1. **Grade substitution.** Vendors will substitute MR for BWP in wet areas because BWP costs 30-40% more. The substitution is invisible until 1-2 monsoons later when the cabinet begins to delaminate. **Verify** the IS marking on every sheet before it goes into the project.

2. **Mixed grades within a single piece.** Vendors will use BWP for the front faces of a kitchen cabinet (visible to inspection) and MR for the internal partitions and back (invisible). The internal parts fail first, causing the cabinet to twist. **Require** the same grade throughout any single piece of joinery.

3. **Edge sealing.** Vendors skip edge sealing because it's an extra step. Unsealed edges are the entry point for moisture and the start of delamination. **Inspect** all cut edges — they should feel sealed, not absorbent.

**Acceptance criteria:**

- ISI marking visible on every sheet used (photographic record)
- Correct grade for the application
- No mixed grades within a single piece
- All cut edges sealed
- No visible warping in finished work
- Moisture content below 12% before any finishing

**Do NOT:**

- Use MR grade in wet areas
- Mix grades within a single piece of furniture
- Use plywood stored on a wet floor
- Use plywood without ISI marking
- Skip edge sealing on cut edges$sop8$,
        updated_at  = NOW()
    WHERE title = 'Plywood Selection & Grading';

  UPDATE sops
    SET category    = 'Carpentry & Joinery',
        description = 'Build cabinet structures that hold square, support specified loads, and remain rigid for decades.',
        content     = $sop9$**Purpose:** Build cabinet structures that hold square, support specified loads, and remain rigid for decades.

**System acceptability:**

- **Carcass:** 18mm BWP or MR plywood per location
- **Back panel:** 6mm or 9mm plywood, grooved into sides where structural
- **Fasteners:** Confirmat screws (Hettich, Hafele) or equivalent thread-cutting screws designed for plywood. Avoid generic wood screws (split the plies).
- **Hardware:** Hinges, slides, lifts per project schedule — Hettich, Hafele, Blum, Salice (premium). Ebco, Hettich Eco (standard).

**Pre-conditions:**

1. Drawings issued with internal dimensions, hardware schedule, and load specifications.
2. Plywood cut to size with edges treated.
3. All hardware on site — sized and verified against drawings before assembly begins.

**Procedure:**

1. **Verify panel cuts** — diagonals within 2mm of each other. Square panels are non-negotiable; out-of-square panels make out-of-square cabinets that don't work properly.

2. **Edge banding** of all visible edges before assembly. Application:
   - PVC or ABS edge band, glued with hot-melt adhesive
   - Or wood veneer edge band, glued with white wood adhesive
   - Trimmed flush after cure
   - Edges sanded to remove any glue residue

3. **Pre-drill all screw locations.** Plywood splits if screws are driven without pilot holes. Pilot hole size: 60-70% of screw shank diameter.

4. **Assembly with screws plus dado/groove joints.**
   - Joints: dado (groove cut in side) into which the shelf or partition fits, then screwed
   - Or biscuit-and-screw construction for thinner panels
   - Nails as the primary structural fastener are forbidden — they pull out under load
   - Glue applied to joint surfaces in addition to screws

5. **Back panel installation.**
   - Upper cabinets: back panel grooved into sides at 6-9mm groove depth. This provides racking resistance — the back panel keeps the cabinet square.
   - Base cabinets: back panel recessed and screwed (allows access to plumbing and electrical behind).

6. **Shelf support.**
   - Fixed shelves: dado'd into sides
   - Adjustable shelves: minimum 2 shelf pins per side per shelf, shelf pin holes drilled in matching patterns on opposite sides

7. **Hardware installation.**
   - Use the manufacturer's template for hinge and slide mounting.
   - Pilot drill at the exact positions marked by the template.
   - Mount hardware and test operation before considering the cabinet complete.

8. **Final check.**
   - Cabinet sits flat on a level surface with no rocking.
   - Doors close flush with even gaps (2-3mm).
   - Drawers run smoothly with no rubbing.

**Things vendors skip if not watched:**

1. **Squaring panels.** Vendors cut panels without verifying square, leading to cabinets that don't sit flat. **Require** diagonal measurement on every cabinet panel set.

2. **Hardware brand substitution.** Vendors will substitute lower-grade hardware (cheap Chinese hinges instead of specified Hettich) — hardware is the most-substituted item in cabinet construction. **Verify** the hardware brand on the box on site before installation.

3. **Pilot holes.** Skipped to save time, causes splitting that's invisible until the joint fails under load.

4. **Edge banding quality.** Vendors apply edge banding badly — visible glue lines, lifted edges, mismatched colors. **Inspect** every banded edge before acceptance.

**Acceptance criteria:**

- Cabinet square: diagonals within 2mm
- No visible screw heads on finished faces
- Shelves carry specified load with no visible deflection
- Doors close flush, gaps even (2-3mm) all sides
- Drawers run smoothly
- Edge banding clean, no glue lines visible
- Hardware operates smoothly, opening direction correct

**Do NOT:**

- Use nails alone for structural joints
- Substitute hardware brands without written approval
- Skip pre-drilling
- Apply finish to unsquare carcass (cannot be corrected after finishing)
- Skip back panel grooving (causes racking)$sop9$,
        updated_at  = NOW()
    WHERE title = 'Cabinet Carcass Construction';

  UPDATE sops
    SET category    = 'Polishing & Finishing',
        description = 'Apply melamine finish to indoor furniture in dry areas with proper sealer base and adequate top-coat protection.',
        content     = $sop10$**Purpose:** Apply melamine finish to indoor furniture in dry areas with proper sealer base and adequate top-coat protection.

**System acceptability:**

- **Melamine sealer:** NC-based — Asian Paints Touchwood Sealer, Sirca Universal Sealer, Pidilite Wudfin sealer.
- **Melamine top coat:** Asian Paints Touchwood, Sirca melamine, Pidilite Wudfin Melamine, Berger Melamine.
- **Thinner:** Brand-matched. Never substitute generic thinner.

**Pre-conditions:**

- Substrate sanded to 180 grit, dust-free.
- Ambient temperature 20-30°C.
- Humidity below 70%.
- This finish is for dry indoor areas only — kitchen, wet areas, and any moisture-exposed locations require PU.

**Procedure:**

1. Final-sand substrate to 180 grit. Wipe with tack cloth.
2. Apply NC sealer coat. Allow 2 hours drying.
3. Sand with 240 grit. Wipe clean.
4. Apply first melamine top coat. Allow 4 hours drying.
5. Sand with 320 grit. Wipe clean.
6. Apply second top coat. Allow 24 hours before handling.

**Things vendors skip if not watched:**

1. **Inter-coat sanding.** Skipped to save time. Result: nibs and ridges in final finish.
2. **End-grain treatment.** End-grain absorbs much more finish; vendors apply normal coats and end-grain looks dry and unprotected.
3. **Application in wrong environment.** Vendors apply melamine in kitchens or wet areas where it will fail.

**Acceptance criteria:**

- Uniform sheen, no patches
- No brush marks, no runs
- Edges and end-grain fully coated
- Surface hard to fingernail after 24 hours

**Do NOT:**

- Use melamine in kitchens, bathrooms, or any wet area
- Use melamine on outdoor furniture
- Apply over uncured PU or other incompatible base
- Mix brand systems
- Skip intermediate sanding$sop10$,
        updated_at  = NOW()
    WHERE title = 'Melamine Polish Application';

  UPDATE sops
    SET category    = 'Polishing & Finishing',
        description = 'Finish veneer to specified open-pore or close-pore appearance, preserving grain visibility while providing surface protection.',
        content     = $sop11$**Purpose:** Finish veneer to specified open-pore or close-pore appearance, preserving grain visibility while providing surface protection.

**System acceptability:**

- **Grain filler (close-pore finish):** Wood-tone matched. Brands: Sirca grain filler, locally-made acrylic-based fillers from recognized manufacturers.
- **Stain:** Water-based or solvent-based per project. Asian Paints Touchwood Stain, Sirca stain.
- **Top coat:** PU or melamine per drawing.

**Pre-conditions:**

- Veneer fully cured on substrate (minimum 24 hours after application).
- Surface sanded with 180 then 240 grit — light pressure to avoid sanding through the veneer.

**Procedure for close-pore finish:**

1. Apply grain filler matched to wood tone. Work into grain, remove excess.
2. Allow overnight drying. Sand 320 grit.
3. Apply stain if specified.
4. Apply 3 coats of top coat with intermediate 400 grit sanding.
5. Final rub with 0000 steel wool for hand-rubbed premium areas.

**Procedure for open-pore finish:**

1. Skip grain filler.
2. Apply stain if specified.
3. Apply 2 coats of matte or satin top coat, sanding 400 grit between coats.
4. Final coat applied thin to preserve open grain texture.

**Things vendors skip if not watched:**

1. **Sanding through veneer.** Veneer is 0.5mm thick — aggressive sanding penetrates to substrate, ruining the panel.
2. **Stain consistency.** Stain applied unevenly leaves panels of different darkness within the same piece.
3. **Heavy top-coats obscuring grain.** Defeats the purpose of open-pore finish.

**Acceptance criteria:**

- Grain visible per finish type
- Color uniform across panels — match approved sample
- No sanding burn-through visible
- Top coat even and protective

**Do NOT:**

- Sand through veneer face
- Apply heavy coats that obscure grain on open-pore finishes
- Mix open-pore and close-pore on the same piece without drawing instruction$sop11$,
        updated_at  = NOW()
    WHERE title = 'Veneer Polish Finishing';

  UPDATE sops
    SET category    = 'Electrical',
        description = 'Install switches and sockets at standard heights, aligned, tested, and free from electrical defects.',
        content     = $sop12$**Purpose:** Install switches and sockets at standard heights, aligned, tested, and free from electrical defects.

**System acceptability:**

- **Switches and sockets:** Schneider, Legrand, Anchor by Panasonic, Norisys, Hager — per project specification.
- **Cover plates:** Color matched to wall finish per drawing.

**Pre-conditions:**

- Wall finishing complete in the switch/socket area (paint, wallpaper, or panelling).
- Back-boxes installed flush with finished wall surface.
- Wiring tested per Concealed Electrical Wiring SOP.

**Procedure:**

1. **Wall condition.** Wall must be fully cured if recently painted (minimum 24 hours).
2. **Wire preparation.** Strip wire ends to the length specified by the switch/socket terminal (typically 8-10mm). Do not nick the conductor — nicked wires can fracture in the terminal.
3. **Wire connection.**
   - Connect per markings on the back of the switch/socket: L (live), N (neutral), E (earth).
   - For switches: input live to common terminal, output to switched terminal.
   - Tighten each terminal — firmly but not over-tight (damages the terminal screw).
   - **Tug test every wire** after tightening. Wire should not pull out of the terminal under firm pulling force.
4. **Module mounting.** Fit module into the mounting plate. Plate fits into the back-box. Verify the plate is flush with the wall and level.
5. **Cover plate.** Fit cover plate after module is mounted.
6. **Testing.** Use a socket tester (three-light type) at every socket. Verify:
   - Live, neutral, earth correctly wired
   - No reverse polarity
   - No missing earth

**Things vendors skip if not watched:**

1. **Earth connection at socket.** Earth wire present in conduit but not connected to the socket earth pin. Use socket tester at every socket. The third light tells you if earth is missing.
2. **Tug test.** Vendors tighten terminals by feel. Loose wires cause arcing and overheating, ultimately fire risk.
3. **Plate alignment.** Vendors fit plates crooked or with one corner sticking out from the wall. Inspect under raking light.

**Acceptance criteria:**

- All switch/socket plates level within 1mm
- All plates at same height in any one room
- No paint, putty, or dirt on faces or plates
- Socket tester confirms correct wiring at every point
- No loose connections (no flicker on tug-test)
- Cover plates fit flush with no gaps

**Do NOT:**

- Tighten terminals over-tight (damages terminals)
- Leave loose strands of wire
- Mix switch brands within a room (inconsistent appearance)
- Install before walls are dry and clean$sop12$,
        updated_at  = NOW()
    WHERE title = 'Switch & Socket Installation';

  UPDATE sops
    SET category    = 'Soft Furnishings',
        description = 'Install curtain tracks/rods and drapes with proper drop, stack-back, and operating smoothness.',
        content     = $sop13$**Purpose:** Install curtain tracks/rods and drapes with proper drop, stack-back, and operating smoothness.

**System acceptability:**

- **Tracks/rods:** Premium — Silent Gliss, Hunter Douglas. Standard — Eurostyle, locally manufactured. Match to project specification.
- **Brackets:** Sized for the track or rod and the weight of drapes.
- **Hardware:** Wall plugs sized for wall type, screws stainless steel for any humid environment.

**Pre-conditions:**

- Window/door installation complete.
- Walls fully painted and cured (24 hours minimum).
- Drape fabric inspected — quantity confirmed, no defects.

**Procedure:**

1. **Mounting height.** Per drawing — typically 150-200mm above the window frame (creates an illusion of height), or ceiling-mounted for full-drop drapes.
2. **Bracket positions.** Mark level positions. Maximum 600mm spacing for tracks supporting heavy fabric, 800mm for lighter fabrics. Brackets within 100mm of each end.
3. **Drilling and anchoring.** Use appropriate anchors for the wall type. Drywall requires either through-bolting to framing studs (preferred) or proper cavity anchors rated for the load. Plastic anchors in drywall are insufficient for curtain loads.
4. **Track or rod installation.** Mount track or rod to brackets. Verify operation is smooth, no binding.
5. **Drape installation.** Install drapes from one end to the other. Distribute pleats evenly.
6. **Settling period.** Allow drapes to hang minimum 24 hours before final adjustments. Fabric will settle and the hem position may need adjustment.
7. **Hem adjustment.** Pin or sew the hem after settling. Drape should just touch the floor, or have consistent 10mm clearance per drawing.

**Things vendors skip if not watched:**

1. **Bracket spacing.** Too wide spacing causes the track to sag. **Verify** spacing matches load.
2. **Anchor type.** Plastic anchors in drywall pull out. Heavy drapes fall. **Require** appropriate anchors for the wall and load.
3. **Settling time.** Vendors hem drapes before they've settled. Hems are uneven or wrong height after fabric settles. **Require** 24-hour settle before hemming.

**Acceptance criteria:**

- Track or rod level within 2mm over its length
- Drapes hang straight with no bunching
- Drape touches floor or has consistent clearance per drawing
- Operation smooth — opens and closes without effort
- Stack-back position acceptable (drape clears window when open)
- Tie-backs aligned at consistent height across multiple windows

**Do NOT:**

- Mount brackets only into drywall without proper anchors
- Hem drapes before they have settled
- Mix bracket types within a window
- Install on uncured wall paint (24 hours minimum)$sop13$,
        updated_at  = NOW()
    WHERE title = 'Curtain & Drape Installation';

  UPDATE sops
    SET category    = 'Studio Operations',
        description = 'Ensure vendors and site teams always work from the current approved drawing.',
        content     = $sop14$**Purpose:** Ensure vendors and site teams always work from the current approved drawing. Drawing-version mistakes cause expensive rework when work is done to an outdated drawing.

**Procedure:**

1. **Title block on every drawing** must include:
   - Project name
   - Drawing title
   - Drawing number (unique identifier)
   - Scale
   - Date
   - Revision letter (A, B, C, etc.)
   - Name of drafter
   - Name of approver (designer or project lead)

2. **Revision letters.** First issue is Revision A. Subsequent changes increment to B, C, etc. Skipping letters or going backwards is forbidden.

3. **Revision notes.** Every revision after A must include:
   - A cloud around the changed area on the drawing
   - A note explaining the change
   - The date of the change

4. **Drawing register.** Maintain a master register (typically Excel or in the project management system) showing:
   - Every drawing
   - Current revision letter
   - Date of last issue
   - Distribution list (who received the current revision)

5. **Distribution protocol.**
   - When a new revision is issued, send to all relevant parties (vendors, site team, client) with email.
   - Email subject line: "Drawing [Number] - Revision [Letter] issued - supersedes Revision [Previous Letter]"
   - Email body: list of changes from previous revision.
   - Attach the new revision.

6. **Old version disposal.**
   - On site, when a new revision arrives, the previous paper copy is collected and destroyed.
   - Site supervisor responsible for this — old drawings must not remain on site after new revisions arrive.
   - Vendors must acknowledge receipt of new revision and confirm destruction of old.

7. **No work on outdated drawings.** Site team and vendors verify the drawing in their hand matches the current register before starting any work.

8. **Hand changes on site.** Forbidden. Any change requires:
   - A formal change order
   - Issue of a new revision
   - Updated drawing distributed before work proceeds

**Things vendors skip if not watched:**

1. **Working from outdated drawings.** Vendors keep older revisions because they don't notice the new one arrived. **Verify** on every site visit that the drawings in hand match the current register.

2. **Hand-marking changes on drawings.** Vendors mark up their copy when the designer makes a verbal change at site. The next vendor sees the original drawing and works to the wrong specification. **Forbid** hand marks; require formal revisions for any change.

3. **Late distribution.** Designer makes a change but takes days to issue the formal revision. Vendor works through the gap to the old drawing. **Require** revisions issued same-day as approved changes.

**Acceptance criteria:**

- Drawing register current and accessible
- All site copies match the current revision per register
- Revision history visible on every drawing
- No undocumented hand-marks on site drawings
- All vendors and site team have current revisions
- Email distribution trail documented

**Do NOT:**

- Issue drawings without revision letter and date
- Make undocumented hand-changes to a drawing on site
- Send unapproved drawings to vendors
- Skip notifying all parties when a revision is issued
- Allow work to proceed on a drawing older than what's in the register

---$sop14$,
        updated_at  = NOW()
    WHERE title = 'Drawing Issue & Revision Control';

  UPDATE sops
    SET category    = 'Studio Operations',
        description = 'Maintain a clean, safe site that supports good workmanship, protects existing finishes from damage, and prevents accidents.',
        content     = $sop15$**Purpose:** Maintain a clean, safe site that supports good workmanship, protects existing finishes from damage, and prevents accidents.

**Pre-conditions:**

- Drawing showing finishes to protect.
- Initial site condition photographed for record.

**Procedure:**

1. **Floor protection** before any trade enters. Corrugated cardboard for soft protection, hardboard sheets for heavy traffic, specialized protection film for delicate finishes.
2. **Existing items.** Protect any items remaining in place with dust sheets and wrapping.
3. **Material storage area** established away from work zones. Materials stacked safely.
4. **Daily cleanup.** All debris removed at the end of each day. Tools stored, not left in walkways.
5. **Wet work areas** (paint, plaster, concrete) cordoned off until dry.
6. **Hazards eliminated or marked.** Sharp materials, exposed wires, trip hazards.
7. **PPE for all workers.** Minimum: safety boots, hard hats during active overhead work, eye protection during cutting/drilling/grinding.
8. **Weekly site walkthrough** by site supervisor with photographic record.

**Things vendors skip if not watched:**

1. **Daily cleanup.** Sites accumulate debris over days, becoming dangerous and inefficient.
2. **PPE.** Workers ignore safety equipment when supervision is absent.
3. **Floor protection.** Removed too early, finishes get damaged at handover.

**Acceptance criteria:**

- No damage to protected surfaces at handover
- No accumulated debris at end of any day
- No tools or material in walkways
- No exposed wires, sharp edges, or trip hazards
- Workers using PPE as required
- Existing finishes adjacent to work zone undamaged

**Do NOT:**

- Allow eating or smoking on site
- Permit workers without PPE
- Skip daily cleanup
- Use power tools without confirming circuit protection
- Leave site without locking and securing$sop15$,
        updated_at  = NOW()
    WHERE title = 'Site Cleanliness & Safety';

  -- Step 3: Insert 9 new v2 titles (idempotent: WHERE NOT EXISTS)
  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'PU (Polyurethane) Polish Application',
         'Polishing & Finishing',
         'Achieve a furniture-grade PU finish that retains clarity, sheen, and adhesion for 7+ years in Indian residential conditions.',
         $sop16$**Purpose:** Achieve a furniture-grade PU finish that retains clarity, sheen, and adhesion for 7+ years in Indian residential conditions. PU is the most-failed finish in Indian interior work — typically through use of inferior products, inadequate cure time, or wrong sheen consistency between panels.

**System acceptability:**

- **Premium:** Sirca, Sayerlack, Renner, Milesi — 2K (two-component) PU. Use these on premium projects and any open-grain or stained finish where clarity matters.
- **Standard:** Asian Paints PU 2K, Pidilite Wudfin PU 2K. Acceptable for standard residential work.
- **Substitution policy:** Written approval required for any downgrade. Single-component (1K) PU is never acceptable for furniture-grade work — it cures by air exposure only and fails on internal surfaces of cabinets.
- **Forbidden:** Any unbranded "PU" sold loose by the litre. NC (nitrocellulose) sold as PU. Mixing brands within a single piece.

**Sheen specification:** Drawing must specify one of: dead matte (5-10 GU), matte (15-20 GU), satin (30-40 GU), semi-gloss (50-60 GU), gloss (80+ GU) at 60° gloss meter reading. "Matte" alone is insufficient — different vendors interpret it differently and panels will not match.

**Pre-conditions:**

1. Substrate moisture content: maximum 12% measured with a pin-type moisture meter. Test five points on every batch of joinery. Photograph readings.
2. Substrate sanding: progressive through 120 → 180 → 240 grit. Each grit must remove the previous grit's scratches — verify by side-lighting before progressing. The most common defect in PU work is scratches from coarser grit showing through under finish.
3. Workspace conditions: ambient temperature 20-30°C, relative humidity below 70%. **Mumbai-specific:** during monsoon (June-September), polish work must be done in dehumidified conditions or postponed. PU applied above 70% RH will cloud, soften, and fail.
4. Dust control: no parallel sanding, cutting, plastering, or sweeping in the same room during application or first 4 hours of drying. Site supervisor to enforce.

**Procedure:**

1. **Final sanding to 240 grit.** Vacuum thoroughly. Wipe with lint-free tack cloth wetted lightly with the system's own thinner (not turpentine — it leaves residue that PU sees as oil and rejects).

2. **Sealer coat.** Apply PU sealer matched to the chosen system. Mix activator per manufacturer ratio (typically 100:50 by volume — exact ratio varies by brand). **Critical:** mixed material has a pot life of 4-6 hours; once mixed, it cannot be saved. Discard unused mixed material at end of session.

3. **First sand: 320 grit.** After 4-6 hours drying. This sand must remove all dust nibs and any sealer ridges. The surface should feel uniformly smooth, no localized rough spots. Vacuum, tack-cloth.

4. **First finish coat.** Apply by spray (preferred for premium work) or quality bristle brush. Cross-coat technique: first pass horizontal, immediate second pass vertical while wet. Maintain wet edge — never overlap a partially dried section. **Mumbai-specific:** in high humidity, add manufacturer's recommended retarder (5-10% by volume) to extend wet edge time.

5. **Second sand: 400 grit.** After 4-6 hours. Light sanding only — the goal is to provide tooth for the next coat, not to remove material. Vacuum, tack-cloth.

6. **Second finish coat.** Same technique as first.

7. **For premium areas** (visible furniture, joinery, dining table): Third coat after 600 grit sanding, then 1000 grit final rub with 0000 steel wool dipped in finishing wax. This produces the hand-rubbed depth that distinguishes furniture-grade from contractor-grade.

8. **Cure period:** 7 days minimum before any heavy use, client handover, or covering with anything (table mats, books, decorative objects). The finish develops final hardness over 21 days. PU is touch-dry in hours but not chemically cured for weeks — premature heavy use will leave permanent dents.

**Things vendors skip if not watched (require photographic evidence):**

1. **Internal surfaces of cabinets.** Vendors routinely apply PU only to externally visible faces and skimp on cabinet interiors, drawer interiors, and undersides. These surfaces absorb moisture and cause the cabinet to twist over 6-12 months. Require photographs of every internal surface during sealer coat application. No exceptions.

2. **End-grain treatment.** End-grain (the cut edges of plywood) absorbs finish 5x more than face grain. Vendors apply normal coats and the end-grain looks dull, dry, and unprotected. Require end-grain to receive an extra sealer coat before the system begins. Verify by inspection — end-grain should feel sealed, not absorbent, to the touch.

3. **Inter-coat sanding documentation.** Vendors skip 400 grit sanding to save time. The result is a finish with embedded dust nibs that becomes visible under side-lighting in 3-6 months as the finish settles. Require photographs of the surface after each sand, before the next coat.

**Inspection points:**

- **After sealer coat:** Side-light the surface. No deep scratches from coarser grit should be visible. If they are, sand back and restart sealer.
- **After first finish coat:** Tap test. The coat should feel firmly cured to fingernail, not gummy. If gummy after 6 hours, conditions are wrong — stop and rectify before continuing.
- **After final coat, 24 hours:** Cross-cut adhesion test on a sample area (1mm grid scored through finish, tape applied and pulled). No flakes should lift. If they do, the finish has failed adhesion and the piece must be stripped and redone — no shortcuts.
- **Sheen meter test (premium projects):** Random panels measured. Sheen variation across the project must be within ±5 GU.

**Acceptance criteria:**

- Uniform sheen across all surfaces of the same finish level, no panel-to-panel variation visible under daylight
- No brush marks, orange peel, sags, runs, holidays, or dust nibs visible
- All edges, corners, end-grain, internal surfaces equally finished
- No yellowing on light-colored stains or natural finishes
- No softening or marking from light pressure with a fingernail
- Cross-cut adhesion test passes on inspected panels
- Photographic record of internal surfaces, end-grain treatment, and inter-coat sanding stages provided

**Do NOT:**

- Apply PU when ambient RH is above 70% (Mumbai monsoon)
- Mix different brands or different systems (2K with 1K, water-based with solvent-based)
- Reuse mixed catalyzed material past its pot life
- Skip end-grain or internal surfaces
- Handle, stack, or wrap work before 24-hour dry minimum, 7-day cure for client release
- Apply over uncured stain, filler, or sealer of another system
- Use turpentine as a wipe-down — only the system's matched thinner
- Accept "we're behind schedule, we'll do the cure shorter" — there is no shortened cure for PU$sop16$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'PU (Polyurethane) Polish Application');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Marble & Natural Stone Installation',
         'Civil & Masonry',
         'Install marble, granite, or other natural stone with full bedding, no staining, and a polished finish that lasts decades.',
         $sop17$**Purpose:** Install marble, granite, or other natural stone with full bedding, no staining, and a polished finish that lasts decades. Stone installation defects (yellowing, picture-framing, hollow spots, polish failure) are extremely expensive to correct because the stone must be lifted, the bedding reworked, and the stone re-laid — often with damage to the stone.

**System acceptability:**

- **Bedding mortar:** Cement-sand 1:3 with white cement for light stones (Italian marble, Statuario, Carrara). Standard grey cement acceptable for darker stones. Bonding agent (SBR latex) added for premium installations.
- **Adhesive bedding:** Roff Premium Marble Adhesive or Pidilite Pidiroll Stone Adhesive — acceptable for thinner stones (under 20mm) and small format applications. Not acceptable for large format slab work.
- **Sealer:** Penetrating impregnator (Akemi Marmor Fleck-Schutz, Tenax Hydrex, Fila MP90) for all marble and porous stones. Not surface sealers (they trap moisture).
- **Polishing compounds:** Diamond pad system graded for stone type. Resin pads for finishing.
- **Forbidden:** Tile adhesive for stone (insufficient strength). Cement slurry alone (white cement only) as bedding. Surface "shine" applications that coat rather than penetrate (they yellow and peel within 2 years).

**Pre-conditions:**

1. Stone slabs inspected on arrival before payment is released. Check for:
   - Cracks (visible and hidden — tap the slab; cracks sound dull, intact stone rings)
   - Color matching across slabs (lay slabs side by side under natural light)
   - Vein direction matching for book-matched or sequential layouts
   - Edge damage from transport
   - Backside check for excessive fiberglass mesh reinforcement (indicates a structurally weak slab that has been mesh-reinforced to hold together)
   Photograph each slab on arrival as record. Reject damaged slabs before they are touched.

2. Substrate is fully cured, level within 5mm over 3m, clean, free of laitance. Concrete slabs must be ground to expose aggregate for bonding.

3. Drawings specify exact layout: vein direction, book-match plan, joint pattern (running bond, stack bond, etc.), location of any inlays.

4. Stone temperature: stones should be at the same temperature as the bedding area. Cold stones (from storage) on a warm substrate will cause condensation between stone and bedding — leads to staining.

**Procedure:**

1. **Dry layout.** Lay all slabs dry in their final positions. Confirm:
   - Color and vein match across the layout
   - Joint widths consistent (1-2mm for polished stones, 3-5mm for honed or natural finish)
   - Cut pieces fall at non-conspicuous positions (corners, under cabinets)
   - Book-matching pairs are correctly oriented
   
   Photograph the dry layout. Client approval at this stage if required. **Do not proceed without sign-off.**

2. **Substrate preparation.** Wet the substrate (do not flood) before applying bedding. This prevents the substrate from drawing moisture too quickly from the mortar, which causes weak bonding and hollow spots.

3. **Bedding mortar application.** Mix cement-sand 1:3 with bonding agent (SBR latex at 2-3% by weight). For light-colored stones, use white cement to prevent grey staining through the stone. Apply mortar at uniform 20-25mm thickness across the substrate. Do not spot-bed (dot the corners only) — this causes hollow spots that break the stone under load.

4. **Slurry coat.** Apply a thin slurry of neat cement (white cement for light stones) on the back of each stone. This ensures intimate contact with the bedding and eliminates voids.

5. **Stone placement.** Lower stone into position carefully. Use rubber mallet with a wooden block to tap the stone into the bedding. Tap evenly across the surface — never strike a single point (will crack the stone). Stone should sit firmly without rocking.

6. **Leveling.** Use a spirit level across each stone and between adjacent stones. Adjust by tapping. The stone must be perfectly flat and aligned with neighbors. Use wedges at edges if needed to hold position while bedding sets.

7. **Joint width.** Maintain consistent joint width using spacers. For polished marble, joints should be 1-2mm. For honed or textured finishes, 3-5mm. Tighter joints than this create stress concentrations and crack the edges.

8. **Initial cleanup.** Within 30 minutes of laying, remove any mortar from the stone surface. Cured mortar on polished stone is nearly impossible to remove without damaging the polish.

9. **Setting time.** Allow 48 hours minimum for bedding to cure before any traffic, grouting, or polishing. Premium installations allow 7 days.

10. **Joint pointing.** Point joints with matching cement (or epoxy grout for premium installations). Use a fine pointing tool to avoid smearing grout on the stone face. Wipe clean immediately.

11. **Polishing stages.** Diamond pad polishing in stages, typically:
    - 50 grit — leveling pass (only if stones are uneven, otherwise skip)
    - 100 grit — rough cut
    - 200 grit — intermediate
    - 400 grit — fine
    - 800 grit — finer
    - 1500 grit — pre-polish
    - 3000 grit — final polish for high-gloss finish
    - For honed finish: stop at 400-800 grit per design intent
    
    Each stage must remove the scratches from the previous stage. Skipping a grit leaves scratch patterns that show under raking light.

12. **Penetrating sealer.** After polishing is complete and stone is fully dry (allow 7 days for stone to dry after wet polishing), apply penetrating impregnating sealer. Apply liberally, allow to penetrate for the time specified (typically 15-30 minutes), then wipe off the excess. Apply a second coat after 4 hours. The sealer penetrates the stone, blocking water and stain absorption without changing appearance.

13. **Final inspection** under multiple lighting conditions — daylight, side-light, and at night with artificial lighting.

**Things vendors skip if not watched:**

1. **Full-bed mortar application.** Vendors use spot-bedding (mortar only at corners and center) to save time and material. The stone sits on these points and the gaps between create hollow spots. Walking on hollow-bedded stones cracks them. **Require** full mortar bed coverage. Verify by checking that mortar squeezes out at the joints when stone is set.

2. **White cement for light stones.** Vendors use grey cement because it's cheaper and on hand. Grey cement migrates through marble and creates permanent grey shadows that appear after the stone dries. **Specify white cement in writing** and verify the bags on site.

3. **Bedding mortar moisture management.** Vendors apply bedding mortar that is too wet (easier to work) and then the stone settles unevenly as the mortar dries. The result is stones that have shifted from their leveled position. Mortar should be plastic but not flowing — hold its shape on the trowel.

4. **Polishing stages skipped.** Vendors will skip intermediate grits to save time. The result is a stone that looks polished from a distance but shows scratch patterns under raking light. **Require** demonstration of each grit on a sample area before proceeding.

5. **Sealer not applied or applied wrong.** Vendors either skip the sealer ("the stone is sealed already") or apply a surface sealer that yellows. **Require** penetrating sealer of a named brand. Verify the bottle on site.

6. **Iron and steel contact during installation.** Workers walk across freshly laid stone with steel-tipped shoes, leave steel tools on the stone surface, or use steel scaffolding that drags across the stone. Iron particles embed in the stone and rust into permanent orange spots over weeks. **Forbid** all steel contact with the stone surface until sealer is applied.

**Inspection points:**

- **Dry layout stage:** Verify color and vein matching. Photograph for record.
- **During bedding:** Verify mortar squeeze-out at joints (indicates full bed).
- **24 hours after laying:** Tap test. Listen for hollow spots — these indicate insufficient bedding.
- **Between polishing grits:** Verify previous grit's scratches are removed.
- **Before sealing:** Confirm stone is dry (use moisture meter — stone should read below 5%).
- **After sealing:** Water-bead test. Drop water on the surface — should bead and not absorb into the stone.

**Acceptance criteria:**

- Joints minimal (1-2mm for polished, 3-5mm for honed) and consistent throughout
- Polish even across all surfaces — no swirl marks, no dull patches under raking light
- Color and veining matched per the approved dry layout
- No rust or yellow staining
- No hollow spots detected by tapping
- Sealer applied evenly — water-bead test passes
- No scratches, chips, or edge damage at handover
- All cut pieces installed at non-conspicuous positions per the dry layout

**Do NOT:**

- Spot-bed (corner-and-center bedding) — full bed required
- Use grey cement under light-colored stones
- Allow any steel or iron contact with stone surface during installation
- Skip polishing grits
- Apply surface sealer instead of penetrating impregnator
- Drag stones across each other (chips edges)
- Use acidic cleaners on marble (etches the polish)
- Walk on bedded stones before 48-hour cure
- Apply sealer to wet stone — must be fully dry$sop17$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Marble & Natural Stone Installation');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Concealed Electrical Wiring Installation',
         'Electrical',
         'Install electrical wiring that is safe, accessible for future fault-finding, properly earthed, and code-compliant.',
         $sop18$**Purpose:** Install electrical wiring that is safe, accessible for future fault-finding, properly earthed, and code-compliant. Concealed wiring defects are the most dangerous failures in residential interiors — they cause fires and electrocution. Defects are invisible after plastering and discovered only when something fails catastrophically.

**System acceptability:**

- **Conduit:** ISI-marked rigid PVC conduit (Polycab, V-Guard, Anchor, Havells, Finolex). Diameter sized per cable count per IS 9537. Forbidden: flexible plastic spiral conduit (insufficient mechanical protection), undersized conduits causing damage during wire pulling.
- **Wires:** Multi-strand copper, ISI-marked, with FRLS (flame-retardant low-smoke) insulation. Brands: Polycab, Havells, RR Kabel, Finolex, V-Guard. Sizes per circuit load — minimum 1.5 sq mm for lighting, 2.5 sq mm for power sockets, 4 sq mm for AC and high-load circuits, 6 sq mm for incoming and earth.
- **Switches and sockets:** Schneider Electric (Zencelo, Opale, AvatarOn), Legrand (Myrius, Arteor), Anchor by Panasonic (Roma, Vision), Norisys, Hager. Match brand to project budget tier. Forbidden: unbranded modular switches; 5-pin/6-pin sockets without earth.
- **Distribution Boards:** Hager, Legrand, Schneider, ABB, Siemens. With proper RCBO (Residual Current Breaker with Overcurrent protection) for all wet area and outdoor circuits.
- **Forbidden:** Single-strand solid wires (only multi-strand acceptable). Aluminum wiring (banned by code in residential). Wires without ISI marking. MCBs without proper rating documentation.

**Pre-conditions:**

1. Drawings approved by licensed electrical engineer, showing:
   - All circuits and their loads
   - Switch positions and heights
   - Light positions and types
   - Socket positions and heights
   - AC point positions
   - DB layout with circuit assignments
   - Earthing arrangement
2. Load calculations completed, total connected load and diversified load documented.
3. Service connection capacity confirmed adequate for the loads.
4. Wall chasing complete per drawing — chases run horizontal at fixed heights (typically 1200mm for switch level, near ceiling for light supply) and vertical from chase to DB. No diagonal chases (forbidden by code — diagonals make future drilling unpredictable and dangerous).
5. Wall not yet plastered — chasing visible.

**Procedure:**

1. **Conduit installation in chases.**
   - Use bending spring or proper conduit bender for direction changes. Never heat-bend (deforms cross-section).
   - Maximum 2 bends between draw points (junction boxes). More bends than this make wire pulling damaging — wires get stripped during pulls.
   - Use pull boxes at intermediate points for long runs (over 5m) or runs with 3+ bends.
   - Conduit ends in boxes flush with the box face, secured with proper bushings (prevents wire damage on sharp conduit edges).
   - Conduit clipped or wired to substrate at maximum 1m intervals to keep position during plastering.

2. **Junction box installation.**
   - Box face flush with finished wall — typically 12mm proud of brickwork to allow for plaster thickness. Verify with the civil contractor's plaster thickness.
   - Box securely anchored — must not move when wires are tugged.
   - Switch boxes at standard heights: 1200mm from finished floor for switches, 300mm for sockets at floor level, 1100mm for kitchen counter sockets (above counter), 1800mm for above-bed reading sockets. Drawing overrides any standard.

3. **Wire pulling.**
   - Use pulling lubricant (yellow-77 or similar) for long runs or multi-cable pulls.
   - Maintain color code throughout the installation:
     - **Red, Yellow, Blue:** Phase (live) — match three-phase rotation if applicable
     - **Black:** Neutral
     - **Green or Green-Yellow:** Earth
     - **Grey:** Switched live (return from switch to fixture)
   - No joints inside conduits — joints only in junction boxes.
   - Leave 200mm minimum wire tail at every junction box for connections.

4. **Circuit organization.**
   - Lighting circuits separate from socket circuits.
   - Wet area sockets (bathrooms, kitchen) on separate RCBO circuits with 30mA earth leakage protection.
   - AC circuits on dedicated circuits with appropriately sized cable.
   - Maximum 8 lighting points per 6A circuit. Maximum 4 sockets per 16A circuit.
   - Critical loads (refrigerator, server, AV equipment) on dedicated circuits.

5. **Earthing.**
   - Every socket and metal fixture earthed via dedicated earth wire (2.5 sq mm minimum for sockets, 4 sq mm for high-load circuits).
   - All earth wires traced back to the main earthing terminal at the DB.
   - Earth electrode (rod/plate) tested for resistance — must be below 5 ohms per IS 3043.
   - Photograph earth electrode installation before backfilling.

6. **Distribution Board assembly.**
   - Each circuit assigned to a separately labeled MCB or RCBO.
   - Main switch sized for total load.
   - RCBO (residual current protection) on every wet area circuit, every outdoor circuit, and every socket circuit.
   - Surge protection device at the incoming.
   - Spare capacity (typically 25% spare ways) for future additions.
   - Label every breaker clearly. Generate a circuit chart and laminate it inside the DB cover.

7. **Continuity and insulation testing.**
   - Before chases are closed (before plastering):
     - Continuity test on every circuit (Phase-Neutral, Phase-Earth, Neutral-Earth)
     - Insulation resistance test (megger): minimum 1 megohm between live conductors and earth at 500V DC test voltage
     - Polarity test at every socket
     - Earth resistance test at every socket
   - Document test results in writing. Photograph the meter readings.
   - **No chasing is to be closed until test results are documented and signed by the electrical contractor.**

8. **Photographic record.**
   - Before plastering, photograph every chase, every junction box position, every conduit run. Include a tape measure or scale in the photo for reference. These photographs are the only record of what is buried in the walls — future fault-finding depends on them.

**Things vendors skip if not watched:**

1. **Earthing.** This is the single most-skipped element. Vendors will run two-wire (phase + neutral only) to save copper and time, and either leave the earth pin disconnected at the socket or jumper it to the neutral inside the box. **Both are dangerous.** Verify every socket with an earth-loop tester — confirm earth is connected to a true earth, not to the neutral.

2. **Insulation resistance testing.** Vendors will declare wiring "done" and pressure for chases to be closed without any testing. **Require** the megger test before any chase is closed. The test takes 10 minutes per circuit and catches insulation damage from rough wire-pulling.

3. **Single-strand vs multi-strand wires.** Single-strand wires are cheaper and vendors substitute them in concealed runs where the difference isn't visible. Single-strand wires crack at the bends in conduits and cause intermittent faults years later. **Verify the wire spools on site** — bend a sample wire; multi-strand bends smoothly, single-strand kinks.

4. **Forming joints inside conduits.** Vendors will splice wires inside conduits where the joint is invisible. Joints inside conduits are forbidden by code — they create resistance heating points and are impossible to access for repair. **Require** all joints to be in accessible junction boxes. Inspect every box during installation.

5. **Color code violations.** Vendors will use whatever wire is on hand and ignore color codes. Future electricians cannot safely work on the installation if colors don't match the standard. **Require** strict adherence to the color code. Spot-check by opening boxes at random.

6. **Conduit size violations.** Using a smaller conduit than specified to "save space" — wires pulled through undersized conduits get insulation damage. **Verify** conduit size at chases before plastering.

7. **Photographic record skipped.** Vendors close chases without photographing the installation. When a fault occurs 5 years later, finding the cable run requires destroying walls. **Require** photographs of every chase before plastering. No exceptions.

**Inspection points:**

- **Before plastering:**
  - Visual: All conduits in chases, all boxes positioned correctly, color code visible at every box
  - Continuity test passes on every circuit
  - Insulation resistance test passes (>1 megohm)
  - Earth continuity verified at every socket point
  - Photographic record complete
- **After fixing switches and sockets:**
  - Polarity test at every socket using socket tester (the cheap three-light testers from any electrical shop)
  - Earth-loop impedance test (specialized meter, electrical contractor should have one)
  - RCBO trip test at every wet area circuit (press the test button, breaker should trip)
- **At handover:**
  - Demonstrate every switch and socket works
  - Demonstrate every RCBO trips on test button
  - Hand over circuit chart, test reports, and the photographic record of pre-plaster condition

**Acceptance criteria:**

- All conduits fully concealed with no exposed sections
- Junction box positions exactly match drawing (verified before plastering)
- Color code consistent throughout
- Continuity and insulation tests pass, documented in writing
- Earth continuity verified at every socket
- All RCBOs trip on test button
- Polarity correct at every socket (no reverse polarity)
- Earth-loop impedance within IS 3043 limits
- Circuit chart laminated and present at DB
- Photographic record of pre-plaster installation provided

**Do NOT:**

- Use single-strand solid wires in concealed installations
- Form joints inside conduits — joints only in junction boxes
- Mix earth and neutral wires
- Run circuits without independent earthing
- Use conduit smaller than required for the cable count
- Close chases before continuity and insulation testing
- Use aluminum wiring (banned)
- Skip the earth electrode resistance test
- Substitute unbranded switches and sockets for the approved brand without written approval
- Leave the DB unlabeled$sop18$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Concealed Electrical Wiring Installation');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Air Conditioning Indoor Unit Installation',
         'HVAC',
         'Install split or VRF AC indoor units securely, with proper drainage, refrigerant pipe routing, electrical safety, and acoustic isolation.',
         $sop19$**Purpose:** Install split or VRF AC indoor units securely, with proper drainage, refrigerant pipe routing, electrical safety, and acoustic isolation. AC installation defects cause drainage leaks (water damage to walls and ceilings), refrigerant leaks (cooling failure, environmental issue), excessive noise, and electrical hazards.

**System acceptability:**

- **Indoor unit:** Daikin, Mitsubishi (Electric or Heavy Industries), Hitachi, Voltas (premium models), Blue Star (premium models), LG (premium models), Carrier. Match to project budget tier.
- **Refrigerant piping:** Copper, ISI-marked, branded (RR Kabel, Mexflow, Maxgold, Lloyd). Sizes per manufacturer specification for the unit's tonnage. Insulation: 9mm-13mm thick closed-cell elastomeric foam (Armaflex, K-Flex), full vapor barrier.
- **Drainage piping:** PVC, ISI-marked, minimum 25mm diameter for indoor unit drainage. Larger for cassette and ducted units per manufacturer specification.
- **Wall sleeve:** PVC sleeve through the wall to prevent direct contact between insulation and wall material.
- **Forbidden:** Aluminum refrigerant pipes (incompatible with copper components, prone to leaks). Foam insulation without vapor barrier (condenses, drips inside wall). Drainage pipes joined without proper solvent welding.

**Pre-conditions:**

1. Drawing showing indoor and outdoor unit positions, refrigerant pipe route, drainage pipe route, and electrical point location.
2. Wall structural capacity verified — indoor units typically weigh 8-15 kg. Wall must hold the unit with at least 4x safety factor.
3. Drainage path planned with continuous downward slope from indoor unit to outlet point. **Critical:** minimum 1:100 slope (10mm fall per meter). Any flat or uphill section in the drainage will accumulate water and overflow.
4. Refrigerant pipe route planned with minimum bends. Each bend reduces system efficiency. Total pipe length and elevation difference between indoor and outdoor units must be within manufacturer's limits — exceeding these requires additional refrigerant charge.
5. Electrical point at the unit location: dedicated 16A or 20A circuit, RCBO protected, sized per unit nameplate.
6. Wall sleeve drilled through the external wall with outward slope (5° minimum) to prevent rain ingress.

**Procedure:**

1. **Mounting plate installation.**
   - Position per drawing — typically 200mm minimum clearance above, 150mm at each side, 1500mm from floor.
   - Plate must be perfectly level — confirm with spirit level on both axes. An unlevel plate causes drainage problems (water pools in the pan instead of flowing to the drain side).
   - Anchor with appropriate fixings for the wall type — concrete needs sleeve anchors, brick needs proper plugs, drywall needs through-bolting to studs.
   - Test the mounting by hanging on it (the installer's weight at minimum) — must be solid.

2. **Wall penetrations.**
   - Drill holes for refrigerant pipes and drainage pipe with the wall sleeve in place.
   - Holes drilled with outward slope (toward exterior) — minimum 5°. This prevents any water that condenses in the pipe insulation from running back into the room.
   - Hole diameter sized so insulated pipes pass through without compression — compressed insulation loses thermal value and creates condensation points.

3. **Refrigerant pipe installation.**
   - Cut pipes square with a proper tube cutter — never a hacksaw (creates burrs that contaminate the refrigerant).
   - Deburr cut ends with deburring tool. Particles inside pipes cause compressor damage.
   - Form flares using a proper flaring tool — flare must be smooth, even, and at the correct angle (45°). Verify flare diameter against the flare nut.
   - Apply refrigerant oil (matched to the system refrigerant — POE for R-410A, mineral oil for R-22 systems) to flare faces before tightening.
   - Tighten flare nuts to torque specification — typically 40-60 N·m for 1/2" lines. Use a torque wrench, not hand-feel.
   - **Critical:** Each joint must be leak-tested.

4. **Drainage pipe installation.**
   - Run drainage pipe with continuous downward slope from indoor unit drain pan to outlet. No dips, no flats, no upward sections.
   - Use solvent cement joints — never push-fit joints (will leak under static head).
   - Support pipe at maximum 600mm intervals — drainage pipes sag between supports and create dips.
   - Drainage outlet must terminate at a permitted location — into a floor drain, a soak pit, or an external air gap above a drain. Never into a closed pipe (creates back-pressure).
   - For long horizontal runs, consider an inspection point (cleanout) — drainage pipes accumulate biofilm and slime over years and need periodic cleaning.

5. **Insulation continuity.**
   - Insulation on refrigerant pipes must be continuous from the indoor unit to the outdoor unit, including through the wall.
   - Joints in insulation sealed with the insulation manufacturer's tape — not generic insulation tape.
   - Vapor barrier intact across all joints. Even small gaps in the vapor barrier cause condensation, dripping, and eventually mold inside the wall.

6. **Electrical connection.**
   - Use the dedicated circuit for the unit. Never piggyback off a lighting circuit or another appliance.
   - Wire size per the unit nameplate amperage.
   - Connection inside the unit per the unit's terminal markings. Photograph the connection.
   - Earth connection verified continuous to the DB earth.

7. **Refrigerant pipe leak test (nitrogen pressure test).**
   - Before charging refrigerant, pressurize the connected piping with dry nitrogen to 30 bar (or per manufacturer specification).
   - Hold pressure for minimum 24 hours.
   - Pressure drop greater than 1 bar indicates a leak — locate and fix before proceeding.
   - **This step is non-negotiable.** Charging refrigerant into a leaky system loses the refrigerant within weeks and damages the compressor.
   - Document the start pressure, time, end pressure, and result. Photograph the gauge reading.

8. **Vacuum pulldown.**
   - After successful pressure test, evacuate the piping with a vacuum pump to 500 microns or below.
   - Hold vacuum for minimum 1 hour to verify no leaks and to remove moisture.
   - **Critical:** Moisture in the system reacts with refrigerant to form acids that destroy the compressor over years.

9. **Refrigerant charging.**
   - Charge with the specific refrigerant for the system (R-410A for most modern units, R-32 for newest, R-22 for legacy).
   - Quantity per manufacturer specification, adjusted for pipe length.
   - Charge through the service port on the outdoor unit only — never through the indoor unit.
   - Charge by weight (digital scale), not by gauge pressure alone — pressure varies with ambient temperature.

10. **Commissioning.**
    - Start the unit. Verify cooling within manufacturer-specified time.
    - Check temperature differential between inlet and outlet air — typically 10-14°C drop for properly charged systems.
    - Check refrigerant pressures against manufacturer specification.
    - Check drainage by pouring water into the drain pan — must flow freely to the outlet with no backup.
    - Check noise — running unit should not have any unusual sounds (rattles, hissing, gurgling).
    - Test all remote functions.

**Things vendors skip if not watched:**

1. **Pressure test with nitrogen.** Vendors will skip the 24-hour pressure test, claim "I checked with soap solution, no bubbles," and charge refrigerant directly. The result is slow refrigerant loss over 6-18 months, cooling degradation, and compressor failure. **Require** the 24-hour pressure test with documented gauge readings. No exceptions.

2. **Vacuum pulldown adequacy.** Vendors will pull a vacuum for 5 minutes and call it done. Inadequate vacuum leaves moisture in the system. **Require** vacuum below 500 microns held for 1 hour. Verify with a proper micron gauge — not a pressure gauge.

3. **Drainage slope.** Vendors fit the drainage pipe at an angle that "looks like it slopes" without measuring. **Require** measurement — a string level along the pipe should show continuous fall. Any flat section will overflow.

4. **Insulation vapor barrier.** Vendors compress the insulation through the wall hole or leave gaps at joints. Result: condensation inside the wall, water marks on the wall around the AC, mold over time. **Require** photographs of insulation continuity, especially at the wall penetration.

5. **Mounting plate level.** Vendors use one eye to "level" the plate. An unlevel mounting plate causes the indoor unit drain pan to tilt incorrectly — water collects on the wrong side and overflows inside the unit. **Verify** with a spirit level on the plate before any unit is hung.

6. **Refrigerant pipe quality.** Vendors substitute aluminum or low-grade copper for the specified copper. **Verify** the pipe brand and ISI marking on site before installation.

7. **Quantity of refrigerant.** Vendors guess the refrigerant charge by pressure reading instead of weighing it. Under-charged units run hot and damage the compressor. **Require** charging by weight with a documented record.

**Inspection points:**

- **Mounting plate:** Spirit level on both axes before any unit is hung.
- **Pipe routing:** Continuous insulation, no kinks, no exposed copper at joints.
- **Drainage:** Pour water into drain pan, watch it flow to outlet. No backup, no spillage.
- **Pressure test:** Gauge reading at start of 24-hour period, photo. Gauge reading at end of 24-hour period, photo. Pressure must hold within 1 bar.
- **Vacuum:** Micron gauge below 500. Hold for 1 hour, verify still below 500.
- **Refrigerant charge:** Weighed in, quantity documented against manufacturer specification.
- **Cooling test:** Temperature differential at inlet and outlet vents.

**Acceptance criteria:**

- Unit level and flush against wall
- Drainage flows freely with no pooling at any point along the line
- No exposed refrigerant pipe inside any room (all concealed or in a proper raceway)
- Insulation continuous with vapor barrier intact at all joints
- Mounting solid — no movement when unit is running
- 24-hour pressure test passed and documented
- Vacuum pulldown documented at <500 microns held for 1 hour
- Refrigerant charge documented by weight
- Temperature differential 10-14°C at commissioning
- No unusual noises during operation
- All remote functions tested
- Cooling certificate signed by the installer

**Do NOT:**

- Install with reverse drainage slope or any flat section
- Kink refrigerant pipes
- Skip wall sleeve
- Use indoor extension cord for power (must be permanent dedicated point)
- Skip pressure test or shorten it
- Skip vacuum pulldown
- Charge refrigerant by pressure alone — must charge by weight
- Compress insulation through wall penetrations
- Tighten flare nuts by feel — use torque wrench
- Use a hacksaw to cut copper pipe
- Mix brands of refrigerant
- Accept "I'll come back and check the cooling after a week" — commissioning must be complete at the time of installation$sop19$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Air Conditioning Indoor Unit Installation');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Sofa & Upholstery Manufacturing Standards',
         'Soft Furnishings',
         'Ensure custom-manufactured sofas, armchairs, and upholstered furniture meet the structural, comfort, and durability standards expected of premium interior design work.',
         $sop20$**Purpose:** Ensure custom-manufactured sofas, armchairs, and upholstered furniture meet the structural, comfort, and durability standards expected of premium interior design work. Upholstery failures (sagging cushions, frame creaking, fabric loosening, foam collapse) become apparent within 6-18 months and are the most common cause of client complaints in custom furniture work.

**System acceptability:**

- **Frame timber:** Kiln-dried hardwood — teak, sal, sheesham, or rubberwood. Moisture content below 12%. Forbidden: softwood (pine, fir) for any structural component, locally seasoned timber, plywood for frame structure (acceptable for back panels and bottoms only).
- **Webbing:** Pirelli webbing (Italian rubber webbing), Elastogrip, or premium jute webbing. Forbidden: cheap synthetic webbing that stretches permanently within months.
- **Springs (where used):** Coiled steel springs in the seat (for traditional construction) or sinuous springs (zigzag). Knot ties at minimum 8 points per spring for coiled springs.
- **Foam:** Polyurethane foam, high-density:
  - Seat cushions: 32-40 density (kg/m³), ILD (firmness) 25-35
  - Back cushions: 25-32 density, ILD 18-25
  - Arms: 35-45 density (firmer, holds shape)
  - For fire-rated environments: CMHR (Combustion Modified High Resilience) foam
  - Forbidden: re-bonded foam scraps as seat cushioning (collapses within a year). Foam below 25 density anywhere (collapses).
- **Cushion fillings (premium):** Down/feather blend (50/50 or 30/70 ratio per design), or feather over foam core, or polyester fiber over foam core. Specify per project.
- **Fabric:** Per project specification. Must include:
  - Composition (cotton, linen, wool, polyester, blend — affects feel and durability)
  - Weight (gsm — heavier fabrics are more durable)
  - Abrasion resistance (Martindale or Wyzenbeek rating — 25,000+ rubs for residential, 50,000+ for heavy-use areas)
  - Cleanability code (W, S, WS, X)
  - Pattern repeat if applicable
- **Thread:** Bonded polyester, matched to fabric color exactly. Lockstitch construction. Forbidden: cotton thread (rots), unbranded thread (variable quality).
- **Hardware:** Solid brass or stainless steel for any visible fittings (legs, glides, decorative elements). Metal threaded inserts for leg attachment (never screws into end-grain wood).

**Pre-conditions:**

1. Detailed drawing showing:
   - All dimensions (overall, seat depth, seat height, back angle, arm height)
   - Frame construction (joinery type, timber sections)
   - Foam specifications per area
   - Fabric quantity calculated with allowance for pattern matching
   - Hardware schedule
   - Special features (storage, recliner mechanism, etc.)
2. Fabric arrived on site, inspected for:
   - Quantity matches calculated requirement plus 10% spare
   - All rolls are from the same dye batch (verify batch number on labels) — different batches have visible color variation
   - No flaws (snags, slubs, color irregularities)
3. Site dimensions verified — confirm the piece fits the intended space and through all doorways/stairs to that space. **Critical:** measure doorways, lift entries, and stair corners. Custom sofas that don't fit through the door are common, expensive failures.

**Procedure:**

1. **Frame construction.**
   - All structural joints by traditional joinery — mortise-and-tenon, dovetail, or twin-dowel. No nails as the primary structural fastener.
   - Joints glued with PVA wood adhesive (Fevicol SH) and clamped during cure (minimum 24 hours).
   - Corner blocks at every corner — triangular hardwood blocks glued and screwed to reinforce.
   - Stretcher rails between front and back leg posts where applicable.
   - Frame must be rigid — no flex when the assembled frame is pressed at any corner.
   - All exposed frame edges chamfered or rounded — prevents fabric wear at sharp points.

2. **Webbing installation.**
   - Stretch webbing across the seat frame in two directions (interwoven) for traditional construction, or single direction with springs for spring-based construction.
   - Webbing tension: stretched to 10% beyond its relaxed length. Test by pressing — webbing should give but spring back.
   - Webbing attached with proper webbing tacks (not staples for primary attachment) — minimum 8 tacks per end.
   - Webbing spacing: typically 50mm apart for seat support.

3. **Spring installation (if specified).**
   - Coiled springs tied at 8 points per spring in 8-way hand-tied construction (premium standard).
   - Springs anchored to webbing or to a wooden seat platform.
   - Spring tops covered with burlap to prevent springs cutting into the foam above.

4. **Padding and foam.**
   - Foam cut precisely to frame dimensions — no gaps at edges, no overhang.
   - Foam edges (where they meet armrests, back, etc.) padded with softer foam or wrapped in batting to prevent firm-foam-edge feel.
   - Foam attached to substrate with spray adhesive — must not move during sitting.
   - **Critical:** Foam density per area as specified — vendors will substitute lower density foam to save cost. Verify by physical inspection of the foam (label often present) or by weighing (high-density foam is noticeably heavier than low-density).

5. **Inner cushion construction (for loose seat and back cushions).**
   - Inner cover: down-proof ticking (tightly woven cotton) for feather/down filling, or synthetic batting wrap over foam core for fiber cushions.
   - Filling distribution even — no lumps, no thin spots.
   - Inner cushion shape exactly matches the outer cover — too small leaves the cover loose, too large stresses the cover seams.
   - Inner cushion zipped or stitched closed.

6. **Outer cover (fabric) cutting and matching.**
   - **Pattern matching across seams** is the single biggest indicator of upholstery quality. Verify the cutter has laid out all pieces with pattern alignment in mind. Pattern repeat must align across:
     - Seat front to back panel
     - Cushion fronts to seat
     - Adjacent back cushions
   - Pieces cut with grain (or pattern direction) consistent — for solid fabrics, the weave direction must be consistent or fabric will appear to have different shades on different panels under lighting.

7. **Sewing.**
   - Lockstitch construction — minimum 7-8 stitches per inch (denser is stronger).
   - Double-stitched at high-stress seams (where the seat meets the arms, where cushions attach).
   - Welt or piping along visible seams per design — provides definition and strengthens the seam.
   - Thread tension consistent — loose stitches loosen further with use.

8. **Upholstering the frame.**
   - Fabric stretched evenly across the frame — no wrinkles, no looseness.
   - Tension equal on opposite sides (front/back, left/right) — uneven tension causes the fabric to pull to one side over time.
   - Fabric attached to frame with staples (acceptable for hidden attachments) or tacks (preferred for traditional construction). Staples placed at maximum 30mm centers.
   - Fabric tucks at corners — neat, hospital-fold style, no bunching.
   - All staples and tacks hidden under welt, gimp tape, or fabric edges.

9. **Leg attachment.**
   - Legs attached via metal threaded inserts (T-nuts or threaded inserts embedded in the frame). The leg threads into the insert.
   - Direct wood screws into end-grain are forbidden — they strip out within a year.
   - Test the leg attachment by attempting to wiggle the leg with the sofa weighted — must be solid.

10. **Final quality check.**
    - Sit test in three positions (left, center, right) on every seating position:
      - Confirms support (no sinking into the frame)
      - Confirms no frame contact (the foam absorbs all pressure; no hard frame edges felt through the upholstery)
      - Confirms silence (no creaking, no squeaking from frame joints)
    - Visual inspection from multiple angles in daylight:
      - Pattern alignment confirmed
      - No wrinkles, no looseness
      - Welt straight and continuous
      - Color consistent across all panels
    - Confirm cushion zippers operate smoothly.
    - Confirm legs are firm and level (sofa sits flat without rocking).

**Things vendors skip if not watched:**

1. **Foam density.** Substituting lower-density foam is the easiest way for vendors to cut cost — and the failure (cushion collapse) takes 6-12 months to become obvious. **Require** the foam supplier's specification sheet showing density and ILD for every batch of foam used. Photograph the foam labels.

2. **Pattern matching.** Vendors will lay out fabric to maximize yardage (minimize waste) rather than to match patterns at seams. **Require** that pattern alignment takes precedence over fabric efficiency. Be willing to provide additional fabric to allow proper matching.

3. **Frame timber substitution.** Vendors will substitute softwood for the specified hardwood inside the frame where it's not visible. The frame fails within 2-3 years. **Inspect** the frame timber during construction — it should be visibly hardwood (grain pattern, weight, color).

4. **Webbing tension.** Vendors will install webbing loose — easier and faster than properly stretching it. Loose webbing means the seat sinks within months. **Test** by pressing the webbing before foam is applied — should be firm under pressure.

5. **Joinery method.** Vendors will use nails and staples for joints that should be mortise-and-tenon or dowel. The piece is structurally weak from day one but feels solid because the upholstery hides the weakness. **Verify** joinery method during frame construction — require photographs of joints before they're covered.

6. **Corner blocks.** Vendors skip corner blocks because they're invisible in the finished piece. Without corner blocks, the frame racks (twists) under use within months. **Require** photographs of corner blocks installed.

7. **Filling distribution.** Vendors stuff cushions quickly, resulting in uneven distribution that becomes obvious after the cushion is used. Lumps form at the back, thin spots at the front. **Require** even filling distribution verified by visual inspection and gentle palpation before cushion covers are closed.

8. **Stitch density.** Vendors use coarse stitches (4-5 per inch) to sew faster. Coarse stitches pull out under stress. **Inspect** stitch density on multiple seams — should be 7-8 per inch minimum.

9. **Leg attachment method.** Vendors will screw legs directly into wooden ends instead of using threaded inserts. The legs loosen within months and may collapse under load. **Verify** threaded insert installation before legs are attached.

10. **Site fit measurement.** Vendors quote and manufacture without verifying the piece will fit through doorways, lift entries, and stair corners to its intended location. **Require** path-of-travel measurement before manufacturing begins. Sofas that don't fit through the door are the most expensive and embarrassing furniture failures.

**Inspection points:**

- **Drawing approval stage:** Verify dimensions against the path of travel to the room.
- **Frame stage (before upholstery):** Inspect timber, joinery, corner blocks. Test rigidity.
- **Foam and padding stage:** Verify foam density and distribution before fabric goes on.
- **Pre-final assembly:** Inspect pattern alignment, stitch density, welt continuity.
- **At delivery:** Sit test, visual inspection, leg test, fit check at site.

**Acceptance criteria:**

- Frame rigid with no flex at any corner
- All joints solid — no creaking under use
- Cushions firm with appropriate density per design intent
- Fabric tension even across all surfaces — no sagging, no wrinkles
- Pattern matching consistent at all seams
- No exposed staples, tacks, or raw fabric edges
- All joints clean — no visible glue, no thread tails
- Welt or piping straight and continuous
- Legs firm with sofa weighted, level on the floor
- Cushion zippers operate smoothly
- Sit-test passes — comfortable, supportive, silent
- Color and tone consistent across all panels in daylight
- Sofa fits through the path of travel to its intended location

**Do NOT:**

- Use softwood or low-grade plywood for structural frame
- Use foam below 25 density anywhere
- Substitute re-bonded foam for the specified high-density polyurethane foam
- Skip pattern matching to save fabric
- Use staples where stitching is specified
- Use nails as the primary structural fastener
- Screw legs directly into end-grain (must use threaded inserts)
- Skip corner blocks because they're hidden
- Accept loose webbing
- Skip the sit-test at delivery
- Manufacture without confirming path of travel to the room

---$sop20$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Sofa & Upholstery Manufacturing Standards');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Plaster of Paris False Ceiling',
         'Civil & Masonry',
         'Construct a flat, crack-free POP false ceiling that holds level and accepts paint finish, with no visible joints or cracks.',
         $sop21$**Purpose:** Construct a flat, crack-free POP false ceiling that holds level and accepts paint finish, with no visible joints or cracks.

**System acceptability:**

- **Framework:** GI channels (galvanized iron) — 0.45mm thickness minimum, sections per drawing.
- **POP boards (drier method):** Saint-Gobain Gyproc Standard, USG Donn, Boral Plasterboard.
- **POP powder (wet method):** ISI-marked, branded — Saint-Gobain Gyproc Plaster, Sakarni POP.
- **Jointing compound:** Manufacturer-matched to board type.
- **Forbidden:** Locally fabricated GI channels with thickness below 0.45mm (sag under load), unbranded POP powder.

**Pre-conditions:**

1. Drawings show:
   - Ceiling layout with all cut-outs marked
   - Levels (typically 250-400mm below structural slab)
   - Light fixture positions
   - AC diffuser positions
   - Any cove or design features
   - Access panels for any concealed services
2. All services above the ceiling line complete and tested:
   - Electrical cables in place
   - AC ducting installed and pressure-tested
   - Plumbing/drainage (if any) tested
   - Fire detection wiring installed
3. The space is clean — debris removed. POP work generates significant dust and will adhere to debris during cure.

**Procedure:**

1. **Establish ceiling level.**
   - Use a laser level to mark the perimeter at the design height.
   - Verify against drawing — common mistake is incorrect level reference.

2. **Perimeter angle.** Fix L-angle (25mm × 25mm GI angle) along the perimeter at the marked level. This is the support for the perimeter edge of the ceiling.

3. **Framework installation.**
   - Main runners every 1200mm spacing.
   - Cross runners every 600mm spacing (for board ceilings) or per design (for wet POP).
   - Hangers from the structural slab — typically every 1200mm along the runners, supported by anchors into the slab.
   - The entire framework must be:
     - Level (variation under 3mm across 3m)
     - Square
     - Aligned with the building grid
   - Verify level at multiple points before any board or POP is applied.

4. **For board ceiling (drier method):**
   - Fix POP boards to framework with screws (drywall screws, sized for board thickness).
   - Screw spacing: 200mm at edges, 300mm in the field.
   - Screws set just below the board surface — not protruding, not over-driven.
   - Joints staggered between rows — never aligned.
   - Cut-outs for lights, diffusers, and access panels cut on site to match positions exactly.

5. **For wet POP (over chicken mesh):**
   - Fix chicken mesh to framework using GI binding wire.
   - Apply first coat of POP — pushed through the mesh to lock it in place.
   - Apply second coat to build up thickness and surface.
   - Apply third coat (skim coat) for finishing.

6. **Joint treatment.**
   - Apply jointing compound over every screw and every board joint.
   - Embed paper tape (or fiberglass mesh tape) in the joint compound at joints.
   - Allow drying, sand smooth.
   - Apply second coat of jointing compound, sand smooth.
   - Apply skim coat over the entire ceiling surface for paint-ready finish.

7. **Cure period.** Minimum 7 days before painting. Premature painting traps moisture and causes the paint to peel.

**Things vendors skip if not watched:**

1. **Framework spacing.** Vendors widen spacing to save material. Result: ceiling sags between supports within 1-2 years. **Verify** framework spacing matches specification.

2. **Hanger anchoring.** Vendors use plastic anchors in concrete (weak, pulls out under sustained load). **Require** mechanical anchors (sleeve anchors or chemical anchors) for hanging into structural slab.

3. **Joint tape.** Vendors apply jointing compound without tape at joints. Joints crack within months as the building moves slightly. **Verify** tape embedded in every joint.

4. **Heavy load fixings on POP alone.** Vendors will fix heavy chandeliers or fans directly to the POP. POP cannot support such loads — failure is dangerous. **Require** any heavy fixture to be hung from independent fixings into the structural slab through the ceiling (the POP just provides a finished surface around the fixing).

5. **Cure period skipped.** Vendors paint before POP is fully cured. **Require** 7-day minimum cure before painting.

**Acceptance criteria:**

- Ceiling level: variation within 3mm over 3m
- No visible joints or cracks after skim coat
- Cut-outs aligned with light fixtures and diffusers per drawing
- Cove lines straight and even
- All edges sharp where meeting walls
- All access panels accessible and properly framed
- All heavy fixtures hung from structural slab, not from ceiling

**Do NOT:**

- Hang heavy fixtures (chandeliers, fans, AC indoor units) from POP — use independent fixing through framework to slab
- Apply POP over wet substrate or in damp conditions
- Skip jointing compound and tape at joints
- Paint before POP is fully dry (minimum 7 days)
- Use undersized GI channels — sag is inevitable
- Skip access panels at locations where concealed services will need future maintenance$sop21$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Plaster of Paris False Ceiling');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Floor Tile Laying',
         'Civil & Masonry',
         'Lay floor tiles level, with consistent joints, full mortar bedding, and clean grouting that will not develop hollow spots, edge chipping, or grout failure.',
         $sop22$**Purpose:** Lay floor tiles level, with consistent joints, full mortar bedding, and clean grouting that will not develop hollow spots, edge chipping, or grout failure.

**System acceptability:**

- **Tiles:** Per project specification. Vitrified tiles, ceramic, porcelain, natural stone. Verify by inspection: dimensional accuracy (corners square, edges straight), color/batch consistency (different batches have visible color variation).
- **Tile adhesive:** Cement-based, sized to tile type:
  - Type 1 adhesive (basic) for small ceramic tiles in dry areas
  - Type 2 (improved) for large ceramic tiles and dry porcelain
  - Type 5 (highly modified) for natural stone, large format porcelain, and wet areas
  - Brands: Pidilite Roff, MYK Laticrete, BAL Adhesives, Asian Paints Smartcare
- **Spacers:** 2-3mm for porcelain, 3-5mm for natural stone, 1.5mm for premium polished porcelain.
- **Grout:** Cement-based grout (standard areas), epoxy grout (wet areas, high-traffic, premium finish). Color matched per drawing.
- **Forbidden:** Cement-sand bedding alone for ceramic or porcelain tiles in residential (cracking issues). Tile adhesive used past its working time.

**Pre-conditions:**

1. Substrate is clean, level within 5mm over 3m, structurally sound.
2. For wet areas: waterproofing completed and ponding test passed.
3. All wall work in the area complete to the level above the finished floor — wall finishes can damage tile floors during finishing.
4. All tiles inspected before laying:
   - Color and batch match across all tiles needed for the area
   - Dimensional accuracy
   - No chips or cracks
5. Drawings show:
   - Tile layout (starting point, joint pattern)
   - Cut tile positions (always at edges, never in the field of view)
   - Joint width
   - Grout color
   - Border details if any

**Procedure:**

1. **Layout planning.**
   - Mark the center of the room (or design center) and chalk lines for the starting tile position.
   - Dry-lay perimeter tiles to confirm cut sizes. The goal is to avoid very small cut pieces (less than 50mm) at edges — these look bad and crack easily.
   - Adjust starting position if needed to balance cuts on opposite sides.
   - **Critical:** Plan the cut tile positions to fall at non-conspicuous locations (under future furniture, behind doors, at room edges).

2. **Mix tile adhesive** per manufacturer specifications. Mix only what can be applied within the working time (typically 30-45 minutes). Adhesive that has begun to skin or set must be discarded.

3. **Apply adhesive to substrate.**
   - Use a notched trowel sized for the tile (typically 10mm notch for floor tiles, 12mm for large format).
   - Comb the adhesive in one direction to create uniform ridges.
   - Coverage: only enough that can be tiled within 15 minutes (before the adhesive skins).

4. **Back-buttering large tiles.** Tiles 600mm × 600mm and larger must have adhesive applied to their back as well (called "back-buttering"). This ensures full contact and prevents hollow spots. Vendors universally skip this step on large tiles — it's the single biggest cause of hollow tile complaints.

5. **Set tile firmly.** Place tile, twist slightly into position to bed fully. Press down evenly. The adhesive ridges should collapse into a continuous bed — you should hear a slight squelch as air escapes.

6. **Use spacers** between every tile. Maintain consistent spacing throughout.

7. **Level check.** Use a straightedge across multiple tiles. Adjust by tapping with a rubber mallet (with a wooden block over the tile to prevent damage). Adjust before the adhesive sets.

8. **Clean tile face immediately** of any adhesive smears with a damp sponge. Cured adhesive on tile faces is very hard to remove without damaging the tile finish.

9. **Setting time.** 24 hours minimum before walking on tiles, grouting, or further work.

10. **Grouting.**
    - Remove spacers.
    - Mix grout per manufacturer.
    - Apply with rubber float, working diagonally across joints. Press firmly to fill the entire joint depth.
    - Wipe excess grout off tile face within 15-20 minutes of application — the grout begins to harden.
    - After 30-45 minutes, polish tile face with a clean dry cloth to remove final haze.

11. **Sealing (for porous tiles and natural stone).** Apply penetrating sealer 24 hours after grouting.

**Things vendors skip if not watched:**

1. **Back-buttering on large tiles.** The single most-skipped step. Hollow spots develop, tiles crack under load. **Require** photographic evidence of back-buttering before tiles are set.

2. **Layout planning.** Vendors will start at a wall and just keep going, ending with random tiny cuts at the opposite end. **Require** the dry-lay and layout planning step before any tile is set.

3. **Cleaning adhesive immediately.** Vendors will leave adhesive smears on tile faces and try to clean them after they cure. The cleaning damages the tile finish. **Require** immediate cleaning.

4. **Adhesive working time.** Vendors will use adhesive past its working time to save material. The adhesive doesn't bond properly. **Verify** that adhesive is fresh-mixed (look for unset mortar in the bucket).

5. **Grouting before adhesive cures.** Vendors will grout the same day to finish faster. The adhesive isn't set; the tiles shift slightly during grouting and create uneven joints. **Require** 24-hour gap between tile-setting and grouting.

**Acceptance criteria:**

- Tile level: variation within 2mm over 2m straightedge
- Joints uniform width — no variation between rows or columns
- Grout uniform color, fully filled, no voids or pinholes
- No hollow sound when tapped (verify by tapping 10% of tiles randomly)
- Cut tiles clean-edged
- Cut tile positions per drawing — full tiles at sight lines
- Tile faces clean — no adhesive smears, no grout haze
- No chipped edges

**Do NOT:**

- Lay tiles over uncured screed
- Skip back-buttering on large-format tiles
- Skip layout planning — never start from a wall
- Walk on tiles before 24-hour adhesive cure
- Grout before 24-hour adhesive set
- Use adhesive past its working time
- Mix grout colors mid-project
- Use cement-sand bedding alone for ceramic/porcelain (causes cracking)$sop22$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Floor Tile Laying');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'CPVC Pipe Installation',
         'Plumbing & Sanitary',
         'Install hot and cold water supply pipes with proper joints, supports, and pressure testing for decades of leak-free service.',
         $sop23$**Purpose:** Install hot and cold water supply pipes with proper joints, supports, and pressure testing for decades of leak-free service.

**System acceptability:**

- **CPVC pipes:** Astral, Ashirvad, Supreme, Finolex CPVC. ISI marked (IS 15778).
- **Solvent cement:** Astral, Ashirvad, Supreme — matched to the pipe brand. Mixing brands of pipe and cement is forbidden — different formulations may not bond properly.
- **Pipe clamps:** UV-stabilized plastic or stainless steel clamps. Sized for pipe diameter.
- **Forbidden:** PPR pipes substituted for CPVC (different installation method, different temperature rating). UPVC pipes for hot water lines (only CPVC is rated for hot water). Local unbranded CPVC.

**Pre-conditions:**

- Drawings showing pipe routes, sizes, and fixture connections.
- Pipe chases or concealment routes prepared.
- All pipe sizing per cold/hot demand calculations.

**Procedure:**

1. **Cut pipe** with a proper plastic pipe cutter — never a hacksaw (creates burrs that affect joint integrity).

2. **Deburr** the cut end with a deburring tool or a sharp knife. Inside and outside edges.

3. **Dry-fit assembly.** Test all components in their final position before applying cement. This is the only opportunity to adjust alignment.

4. **Cement application.**
   - Apply solvent cement to both the pipe end and the fitting socket.
   - Use the brush supplied with the cement (size matched to pipe).
   - Coverage: light, uniform film. Excess cement is squeezed out as joints assemble and weakens the joint.

5. **Joint assembly.**
   - Push pipe into fitting with a slight twist (quarter turn).
   - Hold the joint for 30 seconds while initial set occurs.
   - The depth of pipe insertion must reach the socket stop — partial insertion is weaker.

6. **Cure times** per manufacturer:
   - Initial set (handling): 1 hour
   - Pressure testing acceptable: 24 hours minimum

7. **Pipe supports.**
   - Horizontal runs: clamps at maximum 1m intervals.
   - Vertical runs: clamps at maximum 1.5m intervals.
   - At every change of direction.
   - Allow some movement for thermal expansion — never clamp tightly enough to prevent pipe expansion.

8. **Pressure testing.**
   - Cap all open ends.
   - Pressurize to 1.5× working pressure (typically 8-10 kg/cm² for residential).
   - Hold for minimum 1 hour, ideally overnight.
   - Pressure drop indicates a leak — locate and repair before concealment.
   - Document the start pressure, time, and end pressure. Photograph the gauge.

9. **Concealment** only after pressure test passes. Pipes concealed before testing means any leak requires breaking the wall.

**Things vendors skip if not watched:**

1. **Pressure testing duration.** Vendors will pressure-test for 10-15 minutes and call it done. Slow leaks at marginal joints take longer to manifest. **Require** minimum 1 hour, ideally overnight, with documented gauge readings.

2. **Cement quality.** Vendors will use cheap unbranded cement. Joints fail at 6-12 months. **Verify** cement brand on the container before any installation.

3. **Pipe support spacing.** Vendors space supports too far apart to save clamps. Pipes sag, creating low points where sediment collects and pipes vibrate during use. **Verify** support spacing matches specification.

4. **Mixing brands.** Pipes from one brand with cement from another — the cement may not be properly formulated for the pipe. **Require** brand consistency.

5. **Hot/cold pipe identification.** Vendors run hot and cold lines without color coding. Future maintenance is impossible without breaking walls to identify pipes. **Require** color marking (red bands for hot, blue for cold) at every junction box and at every accessible point.

**Acceptance criteria:**

- All joints clean, no excess cement visible
- All supports in place per spacing standard
- Pressure test passes with zero drop documented (with photographs)
- No joints concealed before pressure testing
- Hot water line clearly identified vs cold
- No air pockets in lines (test by bleeding all fixtures)

**Do NOT:**

- Mix pipe brands or cement brands
- Apply cement to wet pipe
- Move joint before initial set time
- Conceal pipes before pressure test passes
- Use hacksaw for cutting
- Skip the pressure test
- Use UPVC for hot water lines$sop23$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'CPVC Pipe Installation');

  INSERT INTO sops (id, title, category, description, content, created_by, org_id, created_at, updated_at)
  SELECT gen_random_uuid(),
         'Project Handover',
         'Studio Operations',
         'Close out a project formally with all documentation, snags closed, and warranties transferred to the client.',
         $sop24$**Purpose:** Close out a project formally with all documentation, snags closed, and warranties transferred to the client.

**Pre-conditions:**

- All site work complete.
- All snags identified, fixed, and re-inspected.
- All vendor accounts settled per terms.
- All required tests completed (waterproofing ponding test, electrical insulation test, AC pressure test, water test on windows, etc.) — documented.

**Procedure:**

1. **Internal walkthrough.** Site supervisor + senior designer + project manager. Fix any remaining issues before client walkthrough.

2. **Handover file compilation.**
   - Warranty certificates from all relevant vendors (electrical, AC, appliances, hardware, glass, fabric, paint)
   - Maintenance manuals for all appliances, AC, water purifiers, exhaust systems
   - Care instructions for all finishes (wood, stone, fabric)
   - Paint codes used in each room for future touch-ups
   - Tile codes and batch numbers
   - Contact list of vendors with phone numbers and email
   - Drawing set as-built (final approved revisions)
   - All test reports (electrical, waterproofing, AC commissioning, water test)
   - Photographic record of pre-plaster electrical installation, waterproofing application, and any other concealed work

3. **Client walkthrough.**
   - Walk through every room with the client.
   - Note any final observations.
   - Close on the spot if minor.
   - Document any items the client wishes to follow up.

4. **Key and access handover.**
   - Hand over all keys, remotes, access cards.
   - Demonstrate operation of major fittings:
     - AC system (each unit and the central control)
     - Water filter
     - Audio/video system
     - Smart lighting
     - Smart locks if any
     - Geyser controls
     - Any motorized blinds, curtains, doors
   - Provide written operating instructions for complex systems.

5. **Client sign-off.** Client signs handover acknowledgment confirming receipt of all materials.

6. **Final photography.** With client permission, take final photographs after the client has moved in for the studio's portfolio.

7. **30-day check-in scheduled.** Set a calendar reminder. The client will likely have small adjustments after living in the space for a few weeks.

**Things vendors skip if not watched:**

1. **Warranty collection.** Vendors don't provide written warranties — they say "we'll come if there's a problem" but with no documentation. **Require** written warranty certificates for every system.

2. **As-built drawings.** Designs change during execution but the final drawings are never updated. Future maintenance is hampered. **Require** as-built drawings showing the actual installed condition.

3. **Photographic record of concealed work.** Concealed wiring, plumbing, waterproofing — if not photographed before concealment, future maintenance requires destructive exploration. **Verify** photographic record is complete before final sign-off.

4. **Demonstration of operation.** Vendors say "the manual is in the file" — but clients don't read manuals. **Require** in-person demonstration of every major system.

**Acceptance criteria:**

- All warranty documents collected and in file
- All snags closed and re-inspected
- All keys/access handed over with receipt acknowledged
- Client signed handover acknowledgment
- 30-day check-in scheduled
- Final photographs taken
- All systems demonstrated to client
- Photographic record of all concealed work in the handover file

**Do NOT:**

- Hand over with open snags
- Skip vendor warranty collection
- Leave the site without client sign-off
- Promise post-handover work that hasn't been specifically agreed
- Hand over without demonstrating each major system

---

# End of SOPs

Total: 25 SOPs across 8 categories — Carpentry & Joinery, Polishing & Finishing, Painting, Civil & Masonry, Electrical, Plumbing & Sanitary, HVAC, Glass & Aluminium, Soft Furnishings, and Studio Operations.

These SOPs are written to be handed to vendors as the standard your firm expects. The depth varies by failure cost — work where failures are expensive and hidden (PU polish, waterproofing, marble, electrical, AC) receives the longest treatment; work that's more straightforward receives a tighter format.

Editable by your daughter to reflect her firm's brand preferences, regional supplier networks, and accumulated experience.$sop24$,
         '46833846',
         NULL,
         NOW(),
         NOW()
  WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Project Handover');

END
$$;