async function runTest() {
  const url = "https://www.costcobusinessdelivery.com/pepperidge-farm-15-grain-whole-grain-bread%2C-24-oz%2C-2-ct.product.100155870.html";
  try {
    const res = await fetch("http://localhost:3000/api/parse-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, aiConfig: { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: process.env.GEMINI_API_KEY || '' } }) // Note: might not have key if not passed
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("BODY:", text);
  } catch (err) {
    console.error(err);
  }
}
runTest();
