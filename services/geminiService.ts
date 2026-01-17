import { 
  GoogleGenAI, 
  GenerateContentResponse,
  LiveServerMessage,
  Modality,
  Type,
  FunctionDeclaration
} from "@google/genai";
import { Ingredient, Recipe, IngredientLocation, ReasoningTrace } from "../types";

// --- API CLIENT ---
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- CHAT SERVICES ---

interface ChatParams {
  history: {role: 'user' | 'model', parts: any[]}[];
  message: string;
  image?: string;
  inventory?: Ingredient[];
  recipes?: Recipe[];
}

export const sendMessageToGemini = async ({ history, message, image, inventory, recipes }: ChatParams) => {
  const client = getClient();
  
  // Default to Flash for speed
  const model = 'gemini-3-flash-preview'; 
  
  // Inventory Tool
  const inventoryTool: FunctionDeclaration = {
    name: 'update_inventory',
    description: 'Add, remove, or update items in the kitchen inventory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { 
          type: Type.STRING, 
          enum: ['add', 'remove', 'update'],
          description: 'Use "add" for new items, "remove" for depleted items, "update" for changing quantity/location of existing items.'
        },
        item_name: { type: Type.STRING },
        quantity: { 
          type: Type.STRING,
          description: 'The quantity with units (e.g. 500g, 2 oz, 1 bottle). If updating, provide the NEW total quantity.'
        },
        expiryDate: {
          type: Type.STRING,
          description: 'ISO Date YYYY-MM-DD if mentioned.'
        },
        location: { type: Type.STRING, enum: ['Fridge', 'Pantry', 'Freezer', 'Spice Rack'] }
      },
      required: ['action', 'item_name']
    }
  };

  // Build Context
  const inventoryContext = inventory 
    ? inventory.map(i => `- ${i.name} (${i.quantity}) in ${i.location}`).join('\n') 
    : "Inventory is empty.";
    
  const recipeContext = recipes && recipes.length > 0
    ? `SAVED RECIPES:\n${recipes.map(r => `- ${r.title}`).join('\n')}`
    : "";

  const systemInstruction = `You are "Yes Chef", a fast and helpful kitchen assistant.
  
  Current System Time: ${new Date().toLocaleString()}
  
  Context:
  - You have access to the user's inventory (below).
  - You have access to the user's saved recipe titles (below).
  
  Capabilities:
  - Check inventory/recipes context before answering.
  - Use 'update_inventory' to manage stock.
  - Use Google Search for *new* recipes or facts.
  - Be concise.
  
  INVENTORY MANAGEMENT RULES:
  1. If the user consumes part of an item (e.g. "I ate half the cheese"), use action='update' and calculate the NEW quantity.
  2. ENFORCE UNITS: Always try to convert vague quantities to standard measurements (grams, oz, ml, cups) where reasonable. Estimate if needed (e.g. "Half block" -> "200g").
  3. If an item is finished completely, use action='remove'.
  
  Formatting Rules:
  - When suggesting a recipe, ALWAYS use the headers "### Ingredients" and "### Instructions".
  - When listing inventory, use the header "### Current Inventory".

  INVENTORY:
  ${inventoryContext}

  ${recipeContext}
  `;

  const config: any = {
    tools: [
      { googleSearch: {} },
      { functionDeclarations: [inventoryTool] }
    ],
    systemInstruction: systemInstruction,
  };

  const chat = client.chats.create({
    model,
    config,
    history: history as any,
  });

  let msgContent: any = message;
  if (image) {
    msgContent = {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: message }
      ]
    };
  }
  
  const response = await chat.sendMessage({ message: msgContent });
  
  // --- Post-Processing for Traces ---
  const text = response.text;
  const traces: ReasoningTrace[] = [];
  const toolCalls: any[] = [];

  // 1. Check Grounding (Web Search)
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks;
  const searchQueries = (groundingMetadata as any)?.webSearchQueries;

  if (groundingChunks && groundingChunks.some((c: any) => c.web)) {
    const query = searchQueries?.[0];
    traces.push({ 
      icon: 'Globe', 
      label: query ? `Searched: "${query}"` : 'Searched the Web', 
      color: 'blue' 
    });
  }
  
  const sources = groundingChunks?.map((chunk: any) => chunk.web).filter(Boolean).map((w: any) => ({
    title: w.title,
    uri: w.uri
  })) || [];

  // 2. Check Tool Calls (Inventory)
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args
      });
      
      if (part.functionCall.name === 'update_inventory') {
        const action = part.functionCall.args['action'];
        const item = part.functionCall.args['item_name'];
        
        let color = 'stone';
        let label = 'Inventory';
        
        if (action === 'add') { color = 'green'; label = `Added: ${item}`; }
        else if (action === 'remove') { color = 'orange'; label = `Removed: ${item}`; }
        else if (action === 'update') { color = 'cyan'; label = `Updated: ${item}`; }

        traces.push({ icon: 'Database', label, color });
      }
    }
  }

  // 3. Implicit Traces (Context usage heuristics)
  
  // Check if a recipe was referenced
  if (recipes && recipes.length > 0) {
    const lowerMsg = message.toLowerCase();
    const referencedRecipe = recipes.find(r => lowerMsg.includes(r.title.toLowerCase()));
    if (referencedRecipe) {
      traces.push({ icon: 'BookOpen', label: `Read Recipe: ${referencedRecipe.title}`, color: 'violet' });
    }
  }

  // Check if inventory was consulted
  // If the query mentions "have" or "fridge" and we didn't search web, we likely checked inventory context
  if (!traces.some(t => t.icon === 'Globe') && (message.toLowerCase().includes('have') || message.toLowerCase().includes('stock'))) {
    let label = 'Checked Inventory';
    const lower = message.toLowerCase();
    if (lower.includes('fridge')) label = 'Checked: Fridge';
    else if (lower.includes('pantry')) label = 'Checked: Pantry';
    else if (lower.includes('freezer')) label = 'Checked: Freezer';
    else if (lower.includes('spice')) label = 'Checked: Spices';

    traces.push({ icon: 'Refrigerator', label, color: 'stone' });
  }

  return {
    text,
    sources,
    toolCalls,
    traces
  };
};

// --- VISION SERVICE ---

export const analyzeFridgeImage = async (base64Image: string): Promise<Ingredient[]> => {
  const client = getClient();
  
  const prompt = `Analyze this image of a fridge or pantry. 
  Extract all identifiable ingredients. 
  Return a JSON array where each item has: 
  - name (string)
  - quantity (estimated string, e.g., "1 bottle", "half full")
  - expiryDate (estimate a date 1 week from today ${new Date().toISOString().split('T')[0]} unless visible, format YYYY-MM-DD)
  - location (one of: Fridge, Pantry, Freezer, Spice Rack. Guess based on context).`;

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-preview', // Keep Pro for vision as it requires high detail
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            location: { type: Type.STRING, enum: [IngredientLocation.FRIDGE, IngredientLocation.PANTRY, IngredientLocation.FREEZER, IngredientLocation.SPICE_RACK] }
          }
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '[]');
    return data.map((item: any, idx: number) => ({
      ...item,
      id: `scanned-${Date.now()}-${idx}`
    }));
  } catch (e) {
    console.error("Failed to parse vision response", e);
    return [];
  }
};

// --- RECIPE GENERATION ---

export const saveSessionAsRecipe = async (chatHistoryText: string): Promise<Recipe> => {
  const client = getClient();
  // Using Flash for speed and reliability in JSON generation
  const prompt = `Based on the following cooking conversation, extract a structured recipe. 
  If details are missing, infer reasonable defaults or leave simple placeholders.
  
  Conversation: ${chatHistoryText}`;

  const response = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.STRING }
        }
      }
    }
  });

  let data;
  try {
    data = JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse recipe JSON", e);
    data = {};
  }

  return {
    id: `recipe-${Date.now()}`,
    dateAdded: new Date().toISOString(),
    title: data.title || "Untitled Session Recipe",
    ingredients: data.ingredients || [],
    steps: data.steps || [],
    notes: data.notes || ""
  };
};

// --- LIVE API AUDIO UTILS ---

export function createPcmBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const connectLiveSession = async (
  onOpen: () => void,
  onMessage: (msg: LiveServerMessage) => void,
  onClose: () => void,
  onError: (err: any) => void
) => {
  const client = getClient();
  return client.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: onOpen,
      onmessage: onMessage,
      onclose: onClose,
      onerror: onError,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
      },
      systemInstruction: `You are Yes Chef, a helpful, hands-free cooking assistant. Current time: ${new Date().toLocaleString()}. Keep answers brief and actionable as the user is likely cooking.`,
    }
  });
};
