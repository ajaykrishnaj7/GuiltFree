import { generateJsonText, RequestAIConfig } from "@/lib/aiClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, instructions, aiConfig } = await req.json() as { name?: string; instructions?: string; aiConfig?: RequestAIConfig };

    if (!instructions) {
      return NextResponse.json({ error: "Instructions are required" }, { status: 400 });
    }

    const prompt = `
      Analyze the following recipe and estimate its nutritional information for ONE standard serving.
      
      Recipe Name: "${name || 'Unnamed Recipe'}"
      Instructions: "${instructions}"

      Based on these instructions, determine a realistic "standard serving" (e.g., "250g", "1 bowl", "2 pancakes", "1 medium potato").
      Then, estimate the total calories, protein, carbs, fats, fiber, and sugar for THAT SPECIFIC serving.

      Output ONLY a JSON object with the following structure:
      {
        "serving_size": "string", (e.g., "250g" or "1 medium")
        "calories": number,
        "protein": number,
        "fiber": number,
        "carbs": number,
        "fats_total": number,
        "sugars_total": number,
        "explanation": "string" (briefly explain why you chose this serving size and macro estimate)
      }

      Provide ONLY the JSON. No markdown, no backticks, no preamble.
    `;

    const jsonText = await generateJsonText(prompt, aiConfig);

    try {
      const data = JSON.parse(jsonText);
      return NextResponse.json(data);
    } catch {
      console.error("JSON Parse Error. Raw text:", jsonText);
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("AI Recipe Estimation Error:", error);
    return NextResponse.json({ error: error.message || "Request failed" }, { status: 500 });
  }
}
