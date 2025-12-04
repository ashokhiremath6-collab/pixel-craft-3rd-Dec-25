import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import * as fs from "fs";

let aiClient: GoogleGenAI | null = null;

const AI_TIMEOUT_MS = 90000; // 90 seconds timeout for AI generation
const MAX_RETRIES = 3; // Maximum retry attempts for AI operations
const RETRY_DELAY_MS = 2000; // Base delay between retries (will be exponentially increased)

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Number of consecutive failures before opening circuit
const CIRCUIT_BREAKER_RESET_MS = 60000; // Time to wait before trying again (1 minute)

// Circuit Breaker State
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false
};

// Check if circuit breaker allows requests
function canMakeRequest(): boolean {
  if (!circuitBreaker.isOpen) {
    return true;
  }
  
  // Check if enough time has passed to try again
  const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
  if (timeSinceLastFailure >= CIRCUIT_BREAKER_RESET_MS) {
    console.log("[Circuit Breaker] Reset - allowing request");
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return true;
  }
  
  const remainingMs = CIRCUIT_BREAKER_RESET_MS - timeSinceLastFailure;
  console.log(`[Circuit Breaker] OPEN - blocking request, try again in ${Math.ceil(remainingMs / 1000)}s`);
  return false;
}

// Record a successful request
function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

// Record a failed request
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  
  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.log(`[Circuit Breaker] Opening - ${circuitBreaker.failures} consecutive failures`);
    circuitBreaker.isOpen = true;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// Sleep helper for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for AI operations with exponential backoff and circuit breaker
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  // Check circuit breaker first
  if (!canMakeRequest()) {
    throw new CircuitBreakerError(
      "AI service is temporarily unavailable. Too many recent failures. Please wait a moment and try again."
    );
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry] ${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      // Success! Record it and return
      recordSuccess();
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`[Retry] ${operationName} failed on attempt ${attempt}:`, error.message);
      
      // Don't retry on timeout errors (already waited too long)
      if (error instanceof TimeoutError) {
        recordFailure();
        throw error;
      }
      
      // Don't retry on configuration errors
      if (error.message?.includes('not configured')) {
        throw error;
      }
      
      // Don't retry on input validation errors
      if (error.message?.includes('Please upload') || error.message?.includes('Unsupported image')) {
        throw error;
      }
      
      // Record failure for circuit breaker
      recordFailure();
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Retry] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  console.error(`[Retry] ${operationName} failed after ${maxRetries} attempts`);
  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
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

// Adaptive image compression - more aggressive for larger images
async function compressImage(imageBase64: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const originalSize = imageBuffer.length;
    console.log("[Gemini] Original image size:", originalSize, "bytes");
    
    // Get original dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 1000;
    const originalHeight = metadata.height || 1000;
    console.log("[Gemini] Original dimensions:", originalWidth, "x", originalHeight);
    
    // Adaptive quality based on image size (larger images get more compression)
    let quality = 80;
    let maxSize = 1024;
    
    if (originalSize > 5000000) { // > 5MB
      quality = 65;
      maxSize = 900;
      console.log("[Gemini] Large image detected, using aggressive compression");
    } else if (originalSize > 2000000) { // > 2MB
      quality = 70;
      maxSize = 950;
      console.log("[Gemini] Medium-large image, using moderate compression");
    }
    
    // Apply EXIF rotation first, then resize
    const compressed = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true }) // Use mozjpeg for better compression
      .toBuffer();
    
    console.log("[Gemini] Compressed image size:", compressed.length, "bytes (target max:", maxSize, "px, quality:", quality, ")");
    
    // Verify compression succeeded
    if (compressed.length > originalSize) {
      console.log("[Gemini] Compression resulted in larger file, using original");
      return {
        data: imageBase64,
        mimeType: mimeType
      };
    }
    
    return {
      data: compressed.toString('base64'),
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    console.error("[Gemini] Compression failed, using original:", error);
    return {
      data: imageBase64,
      mimeType: mimeType
    };
  }
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

// Validate image data before processing
function validateImageInput(imageBase64: string, mimeType: string): { valid: boolean; error?: string } {
  if (!imageBase64 || imageBase64.length === 0) {
    return { valid: false, error: "No image data provided. Please upload an image first." };
  }
  
  // Check for minimum size (very small images are likely corrupt)
  const minSize = 1000; // ~1KB minimum
  if (imageBase64.length < minSize) {
    return { valid: false, error: "Image is too small or corrupt. Please upload a valid image." };
  }
  
  // Check for valid base64 (should not contain HTML/text)
  if (imageBase64.includes('<html') || imageBase64.includes('<!DOCTYPE')) {
    return { valid: false, error: "Invalid image format. The data appears to be HTML, not an image." };
  }
  
  // Validate mime type
  const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validMimeTypes.includes(mimeType.toLowerCase())) {
    return { valid: false, error: `Unsupported image format: ${mimeType}. Please use JPEG, PNG, or WebP.` };
  }
  
  return { valid: true };
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
  
  // Input validation
  const validation = validateImageInput(imageBase64, mimeType);
  if (!validation.valid) {
    console.error("[Gemini] Input validation failed:", validation.error);
    throw new Error(validation.error);
  }
  
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style && !customPrompt && (!referenceItems || referenceItems.length === 0)) {
    throw new Error("Please select a design style, add custom instructions, or choose reference items to continue.");
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
        referenceInstructions += '\nITEM REFERENCE PHOTOS (show what the specific item should look like):\n';
        referenceInstructions += 'WARNING: These photos show ONLY what a specific furniture item looks like.\n';
        referenceInstructions += 'DO NOT copy the room, walls, floors, lighting, or any other elements from these photos.\n';
        referenceInstructions += 'ONLY extract the specific item (like a sofa or chair) from these reference photos.\n\n';
        for (let i = 0; i < inspirationPhotos.length; i++) {
          const photo = inspirationPhotos[i];
          console.log(`[Gemini] Compressing inspiration photo ${i + 1}...`);
          const compressed = await compressImage(photo.imageData, photo.mimeType);
          referenceImageParts.push({
            inlineData: { mimeType: compressed.mimeType, data: compressed.data }
          });
          const desc = photo.description || 'Item reference';
          referenceInstructions += `- Reference ${i + 1}: ${desc} - copy ONLY the specific item from this photo, nothing else (image attached)\n`;
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
      
      referenceInstructions += '\nCRITICAL RULES FOR USING REFERENCE PHOTOS:\n';
      referenceInstructions += '- The reference photos show what ONE SPECIFIC ITEM should look like (e.g., a sofa, chair, or table)\n';
      referenceInstructions += '- COPY ONLY THAT SPECIFIC ITEM into the original room - match its exact appearance, color, and style\n';
      referenceInstructions += '- DO NOT change ANYTHING ELSE in the room - same walls, floors, other furniture, lighting, colors\n';
      referenceInstructions += '- The background/room in the reference photo is IRRELEVANT - ignore it completely\n';
      referenceInstructions += '- The output room should be 99% identical to the input room, with only the ONE item changed\n';
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
      // Check if there are reference photos to add special handling
      const hasReferencePhotos = referencePhotos && referencePhotos.length > 0;
      
      prompt = `STOP. READ THESE CONSTRAINTS FIRST BEFORE LOOKING AT ANY IMAGES:

===== ABSOLUTE CONSTRAINTS (VIOLATION = FAILURE) =====
- You MUST NOT change the wall colors
- You MUST NOT change the floor
- You MUST NOT change the ceiling  
- You MUST NOT change the windows
- You MUST NOT change the lighting style
- You MUST NOT move or modify ANY furniture except the ONE item specified below
- You MUST NOT add new decor items
- You MUST NOT remove existing items (except the one being replaced)
- You MUST NOT apply any style transformation to the room
- The camera angle MUST remain exactly the same
- The room layout MUST remain exactly the same
================================================

YOUR SINGLE TASK:
${customPrompt}

${hasReferencePhotos ? `HOW TO USE THE REFERENCE PHOTO(S):
- The reference photo shows what the NEW item should look like
- EXTRACT ONLY: the specific piece of furniture/item from the reference
- IGNORE COMPLETELY: the room, walls, floor, other furniture, and styling in the reference photo
- Copy the item's: shape, color, material, and design details
- Place it in the EXACT same position as the item it replaces in the original room
` : ''}${referenceInstructions}

VERIFICATION CHECKLIST (mentally confirm before generating):
[ ] Wall colors: UNCHANGED from original
[ ] Floor: UNCHANGED from original
[ ] All other furniture: UNCHANGED from original
[ ] Lighting: UNCHANGED from original
[ ] Only the specified item is different

OUTPUT: High resolution photorealistic image with sharp details.`;
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
    
    // Use retry logic for the AI API call to handle transient failures
    const result = await withRetry(async () => {
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
      return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png"
      };
    }, "Render generation");
    
    console.log("[Gemini] Enhancing output resolution...");
    const enhanced = await enhanceOutputImage(
      result.data, 
      result.mimeType
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
  
  // Use retry logic for the AI API call
  const result = await withRetry(async () => {
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
    
    return {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png"
    };
  }, "Concept render generation");

  console.log("[Gemini] Enhancing concept render output resolution...");
  const enhanced = await enhanceOutputImage(
    result.data, 
    result.mimeType
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

// Object Asset Processing Types
export interface ObjectDetectionResult {
  objectType: 'art' | 'furniture' | 'decor' | 'lighting' | 'textile' | 'accessory';
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description: string;
  aiPromptHints: string;
  suggestedCategory: string;
  suggestedSubcategory: string;
}

// Detect object type and extract information from an image
export async function detectObjectInImage(
  imageData: string,
  mimeType: string
): Promise<ObjectDetectionResult> {
  console.log("[Object Detection] Starting object analysis...");
  
  const prompt = `You are an expert at identifying objects in product photography. Analyze this image carefully.

IMPORTANT: The image may have been taken with a phone camera and could appear rotated or upside down due to EXIF orientation. Analyze the actual visual content regardless of orientation.

Your task:
1. Identify the MAIN object/product in the image (ignore backgrounds, surfaces, hands, rulers, papers)
2. Provide a TIGHT bounding box that crops closely around ONLY the main object

Respond with a JSON object:
{
  "objectType": one of ["art", "furniture", "decor", "lighting", "textile", "accessory"],
  "confidence": number between 0 and 1,
  "boundingBox": {
    "x": number (percentage from left edge where object STARTS, 0-100),
    "y": number (percentage from top edge where object STARTS, 0-100),  
    "width": number (percentage of image width the object spans, 0-100),
    "height": number (percentage of image height the object spans, 0-100)
  },
  "description": detailed description of the object (2-3 sentences),
  "aiPromptHints": short phrase for AI render insertion (e.g., "vintage wooden coffee table with marble top"),
  "suggestedCategory": suggested main category for cataloguing,
  "suggestedSubcategory": suggested subcategory for cataloguing
}

BOUNDING BOX RULES:
- Be PRECISE - crop tightly around the object edges
- EXCLUDE: tables/surfaces the object sits on, rulers, measurement tools, hands, papers, background clutter
- INCLUDE: the complete object including any attached parts (e.g., for a lamp, include the shade AND base)
- Example: If an artwork frame occupies the center 60% of width and 70% of height, with 20% margin on left and 15% on top, boundingBox would be {"x": 20, "y": 15, "width": 60, "height": 70}

Object types:
- art: paintings, prints, sculptures, wall art, photographs, frames
- furniture: sofas, chairs, tables, beds, cabinets, shelving units
- decor: vases, sculptures, decorative objects, plants, mirrors, clocks
- lighting: lamps, chandeliers, pendants, sconces, light fixtures
- textile: rugs, curtains, cushions, throws, fabric samples
- accessory: small items, bookends, candles, trinkets, hardware

Respond ONLY with the JSON object.`;

  try {
    // Use retry logic for object detection
    const result = await withRetry(async () => {
      const response = await withTimeout(
        getAIClient().models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{
            role: "user",
            parts: [
              { inlineData: { data: imageData, mimeType } },
              { text: prompt }
            ]
          }],
        }),
        AI_TIMEOUT_MS,
        "Object detection"
      );

      const candidate = response.candidates?.[0];
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);
      
      if (textPart?.text) {
        // Parse JSON response
        const jsonMatch = textPart.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("[Object Detection] Detected:", parsed.objectType, "with confidence:", parsed.confidence);
          return parsed as ObjectDetectionResult;
        }
      }
      
      throw new Error("Failed to parse object detection response");
    }, "Object detection", 2); // Only 2 retries for detection since it has a fallback
    
    return result;
  } catch (error) {
    console.error("[Object Detection] Error after retries:", error);
    // Return default values if detection fails - graceful degradation
    return {
      objectType: 'decor',
      confidence: 0,
      description: 'Unable to detect object details',
      aiPromptHints: 'decorative object',
      suggestedCategory: 'Decor',
      suggestedSubcategory: 'General'
    };
  }
}

// Process an object image: crop, enhance, and optionally remove background
// Note: inputBuffer should already be EXIF-rotated from the calling function
export async function processObjectImage(
  inputBuffer: Buffer,
  objectType: string,
  boundingBox?: { x: number; y: number; width: number; height: number }
): Promise<{
  processedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  dimensions: { width: number; height: number };
}> {
  console.log("[Object Processing] Starting image processing for:", objectType);
  
  // Ensure EXIF rotation is applied (safe to call again, will be no-op if already rotated)
  const rotatedBuffer = await sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation (no-op if already correct)
    .toBuffer();
  
  // Get image metadata
  const metadata = await sharp(rotatedBuffer).metadata();
  const originalWidth = metadata.width || 1000;
  const originalHeight = metadata.height || 1000;
  console.log("[Object Processing] Image dimensions:", originalWidth, "x", originalHeight);
  
  let processedImage = sharp(rotatedBuffer);
  
  // Skip cropping for art objects - frames are important and should be preserved
  // Also skip for decor objects which may have important context
  const skipCropTypes = ['art', 'decor'];
  
  // If we have a bounding box, crop to it (but skip for certain object types)
  if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0 && !skipCropTypes.includes(objectType)) {
    // Use moderate padding (5%) to ensure nothing important is cut off
    const padding = 0.05;
    
    // Calculate crop coordinates
    const cropX = Math.max(0, Math.floor((boundingBox.x / 100 - padding) * originalWidth));
    const cropY = Math.max(0, Math.floor((boundingBox.y / 100 - padding) * originalHeight));
    
    // Calculate crop dimensions with padding
    let cropWidth = Math.floor((boundingBox.width / 100 + padding * 2) * originalWidth);
    let cropHeight = Math.floor((boundingBox.height / 100 + padding * 2) * originalHeight);
    
    // Ensure we don't exceed image bounds
    cropWidth = Math.min(cropWidth, originalWidth - cropX);
    cropHeight = Math.min(cropHeight, originalHeight - cropY);
    
    // Only crop if the bounding box is meaningful (not the whole image)
    const boxCoverage = (boundingBox.width * boundingBox.height) / 10000; // As fraction of total
    if (cropWidth > 50 && cropHeight > 50 && boxCoverage < 0.90) {
      processedImage = processedImage.extract({ 
        left: cropX, 
        top: cropY, 
        width: cropWidth, 
        height: cropHeight 
      });
      console.log("[Object Processing] Cropped to bounding box:", { x: cropX, y: cropY, width: cropWidth, height: cropHeight });
    } else {
      console.log("[Object Processing] Skipping crop - bounding box covers entire image or too small");
    }
  } else if (skipCropTypes.includes(objectType)) {
    console.log("[Object Processing] Skipping crop for", objectType, "- preserving full image including frames");
  }
  
  // Apply different processing based on object type
  switch (objectType) {
    case 'art':
      // For art: enhance colors, sharpen, correct perspective
      processedImage = processedImage
        .modulate({ saturation: 1.1 }) // Slightly boost saturation
        .sharpen({ sigma: 1.5 })
        .normalise(); // Normalize contrast
      break;
      
    case 'furniture':
    case 'lighting':
      // For furniture/lighting: enhance details, good contrast
      processedImage = processedImage
        .sharpen({ sigma: 1.2 })
        .modulate({ brightness: 1.05 })
        .normalise();
      break;
      
    case 'textile':
      // For textiles: enhance texture visibility
      processedImage = processedImage
        .sharpen({ sigma: 2.0 })
        .modulate({ saturation: 1.05 });
      break;
      
    default:
      // General enhancement
      processedImage = processedImage
        .sharpen({ sigma: 1.0 })
        .normalise();
  }
  
  // Resize to max 2048px while maintaining aspect ratio
  const processedBuffer = await processedImage
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();
  
  // Get final dimensions
  const finalMetadata = await sharp(processedBuffer).metadata();
  const dimensions = {
    width: finalMetadata.width || 0,
    height: finalMetadata.height || 0
  };
  
  // Create thumbnail (256px)
  const thumbnailBuffer = await sharp(processedBuffer)
    .resize(256, 256, { fit: 'cover' })
    .png({ quality: 80 })
    .toBuffer();
  
  console.log("[Object Processing] Complete. Dimensions:", dimensions);
  
  return {
    processedBuffer,
    thumbnailBuffer,
    dimensions
  };
}

// Generate a transparent version (background removed) using AI
export async function generateTransparentVersion(
  imageData: string,
  mimeType: string,
  objectDescription: string
): Promise<string | null> {
  console.log("[Transparency] Generating transparent version...");
  
  const prompt = `Create a version of this ${objectDescription} with a completely transparent background. 
Keep the object exactly as it appears but remove ALL background elements. 
The object should be cleanly isolated with smooth edges, suitable for compositing into other images.
Maintain the original colors, lighting, and details of the object.`;

  try {
    // Use retry logic for background removal
    const result = await withRetry(async () => {
      const response = await withTimeout(
        getAIClient().models.generateContent({
          model: "gemini-2.0-flash-exp-image-generation",
          contents: [{
            role: "user",
            parts: [
              { inlineData: { data: imageData, mimeType } },
              { text: prompt }
            ]
          }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        AI_TIMEOUT_MS * 2, // Longer timeout for image generation
        "Background removal"
      );

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      
      if (imagePart?.inlineData?.data) {
        console.log("[Transparency] Successfully generated transparent version");
        return imagePart.inlineData.data;
      }
      
      throw new Error("No image in response");
    }, "Background removal", 2);
    
    return result;
  } catch (error) {
    console.error("[Transparency] Error generating transparent version after retries:", error);
    // Background removal is optional - return null gracefully
    return null;
  }
}

// AI-based image editing that follows user processing instructions
export async function applyProcessingInstructions(
  imageData: string,
  mimeType: string,
  instructions: string,
  objectDescription: string
): Promise<{ processedData: string | null; dimensions: { width: number; height: number } | null }> {
  console.log("[AI Edit] Applying processing instructions:", instructions);
  
  const prompt = `Edit this image according to these specific instructions:

${instructions}

This is an image of: ${objectDescription}

Important guidelines:
- Apply ONLY the changes described in the instructions above
- Maintain the integrity and quality of the original image
- Keep the same subject/object in focus
- Preserve important details while making the requested adjustments
- Output a high-quality edited version of the image

Please create the edited image now.`;

  try {
    // Use retry logic for AI editing
    const result = await withRetry(async () => {
      const response = await withTimeout(
        getAIClient().models.generateContent({
          model: "gemini-2.0-flash-exp-image-generation",
          contents: [{
            role: "user",
            parts: [
              { inlineData: { data: imageData, mimeType } },
              { text: prompt }
            ]
          }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        AI_TIMEOUT_MS * 2, // Longer timeout for image generation
        "AI image editing"
      );

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      
      if (imagePart?.inlineData?.data) {
        console.log("[AI Edit] Successfully applied processing instructions");
        
        // Get dimensions from the generated image
        const processedBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        const metadata = await sharp(processedBuffer).metadata();
        
        return {
          processedData: imagePart.inlineData.data,
          dimensions: {
            width: metadata.width || 0,
            height: metadata.height || 0
          }
        };
      }
      
      throw new Error("No image in response");
    }, "AI image editing", 2);
    
    return result;
  } catch (error) {
    console.error("[AI Edit] Error applying processing instructions after retries:", error);
    return { processedData: null, dimensions: null };
  }
}
