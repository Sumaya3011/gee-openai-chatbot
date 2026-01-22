import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -------- AI tools (logical actions) --------
const tools = [
  {
    type: 'function',
    function: {
      name: 'set_years',
      description: 'Set start and end years for analysis',
      parameters: {
        type: 'object',
        properties: {
          yearA: { type: 'integer' },
          yearB: { type: 'integer' }
        },
        required: ['yearA', 'yearB']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'export_timelapse',
      description: 'Export a timelapse video',
      parameters: {
        type: 'object',
        properties: {
          yearA: { type: 'integer' },
          yearB: { type: 'integer' }
        },
        required: ['yearA', 'yearB']
      }
    }
  }
];

// -------- Convert tool calls to actions --------
function toolCallToAction(toolCall) {
  const args = JSON.parse(toolCall.function.arguments || '{}');

  if (toolCall.function.name === 'set_years') {
    return { type: 'set_years', ...args };
  }

  if (toolCall.function.name === 'export_timelapse') {
    return { type: 'export_timelapse', ...args };
  }

  return { type: 'unknown' };
}

// -------- Chat endpoint --------
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const first = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a GIS assistant for a Google Earth Engine app. ' +
            'If the user asks to do something, use tools.'
        },
        { role: 'user', content: userMessage }
      ],
      tools,
      tool_choice: 'auto'
    });

    const msg = first.choices[0].message;
    let actions = [];
    let reply = '';

    if (msg.tool_calls) {
      actions = msg.tool_calls.map(toolCallToAction);

      const second = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: userMessage },
          msg,
          {
            role: 'tool',
            content: JSON.stringify(actions)
          }
        ]
      });

      reply = second.choices[0].message.content;
    } else {
      reply = msg.content;
    }

    res.json({ reply, actions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- Health check --------
app.get('/', (req, res) => {
  res.send('AI backend is running');
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
