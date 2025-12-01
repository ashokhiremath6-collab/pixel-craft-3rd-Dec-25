import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import * as fs from "fs";

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const isProduction = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
  
  console.log("[Gemini Config] Initializing...");
  console.log("[Gemini Config] NODE_ENV:", process.env.NODE_ENV);
  console.log("[Gemini Config] REPLIT_DEPLOYMENT:", process.env.REPLIT_DEPLOYMENT);
  console.log("[Gemini Config] Is Production:", isProduction);
  console.log("[Gemini Config] Base URL from env:", baseUrl);
  console.log("[Gemini Config] API Key configured:", !!apiKey);
  
  let effectiveBaseUrl = baseUrl || "";
  
  if (isProduction && (effectiveBaseUrl.includes("localhost") || !effectiveBaseUrl)) {
    effectiveBaseUrl = "https://modelfarm.replit.app";
    console.log("[Gemini Config] Production detected - using Replit modelfarm:", effectiveBaseUrl);
  }
  
  if (!effectiveBaseUrl || !apiKey) {
    console.error("[Gemini Config] Missing required environment variables!");
    console.error("[Gemini Config] Effective Base URL:", effectiveBaseUrl || "NOT SET");
    console.error("[Gemini Config] AI_INTEGRATIONS_GEMINI_API_KEY:", apiKey ? "SET" : "NOT SET");
  }
  
  console.log("[Gemini Config] Creating client with base URL:", effectiveBaseUrl);
  
  aiClient = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      apiVersion: "",
      baseUrl: effectiveBaseUrl,
    },
  });
  
  return aiClient;
}

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

async function compressImage(imageBase64: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  console.log("[Gemini] Original image size:", imageBuffer.length, "bytes");
  
  const compressed = await sharp(imageBuffer)
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  
  console.log("[Gemini] Compressed image size:", compressed.length, "bytes");
  
  return {
    data: compressed.toString('base64'),
    mimeType: 'image/jpeg'
  };
}

export async function generateInteriorRender(
  imageBase64: string,
  mimeType: string,
  styleId: string,
  customPrompt?: string
): Promise<{ imageData: string; mimeType: string }> {
  console.log("[Gemini] Starting interior render generation...");
  console.log("[Gemini] Style ID:", styleId);
  console.log("[Gemini] Has custom prompt:", !!customPrompt);
  console.log("[Gemini] API Key configured:", !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
  console.log("[Gemini] Base URL:", process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
  
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style && !customPrompt) {
    throw new Error("Invalid style ID and no custom prompt provided");
  }

  try {
    console.log("[Gemini] Compressing image...");
    const compressed = await compressImage(imageBase64, mimeType);
    console.log("[Gemini] Image compressed, size:", compressed.data.length, "bytes");

    let prompt: string;
    
    if (customPrompt && customPrompt.trim()) {
      prompt = `You are an interior design assistant. Make ONLY the specific changes requested below to this image. 
DO NOT change anything else. Keep the room layout, furniture positions, colors, materials, and all other elements EXACTLY as they are in the original image.

ONLY make these specific changes:
${customPrompt}

IMPORTANT RULES:
- Make MINIMAL changes - only what is explicitly requested above
- Preserve all existing furniture, decor, and layout that is not mentioned
- Keep the same perspective, lighting style, and room dimensions
- Do not add or remove items unless specifically asked
- The output should look almost identical to the input, except for the requested changes
- Maintain photorealistic quality`;
    } else if (style) {
      prompt = `Transform this interior space image into a photorealistic ${style.name} interior design render. 
Apply the following design style: ${style.prompt}
Keep the same room layout and dimensions, but update the furniture, materials, lighting, and decor to match the ${style.name} style.
Create a high-quality, professional interior design visualization that looks like a real photograph.
Make sure the render is detailed, realistic, and suitable for client presentation.`;
    } else {
      throw new Error("Either a style or custom prompt must be provided");
    }

    console.log("[Gemini] Calling AI API with model: gemini-2.5-flash-image");
    
    const response = await getAIClient().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: compressed.mimeType, data: compressed.data } }
          ]
        }
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    console.log("[Gemini] API response received");
    console.log("[Gemini] Candidates count:", response.candidates?.length || 0);
    
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error("[Gemini] No image data in response. Full response:", JSON.stringify(response, null, 2));
      throw new Error("No image data in response. The AI may not have been able to process the image.");
    }

    console.log("[Gemini] Successfully generated render, image size:", imagePart.inlineData.data.length);
    
    return {
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png"
    };
  } catch (error: any) {
    console.error("[Gemini] Error during render generation:", error);
    console.error("[Gemini] Error message:", error.message);
    console.error("[Gemini] Error stack:", error.stack);
    throw error;
  }
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

  const response = await getAIClient().models.generateContent({
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

export function extractRoomName(filename: string): string {
  if (!filename) return "General";
  
  // Remove file extension
  let name = filename.replace(/\.[^/.]+$/, "");
  
  // Remove trailing numbers and common suffixes
  name = name.replace(/[\s_-]*\d+\s*$/, "").trim();
  
  // Clean up underscores and dashes to spaces
  name = name.replace(/[-_]+/g, " ").trim();
  
  // Proper case: capitalize first letter of each word
  name = name.split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  // Fix possessive apostrophes (e.g., "Chitra'S" -> "Chitra's")
  name = name.replace(/'S\b/g, "'s");
  
  return name || "General";
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

    const response = await getAIClient().models.generateContent({
      model: "gemini-2.5-flash",
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
