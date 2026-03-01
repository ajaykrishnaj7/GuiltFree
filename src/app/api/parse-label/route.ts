import { generateJsonVision, RequestAIConfig } from "@/lib/aiClient";
import { NextResponse } from "next/server";

/**
 * Parse a nutrition label image using Gemini Vision.
 * Accepts base64 image data, sends to Gemini for extraction.
 * No image is stored — process and discard.
 */
export async function POST(req: Request) {
  try {
    const { image, mimeType, aiConfig } = await req.json() as { image?: string; mimeType?: string; aiConfig?: RequestAIConfig };

    if (!image) {
      return NextResponse.json({ error: "Image data is required" }, { status: 400 });
    }

    const prompt = `
      Analyze this image. If it contains a Nutrition Facts label or Supplement Facts label, extract the EXACT values from the label.
      
      Return a JSON object with: (ensure all nutritional values are strictly NUMBERS with no 'g' or units attached)
      {
        "name": "Product name if visible, otherwise 'Nutrition Label'",
        "serving_size": "serving size as stated on label",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fats_total": number,
        "fiber": number,
        "sugars_total": number,
        "rationale": "Extracted from nutrition facts label in uploaded image"
      }
      
      If the image does NOT contain a nutrition label, return:
      {
        "error": "No nutrition label detected in this image. Please upload a clear photo of a Nutrition Facts or Supplement Facts label."
      }
      
      Provide ONLY the JSON. No markdown formatting, no backticks, no explanation.
    `;

    const jsonText = await generateJsonVision(prompt, [
      {
        data: image,
        mimeType: mimeType || "image/jpeg",
      },
    ], aiConfig);

    try {
      const data = JSON.parse(jsonText);
      return NextResponse.json(data);
    } catch {
      console.error("Label Parse JSON Error. Raw text:", jsonText);
      return NextResponse.json({ 
        error: "Failed to parse AI response", 
        details: "The AI returned invalid JSON." 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Label Parse error:", error);
    return NextResponse.json({ 
      error: "AI Request Failed", 
      details: error.message || "An unexpected error occurred."
    }, { status: 500 });
  }
}
