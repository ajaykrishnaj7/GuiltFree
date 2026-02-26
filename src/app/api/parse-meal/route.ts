import { generateJsonText, RequestAIConfig } from "@/lib/aiClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, aiConfig } = await req.json() as { text?: string; aiConfig?: RequestAIConfig };

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const prompt = `
      Analyze the following food description and provide a detailed nutritional breakdown in JSON format.
      The output should be an array of "meals".

      CRITICAL RULES FOR COMBINING vs. SPLITTING:
      1. When the user describes a SINGLE PREPARED DISH (e.g., "omelette with eggs and cheese", "chicken breast pan-fried with oil and spices", "pasta with sauce"), return it as ONE item with COMBINED macros for the entire finished dish. The item name should be the dish name (e.g., "Pan-Fried Chicken Breast", "Cheese Omelette", "Pasta Bolognese"). Do NOT split a single cooked dish into its raw ingredients.
      2. Spices, seasonings, salt, pepper, and negligible-calorie ingredients should be ABSORBED into the main dish item, not listed separately.
      3. Cooking oils should be INCLUDED in the main dish's macros, not listed as a separate item.
      4. Only create MULTIPLE items when the user explicitly describes SEPARATE, independently eaten foods (e.g., "chicken breast with a side salad and rice" = 3 items; "eggs for breakfast and salmon for dinner" = 2 separate meals).
      5. If the user describes multiple DISTINCT meals in one prompt (e.g., different meal times), split them into separate meal objects in the array.
      
      Each meal object should follow this schema:
      {
        "meal_name": "string", (e.g. "Pan-Fried Chicken", "Cheese Omelette", "After-work Snack")
        "meal_type": "string", (MUST be one of: "Breakfast", "Lunch", "Dinner", "Snack")
        "items": [
          {
            "name": "string",
            "quantity": number,
            "unit": "string",
            "display_name": "string",
            "rationale": "string", (briefly explain your macro calculation, mention absorbed ingredients like oils/spices)
            "calories": number,
            "protein": number,
            "fiber": number,
            "fats": { "saturated": number, "unsaturated": number, "total": number },
            "carbs": number,
            "sugars": { "natural": number, "added": number, "total": number }
          }
        ]
      }

      Description: "${text}"

      IMPORTANT: If the user provides multiple meals in one sentence, split them into separate objects in the array.
      If it's just one meal, the array will have one object.
      Remember: A single cooked/prepared dish should be ONE item with combined macros, NOT split into raw ingredients.
      Provide ONLY the JSON. No markdown formatting, no backticks, no explanation.
    `;

    const jsonText = await generateJsonText(prompt, aiConfig);

    try {
      const data = JSON.parse(jsonText);
      return NextResponse.json(data);
    } catch {
      console.error("JSON Parse Error. Raw text:", jsonText);
      return NextResponse.json({ 
        error: "Failed to parse AI response", 
        details: "The AI returned invalid JSON." 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("AI Error:", error);
    return NextResponse.json({ 
      error: "AI Request Failed", 
      details: error.message || "An unexpected error occurred."
    }, { status: 500 });
  }
}
