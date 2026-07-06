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

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: 'You identify wine bottle labels. Return only valid JSON. If uncertain, use empty strings and a low confidence value.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Extract producer, wine_name, vintage, country, region, appellation, colour, and confidence from this wine label.'
              },
              {
                type: 'input_image',
                image_url: image
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'wine_label_result',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                producer: { type: 'string' },
                wine_name: { type: 'string' },
                vintage: { type: 'string' },
                country: { type: 'string' },
                region: { type: 'string' },
                appellation: { type: 'string' },
                colour: { type: 'string' },
                confidence: { type: 'number' }
              },
              required: ['producer', 'wine_name', 'vintage', 'country', 'region', 'appellation', 'colour', 'confidence']
            },
            strict: true
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI request failed.'
      });
    }

    const raw = data.output_text || '{}';
    const parsed = JSON.parse(raw);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: String(error?.message || error)
    });
  }
}
