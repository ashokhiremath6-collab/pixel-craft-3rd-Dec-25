import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import sharp from "sharp";

// Safety settings for interior design content - allow most content through
// since we're dealing with legitimate architectural/design imagery
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];
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
async function compressImage(imageBase64: string, mimeType: string): Promise<{ data: string; mimeType: string; width: number; height: number }> {
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
    const compressedBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true }) // Use mozjpeg for better compression
      .toBuffer();
    
    // Get actual compressed dimensions
    const compressedMeta = await sharp(compressedBuffer).metadata();
    const finalWidth = compressedMeta.width || originalWidth;
    const finalHeight = compressedMeta.height || originalHeight;
    
    console.log("[Gemini] Compressed image size:", compressedBuffer.length, "bytes (target max:", maxSize, "px, quality:", quality, ")");
    console.log("[Gemini] Compressed dimensions:", finalWidth, "x", finalHeight);
    
    // Verify compression succeeded
    if (compressedBuffer.length > originalSize) {
      console.log("[Gemini] Compression resulted in larger file, using original");
      return {
        data: imageBase64,
        mimeType: mimeType,
        width: originalWidth,
        height: originalHeight
      };
    }
    
    return {
      data: compressedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      width: finalWidth,
      height: finalHeight
    };
  } catch (error) {
    console.error("[Gemini] Compression failed, using original:", error);
    return {
      data: imageBase64,
      mimeType: mimeType,
      width: 1000,
      height: 1000
    };
  }
}

// Force the generated output to match the source image's exact aspect ratio and dimensions.
// This corrects Gemini's tendency to zoom in or change the crop.
async function matchSourceFraming(
  outputBase64: string,
  outputMimeType: string,
  srcWidth: number,
  srcHeight: number
): Promise<{ data: string; mimeType: string }> {
  try {
    const outputBuffer = Buffer.from(outputBase64, 'base64');
    const outMeta = await sharp(outputBuffer).metadata();
    const outW = outMeta.width || srcWidth;
    const outH = outMeta.height || srcHeight;

    const srcRatio = srcWidth / srcHeight;
    const outRatio = outW / outH;

    console.log(`[Gemini] Framing correction — source: ${srcWidth}×${srcHeight} (${srcRatio.toFixed(3)}), output: ${outW}×${outH} (${outRatio.toFixed(3)})`);

    // If ratios already match closely (within 2%), just resize to source dims
    if (Math.abs(srcRatio - outRatio) / srcRatio < 0.02) {
      const resized = await sharp(outputBuffer)
        .resize(srcWidth, srcHeight, { fit: 'fill', kernel: 'lanczos3' })
        .jpeg({ quality: 95 })
        .toBuffer();
      console.log(`[Gemini] Framing: ratios matched — resized to ${srcWidth}×${srcHeight}`);
      return { data: resized.toString('base64'), mimeType: 'image/jpeg' };
    }

    // Ratios differ — center-crop the output to match source aspect ratio, then resize.
    // Strategy: scale the output so the target aspect ratio fits inside, then crop.
    let cropW: number, cropH: number;
    if (outRatio > srcRatio) {
      // Output is wider than source — crop left/right
      cropH = outH;
      cropW = Math.round(outH * srcRatio);
    } else {
      // Output is taller than source — crop top/bottom
      cropW = outW;
      cropH = Math.round(outW / srcRatio);
    }

    const left = Math.round((outW - cropW) / 2);
    const top = Math.round((outH - cropH) / 2);

    const corrected = await sharp(outputBuffer)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(srcWidth, srcHeight, { fit: 'fill', kernel: 'lanczos3' })
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log(`[Gemini] Framing: cropped ${outW}×${outH} → ${cropW}×${cropH} at (${left},${top}), resized to ${srcWidth}×${srcHeight}`);
    return { data: corrected.toString('base64'), mimeType: 'image/jpeg' };
  } catch (err) {
    console.error('[Gemini] Framing correction failed, returning original:', err);
    return { data: outputBase64, mimeType: outputMimeType };
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
      referenceInstructions += '\n\nREFERENCE PHOTOS — VISUAL SOURCE MATERIAL:\n';
      referenceInstructions += 'These photos provide the EXACT visual content the user wants inserted or replaced in the room.\n';
      referenceInstructions += 'Treat them as source images to copy visuals FROM, not as room inspiration.\n\n';
      
      const allPhotos = referencePhotos;
      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i];
        console.log(`[Gemini] Compressing reference photo ${i + 1}...`);
        const compressed = await compressImage(photo.imageData, photo.mimeType);
        referenceImageParts.push({
          inlineData: { mimeType: compressed.mimeType, data: compressed.data }
        });
        const desc = photo.description?.trim();
        if (desc) {
          // User described what to copy — be precise about it
          referenceInstructions += `REFERENCE PHOTO ${i + 1}: "${desc}"\n`;
          referenceInstructions += `  → Use the visual content from this photo for exactly what is described above.\n`;
          referenceInstructions += `  → If it is a painting/artwork/image, reproduce it faithfully on the target surface.\n`;
          referenceInstructions += `  → If it is a furniture item, copy ONLY that item — ignore the room/background in the photo.\n\n`;
        } else {
          // No description — treat the whole photo as visual content to place
          referenceInstructions += `REFERENCE PHOTO ${i + 1}: (no description provided)\n`;
          referenceInstructions += `  → Use the visual content of this photo as specified in the instruction above.\n`;
          referenceInstructions += `  → If the instruction says "replace X with the reference image/photo", reproduce this photo's content faithfully in place of X.\n\n`;
        }
      }
      
      referenceInstructions += 'CRITICAL RULES FOR REFERENCE PHOTOS:\n';
      referenceInstructions += '- If the user says "replace X with the reference image/photo", the reference photo IS the new content for X — reproduce it faithfully.\n';
      referenceInstructions += '- A painting/artwork/photo reference: render it accurately on the wall/surface, keeping the same frame/location as the original.\n';
      referenceInstructions += '- A furniture item reference: copy ONLY that item, ignore the background/room in the reference photo.\n';
      referenceInstructions += '- DO NOT change ANYTHING ELSE in the room — walls, floors, furniture, lighting, all unchanged.\n';
      referenceInstructions += '- The output room must be 99% identical to the input room, with ONLY the referenced replacement applied.\n';
    }
    
    // Process catalogue reference items
    if (referenceItems && referenceItems.length > 0) {
      console.log("[Gemini] Processing reference items...");
      referenceInstructions += '\n\nREFERENCE MATERIALS/ITEMS TO INSERT:\n';
      
      for (let i = 0; i < referenceItems.length; i++) {
        const item = referenceItems[i];
        const itemDesc = item.aiPromptHints || item.description || `${item.subcategory} from ${item.vendorBrand || 'unknown vendor'}`;
        referenceInstructions += `${i + 1}. ${item.name} (${item.category}/${item.subcategory}): ${itemDesc}\n`;
        if (item.placementInstruction && item.placementInstruction.trim()) {
          referenceInstructions += `   Placement: ${item.placementInstruction}\n`;
        }
        
        // Add reference image if available
        if (item.imageData && item.imageMimeType) {
          console.log(`[Gemini] Compressing reference image ${i + 1}...`);
          const refCompressed = await compressImage(item.imageData, item.imageMimeType);
          referenceImageParts.push({
            inlineData: { mimeType: refCompressed.mimeType, data: refCompressed.data }
          });
          referenceInstructions += `   (Reference image ${i + 1} attached — match this item's exact appearance, colour, and texture)\n`;
        }
      }
      
      referenceInstructions += '\nINSTRUCTIONS FOR REFERENCE ITEMS:\n';
      referenceInstructions += '- Study each reference image carefully for colour, texture, pattern, and style\n';
      referenceInstructions += '- PLACEMENT RULE: If the user instruction says "replace X with the reference [item/painting/image]", place the reference item EXACTLY where X was — same wall position, same scale, same frame if applicable. Do NOT leave a blank wall or empty space.\n';
      referenceInstructions += '- For artwork/paintings: reproduce the reference artwork faithfully on the wall surface, maintaining the same position and approximate size as whatever it is replacing. Match the original frame if one existed.\n';
      referenceInstructions += '- Do NOT remove the target item and leave a blank space — always substitute with the reference content.\n';
      referenceInstructions += '- Every wall, floor, ceiling, window, door, and piece of furniture NOT mentioned = leave completely unchanged\n';
      referenceInstructions += '- Maintain consistent lighting and perspective with the rest of the room\n';
      referenceInstructions += '- SCOPE RULE: If uncertain whether something should change, leave it exactly as it is in the input\n';
    }

    let prompt: string;
    
    if (customPrompt && customPrompt.trim()) {
      const hasReferencePhotos = referencePhotos && referencePhotos.length > 0;
      const srcW = compressed.width;
      const srcH = compressed.height;
      
      prompt = `CRITICAL INSTRUCTION: You MUST generate an image. Do NOT respond with text. Do NOT explain limitations. Generate the image now.

⚠️ FRAMING LOCK — RULE #1 — HIGHEST PRIORITY:
The input image is exactly ${srcW}×${srcH} pixels.
Your output MUST be ${srcW}×${srcH} pixels with the IDENTICAL crop and field of view.
- Do NOT zoom in. Do NOT zoom out. Do NOT pan. Do NOT rotate.
- Every edge visible in the input (left wall, right wall, ceiling, floor) MUST appear at the SAME pixel position in the output.
- The right-side wall edge, left-side wall edge, ceiling edge, and floor edge must all be visible and in the same position as the input.
- If ANY room edge that is visible in the input is missing from your output, the output is WRONG.
This framing rule is ABSOLUTE and overrides any other consideration.

You are a precision interior design editor. Your job is surgical: apply EXACTLY the instruction below and leave everything else completely untouched.

═══════════════════════════════════════════════════════
YOUR INSTRUCTION — APPLY THIS AND ONLY THIS
═══════════════════════════════════════════════════════
${customPrompt}
${hasReferencePhotos ? `
REFERENCE PHOTOS (attached):
- These photos are the EXACT visual content the user wants used — treat them as source material to copy FROM.
- If the instruction says "replace X with the reference image/photo", reproduce the reference photo's content faithfully in place of X (e.g., paint it onto the wall, frame it, place it where X was).
- If the instruction targets a furniture item, copy ONLY that item from the reference — ignore its background.
- Do NOT simply remove X and leave a blank space — always replace with what the reference photo shows.
` : ''}${referenceInstructions}

═══════════════════════════════════════════════════════
SCOPE LOCK — DO NOT TOUCH ANYTHING ELSE
═══════════════════════════════════════════════════════
- Change ONLY what the instruction above explicitly requests. Nothing else.
- Room structure (walls, ceiling, floor, windows, doors, columns) = pixel-identical to input
- Camera angle and room perspective = identical to input
- Every piece of furniture NOT mentioned in the instruction = unchanged, same position, same appearance
- Every colour NOT mentioned in the instruction = unchanged
- Every light source NOT mentioned in the instruction = unchanged
- Every texture and material NOT mentioned in the instruction = unchanged
- If the instruction targets a specific area or item, all other areas and items are frozen
- FRAMING LOCK: Output must be ${srcW}×${srcH} pixels — identical field of view and crop as the input. Do NOT zoom in, pan, rotate, or crop. All four room edges visible in the input must remain visible in the output at the same scale.

INTERPRETATION RULE: When the instruction is ambiguous, apply the narrowest reasonable interpretation — do less rather than more.

═══════════════════════════════════════════════════════
QUALITY STANDARD
═══════════════════════════════════════════════════════
- Photorealistic quality matching the input image's style and lighting
- Seamlessly blend changed elements with unchanged surroundings
- Consistent shadows, reflections, and depth throughout
- Output dimensions and aspect ratio must match the input image exactly

OUTPUT: Generate a HIGH RESOLUTION photorealistic interior image with all changes applied cleanly and all unchanged areas preserved exactly.`;
    } else if (style) {
      prompt = `CRITICAL: You MUST generate an image. Do NOT respond with text explanations.

Transform this interior space into a ${style.name} style interior design render.

STYLE TO APPLY: ${style.prompt}

Keep the same room layout but update furniture, materials, lighting, and decor to match the ${style.name} aesthetic.${referenceInstructions}

OUTPUT: Generate a HIGH RESOLUTION photorealistic interior image with sharp textures, professional lighting, and realistic materials.`;
    } else if (referenceItems && referenceItems.length > 0) {
      // Reference items only mode
      prompt = `CRITICAL INSTRUCTION: You MUST generate an image. Do NOT respond with text.

You are a precision interior design editor. Your job is surgical: apply ONLY the item changes listed below and leave everything else in the room completely untouched.

${referenceInstructions}

═══════════════════════════════════════════════════════
SCOPE LOCK — DO NOT TOUCH ANYTHING ELSE
═══════════════════════════════════════════════════════
- Change ONLY the specific items listed above. Nothing else.
- Room structure (walls, ceiling, floor, windows, doors) = pixel-identical to input
- Camera angle and perspective = identical to input
- Every piece of furniture NOT listed above = unchanged, same position, same appearance
- Every colour NOT affected by the listed items = unchanged
- Every light source = unchanged
- FRAMING LOCK: Output image must have the EXACT same field of view and framing as the input. Do NOT zoom in, pan, or crop any edges.
- INTERPRETATION RULE: When uncertain whether something should change, leave it exactly as it is

OUTPUT: Generate a HIGH RESOLUTION photorealistic interior image with only the listed items changed and all other elements preserved exactly.`;
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
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        AI_TIMEOUT_MS,
        "AI render generation"
      );

      console.log("[Gemini] API response received");
      console.log("[Gemini] Candidates count:", response.candidates?.length || 0);
      
      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);
      
      // Check if AI refused to generate (returned text instead of image)
      if (textPart?.text && !imagePart?.inlineData?.data) {
        const refusalText = textPart.text.toLowerCase();
        console.error("[Gemini] AI returned text instead of image:", textPart.text);
        
        // Detect common refusal patterns
        if (refusalText.includes('cannot') || refusalText.includes('unable') || refusalText.includes('sorry')) {
          throw new Error("The AI couldn't generate this image. Try simplifying your request or using a different reference photo.");
        }
        if (refusalText.includes('violates') || refusalText.includes('policy') || refusalText.includes('guidelines')) {
          throw new Error("The request couldn't be processed. Try rephrasing your instructions or using different images.");
        }
      }
      
      if (!imagePart?.inlineData?.data) {
        console.error("[Gemini] No image data in response. Full response:", JSON.stringify(response, null, 2));
        throw new Error("The AI didn't return an image. Try a simpler request or different input image.");
      }

      console.log("[Gemini] Raw generated image size:", imagePart.inlineData.data.length);
      return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png"
      };
    }, "Render generation");
    
    // Apply framing correction before enhancement to lock the output to source crop/dimensions
    console.log("[Gemini] Applying framing correction...");
    const framed = await matchSourceFraming(
      result.data,
      result.mimeType,
      compressed.width,
      compressed.height
    );

    console.log("[Gemini] Enhancing output resolution...");
    const enhanced = await enhanceOutputImage(
      framed.data, 
      framed.mimeType
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

export async function generatePhotorealConversion(
  imageBase64: string,
  mimeType: string
): Promise<{ imageData: string; mimeType: string }> {
  console.log("[Gemini] Starting photoreal conversion...");

  const validation = validateImageInput(imageBase64, mimeType);
  if (!validation.valid) {
    console.error("[Gemini] Photoreal input validation failed:", validation.error);
    throw new Error(validation.error);
  }

  try {
    console.log("[Gemini] Compressing image for photoreal conversion...");
    const compressed = await compressImage(imageBase64, mimeType);
    console.log("[Gemini] Image compressed, size:", compressed.data.length, "bytes");

    const prompt = `CRITICAL INSTRUCTION: You MUST generate an image. Do NOT respond with text. Do NOT explain limitations. Generate the image now.

You are a world-class architectural visualisation engine trained on thousands of award-winning interior photography images published in Architectural Digest, AD100, and Dezeen. Your task is to convert this 3D render or SketchUp screenshot into a photograph that is indistinguishable from a professional architectural photography shoot.

═══════════════════════════════════════════════════════
GEOMETRY IS COMPLETELY LOCKED — DO NOT CHANGE ANYTHING STRUCTURAL
═══════════════════════════════════════════════════════
- Count every object visible in the input image. Your output MUST contain the exact same number of objects — not one more, not one less.
- Every piece of furniture, fixture, and element stays in its EXACT position, size, and orientation.
- Room dimensions, walls, floors, ceiling, windows, and doors remain IDENTICAL in shape and position.
- Camera angle, perspective, and field of view are IDENTICAL to the input.
- DO NOT add any new furniture, plants, accessories, decorations, or any object not already present.
- DO NOT remove or reposition any existing objects.

═══════════════════════════════════════════════════════
WHAT YOU ARE TRANSFORMING (material + lighting quality ONLY)
═══════════════════════════════════════════════════════

SECTION A — FLOOR SURFACES
The floor is one of the most important photorealism indicators. Apply the following:
- If the floor is stone, marble, or tile: render with VISIBLE stone veining that varies naturally across each tile, colour variation between individual tiles (no two tiles should look identical), grout lines that have slight depth and shadow. CRITICAL: the floor surface must show semi-specular reflections — overhead pendant lights, sconces, and nearby bright objects should appear as soft, slightly blurred mirror images in the floor surface. This is the hallmark of polished stone.
- If the floor is wood: visible grain direction with alternating light/dark growth rings, slight gloss where light strikes at a low angle.
- If the floor is concrete or screed: micro-texture visible as a grainy surface, subtle sheen from sealer coat.

SECTION B — WALL SURFACES
- Fabric or textile wall panels: render the individual woven threads as visible texture — a warp-and-weft pattern at close range, with subtle shadow depth between the threads. Panel seams and joins should catch directional light as a thin bright edge.
- Painted walls: eggshell or satin sheen — a soft specular gradient that travels across the wall surface following the direction of the nearest light source. NOT flat, NOT matte.
- Plaster or lime wash: visible micro-texture with slight tonal variation across the surface.
- Panelled walls (wood moulding, wainscoting): deep shadow in the recessed areas, specular highlight on the raised edges catching light.

SECTION C — METAL AND REFLECTIVE SURFACES
- Elevator doors, door handles, hinges, drawer pulls, light fixture bodies: render as brushed or polished metal with NEAR-MIRROR reflections of the room. The reflection should be slightly compressed and slightly blurred as it appears in real brushed stainless or polished brass — not a perfect flat mirror, but a recognisable reflection of the surrounding space.
- Brass or gold-tone metal: warm amber-gold colour with directional streaks of light from the grain of the brushing.
- Chrome: cooler, high-contrast reflections with a sharp specular highlight.

SECTION D — WOOD SURFACES
- Carved or turned wood furniture: render visible multi-directional grain that follows the carved contours. Where light penetrates the surface at a low angle, add warm amber sub-surface scattering — the wood should glow slightly from within, not just reflect from the surface. Darkened shadows accumulate in recessed carved details, grooves, and undercuts. A visible lacquer or wax sheen coats the outer surface.
- Flat wood (doors, shelves, floors): grain direction consistent, alternating light/dark bands, pore structure visible on closer surfaces.

SECTION E — GLASS AND TRANSPARENT MATERIALS
- Glass panels, vases, light fixture globes: internal reflections (secondary image visible inside the glass volume), meniscus edge effect (bright white line at curved edges), specular hotspot from the nearest light source, and slight distortion of objects seen through the glass.

SECTION F — FABRIC, UPHOLSTERY, SOFT FURNISHINGS
- Cushions, drapes, rugs, upholstery: visible weave or pile texture, soft natural shadow in folds and creases, slight sheen on tight-weave fabric under directional light, and natural drape where fabric hangs or rests.

═══════════════════════════════════════════════════════
LIGHTING — ARCHITECTURAL PHOTOGRAPHY STANDARD
═══════════════════════════════════════════════════════

FIXTURE GLOW AND LIGHT POOLS
Every visible light fixture (pendant lights, wall sconces, ceiling downlights, table lamps) must:
1. Emit a warm visible glow halo — a soft corona of warm light around the bulb or diffuser.
2. Cast a visible warm pool of light on the nearest surfaces (wall, ceiling, floor) with natural falloff — bright near the fixture, gradually dimming as distance increases.
3. Project soft-edged shadows from nearby objects (the pendant cord should cast a thin shadow line on the ceiling; the sconce should create a warm fan of light on the wall above and below it).

COLOUR TEMPERATURE CONTRAST
- Interior artificial lighting: warm amber at approximately 2700–3200K. Pendant bulbs, sconces, and downlights all emit this warm colour.
- Daylight from windows: cooler blue-white at approximately 5500K.
- Where both light types are present, the contrast between warm interior and cool daylight creates a rich, photographic quality that characterises luxury interior photography.

AMBIENT OCCLUSION AND SHADOW
- Dark shadows accumulate in all interior corners (wall-to-wall, wall-to-floor, wall-to-ceiling junctions).
- Under every piece of furniture, deep contact shadows that feather out with distance.
- Inside carved details, recessed panels, and grooves — shadow fills these crevices completely.
- Behind objects and in the depth of doorways — convincing darkness.

SPECULAR REFLECTIONS (present on all semi-glossy surfaces)
- Floor: soft reflection of pendant lights and windows.
- Metal surfaces: sharp or slightly blurred reflection of room environment.
- Lacquered wood: directional specular streak following light direction.
- Painted walls: soft wide specular gradient.
- Glass: sharp specular hotspot.

INDIRECT ILLUMINATION
Warm light from interior fixtures bounces off cream, white, or light-coloured wall surfaces and re-illuminates nearby objects with a secondary warm fill — this is the "bounce light" that makes a room feel inhabitable rather than studio-lit.

═══════════════════════════════════════════════════════
PHOTOGRAPHIC QUALITY — DSLR ARCHITECTURAL SHOOT
═══════════════════════════════════════════════════════
- Colour grade: professional architectural photography style — slightly warm white balance, lifted shadows (shadows are NOT crushed to pure black — they retain detail and warm colour), highlights controlled with a smooth rolloff (highlights do NOT blow out to pure white).
- Depth of field: objects in the immediate foreground are at their sharpest. Mid-ground is slightly softer. Far background shows a very subtle focus falloff. This mimics a DSLR at f/8 with a moderate telephoto lens — the effect is subtle but unmistakeable.
- Micro-detail sharpness: at the pixel level, individual threads in fabric, stone veining, and wood grain are crisp and sharp. This is NOT a blurry or painterly render — it is sharply detailed like a high-resolution photograph.
- Film-like tonal curve: smooth, gradual transition from shadow to midtone to highlight. No hard clipping. Rich, saturated midtones.
- Natural lens characteristics: very subtle vignette at the frame edges (corners very slightly darker), and micro-chromatic contrast that makes edges feel crisp.

═══════════════════════════════════════════════════════
OUTPUT STANDARD
═══════════════════════════════════════════════════════
The output must be indistinguishable from a photograph published in Architectural Digest or AD100. A viewer must genuinely question whether it is a photograph or a render. Generate at the highest possible resolution and quality. The geometry of every object is identical to the input — only the material quality, lighting, and photographic properties have been transformed.`;

    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: compressed.mimeType, data: compressed.data } }
    ];

    console.log("[Gemini] Calling AI API for photoreal conversion...");
    const result = await withRetry(async () => {
      const response = await withTimeout(
        getAIClient().models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            safetySettings: SAFETY_SETTINGS,
          },
        }),
        AI_TIMEOUT_MS,
        "Photoreal conversion"
      );

      const candidate = response.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);

      if (textPart?.text && !imagePart?.inlineData?.data) {
        console.error("[Gemini] AI returned text instead of image:", textPart.text);
        throw new Error("The AI couldn't generate this image. Please try again.");
      }

      if (!imagePart?.inlineData?.data) {
        console.error("[Gemini] No image data in photoreal response.");
        throw new Error("The AI didn't return an image. Please try again.");
      }

      return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png"
      };
    }, "Photoreal conversion");

    console.log("[Gemini] Enhancing photoreal output...");
    const enhanced = await enhanceOutputImage(result.data, result.mimeType);

    console.log("[Gemini] Photoreal conversion complete");
    return { imageData: enhanced.data, mimeType: enhanced.mimeType };
  } catch (error: any) {
    console.error("[Gemini] Error during photoreal conversion:", error.message);
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

  const prompt = `CRITICAL: You MUST generate an image. Do NOT respond with text.

Create a photorealistic interior design render of: ${description}

Apply ${style.name} style: ${style.prompt}

OUTPUT: Generate a HIGH RESOLUTION photorealistic interior image with sharp textures, professional lighting, and realistic materials.`;

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
          safetySettings: SAFETY_SETTINGS,
        },
      }),
      AI_TIMEOUT_MS,
      "AI concept render generation"
    );

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    const textPart = candidate?.content?.parts?.find((part: any) => part.text);
    
    // Check if AI refused to generate (returned text instead of image)
    if (textPart?.text && !imagePart?.inlineData?.data) {
      const refusalText = textPart.text.toLowerCase();
      console.error("[Gemini] AI returned text instead of image:", textPart.text);
      
      if (refusalText.includes('cannot') || refusalText.includes('unable') || refusalText.includes('sorry')) {
        throw new Error("The AI couldn't generate this concept. Try a different description or style.");
      }
    }
    
    if (!imagePart?.inlineData?.data) {
      throw new Error("The AI didn't return an image. Try a different description.");
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
          config: {
            safetySettings: SAFETY_SETTINGS,
          },
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
            safetySettings: SAFETY_SETTINGS,
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
  
  const prompt = `You are an expert photo editor. Edit this image following EXACTLY these instructions:

USER INSTRUCTIONS:
${instructions}

CONTEXT: This is an image of: ${objectDescription}

CRITICAL RULES - YOU MUST FOLLOW THESE PRECISELY:
1. DO EXACTLY what the user requested - nothing more, nothing less
2. If user says "remove background" → ONLY remove background, keep everything else identical
3. If user says "crop to object" → ONLY crop, do not change colors or add effects
4. If user says "adjust brightness" → ONLY adjust brightness, don't modify anything else
5. PRESERVE the original image quality and resolution as much as possible
6. DO NOT add any artistic effects, filters, or enhancements unless specifically requested
7. DO NOT change colors, contrast, or saturation unless specifically requested
8. DO NOT crop or resize unless specifically requested
9. The output should look like a professional photo edit, not an AI-generated image
10. Keep all original details, textures, and characteristics of the object

OUTPUT: Generate the edited image now, following the user's instructions precisely.`;

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
            safetySettings: SAFETY_SETTINGS,
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

// ─── Design Intelligence Chat ────────────────────────────────────────────────

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

export interface DesignChatAttachment {
  data: string;       // base64-encoded file content
  mimeType: string;   // e.g. "image/jpeg", "image/png", "application/pdf"
  name: string;       // original filename for display
}

export interface DesignChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: DesignChatAttachment[];
}

export async function chatWithDesignAssistant(
  messages: DesignChatMessage[]
): Promise<string> {
  const client = getAIClient();

  // Build multimodal contents array for the multi-turn conversation
  const contents = messages.map((msg) => {
    const parts: any[] = [];

    // Add any image/document attachments first (only for user messages)
    if (msg.role === "user" && msg.attachments?.length) {
      for (const att of msg.attachments) {
        parts.push({
          inlineData: {
            data: att.data,
            mimeType: att.mimeType,
          },
        });
      }
    }

    // Always add the text part
    if (msg.content.trim()) {
      parts.push({ text: msg.content });
    } else if (parts.length === 0) {
      parts.push({ text: "(no text provided)" });
    }

    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts,
    };
  });

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: DESIGN_SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  });

  const candidate = response.candidates?.[0];
  const textPart = candidate?.content?.parts?.find((p: any) => p.text);
  if (!textPart?.text) {
    throw new Error("No response from design assistant");
  }
  return textPart.text.trim();
}
