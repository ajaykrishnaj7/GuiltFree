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
    
    const sanitizeData = (data: any) => {
      const parsed = { ...data };
      ['calories', 'protein', 'carbs', 'fats_total', 'fiber', 'sugars_total'].forEach((key) => {
        if (typeof parsed[key] === 'string') {
          // Removes any letters/symbols and extracts just the float
          const match = parsed[key].match(/[\d.]+/);
          parsed[key] = match ? parseFloat(match[0]) : 0;
        } else if (typeof parsed[key] !== 'number') {
          parsed[key] = 0;
        }
      });
      return parsed;
    };

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

        // Capture any structured Recipe/Nutrition JSON-LD data before destroying scripts
        let jsonLdRaw = "";
        $("script[type='application/ld+json']").each((_, el) => {
          const contents = $(el).html();
          if (contents && (contents.includes("NutritionInformation") || contents.includes("Recipe") || contents.includes("nutrition"))) {
            jsonLdRaw += contents + "\n";
          }
        });

        // Remove scripts, styles, nav, footer for cleaner text
        $("script, style, nav, footer, header, .nav, .footer, .header, .sidebar, .menu, .ad, .ads").remove();

        // Add spaces to block elements to prevent text squashing (e.g. <tr><td>Calories</td><td>100</td></tr> => Calories 100)
        $("br, p, div, tr, th, td, li, h1, h2, h3, h4, h5, h6").append(" ");

        // Extract text content (limit to reasonable size)
        pageText = $("body").text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 12000);
          
        if (jsonLdRaw) {
          pageText = `STRUCTURED PAGE DATA (JSON-LD):\n${jsonLdRaw}\n\nPAGE VISUAL TEXT:\n${pageText}`;
        }


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
        $("img[data-a-dynamic-image], img[data-old-hires], img.a-dynamic-image, img.product-image").each((_, el) => {
          const src = $(el).attr("data-old-hires") || $(el).attr("src") || "";
          if (src && !src.includes("data:image")) {
            try {
              const absoluteUrl = new URL(src, url).href;
              // Push images to the front if they are larger/main viewer images
              if (absoluteUrl.includes("viewer") || absoluteUrl.includes("zoom") || absoluteUrl.includes("hero")) {
                 nutritionImageUrls.unshift(absoluteUrl);
                 return;
              }
              if (!nutritionImageUrls.includes(absoluteUrl)) {
                nutritionImageUrls.push(absoluteUrl);
              }
            } catch {
              // Skip
            }
          }
        });
        
        // Costco specific: product viewer images are usually loaded dynamically, 
        // try to catch them from any obvious sources if any exist
        $(".product-image-container img, .image-viewer img, .product-images img").each((_, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src") || "";
          if (src && !src.includes("data:image")) {
             try {
                const absoluteUrl = new URL(src, url).href;
                if (!nutritionImageUrls.includes(absoluteUrl)) {
                  nutritionImageUrls.unshift(absoluteUrl); // Prioritize explicit product images
                }
             } catch {}
          }
        });

        // Costco CDN generic fallback
        $("img").each((_, el) => {
           const src = $(el).attr("src") || $(el).attr("data-src") || "";
           if (src && src.includes("costco-static.com") && !src.includes("data:image")) {
             try {
               let absoluteUrl = new URL(src, url).href;
               // Costco uses query parameters to return 350x350 blurry thumbnails instead of hi-res images.
               absoluteUrl = absoluteUrl.replace(/&width=\d+&height=\d+&fit=bounds&canvas=\d+,\d+/g, '');
               absoluteUrl = absoluteUrl.replace(/\?width=\d+&height=\d+&fit=bounds&canvas=\d+,\d+/g, '');
               
               if (!nutritionImageUrls.includes(absoluteUrl)) {
                 nutritionImageUrls.unshift(absoluteUrl);
               }
             } catch {}
           }
        });
        
        // Costco lazy loads external images across multiple gallery nodes using "__1", "__2" file naming conventions
        // Intercept any base images and forcibly inject permutations for the AI to check
        const costcoVariations: string[] = [];
        nutritionImageUrls.forEach((imgUrl) => {
           if (imgUrl.includes("__1")) {
              for (let i = 2; i <= 6; i++) {
                 costcoVariations.push(imgUrl.replace("__1", `__${i}`));
              }
           }
        });
        nutritionImageUrls.unshift(...costcoVariations);
        
      }
    } catch (fetchError) {
      console.log("Could not fetch page, will rely on AI knowledge:", fetchError);
    }

    // Step 3: Try vision-based extraction if we found nutrition images
    let visionResult = null;
    if (nutritionImageUrls.length > 0) {
      try {
        // Expand to first 6 images to avoid missing the backside/nutrition label if it's the 4th/5th image in the carousel
        const imagesToAnalyze = nutritionImageUrls.slice(0, 6);
        
        const imageParts = await Promise.all(
          imagesToAnalyze.map(async (imgUrl) => {
            try {
              const imgResponse = await fetch(imgUrl, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(5000),
                cache: 'force-cache'
              });
              if (!imgResponse.ok) return null;
              
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
            
            Return a JSON object with: (ensure all nutritional values are strictly NUMBERS with no 'g' or units attached)
            {
              "scratchpad": "Think step-by-step and locate the exact values on the label. Explain your process here.",
              "name": "Product name",
              "serving_size": "serving size as stated on label",
              "calories": number,
              "protein": number,
              "carbs": number,
              "fats_total": number,
              "fiber": number,
              "sugars_total": number,
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
            visionResult = sanitizeData(visionData);
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
      
      Find the nutrition facts PER SERVING and return a JSON object with: (ensure all nutritional values are strictly NUMBERS with no 'g' or units attached)
      {
        "scratchpad": "Very carefully find the nutrition table in the page text. Map every macro to its value. Show your logic here before writing the final numbers.",
        "name": "Name of the food/product",
        "serving_size": "serving size if found",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fats_total": number,
        "fiber": number,
        "sugars_total": number,
        "rationale": "Briefly explain how you derived these numbers",
        "source": "text"
      }
      Provide ONLY the JSON. No markdown formatting, no backticks, no explanation.
    `;

    const textJsonText = await generateJsonText(textPrompt, aiConfig);

    try {
      textResult = sanitizeData(JSON.parse(textJsonText));
    } catch {
      console.error("Text parse failed:", textJsonText);
    }

    // Step 5: Pick the best result (prefer vision when available)
    const result = visionResult || textResult;
    
    console.log("VISION RESULT:", visionResult);
    console.log("TEXT RESULT:", textResult);
    
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
