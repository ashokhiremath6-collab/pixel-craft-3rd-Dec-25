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
