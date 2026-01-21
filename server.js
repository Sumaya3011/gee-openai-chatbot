import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;

app.post("/chat", async (req, res) => {
  const userText = req.body.text;

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Choose which GEE function to call." },
          { role: "user", content: userText }
        ],
        functions: [
          {
            name: "showNDVI",
            parameters: {
              type: "object",
              properties: {
                area: { type: "string" },
                startDate: { type: "string" },
                endDate: { type: "string" }
              }
            }
          }
        ],
        function_call: "auto"
      })
    }
  );

  const data = await response.json();
  res.json(data.choices[0].message);
});

app.listen(3000);
