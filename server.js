// server.js - uses global fetch available in Node 18+
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY in env. Set it in Render environment variables.");
  process.exit(1);
}

// Function definitions for OpenAI to choose from
const functions = [
  {
    name: "showNDVI",
    description: "Show NDVI for an area and date range",
    parameters: {
      type: "object",
      properties: {
        area: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" }
      },
      required: ["area","startDate","endDate"]
    }
  }
];

app.post("/chat", async (req, res) => {
  try {
    const userText = req.body.text || "";
    if (!userText) return res.status(400).json({ error: "text required" });

    // Use the global fetch (Node 18+). No node-fetch import needed.
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an assistant that returns a function name and JSON args to control a Google Earth Engine client." },
        { role: "user", content: userText }
      ],
      functions,
      function_call: "auto",
      max_tokens: 300
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: "OpenAI error", details: text });
    }

    const data = await r.json();
    const message = data.choices?.[0]?.message;
    if (!message) return res.status(500).json({ error: "no message from model", raw: data });

    if (message.function_call) {
      const fname = message.function_call.name;
      let fargs = {};
      try { fargs = JSON.parse(message.function_call.arguments || "{}"); }
      catch (e) {
        return res.json({ function_call: { name: fname, arguments_raw: message.function_call.arguments } });
      }
      return res.json({ function_call: { name: fname, arguments: fargs } });
    }

    return res.json({ text: message.content || "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
