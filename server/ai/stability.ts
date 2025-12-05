import fetch from 'node-fetch';
import FormData from 'form-data';

const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';

interface InpaintResult {
  imageData: string;
  mimeType: string;
}

export async function inpaintImage(
  imageBase64: string,
  imageMimeType: string,
  maskBase64: string,
  prompt: string,
  negativePrompt?: string
): Promise<InpaintResult> {
  const apiKey = process.env.STABILITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('STABILITY_API_KEY is not configured. Please add your Stability AI API key in the Secrets tab.');
  }

  console.log('[Stability] Starting inpaint request...');
  console.log('[Stability] Prompt:', prompt);
  console.log('[Stability] Image size:', imageBase64.length);
  console.log('[Stability] Mask size:', maskBase64.length);

  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const maskBuffer = Buffer.from(maskBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: 'image.png',
    contentType: imageMimeType || 'image/png'
  });
  formData.append('mask', maskBuffer, {
    filename: 'mask.png',
    contentType: 'image/png'
  });
  formData.append('prompt', prompt);
  formData.append('output_format', 'png');
  
  if (negativePrompt) {
    formData.append('negative_prompt', negativePrompt);
  }

  try {
    const response = await fetch(STABILITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*',
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Stability] API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('Invalid Stability AI API key. Please check your API key in the Secrets tab.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient Stability AI credits. Please add credits to your account.');
      }
      if (response.status === 400) {
        throw new Error(`Invalid request: ${errorText}`);
      }
      
      throw new Error(`Stability AI error (${response.status}): ${errorText}`);
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    
    console.log('[Stability] Inpaint successful, result size:', base64.length);

    return {
      imageData: base64,
      mimeType: 'image/png'
    };
  } catch (error: any) {
    console.error('[Stability] Inpaint error:', error);
    throw error;
  }
}

export async function searchAndReplace(
  imageBase64: string,
  imageMimeType: string,
  searchPrompt: string,
  replacePrompt: string
): Promise<InpaintResult> {
  const apiKey = process.env.STABILITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('STABILITY_API_KEY is not configured. Please add your Stability AI API key in the Secrets tab.');
  }

  console.log('[Stability] Starting search-and-replace...');
  console.log('[Stability] Search:', searchPrompt);
  console.log('[Stability] Replace:', replacePrompt);

  const imageBuffer = Buffer.from(imageBase64, 'base64');

  const formData = new FormData();
  formData.append('image', imageBuffer, {
    filename: 'image.png',
    contentType: imageMimeType || 'image/png'
  });
  formData.append('prompt', replacePrompt);
  formData.append('search_prompt', searchPrompt);
  formData.append('output_format', 'png');

  try {
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/edit/search-and-replace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*',
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Stability] Search-and-replace error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('Invalid Stability AI API key. Please check your API key in the Secrets tab.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient Stability AI credits. Please add credits to your account.');
      }
      
      throw new Error(`Stability AI error (${response.status}): ${errorText}`);
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    
    console.log('[Stability] Search-and-replace successful');

    return {
      imageData: base64,
      mimeType: 'image/png'
    };
  } catch (error: any) {
    console.error('[Stability] Search-and-replace error:', error);
    throw error;
  }
}
