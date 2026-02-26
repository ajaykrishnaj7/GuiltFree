import { generateJsonText, RequestAIConfig } from "@/lib/aiClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, aiConfig } = await req.json() as { text?: string; aiConfig?: RequestAIConfig };

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const prompt = `
      Extract a list of ingredients and their nutritional information from the following recipe text.
      For each ingredient, estimate the calories, protein, carbs, fats, fiber, and sugars based on the specified quantity.
      
      Output ONLY a JSON array of objects with the following structure:
      {
        "ingredients": [
          {
            "name": "string", (e.g., "Large Egg", "All-purpose Flour", "Unsalted Butter")
            "quantity": number, (numeric value, e.g., 2 for "2 eggs", 0.5 for "half cup")
            "unit": "string", (e.g., "pcs", "cup", "g", "tbsp")
            "calories": number,
            "protein": number,
            "fiber": number,
            "carbs": number,
            "fats_total": number,
            "sugars_total": number
          }
        ]
      }

      Recipe Text: "${text}"

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
    console.error("AI Recipe Parse Error:", error);
    return NextResponse.json({ error: error.message || "Request failed" }, { status: 500 });
  }
}
