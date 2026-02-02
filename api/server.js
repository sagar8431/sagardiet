// -----------------------------
// SmartChef Backend - server.js
// (This code is correct and bug-free)
// -----------------------------

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// -----------------------------
// 🧑‍🍳 Route: Generate Recipe (OpenRouter)
// -----------------------------
app.post("/api/recipe", async (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!ingredients || ingredients.trim() === "") {
      return res.status(400).json({ error: "Please provide ingredients." });
    }

    console.log("🍳 Generating recipe for:", ingredients);

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Recipe generation failed. OPENROUTER_API_KEY not configured in .env." });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional chef who suggests delicious and easy recipes.",
          },
          {
            role: "user",
            content: `Create a creative and tasty recipe using these ingredients: ${ingredients}. Include preparation steps and serving ideas.`,
          },
        ],
      }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.warn("OpenRouter recipe failed (Status:", response.status, "):", errBody);
        throw new Error(errBody);
    }

    const data = await response.json();
    const recipe =
      data?.choices?.[0]?.message?.content || "No recipe generated.";

    res.json({ success: true, recipe });
  } catch (err) {
    console.error("🔥 Recipe Error:", err);
    res.status(500).json({ error: "Failed to generate recipe." });
  }
});

// -----------------------------
// 🩺 Health Check
// -----------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, provider: (process.env.DIET_PROVIDER || "auto"), port: PORT });
});

// -----------------------------
// 🥗 Route: Healthy Diet Plan (OpenRouter) - EDITED FOR ROBUSTNESS
// -----------------------------
app.post("/api/healthy-diet", async (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!ingredients || ingredients.trim() === "") {
      return res.status(400).json({ error: "Please provide ingredients." });
    }

    console.log("🥦 Generating diet plan for:", ingredients);

    // 1) Try OpenAI directly if configured
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("🥦 Trying OpenAI for diet plan...");
        const oaResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are a certified nutritionist and professional chef. Write approachable, human-sounding diet plans with complete healthy recipes using the provided ingredients. Include tasteful emojis and readable line breaks. Be concise yet specific with actual cooking instructions."
              },
              {
                role: "user",
                content:
                  `Given these ingredients: ${ingredients}.\n\nCreate a one-day healthy diet plan (breakfast, lunch, dinner, and 2 snacks) with complete recipes for each meal. For each meal, provide:\n1. Meal title\n2. List of ingredients (prioritize using the provided ingredients: ${ingredients})\n3. Step-by-step preparation instructions\n4. Approximate calories\n5. Nutritional benefits\n\nMake sure each recipe is healthy, balanced, and actually uses the provided ingredients. Keep it concise and friendly, with emojis and clear line breaks.`
              }
            ]
          })
        });

        if (oaResp.ok) {
          const oaData = await oaResp.json();
          const oaText = oaData?.choices?.[0]?.message?.content;
          if (oaText) {
            // Success with OpenAI, return immediately
            return res.json({ success: true, ingredients, dietPlan: oaText, provider: "openai" });
          }
        } else {
          const errBody = await oaResp.text();
          console.warn("OpenAI diet plan failed (Status:", oaResp.status, "):", errBody);
        }
      } catch (e) {
        console.warn("OpenAI diet plan error (Catch):", e);
      }
    } else {
      console.log("Skipping OpenAI: OPENAI_API_KEY not found in .env.");
    }

    // 2) Fall back to OpenRouter
    if (!process.env.OPENROUTER_API_KEY) {
      // Critical check if the main fallback key is missing
      return res.status(500).json({ error: "Diet plan failed. Neither OPENAI_API_KEY nor OPENROUTER_API_KEY are properly configured in .env." });
    }

    const preferred = process.env.DIET_MODEL ? [process.env.DIET_MODEL] : [];
    const fallbacks = [
      "openai/gpt-4o-mini",
      "openai/gpt-3.5-turbo",
      "mistralai/mistral-7b-instruct",
      "meta-llama/llama-3.1-8b-instruct"
    ];
    const modelsToTry = [...preferred, ...fallbacks];

    let lastError = null;
    for (const model of modelsToTry) {
      console.log("🥦 Trying OpenRouter model:", model);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_TITLE || "SmartChef"
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "You are a certified nutritionist and professional chef. Write approachable, human-sounding diet plans with complete healthy recipes using the provided ingredients. Include tasteful emojis and readable line breaks. Be concise yet specific with actual cooking instructions."
            },
            {
              role: "user",
              content:
                `Given these ingredients: ${ingredients}.\n\nCreate a one-day healthy diet plan (breakfast, lunch, dinner, and 2 snacks) with complete recipes for each meal. For each meal, provide:\n1. Meal title\n2. List of ingredients (prioritize using the provided ingredients: ${ingredients})\n3. Step-by-step preparation instructions\n4. Approximate calories\n5. Nutritional benefits\n\nMake sure each recipe is healthy, balanced, and actually uses the provided ingredients. Keep it concise and friendly, with emojis and clear line breaks.`
            }
          ],
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          // Success with OpenRouter, return immediately
          return res.json({ success: true, ingredients, dietPlan: text, modelUsed: model });
        }
      } else {
        try { 
          // Try to parse error as JSON, fall back to text and status code
          lastError = await response.json(); 
        } catch (_) { 
          lastError = { status: response.status, body: await response.text() }; 
        }
        console.warn("OpenRouter model failed:", model, lastError);
      }
    }

    // Final failure after trying all providers and models
    return res.status(500).json({ error: "Failed to generate healthy diet plan after trying all models.", details: lastError || "All models failed." });
  } catch (err) {
    console.error("🔥 Diet Plan Error (Final Catch):", err);
    res.status(500).json({ error: "An unexpected error occurred while generating the diet plan." });
  }
});

// -----------------------------

// 🖼️ Route: Generate Meal Image (Google Gemini)
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Please provide an image prompt." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ Gemini API key not configured.");
      return res.json({
        success: false,
        image_url: "https://via.placeholder.com/512x512.png?text=Gemini+Image+Unavailable",
      });
    }

    console.log("🖼️ Generating image (Gemini) for:", prompt);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}. Photorealistic food photography, soft lighting, high detail, no text, professional plating.`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.warn("⚠️ Gemini failed:", response.status, err);
      return res.json({
        success: false,
        image_url: "https://via.placeholder.com/512x512.png?text=Gemini+Image+Unavailable",
      });
    }

    const data = await response.json();

    // Gemini returns base64 image data (in some versions)
    const base64Image =
      data?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;

    if (base64Image) {
      res.json({
        success: true,
        image_url: `data:image/png;base64,${base64Image}`,
      });
    } else {
      res.json({
        success: false,
        image_url: "https://via.placeholder.com/512x512.png?text=Gemini+Image+Unavailable",
      });
    }
  } catch (err) {
    console.error("🔥 Gemini Image Generation Error:", err);
    res.json({
      success: false,
      image_url: "https://via.placeholder.com/512x512.png?text=Gemini+Image+Unavailable",
    });
  }
});



// -----------------------------
// 🚀 Start Server
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ SmartChef Server running at http://localhost:${PORT}`);
});