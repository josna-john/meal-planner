require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Proxy endpoint — keeps API key on the server
app.post('/api/generate', async (req, res) => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey || apiKey === 'your-api-key-here') {
    return res.status(500).json({ error: 'Set your CLAUDE_API_KEY in the .env file' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Pantry Meal Planner running at:`);
  console.log(`    Local:   http://localhost:${PORT}`);
  console.log(`    Network: http://192.168.1.149:${PORT}  (open this on your iPhone)\n`);
});
