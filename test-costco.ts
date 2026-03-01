import * as cheerio from "cheerio";

const url = "https://www.costcobusinessdelivery.com/pepperidge-farm-15-grain-whole-grain-bread%2C-24-oz%2C-2-ct.product.100155870.html";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testFetch() {
  const nutritionImageUrls: string[] = [];
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      console.log("HTML length:", html.length);
      console.log("Includes Cloudflare:", html.includes("Cloudflare"));
      console.log("Includes Access Denied:", html.includes("Access Denied"));
      // print first 500 chars
      $(".product-image-container img, .image-viewer img, .product-images img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (src && !src.includes("data:image")) {
          try {
            const absoluteUrl = new URL(src, url).href;
            if (!nutritionImageUrls.includes(absoluteUrl)) {
              nutritionImageUrls.unshift(absoluteUrl);
            }
          } catch {}
        }
      });

      $("img").each((_, el) => {
         const src = $(el).attr("src") || $(el).attr("data-src") || "";
         if (src && src.includes("costco-static.com") && !src.includes("data:image")) {
           try {
             const absoluteUrl = new URL(src, url).href;
             if (!nutritionImageUrls.includes(absoluteUrl)) {
               nutritionImageUrls.unshift(absoluteUrl);
             }
           } catch {}
         }
      });
      
      console.log("Found Images:", nutritionImageUrls);
    } else {
        console.log("Fetch failed", response.status, response.statusText);
    }
  } catch (err) {
    console.error(err);
  }
}

testFetch();
