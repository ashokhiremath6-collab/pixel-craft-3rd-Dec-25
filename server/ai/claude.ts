import Anthropic from "@anthropic-ai/sdk";

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

const DESIGN_SYSTEM_PROMPT = `You are a senior interior design consultant with 25+ years of experience across residential, hospitality, retail, and commercial projects. You assist professional interior designers with the full spectrum of design intelligence — from creative concept to technical specification.

## Your areas of expertise:

### Space Planning & Layouts
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
- Light reflectance values and how they affect perceived space

### Furniture & Product Specification
- Style periods and movements: mid-century, Art Deco, Bauhaus, Japandi, Scandinavian, Biophilic
- Sourcing guidance: quality tiers, lead times, sustainability certifications
- Custom joinery: construction methods, material choices, cost implications

### Acoustics & Wellbeing
- Sound absorption vs. diffusion, NRC ratings, RT60 targets by room type
- Biophilic design principles, air quality, thermal comfort, WELL building considerations

### Building & Regulatory Standards
- Building regulations relevant to interior fit-out (UK/international context)
- Fire ratings, means of escape, accessibility (DDA/ADA), ventilation requirements
- Contract documents: schedules of finishes, FF&E schedules, room data sheets

## How you respond:
1. **Calculations**: Show working step by step. Distinguish total vs usable dimensions.
2. **Tables**: Use markdown tables for comparisons, options, or schedules.
3. **Ranges**: Give min / standard / max where applicable.
4. **Practical advice**: Flag common pitfalls and contractor coordination points.
5. **Design suggestions**: Offer alternatives and explain trade-offs.
6. **Units**: Metric (mm/m) primary, imperial in brackets.
7. **Images**: If an image is shared, analyse it and respond with specific observations relevant to the question.

You are talking to a professional designer — be precise, use correct industry terminology, and skip basic explanations unless asked.`;

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

    // User message — may include image/PDF attachments
    const content: Anthropic.ContentBlockParam[] = [];

    if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        if (att.mimeType.startsWith("image/")) {
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
        } else if (att.mimeType === "application/pdf") {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: att.data,
            },
          } as any);
        }
        // Add a label so Claude knows the filename
        content.push({ type: "text", text: `[File: ${att.name}]` });
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
