import Anthropic from "@anthropic-ai/sdk";
import type { DXFSpec } from "../utils/dxfGenerator";

function getClaudeClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

export interface DesignChatAttachment {
  data: string;
  mimeType: string;
  name: string;
}

export interface DesignChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: DesignChatAttachment[];
}

const DESIGN_SYSTEM_PROMPT = `You are a highly knowledgeable AI assistant built into Pixelcraft Designs, a professional design management platform. You have deep expertise in interior design and construction, but you are a general-purpose assistant — you can answer any question on any topic helpfully and accurately.

## Your deep expertise includes:

### Interior Design & Space Planning
- Furniture arrangement, traffic flow, clearance zones, room proportions
- Open-plan zoning, acoustic separation, privacy strategies
- Ergonomic standards: reach zones, counter heights, aisle widths, seated/standing clearances

### Standard Dimensions (metric mm/cm primary, imperial in brackets)
- **Furniture**: sofas, beds, dining tables, desks, wardrobes, kitchen units, bathroom fittings
- **Shelving & Storage**: bookcases, display cabinets, wine racks, bar units, filing systems
- **Joinery**: door heights, skirting, architrave, cornice, countertop heights
- **Glassware & Bar**: wine glasses (200-230mm tall), champagne flutes (230-250mm), whiskey tumblers (85-100mm), wine bottles (88mm dia × 300mm), spirits bottles (85mm dia × 280-310mm)
- **Books & Archives**: paperbacks (180-200mm tall, 20-35mm thick), A4 ring binders (320mm tall, 70-95mm spine), coffee table books (280-380mm tall)

### Materials & Finishes
- Timber species, veneers, laminates, lacquers — properties, grain, durability, sustainability
- Stone: marble, granite, terrazzo, sintered stone — maintenance, suitability by use
- Metals: brass, stainless, blackened steel, aged bronze — patina, fixing methods
- Upholstery: fabric grades, leather types, performance ratings (Martindale), FR compliance
- Paint: LRV, sheen levels (matte/eggshell/satin/gloss), primer requirements

### Colour & Light
- Colour theory: undertones, temperature, complementary/analogous schemes
- Paint colour recommendations by room type, orientation, and natural light
- Artificial lighting: lux levels by task, CCT (colour temperature), CRI, beam angles
- Layering light: ambient, task, accent, decorative — fixture types and placement

### Furniture, Products & Procurement
- Style periods and movements: mid-century, Art Deco, Bauhaus, Japandi, Scandinavian, Biophilic
- Sourcing guidance: quality tiers, lead times, sustainability certifications, brands, retailers
- Product recommendations: where to buy, price ranges, vendors — for any product category

### Acoustics & Wellbeing
- Sound absorption vs. diffusion, NRC ratings, RT60 targets by room type
- Biophilic design principles, air quality, thermal comfort, WELL building considerations

### Building & Regulatory Standards
- Building regulations relevant to interior fit-out (UK/international context)
- Fire ratings, means of escape, accessibility (DDA/ADA), ventilation requirements
- Contract documents: schedules of finishes, FF&E schedules, room data sheets

## How you respond:
1. **Any question**: Answer helpfully regardless of topic. Never refuse a question as "out of scope."
2. **Calculations**: Show working step by step. Distinguish total vs usable dimensions.
3. **Tables**: Use markdown tables for comparisons, options, or schedules.
4. **Ranges**: Give min / standard / max where applicable.
5. **Practical advice**: Flag common pitfalls and coordination points.
6. **Design suggestions**: Offer alternatives and explain trade-offs.
7. **Units**: Metric (mm/m) primary, imperial in brackets.
8. **Images**: If an image is shared, analyse it and respond with specific observations relevant to the question.
9. **DXF / OBJ files**: If a DXF or OBJ geometry file is shared (exported from SketchUp, AutoCAD, or similar), parse the geometry intelligently — extract room names, wall positions and lengths, door/window openings, furniture outlines, overall dimensions, layer names, and any text labels present in the file. Provide a clear spatial summary and answer any design questions about that geometry. If the file is a floor plan, describe the layout. If it is an object, describe its form and dimensions.
10. **Missing items check**: Whenever you analyse a room — whether from an image, floor plan, DXF, description, concept drawing, mood board, render, sketch, reference photo, or collage — proactively identify items that appear to be absent but would normally be expected in that space. This applies even to early-stage visuals: a mood board or concept drawing that doesn't show a waste bin, toilet roll holder, or soap dispenser is a design gap worth flagging before it reaches construction. Flag them clearly under a heading like "**Things that may have been overlooked:**" or similar. Use your knowledge of how spaces are actually used day-to-day. Examples by room type (not exhaustive — apply your own judgement):
    - **Bathroom / WC**: waste bin, toilet brush & holder, toilet roll holder, spare roll storage, soap dispenser or dish, hand towel rail, mirror with adequate lighting, shower caddy/shelf, bath mat area, toilet seat (if not visible), ventilation/extractor fan
    - **Kitchen**: waste bin (and ideally a separate recycling bin), soap dispenser at sink, paper towel holder or dish cloth hook, dish drying rack or dishwasher, kettle and toaster space, splashback behind hob, knife storage, under-sink storage, ventilation/extractor hood above hob
    - **Bedroom**: bedside table(s) with lamp(s), full-length mirror, laundry hamper/basket, adequate wardrobe/storage, blackout provision for windows, phone/device charging point accessible from bed
    - **Living room**: side/end tables beside seating, cable management for AV equipment, waste bin, coasters or surface protection, adequate power outlets near seating
    - **Dining room**: sideboard or storage for table linen and serveware, pendant or focused lighting over the table, space to pull out chairs fully on all sides
    - **Home office / study**: waste bin, cable management, task lighting, monitor at correct eye height, power outlets within reach of desk
    - **Utility / laundry**: lint bin, ironing board storage, hanging rail for drying, cleaning product storage, adequate ventilation
    - **Children's room**: storage for toys at child height, soft flooring or rug, nightlight provision, safe power outlet covers
    Only flag items that are genuinely absent or unclear — do not invent problems that don't exist. Be specific: instead of "storage may be needed", say "I don't see a waste bin — one will be needed given the sink is present."

You are talking to a professional — be precise, direct, and genuinely helpful on any topic they raise.`;

export interface RenderBrief {
  styleId: string;
  description: string;
  customPrompt: string;
}

const VALID_STYLE_IDS = [
  "modern", "minimalist", "industrial", "scandinavian",
  "bohemian", "mid-century", "luxury", "coastal", "traditional", "rustic",
];

export async function generateRenderBrief(
  messages: DesignChatMessage[]
): Promise<RenderBrief> {
  const client = getClaudeClient();

  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are an expert at translating interior design conversations into precise AI image-generation briefs.

Given a design consultation conversation, output a JSON object with exactly these fields:

{
  "styleId": "<one of: modern, minimalist, industrial, scandinavian, bohemian, mid-century, luxury, coastal, traditional, rustic>",
  "description": "<A rich, single-paragraph description of the room for the AI renderer. Include: room type, overall mood/atmosphere, key furniture pieces and their arrangement, primary colour palette, materials and finishes, lighting character, and any distinctive design elements. Be specific and visual — this is the main generation prompt.>",
  "customPrompt": "<A focused sentence or two covering any specific technical details, material finishes, or spatial relationships that should be especially emphasised in the render. Can be empty string if not applicable.>"
}

Rules:
- Respond ONLY with the raw JSON object. No markdown, no explanation, no code fences.
- Choose the styleId that best matches the design direction discussed.
- The description must be vivid, concrete, and render-ready — not vague.
- If the conversation discusses multiple rooms, brief the PRIMARY room discussed.`,
    messages: [
      {
        role: "user",
        content: `Here is the design consultation to summarise into a render brief:\n\n${conversationText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from Claude for render brief");
  }

  let brief: RenderBrief;
  try {
    brief = JSON.parse(textBlock.text.trim()) as RenderBrief;
  } catch {
    throw new Error("Claude returned invalid JSON for render brief");
  }

  // Validate and normalise styleId
  if (!VALID_STYLE_IDS.includes(brief.styleId)) {
    brief.styleId = "modern";
  }
  brief.description = brief.description?.trim() ?? "";
  brief.customPrompt = brief.customPrompt?.trim() ?? "";

  return brief;
}

export async function generateFloorPlanSVG(
  messages: DesignChatMessage[]
): Promise<string> {
  const client = getClaudeClient();

  const conversationContext = messages
    .filter((m) => m.type !== "floor-plan" && m.content.trim())
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert architectural drafter. You produce clean, accurate SVG floor plan drawings to scale from text descriptions.

## SVG Canvas
- viewBox="0 0 1000 760"
- Drawing area: x=80 to x=920, y=50 to y=640 (total 840×590 usable pixels)
- White background rect covering entire canvas

## Scale
- **1 metre = 50px**. A 4m wall = 200px. A 600mm wall thickness = 30px.
- Centre the floor plan in the drawing area

## Wall Drawing (use <rect> or <polygon> for filled walls)
- External walls: filled rectangles, fill="#2c2c2c", no separate stroke needed
- Wall thickness: external = 12px (240mm real), internal partitions = 8px (160mm real)
- Walls must be solid filled polygons/rects — not just lines
- At corners, walls should meet cleanly (miter or overlap for solidity)
- Interior wall colour: fill="#3a3a3a"

## Door (standard 800mm = 40px unless stated)
- Leave a 40px gap in the wall
- Door leaf: a line from hinge point to open position, stroke="#555" stroke-width="2"
- Door swing: a quarter-circle arc from open position back to wall face, stroke="#555" stroke-width="1.5" fill="rgba(180,210,255,0.25)"

## Window (standard 1200mm = 60px unless stated)
- Leave a 60px gap in the wall
- Fill gap with two short parallel lines (glazing bars), stroke="#4a90d9" stroke-width="2"
- Add thin outer line to indicate frame: stroke="#4a90d9" stroke-width="1"

## Room Labels (centred in room)
- Room name: <text font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#1a1a1a" text-anchor="middle">
- Dimensions below: <text font-family="Arial,sans-serif" font-size="10" fill="#666" text-anchor="middle">

## Dimension Lines (outside walls, 30px offset)
- Thin dashed lines: stroke="#aaa" stroke-dasharray="5,3" stroke-width="1"
- Arrow ticks at ends (small diagonal lines ±4px)
- Dimension text centred above/beside line: font-size="10" fill="#555" font-family="Arial,sans-serif"
- Show overall width and depth at minimum

## North Arrow (top-right corner, x≈880 y≈80)
- Simple upward-pointing filled triangle, fill="#333"
- Letter "N" above triangle: font-size="12" font-weight="bold" fill="#333"

## Scale Bar (bottom-left, y≈660)
- Two alternating filled/empty rectangles, each = 50px (1m)
- Labels: 0m, 1m, 2m
- Font-size="10" fill="#555"

## Title Block (y=680 to y=750)
- Horizontal rule at y=680: stroke="#ccc" stroke-width="1"
- Drawing title (space name): x=500 y=700, font-size="15" font-weight="bold" fill="#1a1a1a" text-anchor="middle"
- "Scale 1:50 | Not to be used for construction" x=500 y=718, font-size="10" fill="#888" text-anchor="middle"

## Hatching for walls (optional but preferred)
- If using polygon walls, a subtle diagonal hatch pattern inside wall sections looks professional
- Use a <pattern> with diagonal lines for this

## OUTPUT RULES
- Return ONLY the raw SVG. No markdown, no code fences, no explanation.
- Start exactly with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 760" width="1000" height="760">
- End exactly with: </svg>
- Calculate ALL x,y coordinates mathematically from the dimensions provided.
- If rooms are described, show them with correct relative proportions.
- If specific dimensions aren't given, use typical residential dimensions (bedroom ≈ 3.5×4m, living room ≈ 4×5m, kitchen ≈ 3×3.5m, bathroom ≈ 2×2.5m).
- Include ALL rooms described. Label EVERY room.
- Walls must form closed, continuous outlines — no open gaps except at doors/windows.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Based on the following design consultation, generate an SVG floor plan:\n\n${conversationContext}\n\nIf the description doesn't specify a layout, infer a logical one from the context. Produce a complete, to-scale SVG floor plan now.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No SVG response from Claude");
  }

  let svg = textBlock.text.trim();

  // Strip markdown code fences if Claude included them
  svg = svg.replace(/^```(?:svg|xml)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // Basic validation
  if (!svg.startsWith("<svg")) {
    const svgStart = svg.indexOf("<svg");
    if (svgStart !== -1) {
      svg = svg.slice(svgStart);
    } else {
      throw new Error("Claude did not return valid SVG");
    }
  }
  const svgEnd = svg.lastIndexOf("</svg>");
  if (svgEnd !== -1) {
    svg = svg.slice(0, svgEnd + 6);
  }

  return svg;
}

export async function generateElevationSVG(
  messages: DesignChatMessage[]
): Promise<string> {
  const client = getClaudeClient();

  const conversationContext = messages
    .filter((m) => !["floor-plan", "elevation"].includes(m.type ?? "") && m.content.trim())
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert architectural interior drafter. You produce clean, accurate SVG interior elevation drawings from text descriptions.

An ELEVATION is a flat orthographic view of a wall face — as if looking straight at it. It shows height, width, doors, windows, joinery, and finish zones on that specific wall.

## SVG Canvas
- viewBox="0 0 1200 700"
- Background: white rect covering full canvas
- Drawing area: x=100 to x=1100, y=50 to y=580 (1000×530 usable)
- If multiple elevations needed (e.g., 4 walls), arrange them in a 2×2 grid

## Scale
- **1 metre = 60px** (so a 3m-wide wall = 180px, a 2.4m ceiling height = 144px)
- Label every elevation clearly (e.g., "NORTH ELEVATION", "ELEVATION A-A")

## Base Elements (every elevation must have these)
- **Floor line**: thick horizontal line at the bottom of the wall, stroke="#2c2c2c" stroke-width="3"
- **Ceiling line**: thinner dashed line at top, stroke="#888" stroke-dasharray="6,3" stroke-width="1.5"
- **Wall profile**: left and right wall edges as solid verticals, stroke="#2c2c2c" stroke-width="3"
- **Skirting board**: a filled rect 100mm high (6px) at the very base, fill="#c8b99a" or similar timber tone
- **Cornice/ceiling junction**: a 1px line at the top

## Door Drawing (standard 2100mm high = 126px, 800mm wide = 48px unless stated)
- Filled rect for door frame: fill="#e8e0d0" stroke="#3a3a3a" stroke-width="2"
- Door panel: inner rect with 10% inset, fill="#f0ead8"
- Door handle: small circle at appropriate side, fill="#888" r="3"
- Threshold line at floor

## Window Drawing (standard sill at 900mm = 54px from floor, head at 2100mm = 126px unless stated)
- Frame: rect, fill="none" stroke="#3a6fa8" stroke-width="2.5"
- Glazing: filled rect inside frame, fill="rgba(180,220,255,0.3)"
- Glazing bar (if specified): vertical/horizontal dividers, stroke="#3a6fa8" stroke-width="1"
- Sill: small rect at bottom of window, fill="#d0c8b8"
- Show sill height label

## Joinery / Built-in Furniture
- Wardrobes/cupboards: rect outline + door lines, fill="#f5f0e8" stroke="#555" stroke-width="1.5"
- Shelving: horizontal lines at correct spacing, stroke="#777" stroke-width="1.5"
- Kitchen units: base and wall units clearly distinguished
- Show handles as small rects or circles

## Finish Zones (optional hatch patterns)
- Tiling: fine grid hatch using <pattern>
- Panelling: vertical lines
- Paint: flat fill with label
- Label each finish zone with an annotation line and text

## Dimension Lines
- Vertical dimensions on the left side (overall height, window sill/head, door head)
- Horizontal dimensions along the top or bottom (overall width, element positions)
- Style: stroke="#aaa" stroke-dasharray="4,3" stroke-width="1", tick marks ±5px at ends
- Text: font-size="9" fill="#555" font-family="Arial,sans-serif"
- Show: floor-to-ceiling height, floor-to-window-sill, window head height, door head height

## Labels and Annotations
- Elevation title: bold, font-size="13" font-weight="700" fill="#1a1a1a" font-family="Arial,sans-serif"
- Material callouts: leader lines (thin, angled) with text labels, font-size="9" fill="#333"
- Room name and wall direction in title block

## Title Block (y=620 to y=700)
- Horizontal rule at y=620, stroke="#ccc"
- Drawing title centred, font-size="14" font-weight="bold" fill="#1a1a1a"
- "Scale 1:50 | Interior Elevation | Reference Only" font-size="9" fill="#888"

## Scale Bar (bottom-left)
- 0m / 1m / 2m markers, alternating filled/empty 60px rects

## OUTPUT RULES
- Return ONLY the raw SVG. No markdown, no code fences, no explanation.
- Start exactly with: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" width="1200" height="700">
- End exactly with: </svg>
- Calculate ALL positions mathematically — every element must be to scale.
- If no specific wall is mentioned, show the PRIMARY feature wall (the one with the most interest — fireplace, joinery, window, etc.)
- If multiple walls described, show up to 4 elevations arranged in a 2-column grid
- Always show at least ONE complete elevation — never return an empty drawing.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Based on the following design consultation, generate an SVG interior elevation drawing:\n\n${conversationContext}\n\nProduce a complete, to-scale interior elevation SVG. If specific walls aren't mentioned, draw the most interesting/feature wall of the space described.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No SVG response from Claude");
  }

  let svg = textBlock.text.trim();
  svg = svg.replace(/^```(?:svg|xml)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  if (!svg.startsWith("<svg")) {
    const svgStart = svg.indexOf("<svg");
    if (svgStart !== -1) {
      svg = svg.slice(svgStart);
    } else {
      throw new Error("Claude did not return valid SVG for elevation");
    }
  }
  const svgEnd = svg.lastIndexOf("</svg>");
  if (svgEnd !== -1) {
    svg = svg.slice(0, svgEnd + 6);
  }

  return svg;
}

export async function chatWithDesignAssistant(
  messages: DesignChatMessage[]
): Promise<string> {
  const client = getClaudeClient();

  // Build Anthropic messages array with multimodal support
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => {
    if (msg.role === "assistant") {
      return { role: "assistant", content: msg.content };
    }

    // User message — may include image/PDF/CAD attachments
    const content: Anthropic.ContentBlockParam[] = [];

    if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        const ext = att.name.split(".").pop()?.toLowerCase();
        const isCadFile = ext === "dxf" || ext === "obj";
        const isSkp = ext === "skp";

        if (isSkp) {
          // SketchUp native binary — Claude cannot decode it; send a descriptive note instead
          content.push({
            type: "text",
            text: `[SketchUp native file attached: ${att.name}]\nInstruction: The user has shared a .skp file. You can absolutely work with SketchUp models — but you need the file exported in an open format first. Respond in a warm, helpful tone. Do NOT lead with a list of things you cannot do. Instead, tell the user you'd love to analyse their SketchUp model and give them these two quick export steps so you can dig into the geometry:\n• For floor plans / elevations: File → Export → 2D Graphic → DXF (AutoCAD)\n• For the full 3D model: File → Export → 3D Model → OBJ\nAsk them to re-attach the exported DXF or OBJ and you'll provide a full spatial analysis — room names, wall dimensions, openings, layers, design feedback, and anything else they need.`,
          });
        } else if (isCadFile) {
          // DXF/OBJ are text formats — decode from base64 and send as readable text
          const rawText = Buffer.from(att.data, "base64").toString("utf-8");
          // Truncate very large files to avoid token overflow (~100KB text limit)
          const MAX_CAD_CHARS = 100_000;
          const truncated = rawText.length > MAX_CAD_CHARS;
          const cadText = truncated ? rawText.slice(0, MAX_CAD_CHARS) : rawText;
          const formatLabel = ext === "dxf" ? "DXF (AutoCAD/SketchUp)" : "OBJ (3D geometry)";
          content.push({
            type: "text",
            text: `[${formatLabel} file: ${att.name}${truncated ? ` — truncated to first ${MAX_CAD_CHARS} characters` : ""}]\n\`\`\`\n${cadText}\n\`\`\``,
          });
        } else if (att.mimeType.startsWith("image/")) {
          // Normalise HEIC to JPEG for Claude (it doesn't support HEIC directly)
          const safeMimeType = att.mimeType === "image/heic" ? "image/jpeg" : att.mimeType;
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: safeMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: att.data,
            },
          });
          // Add a label so Claude knows the filename
          content.push({ type: "text", text: `[File: ${att.name}]` });
        } else if (att.mimeType === "application/pdf") {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: att.data,
            },
          } as any);
          content.push({ type: "text", text: `[File: ${att.name}]` });
        }
      }
    }

    // Text part
    if (msg.content.trim()) {
      content.push({ type: "text", text: msg.content });
    } else if (content.length === 0) {
      content.push({ type: "text", text: "(no text provided)" });
    }

    return { role: "user", content };
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: DESIGN_SYSTEM_PROMPT,
    messages: anthropicMessages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text.trim();
}

// ─── DXF spec generators ──────────────────────────────────────────────────────

const DXF_FLOOR_PLAN_SYSTEM = `You are an expert architectural CAD drafter. You produce precise JSON geometry specs for floor plans that will be converted to DXF files importable into SketchUp and AutoCAD.

## Units
All coordinates and dimensions are in MILLIMETRES at 1:1 real-world scale.
Origin (0,0) is the bottom-left outer corner of the floor plan.
Y axis goes UPWARD (north).

## Output
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:

{
  "title": "string — space name / project name",
  "width_mm": number,
  "height_mm": number,
  "entities": [
    // WALLS — use LWPOLYLINE closed=true for each wall outline (outer + inner face as a closed polygon)
    // or use LINE pairs for wall faces
    // DOORS — use LINE for door leaf + ARC for swing
    // WINDOWS — use LWPOLYLINE for frame outline + LINE for glazing bars
    // FURNITURE — use LWPOLYLINE (closed) for outlines, TEXT for labels
    // DIMENSIONS — use LINE for dim lines, LINE for ticks, TEXT for value labels
    // LABELS — use TEXT for room names (large h) and area notations (smaller h)
  ]
}

## Entity formats

LINE:       { "type":"LINE",       "layer":"...", "x1":0, "y1":0, "x2":1000, "y2":0 }
TEXT:       { "type":"TEXT",       "layer":"...", "x":500, "y":500, "h":150, "text":"BEDROOM" }
ARC:        { "type":"ARC",        "layer":"...", "cx":0, "cy":0, "r":900, "a1":0, "a2":90 }
CIRCLE:     { "type":"CIRCLE",     "layer":"...", "cx":0, "cy":0, "r":50 }
LWPOLYLINE: { "type":"LWPOLYLINE", "layer":"...", "points":[[0,0],[1000,0],[1000,1000],[0,1000]], "closed":true }

## Layers to use
- "Walls"         — external wall outlines (LWPOLYLINE filled region = use 4 outer + 4 inner points for thick wall)
- "InternalWalls" — partition walls
- "Doors"         — door leaf (LINE) and swing (ARC)
- "Windows"       — window frame and glazing
- "Furniture"     — furniture outlines and labels
- "Dimensions"    — dimension lines, ticks, and value text
- "Labels"        — room name TEXT and area TEXT
- "Grid"          — optional reference grid lines (subtle)
- "Title"         — title block text at bottom

## Mandatory content
1. Complete wall outline for every room described
2. All doors with swing arcs
3. All windows
4. Room name labels (h=150mm) and area labels e.g. "16.5 m²" (h=100mm)
5. Dimension lines along ALL four outer edges with real dimensions
6. Title block text at y=-600: drawing title, "Scale 1:50", "Pixelcraft Designs"

## Wall thickness
- External walls: 240mm thick — draw as LWPOLYLINE with 8 points (outer rect + inner rect, closed=true, no fill needed — just the outline)
- Internal partitions: 150mm thick

## Example for a simple 4000×3000 room with one door and one window:
The outer extents would be x=0,y=0 to x=4480,y=3480 (adding wall thickness all around).
Draw outer wall LWPOLYLINE, then inner void LWPOLYLINE, then individual features.`;

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

export async function generateFloorPlanDXFSpec(
  messages: DesignChatMessage[]
): Promise<DXFSpec> {
  const client = getClaudeClient();

  const conversationContext = messages
    .filter((m) => !["floor-plan", "elevation"].includes((m as any).type ?? "") && m.content.trim())
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: DXF_FLOOR_PLAN_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Generate a DXF floor plan JSON spec based on the following design consultation:\n\n${conversationContext}\n\nProduce the complete JSON now. Calculate ALL coordinates precisely in mm.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No response from Claude");

  const cleaned = stripJsonFences(textBlock.text);
  try {
    return JSON.parse(cleaned) as DXFSpec;
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as DXFSpec;
    }
    throw new Error("Claude returned invalid JSON for floor plan DXF");
  }
}

const DXF_ELEVATION_SYSTEM = `You are an expert architectural CAD drafter. You produce precise JSON geometry specs for interior elevation drawings that will be converted to DXF files importable into SketchUp and AutoCAD.

## Units
All coordinates in MILLIMETRES at 1:1 real-world scale.
Origin (0,0) is the bottom-left of the wall face (floor-left corner).
X axis goes right, Y axis goes UPWARD.

## Output
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:

{
  "title": "string — e.g. NORTH ELEVATION - Master Bedroom",
  "width_mm": number,   // wall width
  "height_mm": number,  // ceiling height
  "entities": [ ... ]
}

## Entity formats (same as floor plan)
LINE:       { "type":"LINE",       "layer":"...", "x1":0, "y1":0, "x2":1000, "y2":0 }
TEXT:       { "type":"TEXT",       "layer":"...", "x":500, "y":500, "h":150, "text":"HEADING" }
ARC:        { "type":"ARC",        "layer":"...", "cx":0, "cy":0, "r":900, "a1":0, "a2":90 }
LWPOLYLINE: { "type":"LWPOLYLINE", "layer":"...", "points":[[0,0],[1000,0],[1000,1000],[0,1000]], "closed":true }

## Layers
- "Walls"       — wall outline and profile edges
- "Doors"       — door frame and panel outlines
- "Windows"     — window frame, sill, glazing
- "Furniture"   — joinery, built-ins, loose furniture silhouettes
- "Hatching"    — material finish hatch lines (tile grid, timber lines, etc.)
- "Dimensions"  — dimension lines, ticks, text
- "Labels"      — element labels and material callouts
- "Title"       — title block

## Mandatory content
1. Floor line (LINE at y=0, full width) and ceiling line (LINE at y=height_mm)
2. Left and right wall edges
3. Skirting board (LWPOLYLINE closed, 100mm high, full width)
4. All doors with frames and panels
5. All windows with frames, glazing, and sill
6. Joinery / built-in furniture as LWPOLYLINE outlines
7. Material finish hatching (tile: grid of LINEs at 300mm centres; timber: horizontal LINEs at 20mm centres; etc.)
8. Dimension lines: vertical left side (floor-to-ceiling, sill height, head height), horizontal bottom (wall width, element positions)
9. Material / finish callout TEXT with leader lines (LINE from element to label)
10. Title block at y=-500: elevation name, wall dimensions, "Scale 1:50", "Pixelcraft Designs"`;

export async function generateElevationDXFSpec(
  messages: DesignChatMessage[]
): Promise<DXFSpec> {
  const client = getClaudeClient();

  const conversationContext = messages
    .filter((m) => !["floor-plan", "elevation"].includes((m as any).type ?? "") && m.content.trim())
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: DXF_ELEVATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Generate a DXF elevation drawing JSON spec based on the following design consultation:\n\n${conversationContext}\n\nProduce the complete JSON now. Calculate ALL coordinates precisely in mm.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No response from Claude");

  const cleaned = stripJsonFences(textBlock.text);
  try {
    return JSON.parse(cleaned) as DXFSpec;
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as DXFSpec;
    }
    throw new Error("Claude returned invalid JSON for elevation DXF");
  }
}

// ── AI Design Review ────────────────────────────────────────────────────────

export interface AIReviewItem {
  severity: "concern" | "suggestion" | "note";
  category: string;
  message: string;
}

export interface AIReviewResult {
  summary: string;
  items: AIReviewItem[];
}

const REVIEW_PROMPTS: Record<string, string> = {
  moodboard: `You are a senior interior designer reviewing a moodboard submitted by a design team.
Analyse it for:
- Colour palette harmony, contrast ratios, and temperature balance (warm/cool)
- Style coherence — does every element belong to the same aesthetic direction?
- Mood and atmosphere effectiveness — does it evoke the right feeling?
- Potential conflicts: clashing textures, mismatched periods, confusing focal points
- Opportunities: what is working well, and what could be strengthened`,

  render: `You are a senior interior designer reviewing a rendered visualisation.
Analyse it for:
- Lighting quality: ambient, task and accent layers; realistic shadows and highlights
- Material and finish coherence — do surfaces read naturally together?
- Colour balance and palette harmony across all surfaces
- Spatial proportions: furniture scale relative to room, ceiling height feel
- Any visual inconsistencies, clipping artefacts, or areas that break realism`,

  "floor-plan": `You are a senior space planner reviewing a floor plan.
Analyse it for:
- Circulation paths and traffic flow — are key routes clear and unobstructed?
- Room proportions and spatial efficiency
- Furniture placement clearances (600 mm minimum pathways; 900 mm for primary routes)
- Door swing conflicts or openings that block usable wall
- Natural light access and ventilation positioning
- Missing or unclear dimensions/annotations`,

  concept: `You are reviewing a concept drawing for an interior design project.
Analyse it for:
- Spatial logic and layout coherence
- Style and mood consistency across the sheet
- Material and finish suggestions that fit the concept direction
- Proportion and scale of key elements
- Design opportunities or areas that need development`,

  elevation: `You are a senior interior designer reviewing an elevation drawing.
Analyse it for:
- Visual proportion and rhythm of vertical elements
- Fenestration sizing, spacing, and relationship to wall area
- Material transitions and finish boundaries — are junctions resolved?
- Joinery and built-in detail opportunities
- Dimension completeness and annotation clarity`,

  working: `You are a technical design reviewer checking a working drawing for construction.
Analyse it for:
- Dimension completeness: are all critical dimensions shown?
- Missing annotations or material call-outs
- Constructability concerns: can a contractor build from this drawing?
- Coordination issues: structural grid alignment, MEP clearances, fixing substrates
- Drawing standard compliance: title block, revision marks, scale`,
};

export async function reviewDesignFile(
  base64Data: string,
  mimeType: string,
  fileName: string,
  reviewType: string
): Promise<AIReviewResult> {
  const client = getClaudeClient();

  const promptContext = REVIEW_PROMPTS[reviewType] ?? REVIEW_PROMPTS.moodboard;

  const contentBlocks: Anthropic.ContentBlockParam[] = [];

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isCadFile = ext === "dxf" || ext === "obj";

  if (isCadFile) {
    const rawText = Buffer.from(base64Data, "base64").toString("utf-8");
    const MAX_CAD_CHARS = 80_000;
    const cadText =
      rawText.length > MAX_CAD_CHARS ? rawText.slice(0, MAX_CAD_CHARS) : rawText;
    contentBlocks.push({
      type: "text",
      text: `[CAD file: ${fileName}]\n\`\`\`\n${cadText}\n\`\`\``,
    });
  } else if (mimeType.startsWith("image/")) {
    const safeMimeType =
      mimeType === "image/heic" ? "image/jpeg" : mimeType;
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: safeMimeType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: base64Data,
      },
    });
  } else if (mimeType === "application/pdf") {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Data,
      },
    } as any);
  }

  contentBlocks.push({
    type: "text",
    text: `${promptContext}

Return your analysis as a JSON object with this exact structure (raw JSON only — no markdown fences):
{
  "summary": "One or two sentence overall impression.",
  "items": [
    { "severity": "concern|suggestion|note", "category": "Short category name", "message": "Specific, actionable observation." }
  ]
}

Severity guide:
- concern: something that should be addressed (layout problem, clash, missing critical info)
- suggestion: improvement opportunity that would enhance the design
- note: general observation or context worth knowing

Aim for 4–8 items. Be specific and actionable. Avoid vague praise.`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from Claude");
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
  }

  const jsonStart = jsonText.indexOf("{");
  const jsonEnd = jsonText.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    jsonText = jsonText.slice(jsonStart, jsonEnd + 1);
  }

  return JSON.parse(jsonText) as AIReviewResult;
}
