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
