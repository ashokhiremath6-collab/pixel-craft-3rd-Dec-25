import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface RenderStyle {
  id: string;
  name: string;
  prompt: string;
}

export const RENDER_STYLES: RenderStyle[] = [
  {
    id: "modern",
    name: "Modern",
    prompt: "modern contemporary interior design, clean lines, minimalist furniture, neutral colors with accent pieces, large windows, natural light"
  },
  {
    id: "minimalist",
    name: "Minimalist",
    prompt: "minimalist interior design, very clean and simple, sparse furniture, white and neutral tones, lots of empty space, zen-like atmosphere"
  },
  {
    id: "industrial",
    name: "Industrial",
    prompt: "industrial interior design, exposed brick, metal fixtures, raw materials, Edison bulbs, concrete floors, urban loft style"
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    prompt: "Scandinavian interior design, light wood tones, cozy textiles, hygge atmosphere, functional furniture, soft neutral palette"
  },
  {
    id: "bohemian",
    name: "Bohemian",
    prompt: "bohemian interior design, eclectic mix of patterns and textures, plants, macrame, warm earthy colors, layered rugs and textiles"
  },
  {
    id: "mid-century",
    name: "Mid-Century Modern",
    prompt: "mid-century modern interior design, retro furniture, organic shapes, wood and leather, mustard and teal accents, iconic design pieces"
  },
  {
    id: "luxury",
    name: "Luxury",
    prompt: "luxury high-end interior design, premium materials, marble, gold accents, velvet upholstery, crystal chandeliers, opulent and sophisticated"
  },
  {
    id: "coastal",
    name: "Coastal",
    prompt: "coastal beach house interior design, light blues and whites, natural textures, driftwood, nautical elements, airy and relaxed"
  },
  {
    id: "traditional",
    name: "Traditional",
    prompt: "traditional classic interior design, ornate details, rich wood furniture, elegant fabrics, symmetrical arrangements, timeless elegance"
  },
  {
    id: "rustic",
    name: "Rustic",
    prompt: "rustic farmhouse interior design, reclaimed wood, stone elements, warm earthy tones, cozy and welcoming, country charm"
  }
];

export async function generateInteriorRender(
  imageBase64: string,
  mimeType: string,
  styleId: string,
  customPrompt?: string
): Promise<{ imageData: string; mimeType: string }> {
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style && !customPrompt) {
    throw new Error("Invalid style ID and no custom prompt provided");
  }

  const stylePrompt = customPrompt || style?.prompt || "";
  
  const prompt = `Transform this interior space image into a photorealistic ${style?.name || 'styled'} interior design render. 
Apply the following design style: ${stylePrompt}
Keep the same room layout and dimensions, but reimagine the furniture, materials, lighting, and decor to match the style.
Create a high-quality, professional interior design visualization that looks like a real photograph.
Make sure the render is detailed, realistic, and suitable for client presentation.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } }
        ]
      }
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
  
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response. The AI may not have been able to process the image.");
  }

  return {
    imageData: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png"
  };
}

export async function generateConceptRender(
  description: string,
  styleId: string
): Promise<{ imageData: string; mimeType: string }> {
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style) {
    throw new Error("Invalid style ID");
  }

  const prompt = `Create a photorealistic interior design render of the following space:
${description}

Apply the ${style.name} design style with these characteristics: ${style.prompt}

The image should look like a professional architectural visualization photograph, suitable for client presentation.
Include realistic lighting, materials, and furniture placement.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
  
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  return {
    imageData: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png"
  };
}

export { RENDER_STYLES as renderStyles };

// Room type detection from filename
const ROOM_KEYWORDS: { [key: string]: string[] } = {
  "Living Room": ["living", "lounge", "sitting", "family room", "great room"],
  "Bedroom": ["bedroom", "master", "guest room", "kids room", "children room"],
  "Kitchen": ["kitchen", "kitchenette", "cooking"],
  "Bathroom": ["bathroom", "bath", "toilet", "washroom", "powder room", "ensuite"],
  "Dining Room": ["dining", "breakfast room"],
  "Study": ["study", "office", "home office", "workspace", "den"],
  "Hallway": ["hallway", "corridor", "foyer", "entrance", "entry"],
  "Balcony": ["balcony", "terrace", "patio", "deck"],
  "Puja Room": ["puja", "pooja", "prayer", "mandir"],
  "Kids Room": ["kids", "children", "nursery", "playroom"],
  "Guest Room": ["guest"],
  "Walk-in Closet": ["closet", "wardrobe", "dressing"],
};

export function detectRoomType(filename: string): string {
  if (!filename) return "General";
  
  const normalizedName = filename.toLowerCase().replace(/[-_]/g, " ");
  
  for (const [roomType, keywords] of Object.entries(ROOM_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return roomType;
      }
    }
  }
  
  return "General";
}

// Paraphrase brief using Gemini for more natural descriptions
export async function paraphraseBrief(brief: string, styleName: string): Promise<string> {
  if (!brief || brief.trim().length === 0) {
    return styleName;
  }

  try {
    const prompt = `Paraphrase this interior design brief into a short, natural-sounding description (max 8-10 words). Keep the key design intent but use different words. Do not start with articles (a, an, the).

Original: "${brief}"

Respond with ONLY the paraphrased text, nothing else.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((part: any) => part.text);
    
    if (textPart?.text) {
      // Clean up the response - remove quotes, trim whitespace
      let paraphrased = textPart.text.trim().replace(/^["']|["']$/g, "");
      // Capitalize first letter
      paraphrased = paraphrased.charAt(0).toUpperCase() + paraphrased.slice(1);
      return paraphrased;
    }
    
    // Fallback to original brief if paraphrasing fails
    return brief;
  } catch (error) {
    console.error("Failed to paraphrase brief:", error);
    return brief;
  }
}
