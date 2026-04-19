import { GoogleGenAI } from "@google/genai";

// A global style suffix to force consistency between background and objects
const GLOBAL_STYLE_ENFORCER = ", minimalist flat 2D vector graphic art style, clean lines, straight-on front-facing view, NO 3D depth, NO perspective, NO tilt. Solid flat colors.";

async function removeWhiteBackground(base64Url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(base64Url);
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple luma extraction for near-white pixels to create anti-aliased transparency
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // If the color is very close to white
        if (r > 230 && g > 230 && b > 230) {
          // Soft blending for anti-aliasing around edges
          const avg = (r + g + b) / 3;
          if (avg >= 250) {
            data[i+3] = 0; // Pure transparent for absolute white
          } else {
            // Partial transparency for edge pixels
            const alpha = Math.floor(((250 - avg) / 20) * 255);
            data[i+3] = alpha;
          }
        }
      }
      
      // 2. Identify the tightest bounding box of non-transparent pixels
      let minY = canvas.height, maxY = 0, minX = canvas.width, maxX = 0;
      let hasVisiblePixels = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            hasVisiblePixels = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!hasVisiblePixels) return resolve(base64Url);

      // Add a small 2px padding to avoid harsh edge cutting
      const padding = 2;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(canvas.width - cropX, (maxX - minX) + padding * 2);
      const cropH = Math.min(canvas.height - cropY, (maxY - minY) + padding * 2);

      // 3. Create a temporary canvas for the cropped version
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext("2d");
      if (!croppedCtx) return resolve(base64Url);

      // We need to write the processed imageData back to the original canvas before drawing to cropped
      ctx.putImageData(imageData, 0, 0);
      croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      resolve(croppedCanvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to process image for transparency"));
    img.src = base64Url;
  });
}

export async function generateImage(prompt: string, isObject: boolean = false): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const objectRequirement = isObject ? " on a pure solid #FFFFFF white background. " : "";
    const finalPrompt = prompt.includes("vector") ? prompt : `${prompt}.${objectRequirement}${GLOBAL_STYLE_ENFORCER}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Fast, native image model
      contents: finalPrompt,
      config: {}
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        let rawBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        
        // Process transparency if it's a draggable object
        if (isObject) {
           return await removeWhiteBackground(rawBase64);
        }
        
        return rawBase64;
      }
    }
    
    throw new Error("No image data was returned from the model.");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
}

