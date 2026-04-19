import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SceneGenerationDraft {
  backgroundPrompt: string;
  items: {
    id: string;
    label: string;
    prompt: string;
  }[];
  dropZones: {
    id: string;
    label: string;
    acceptedItemId: string;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    quadPoints?: number[]; // [tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y]
  }[];
}

const sceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    backgroundPrompt: {
      type: Type.STRING,
      description: "A highly detailed image generation prompt for the background scene. It MUST NOT contain any of the interactable objects, as they will be placed later. E.g., 'A warm, well-lit empty wooden desk near a window, sunset lighting, DSLR photography'."
    },
    items: {
      type: Type.ARRAY,
      description: "The objects that the user will drag and drop.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique identifier, e.g., 'item_books'" },
          label: { type: Type.STRING, description: "Display name for the item, e.g., 'Darija Books'" },
          prompt: {
            type: Type.STRING,
            description: "An image generation prompt for this specific object on a pure white background. It MUST match the lighting and perspective of the background scene perfectly so it can be cleanly extracted and look natural when placed on top."
          }
        },
        required: ["id", "label", "prompt"]
      }
    },
    dropZones: {
      type: Type.ARRAY,
      description: "The targeted locations on the background image where items belong based on their spatial descriptions.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique identifier for the zone, e.g., 'zone_books'" },
          label: { type: Type.STRING, description: "Display name for the zone, e.g., 'On Top of Table'" },
          acceptedItemId: { type: Type.STRING, description: "The id of the item that belongs here" },
          xPct: { type: Type.NUMBER, description: "X coordinate percentage (0-100) of the drop zone (0 is left, 100 is right)" },
          yPct: { type: Type.NUMBER, description: "Y coordinate percentage (0-100) of the drop zone (0 is top, 100 is bottom)" },
          widthPct: { type: Type.NUMBER, description: "Estimated width percentage (0-100) of the zone" },
          heightPct: { type: Type.NUMBER, description: "Estimated height percentage (0-100) of the zone" },
          quadPoints: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Perspective distortion points [tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y] defined as percents RELATIVE to the zone's bounding box (0-100). Use this to warp items (e.g., carpets on the floor should look like trapezoids: Top points closer together, bottom points wider)."
          }
        },
        required: ["id", "label", "acceptedItemId", "xPct", "yPct", "widthPct", "heightPct"]
      }
    }
  },
  required: ["backgroundPrompt", "items", "dropZones"]
};

export async function generateSceneFromText(description: string): Promise<SceneGenerationDraft> {
  const prompt = `
You are a "Scene Architect". Transform the following text into a structured 2D game layout.

INPUT DESCRIPTION:
"${description}"

TASK:
1. Identify all tangible objects (carpet, sofa, books, etc.).
2. Create 'dropZone' percentages (0-100) for each.
3. Define 'quadPoints' if an object needs perspective distortion (e.g. carpets, mats, or flat items on tilted surfaces).
4. backgroundPrompt: Describe the scenery ONLY (no objects).
5. items: Prompts for each object on white background.

QUAD POINTS LOGIC:
- If an object is "on the floor" (like a carpet), the quadPoints[0,1,2,3,4,5,6,7] should define a trapezoid to simulate perspective. 
- Example for a floor carpet: [20,0, 80,0, 100,100, 0,100] (pinches the top towards the horizon).
- For vertical items like TVs or posters, use the default: [0,0, 100,0, 100,100, 0,100].

CRITICAL PERSPECTIVE RULE:
To ensure objects don't look like a disjointed collage, you MUST enforce a "Flat minimalist 2D vector illustration, strict orthographic projection, straight-on angle" style in EVERY single prompt (both background and items). Even if you define quad-warping, the base image should be flat.

COORDINATES: Top-left is (0,0). Min zone size 10%. Objects must map EXPLICITLY to zones via acceptedItemId.`;

  // Initialize inside function to ensure environment variables are ready
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const startTime = Date.now();
  console.log("Starting AI Scene Generation...");

  try {
    // Create a controller to handle potential hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out after 60s. Please try again.")), 60000);
    });

    const aiPromise = ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', // MUST use this model as it's the only one with valid API scopes in this environment
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: sceneSchema,
        temperature: 0.1, 
      }
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`AI Scene Generation completed in ${duration.toFixed(2)}s`);

    if (!response.text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(response.text) as SceneGenerationDraft;
    
    if (!parsed.items || parsed.items.length === 0) {
      throw new Error("No objects were identified in your description. Please be more specific about tangible objects.");
    }

    return parsed;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`AI Scene Generation failed after ${duration.toFixed(2)}s:`, error);
    throw error;
  }
}
