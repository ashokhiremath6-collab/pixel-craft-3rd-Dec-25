import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import * as fs from "fs";

let aiClient: GoogleGenAI | null = null;

const AI_TIMEOUT_MS = 90000; // 90 seconds timeout for AI generation

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${operation} timed out after ${timeoutMs / 1000} seconds. Please try again.`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

function getAIClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  console.log("[Gemini Config] Initializing...");
  console.log("[Gemini Config] NODE_ENV:", process.env.NODE_ENV);
  console.log("[Gemini Config] Base URL from env:", baseUrl);
  console.log("[Gemini Config] API Key configured:", !!apiKey);
  
  if (!baseUrl || !apiKey) {
    console.error("[Gemini Config] Missing required environment variables!");
    console.error("[Gemini Config] AI_INTEGRATIONS_GEMINI_BASE_URL:", baseUrl || "NOT SET");
    console.error("[Gemini Config] AI_INTEGRATIONS_GEMINI_API_KEY:", apiKey ? "SET" : "NOT SET");
    throw new Error("AI integration not configured. Please ensure Gemini AI integration is set up.");
  }
  
  console.log("[Gemini Config] Creating client with base URL:", baseUrl);
  
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl: baseUrl,
    },
  });
  
  return aiClient;
}

export interface RenderStyle {
  id: string;
  name: string;
  prompt: string;
}

// Reference item for AI render insertion
export interface ReferenceItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  vendorBrand?: string;
  description?: string;
  aiPromptHints?: string;
  placementInstruction: string;
  imageData?: string; // Base64 encoded image
  imageMimeType?: string;
}

// Reference photo for inspiration or existing space
export interface ReferencePhoto {
  imageData: string; // Base64 encoded image
  mimeType: string;
  type: 'inspiration' | 'existing_space';
  description: string;
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
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  console.log("[Gemini] Compressed image size:", compressed.length, "bytes");
  
  return {
    data: compressed.toString('base64'),
    mimeType: 'image/jpeg'
  };
}

async function enhanceOutputImage(imageBase64: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    const enhanced = await sharp(imageBuffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' })
      .sharpen({ sigma: 1.0, m1: 1.0, m2: 0.5 })
      .modulate({ saturation: 1.05 })
      .png({ compressionLevel: 4 })
      .toBuffer();
    
    console.log("[Gemini] Enhanced output image size:", enhanced.length, "bytes (2048px)");
    
    return {
      data: enhanced.toString('base64'),
      mimeType: 'image/png'
    };
  } catch (error) {
    console.error("[Gemini] Enhancement failed, returning original:", error);
    return {
      data: imageBase64,
      mimeType: mimeType
    };
  }
}

export async function generateInteriorRender(
  imageBase64: string,
  mimeType: string,
  styleId: string,
  customPrompt?: string,
  referenceItems?: ReferenceItem[],
  referencePhotos?: ReferencePhoto[]
): Promise<{ imageData: string; mimeType: string }> {
  console.log("[Gemini] Starting interior render generation...");
  console.log("[Gemini] Style ID:", styleId);
  console.log("[Gemini] Has custom prompt:", !!customPrompt);
  console.log("[Gemini] Reference items count:", referenceItems?.length || 0);
  console.log("[Gemini] Reference photos count:", referencePhotos?.length || 0);
  console.log("[Gemini] API Key configured:", !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
  console.log("[Gemini] Base URL:", process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
  
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style && !customPrompt && (!referenceItems || referenceItems.length === 0)) {
    throw new Error("Invalid style ID and no custom prompt or reference items provided");
  }

  try {
    console.log("[Gemini] Compressing image...");
    const compressed = await compressImage(imageBase64, mimeType);
    console.log("[Gemini] Image compressed, size:", compressed.data.length, "bytes");

    // Build reference items instruction block
    let referenceInstructions = '';
    const referenceImageParts: any[] = [];
    
    // Process reference photos (inspiration/existing space)
    if (referencePhotos && referencePhotos.length > 0) {
      console.log("[Gemini] Processing reference photos...");
      referenceInstructions += '\n\nREFERENCE PHOTOS FOR GUIDANCE:\n';
      
      const inspirationPhotos = referencePhotos.filter(p => p.type === 'inspiration');
      const existingSpacePhotos = referencePhotos.filter(p => p.type === 'existing_space');
      
      if (inspirationPhotos.length > 0) {
        referenceInstructions += '\nINSPIRATION PHOTOS (use these as style/mood references):\n';
        for (let i = 0; i < inspirationPhotos.length; i++) {
          const photo = inspirationPhotos[i];
          console.log(`[Gemini] Compressing inspiration photo ${i + 1}...`);
          const compressed = await compressImage(photo.imageData, photo.mimeType);
          referenceImageParts.push({
            inlineData: { mimeType: compressed.mimeType, data: compressed.data }
          });
          const desc = photo.description || 'Style inspiration';
          referenceInstructions += `- Inspiration ${i + 1}: ${desc} (image attached)\n`;
        }
      }
      
      if (existingSpacePhotos.length > 0) {
        referenceInstructions += '\nEXISTING SPACE PHOTOS (reference for room context):\n';
        for (let i = 0; i < existingSpacePhotos.length; i++) {
          const photo = existingSpacePhotos[i];
          console.log(`[Gemini] Compressing existing space photo ${i + 1}...`);
          const compressed = await compressImage(photo.imageData, photo.mimeType);
          referenceImageParts.push({
            inlineData: { mimeType: compressed.mimeType, data: compressed.data }
          });
          const desc = photo.description || 'Existing space reference';
          referenceInstructions += `- Existing space ${i + 1}: ${desc} (image attached)\n`;
        }
      }
      
      referenceInstructions += '\nGUIDANCE:\n';
      referenceInstructions += '- Use inspiration photos to guide the overall mood, color palette, and style\n';
      referenceInstructions += '- Use existing space photos to understand the room context and proportions\n';
    }
    
    // Process catalogue reference items
    if (referenceItems && referenceItems.length > 0) {
      console.log("[Gemini] Processing reference items...");
      referenceInstructions += '\n\nREFERENCE MATERIALS/ITEMS TO INSERT:\n';
      
      for (let i = 0; i < referenceItems.length; i++) {
        const item = referenceItems[i];
        const itemDesc = item.aiPromptHints || item.description || `${item.subcategory} from ${item.vendorBrand || 'unknown vendor'}`;
        referenceInstructions += `${i + 1}. ${item.name} (${item.category}/${item.subcategory}): ${itemDesc}\n`;
        referenceInstructions += `   Placement: ${item.placementInstruction}\n`;
        
        // Add reference image if available
        if (item.imageData && item.imageMimeType) {
          console.log(`[Gemini] Compressing reference image ${i + 1}...`);
          const refCompressed = await compressImage(item.imageData, item.imageMimeType);
          referenceImageParts.push({
            inlineData: { mimeType: refCompressed.mimeType, data: refCompressed.data }
          });
          referenceInstructions += `   (Reference image ${i + 1} attached - use this as visual guide)\n`;
        }
      }
      
      referenceInstructions += '\nINSTRUCTIONS FOR REFERENCE ITEMS:\n';
      referenceInstructions += '- Study each reference image carefully for color, texture, pattern, and style\n';
      referenceInstructions += '- Insert or replace items in the render to match the reference images as closely as possible\n';
      referenceInstructions += '- Follow the placement instructions for where to position each item\n';
      referenceInstructions += '- Maintain consistent lighting and perspective with the rest of the room\n';
    }

    let prompt: string;
    
    if (customPrompt && customPrompt.trim()) {
      prompt = `You are an interior design assistant. Make ONLY the specific changes requested below to this image. 
DO NOT change anything else. Keep the room layout, furniture positions, colors, materials, and all other elements EXACTLY as they are in the original image.

ONLY make these specific changes:
${customPrompt}${referenceInstructions}

IMPORTANT RULES:
- Make MINIMAL changes - only what is explicitly requested above
- Preserve all existing furniture, decor, and layout that is not mentioned
- Keep the same perspective, lighting style, and room dimensions
- Do not add or remove items unless specifically asked
- The output should look almost identical to the input, except for the requested changes
- When inserting reference items, match their appearance as closely as possible

OUTPUT QUALITY:
- Generate a HIGH RESOLUTION, photorealistic image with maximum detail
- Use sharp textures, realistic materials, and professional lighting
- Ensure crisp edges and fine details are preserved
- The final image should be suitable for large format printing and professional presentations`;
    } else if (style) {
      prompt = `Transform this interior space image into a photorealistic ${style.name} interior design render. 
Apply the following design style: ${style.prompt}
Keep the same room layout and dimensions, but update the furniture, materials, lighting, and decor to match the ${style.name} style.${referenceInstructions}

OUTPUT QUALITY REQUIREMENTS:
- Generate a HIGH RESOLUTION image with maximum detail and clarity
- Create sharp, crisp textures on all surfaces (wood grain, fabric weave, marble veining)
- Apply professional architectural photography lighting with realistic shadows
- Include fine details: realistic reflections, accurate material properties, subtle ambient occlusion
- When inserting reference items, match their appearance as closely as possible
- The render should be suitable for large format printing and professional client presentations
- Ensure photorealistic quality that looks indistinguishable from a real photograph`;
    } else if (referenceItems && referenceItems.length > 0) {
      // Reference items only mode
      prompt = `You are an interior design assistant. Modify this interior image by inserting specific materials and items as described below.
${referenceInstructions}

IMPORTANT RULES:
- Insert each reference item according to its placement instruction
- Match the appearance of reference images as closely as possible
- Maintain realistic lighting, shadows, and perspective
- Blend the new items naturally with the existing room
- Keep other elements of the room unchanged unless necessary for the insertion

OUTPUT QUALITY:
- Generate a HIGH RESOLUTION, photorealistic image with maximum detail
- Use sharp textures, realistic materials, and professional lighting
- Ensure crisp edges and fine details are preserved
- The final image should be suitable for large format printing and professional presentations`;
    } else {
      throw new Error("Either a style, custom prompt, or reference items must be provided");
    }

    console.log("[Gemini] Calling AI API with model: gemini-2.5-flash-image");
    console.log("[Gemini] Timeout set to:", AI_TIMEOUT_MS / 1000, "seconds");
    
    // Build parts array: text prompt + source image + reference images
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: compressed.mimeType, data: compressed.data } },
      ...referenceImageParts
    ];
    
    const response = await withTimeout(
      getAIClient().models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [
          {
            role: "user",
            parts: parts
          }
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      }),
      AI_TIMEOUT_MS,
      "AI render generation"
    );

    console.log("[Gemini] API response received");
    console.log("[Gemini] Candidates count:", response.candidates?.length || 0);
    
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error("[Gemini] No image data in response. Full response:", JSON.stringify(response, null, 2));
      throw new Error("No image data in response. The AI may not have been able to process the image.");
    }

    console.log("[Gemini] Raw generated image size:", imagePart.inlineData.data.length);
    
    console.log("[Gemini] Enhancing output resolution...");
    const enhanced = await enhanceOutputImage(
      imagePart.inlineData.data, 
      imagePart.inlineData.mimeType || "image/png"
    );
    
    console.log("[Gemini] Successfully generated and enhanced render");
    
    return {
      imageData: enhanced.data,
      mimeType: enhanced.mimeType
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

OUTPUT QUALITY REQUIREMENTS:
- Generate a HIGH RESOLUTION image with maximum detail and clarity
- Create sharp, crisp textures on all surfaces (wood grain, fabric weave, marble veining)
- Apply professional architectural photography lighting with realistic shadows
- Include fine details: realistic reflections, accurate material properties, subtle ambient occlusion
- The render should be suitable for large format printing and professional client presentations
- Ensure photorealistic quality that looks indistinguishable from a real photograph`;

  console.log("[Gemini] Calling AI API for concept render...");
  console.log("[Gemini] Timeout set to:", AI_TIMEOUT_MS / 1000, "seconds");
  
  const response = await withTimeout(
    getAIClient().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    }),
    AI_TIMEOUT_MS,
    "AI concept render generation"
  );

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
  
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  console.log("[Gemini] Enhancing concept render output resolution...");
  const enhanced = await enhanceOutputImage(
    imagePart.inlineData.data, 
    imagePart.inlineData.mimeType || "image/png"
  );

  return {
    imageData: enhanced.data,
    mimeType: enhanced.mimeType
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
