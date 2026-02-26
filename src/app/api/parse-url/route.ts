import { generateJsonText, generateJsonVision, RequestAIConfig } from "@/lib/aiClient";
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch and parse a URL for nutritional information.
 * Strategy:
 * 1. Fetch the page HTML with a browser-like User-Agent
 * 2. Extract text content (product descriptions, nutrition tables)
 * 3. Extract image URLs (potential nutrition labels)
 * 4. Send text to Gemini for structured extraction
 * 5. If nutrition images found, also use Gemini vision to read labels
 * 6. Return the most accurate result
 */
export async function POST(req: Request) {
  try {
    const { url, aiConfig } = await req.json() as { url?: string; aiConfig?: RequestAIConfig };
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Step 1: Fetch the page
    let pageText = "";
    const nutritionImageUrls: string[] = [];

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, nav, footer for cleaner text
        $("script, style, nav, footer, header, .nav, .footer, .header, .sidebar, .menu, .ad, .ads").remove();

        // Extract text content (limit to reasonable size)
        pageText = $("body").text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);

        // Look for nutrition-related images
        $("img").each((_, el) => {
          const src = $(el).attr("src") || "";
          const alt = ($(el).attr("alt") || "").toLowerCase();
          const className = ($(el).attr("class") || "").toLowerCase();
          const parentText = $(el).parent().text().toLowerCase();

          // Check if image might be a nutrition label
          const isNutritionImage =
            alt.includes("nutrition") ||
            alt.includes("supplement") ||
            alt.includes("facts") ||
            alt.includes("label") ||
            className.includes("nutrition") ||
            parentText.includes("nutrition facts") ||
            parentText.includes("supplement facts") ||
            src.includes("nutrition") ||
            src.includes("label");

          if (isNutritionImage && src) {
            // Resolve relative URLs
            try {
              const absoluteUrl = new URL(src, url).href;
              nutritionImageUrls.push(absoluteUrl);
            } catch {
              // Skip malformed URLs
            }
          }
        });

        // Also look at all product images (for Amazon, etc.)
        $("img[data-a-dynamic-image], img[data-old-hires], img.a-dynamic-image").each((_, el) => {
          const src = $(el).attr("data-old-hires") || $(el).attr("src") || "";
          if (src) {
            try {
              const absoluteUrl = new URL(src, url).href;
              if (!nutritionImageUrls.includes(absoluteUrl)) {
                nutritionImageUrls.push(absoluteUrl);
              }
            } catch {
              // Skip
            }
          }
        });
      }
    } catch (fetchError) {
      console.log("Could not fetch page, will rely on AI knowledge:", fetchError);
    }

    // Step 3: Try vision-based extraction if we found nutrition images
    let visionResult = null;
    if (nutritionImageUrls.length > 0) {
      try {
        // Limit to first 3 images to avoid overwhelming the API
        const imagesToAnalyze = nutritionImageUrls.slice(0, 3);
        
        const imageParts = await Promise.all(
          imagesToAnalyze.map(async (imgUrl) => {
            try {
              const imgResponse = await fetch(imgUrl, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(5000),
              });
              const buffer = await imgResponse.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
              return {
                inlineData: { data: base64, mimeType }
              };
            } catch {
              return null;
            }
          })
        );

        const validParts = imageParts.filter((p): p is { inlineData: { data: string; mimeType: string } } => p !== null);
        
        if (validParts.length > 0) {
          const visionPrompt = `
            Look at these product images carefully. If any image contains a Nutrition Facts label or Supplement Facts label, extract the EXACT values from the label.
            
            Return a JSON object with:
            {
              "name": "Product name",
              "serving_size": "serving size as stated on label",
              "calories": number (per serving),
              "protein": number (grams per serving),
              "carbs": number (grams total carbohydrates per serving),
              "fats_total": number (grams total fat per serving),
              "fiber": number (grams dietary fiber per serving),
              "sugars_total": number (grams total sugars per serving),
              "rationale": "Extracted from nutrition facts label in product image",
              "source": "vision"
            }
            
            If NO nutrition label is visible in any image, return: {"source": "none"}
            Provide ONLY the JSON. No markdown, no backticks.
          `;

          const visionText = await generateJsonVision(
            visionPrompt,
            validParts.map((part) => ({
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
            })),
            aiConfig
          );

          const visionData = JSON.parse(visionText);
          if (visionData.source !== "none" && visionData.calories) {
            visionResult = visionData;
          }
        }
      } catch (visionError) {
        console.log("Vision extraction failed, falling back to text:", visionError);
      }
    }

    // Step 4: Text-based extraction (always try as backup/primary)
    let textResult = null;
    const textPrompt = `
      Extract nutritional information from this food/product page.
      
      URL: ${url}
      ${pageText ? `\nPage Content:\n${pageText}` : "\nCould not fetch page content. Use your knowledge of this product/URL to provide the best estimate."}
      
      Find the nutrition facts PER SERVING and return a JSON object with:
      {
        "name": "Name of the food/product",
        "serving_size": "serving size if found",
        "calories": number (per serving),
        "protein": number (grams),
        "carbs": number (grams),
        "fats_total": number (grams),
        "fiber": number (grams),
        "sugars_total": number (grams),
        "rationale": "Briefly explain how you derived these numbers",
        "source": "text"
      }
      Provide ONLY the JSON. No markdown formatting, no backticks, no explanation.
    `;

    const textJsonText = await generateJsonText(textPrompt, aiConfig);

    try {
      textResult = JSON.parse(textJsonText);
    } catch {
      console.error("Text parse failed:", textJsonText);
    }

    // Step 5: Pick the best result (prefer vision when available)
    const result = visionResult || textResult;
    
    if (!result) {
      return NextResponse.json({ 
        error: "Failed to parse AI response", 
        details: "Could not extract nutritional information from this URL." 
      }, { status: 500 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("URL Parse error:", error);
    return NextResponse.json({ 
      error: "AI Request Failed", 
      details: error.message || "An unexpected error occurred."
    }, { status: 500 });
  }
}
