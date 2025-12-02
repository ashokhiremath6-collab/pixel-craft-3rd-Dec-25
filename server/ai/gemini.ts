import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import * as fs from "fs";

let aiClient: GoogleGenAI | null = null;

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

// Helper function to calculate crop region coordinates
function getRegionCoordinates(region: string, width: number, height: number): { left: number; top: number; width: number; height: number } {
  const regionWidth = Math.floor(width / 3);
  const regionHeight = Math.floor(height / 3);
  
  const regionMap: Record<string, { col: number; row: number }> = {
    'top-left': { col: 0, row: 0 },
    'top-center': { col: 1, row: 0 },
    'top-right': { col: 2, row: 0 },
    'center-left': { col: 0, row: 1 },
    'center': { col: 1, row: 1 },
    'center-right': { col: 2, row: 1 },
    'bottom-left': { col: 0, row: 2 },
    'bottom-center': { col: 1, row: 2 },
    'bottom-right': { col: 2, row: 2 },
  };
  
  const pos = regionMap[region] || { col: 1, row: 1 };
  
  return {
    left: pos.col * regionWidth,
    top: pos.row * regionHeight,
    width: regionWidth,
    height: regionHeight
  };
}

// Create a feathered mask for smooth blending at edges
async function createFeatheredMask(width: number, height: number, featherSize: number): Promise<Buffer> {
  // Create a white rectangle with feathered/gradient edges
  const channels = 4; // RGBA
  const data = Buffer.alloc(width * height * channels);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      
      // Calculate distance from each edge
      const distLeft = x;
      const distRight = width - 1 - x;
      const distTop = y;
      const distBottom = height - 1 - y;
      
      // Find minimum distance to any edge
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      
      // Calculate alpha based on distance (feather gradient)
      let alpha = 255;
      if (minDist < featherSize) {
        alpha = Math.round((minDist / featherSize) * 255);
      }
      
      // Set RGBA (white with variable alpha for feathering)
      data[idx] = 255;     // R
      data[idx + 1] = 255; // G
      data[idx + 2] = 255; // B
      data[idx + 3] = alpha; // A (feathered at edges)
    }
  }
  
  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// Patch-edit pipeline: crops region with context, generates replacement, composites back with feathered blending
async function generatePatchEdit(
  imageBase64: string,
  mimeType: string,
  customPrompt: string,
  referenceItems?: ReferenceItem[],
  editRegion?: string,
  customRegionPercent?: {x: number; y: number; width: number; height: number}
): Promise<{ imageData: string; mimeType: string }> {
  console.log("[Gemini Patch] Starting context-aware patch-edit pipeline...");
  
  // Decode original image and get dimensions
  const originalBuffer = Buffer.from(imageBase64, 'base64');
  const metadata = await sharp(originalBuffer).metadata();
  const { width = 1024, height = 1024 } = metadata;
  
  console.log("[Gemini Patch] Original image dimensions:", width, "x", height);
  
  // Calculate crop region - use custom percentage region if provided, otherwise grid-based
  let region: { left: number; top: number; width: number; height: number };
  
  if (customRegionPercent && customRegionPercent.width > 2 && customRegionPercent.height > 2) {
    // Convert percentage coordinates to pixel coordinates
    region = {
      left: Math.round((customRegionPercent.x / 100) * width),
      top: Math.round((customRegionPercent.y / 100) * height),
      width: Math.round((customRegionPercent.width / 100) * width),
      height: Math.round((customRegionPercent.height / 100) * height)
    };
    // Ensure we don't exceed image bounds
    region.left = Math.max(0, Math.min(region.left, width - 10));
    region.top = Math.max(0, Math.min(region.top, height - 10));
    region.width = Math.min(region.width, width - region.left);
    region.height = Math.min(region.height, height - region.top);
    console.log("[Gemini Patch] Using custom region (from %):", region);
  } else {
    region = getRegionCoordinates(editRegion || 'center', width, height);
    console.log("[Gemini Patch] Using grid region:", region);
  }
  
  // Add context padding (15-20% of region size) to help AI understand surrounding context
  const paddingPercent = 0.18; // 18% padding
  const paddingX = Math.round(region.width * paddingPercent);
  const paddingY = Math.round(region.height * paddingPercent);
  
  // Calculate expanded region with padding (clamped to image bounds)
  const expandedRegion = {
    left: Math.max(0, region.left - paddingX),
    top: Math.max(0, region.top - paddingY),
    width: 0,
    height: 0
  };
  expandedRegion.width = Math.min(width - expandedRegion.left, region.width + paddingX * 2);
  expandedRegion.height = Math.min(height - expandedRegion.top, region.height + paddingY * 2);
  
  console.log("[Gemini Patch] Original region:", region);
  console.log("[Gemini Patch] Expanded region with context:", expandedRegion);
  
  // Calculate the inner region position relative to expanded region (for masking)
  const innerOffset = {
    left: region.left - expandedRegion.left,
    top: region.top - expandedRegion.top
  };
  
  // Crop the expanded region (includes context padding)
  const expandedCropBuffer = await sharp(originalBuffer)
    .extract({ 
      left: expandedRegion.left, 
      top: expandedRegion.top, 
      width: expandedRegion.width, 
      height: expandedRegion.height 
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  
  const expandedCropBase64 = expandedCropBuffer.toString('base64');
  console.log("[Gemini Patch] Expanded crop size:", expandedCropBuffer.length, "bytes");
  
  // Also prepare full image context (resized for API limits)
  const fullContextBuffer = await sharp(originalBuffer)
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();
  const fullContextBase64 = fullContextBuffer.toString('base64');
  
  // Build reference instructions for patch generation
  let referenceInstructions = '';
  const referenceImageParts: any[] = [];
  
  if (referenceItems && referenceItems.length > 0) {
    referenceInstructions = '\n\nREFERENCE ITEMS TO INCORPORATE:\n';
    for (let i = 0; i < referenceItems.length; i++) {
      const item = referenceItems[i];
      const itemDesc = item.aiPromptHints || item.description || `${item.subcategory} from ${item.vendorBrand || 'unknown vendor'}`;
      referenceInstructions += `${i + 1}. ${item.name}: ${itemDesc}\n`;
      referenceInstructions += `   Placement: ${item.placementInstruction}\n`;
      
      if (item.imageData && item.imageMimeType) {
        const refCompressed = await compressImage(item.imageData, item.imageMimeType);
        referenceImageParts.push({
          inlineData: { mimeType: refCompressed.mimeType, data: refCompressed.data }
        });
      }
    }
  }
  
  // Enhanced prompt with context awareness and object consistency
  const patchPrompt = `TASK: Edit a specific region of an interior room while maintaining perfect visual continuity.

You are provided with:
1. FULL ROOM CONTEXT (Image 1): The complete room for understanding lighting, perspective, and existing furniture
2. EDIT REGION WITH PADDING (Image 2): The area to edit, with surrounding context visible at the edges

EDIT REQUEST: ${customPrompt}${referenceInstructions}

CRITICAL REQUIREMENTS FOR SEAMLESS BLENDING:

1. VISUAL CONTINUITY:
   - The edited region MUST blend seamlessly with surrounding areas
   - Match the exact wall colors, floor patterns, and textures visible at the edges
   - Maintain consistent lighting direction, shadows, and ambient color
   - Preserve perspective lines and vanishing points from the original

2. OBJECT ALIGNMENT & CONSISTENCY:
   - If adding/modifying furniture similar to existing pieces, ensure IDENTICAL scale, orientation, and style
   - Match leg angles, arm heights, and proportions of similar objects (e.g., pairs of chairs must be symmetrical)
   - Align objects with floor planes and maintain proper ground contact
   - Keep consistent spacing between furniture pieces

3. EDGE TREATMENT:
   - Elements at the crop boundary must connect naturally with what's outside
   - Wall edges, floor lines, and architectural elements must continue smoothly
   - No visible seams, color shifts, or style breaks at boundaries

4. PRESERVATION:
   - Only modify what's explicitly requested
   - Keep unchanged elements exactly as they appear in the context

OUTPUT: Generate a HIGH RESOLUTION photorealistic edited version of Image 2 (the edit region) that will composite seamlessly back into the full room.`;

  console.log("[Gemini Patch] Calling AI with full context + expanded region...");
  
  // Generate the patch with both full context and expanded crop
  const parts: any[] = [
    { text: patchPrompt },
    { inlineData: { mimeType: 'image/jpeg', data: fullContextBase64 } },
    { inlineData: { mimeType: 'image/jpeg', data: expandedCropBase64 } },
    ...referenceImageParts
  ];
  
  const response = await getAIClient().models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
  });
  
  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
  
  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in patch generation response");
  }
  
  console.log("[Gemini Patch] Patch generated, size:", imagePart.inlineData.data.length);
  
  // Resize the generated patch back to the expanded region size
  const patchBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const resizedExpandedPatch = await sharp(patchBuffer)
    .resize(expandedRegion.width, expandedRegion.height, { fit: 'fill' })
    .png()
    .toBuffer();
  
  console.log("[Gemini Patch] Resized patch to expanded region:", expandedRegion.width, "x", expandedRegion.height);
  
  // Extract just the inner region from the generated patch (removing context padding)
  const innerPatch = await sharp(resizedExpandedPatch)
    .extract({
      left: innerOffset.left,
      top: innerOffset.top,
      width: region.width,
      height: region.height
    })
    .png()
    .toBuffer();
  
  console.log("[Gemini Patch] Extracted inner patch:", region.width, "x", region.height);
  
  // Create feathered mask for smooth blending (feather size = 5% of smallest dimension)
  const featherSize = Math.round(Math.min(region.width, region.height) * 0.08);
  const featheredMask = await createFeatheredMask(region.width, region.height, featherSize);
  
  // Apply feathered mask to the inner patch
  const maskedPatch = await sharp(innerPatch)
    .composite([{
      input: featheredMask,
      blend: 'dest-in' // Use mask as alpha channel
    }])
    .png()
    .toBuffer();
  
  console.log("[Gemini Patch] Applied feathered mask for blending");
  
  // Composite the masked patch back onto the original image
  const composited = await sharp(originalBuffer)
    .composite([{
      input: maskedPatch,
      left: region.left,
      top: region.top,
      blend: 'over' // Blend using patch's alpha channel
    }])
    .png({ compressionLevel: 4 })
    .toBuffer();
  
  console.log("[Gemini Patch] Final composited image size:", composited.length, "bytes");
  
  // Enhance the final output
  const enhanced = await enhanceOutputImage(composited.toString('base64'), 'image/png');
  
  // Return in the expected format with imageData (not data)
  return {
    imageData: enhanced.data,
    mimeType: enhanced.mimeType
  };
}

export async function generateInteriorRender(
  imageBase64: string,
  mimeType: string,
  styleId: string,
  customPrompt?: string,
  referenceItems?: ReferenceItem[],
  editRegion?: string,
  customRegionPercent?: {x: number; y: number; width: number; height: number},
  editMode?: "smart" | "grid"
): Promise<{ imageData: string; mimeType: string }> {
  console.log("[Gemini] Starting interior render generation...");
  console.log("[Gemini] Style ID:", styleId);
  console.log("[Gemini] Has custom prompt:", !!customPrompt);
  console.log("[Gemini] Reference items count:", referenceItems?.length || 0);
  console.log("[Gemini] Edit mode:", editMode || "style-only");
  console.log("[Gemini] Edit region:", editRegion || (customRegionPercent ? "custom" : "full"));
  console.log("[Gemini] Custom region (%):", customRegionPercent || "none");
  console.log("[Gemini] API Key configured:", !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
  console.log("[Gemini] Base URL:", process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
  
  const style = RENDER_STYLES.find(s => s.id === styleId);
  
  if (!style && !customPrompt && (!referenceItems || referenceItems.length === 0)) {
    throw new Error("Invalid style ID and no custom prompt or reference items provided");
  }

  try {
    // Note: We no longer use patch-edit for grid mode as it caused compositing artifacts
    // Instead, grid mode uses the full-image approach with region focus instructions in the prompt
    
    console.log("[Gemini] Compressing image...");
    const compressed = await compressImage(imageBase64, mimeType);
    console.log("[Gemini] Image compressed, size:", compressed.data.length, "bytes");

    // Build reference items instruction block
    let referenceInstructions = '';
    const referenceImageParts: any[] = [];
    
    if (referenceItems && referenceItems.length > 0) {
      console.log("[Gemini] Processing reference items...");
      referenceInstructions = '\n\nREFERENCE MATERIALS/ITEMS TO INSERT:\n';
      
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
    
    // Build region focus instructions for grid mode
    let regionFocusInstructions = '';
    if (editMode === "grid") {
      // Convert named grid regions to percentage coordinates
      const gridRegionToPercent: Record<string, {x: number; y: number; width: number; height: number}> = {
        'top-left': { x: 0, y: 0, width: 33, height: 33 },
        'top-center': { x: 33, y: 0, width: 34, height: 33 },
        'top-right': { x: 67, y: 0, width: 33, height: 33 },
        'center-left': { x: 0, y: 33, width: 33, height: 34 },
        'center': { x: 33, y: 33, width: 34, height: 34 },
        'center-right': { x: 67, y: 33, width: 33, height: 34 },
        'bottom-left': { x: 0, y: 67, width: 33, height: 33 },
        'bottom-center': { x: 33, y: 67, width: 34, height: 33 },
        'bottom-right': { x: 67, y: 67, width: 33, height: 33 },
      };
      
      let regionPercent: {x: number; y: number; width: number; height: number} | null = null;
      
      // Use custom region if provided, otherwise use named grid region
      if (customRegionPercent && customRegionPercent.width > 2 && customRegionPercent.height > 2) {
        regionPercent = customRegionPercent;
      } else if (editRegion && gridRegionToPercent[editRegion]) {
        regionPercent = gridRegionToPercent[editRegion];
      }
      
      if (regionPercent) {
        const regionDesc = `The user has selected a specific region of the image:
- LEFT edge: ${Math.round(regionPercent.x)}% from left side
- TOP edge: ${Math.round(regionPercent.y)}% from top
- WIDTH: ${Math.round(regionPercent.width)}% of image width
- HEIGHT: ${Math.round(regionPercent.height)}% of image height

FOCUS YOUR EDIT on elements within this selected region. Elements OUTSIDE this region should remain COMPLETELY UNCHANGED.`;
        regionFocusInstructions = `\n\nSELECTED REGION (Grid Mode):\n${regionDesc}\n`;
      }
    }
    
    if (customPrompt && customPrompt.trim()) {
      // Smart/Grid mode: AI semantically understands what element to modify
      prompt = `You are an expert interior design AI assistant. Analyze this room image and perform a TARGETED EDIT based on the user's description.

USER'S EDIT REQUEST: "${customPrompt}"
${regionFocusInstructions}${referenceInstructions}

YOUR TASK:
1. UNDERSTAND: Parse the user's request to identify EXACTLY what element they want to change
   - "wall color pink" → change ONLY the wall color to pink
   - "bigger carpet" → make ONLY the carpet larger  
   - "add plant in corner" → add a plant in a corner, change nothing else
   - "leather sofa" → change ONLY the sofa material to leather
   - "remove the lamp" → remove ONLY the lamp
   - "add another chair" → add a chair that MATCHES existing chairs exactly (same style, scale, orientation)

2. LOCATE: Find the specific element(s) in the image that match the user's request
   ${regionFocusInstructions ? '- IMPORTANT: Focus on elements within the user-selected region' : ''}
   - If they mention "wall", identify all visible walls
   - If they mention "sofa" or "couch", find the seating furniture
   - If they mention "floor" or "carpet", identify the floor covering

3. MODIFY: Apply the change ONLY to the identified element
   - Preserve exact perspective, lighting, and camera angle
   - Keep all other furniture, decor, and architectural elements UNCHANGED
   - Blend the modification naturally with realistic shadows and lighting
   - If adding furniture similar to existing pieces, ensure IDENTICAL style, scale, and proportions
   - New chairs must match existing chairs exactly (leg angles, arm heights, upholstery)

CRITICAL PRESERVATION RULES:
- The output image must be 95%+ identical to the input
- DO NOT change anything not explicitly mentioned in the request
- DO NOT add decorations or furniture not requested
- DO NOT modify the room layout, ceiling, or architecture
- DO NOT adjust colors of items not mentioned
- Keep the same style and atmosphere of the room
- Duplicate objects (pairs of chairs, matching lamps) must be SYMMETRICAL and IDENTICAL

OUTPUT: Generate a high-resolution photorealistic result where ONLY the specifically requested element has been modified.`;
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
    
    // Build parts array: text prompt + source image + reference images
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: compressed.mimeType, data: compressed.data } },
      ...referenceImageParts
    ];
    
    const response = await getAIClient().models.generateContent({
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
    });

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
