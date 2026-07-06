export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Missing image' });

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
            content: 'Extract wine label data. Return only JSON with producer, wine_name, vintage, country, region, appellation, colour, confidence.'
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Identify this wine label.' },
              { type: 'input_image', image_url: image }
            ]
          }
        ],
        text: { format: { type: 'json_object' } }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'OpenAI request failed' });

    return res.status(200).json(JSON.parse(data.output_text || '{}'));
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
