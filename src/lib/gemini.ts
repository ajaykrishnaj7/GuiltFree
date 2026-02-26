import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_AI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Dynamically finds the best available model that supports generateContent.
 * Prefers flash models for speed, then pro models.
 */
export async function getBestModel() {
  try {
    // List available models using the API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await response.json();
    
    if (!data.models || data.models.length === 0) {
      throw new Error("No models returned from Google AI API.");
    }

    const models = data.models as any[];
    
    // Filter for models that support generating content
    const supportedModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
    
    // Sort by preference: 1.5-flash -> 1.5-pro -> others
    const bestModel = supportedModels.find(m => m.name.includes("gemini-1.5-flash")) 
                   || supportedModels.find(m => m.name.includes("gemini-1.5-pro"))
                   || supportedModels[0];

    if (!bestModel) throw new Error("No supported models found.");

    console.log(`Using dynamically selected model: ${bestModel.name}`);
    return genAI.getGenerativeModel({ model: bestModel.name });
  } catch (error) {
    console.error("Failed to dynamically discover models, falling back to default:", error);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
}
