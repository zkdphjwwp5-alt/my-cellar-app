export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set in Vercel.' });
    }

    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Missing image.' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You identify wine bottle labels. Return only JSON with keys: producer, wine_name, vintage, country, region, appellation, colour, confidence. Use empty strings if unknown. Confidence must be 0 to 1.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Identify this wine label.' },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI request failed.'
      });
    }

    const text = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    return res.status(200).json({
      producer: String(parsed.producer || ''),
      wine_name: String(parsed.wine_name || ''),
      vintage: String(parsed.vintage || ''),
      country: String(parsed.country || ''),
      region: String(parsed.region || ''),
      appellation: String(parsed.appellation || ''),
      colour: String(parsed.colour || ''),
      confidence: Number(parsed.confidence || 0)
    });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
