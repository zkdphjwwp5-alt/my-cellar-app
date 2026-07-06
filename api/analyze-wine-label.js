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
            content: [
              {
                type: 'input_text',
                text: 'You identify wine bottle labels. Return only valid JSON with these exact keys: producer, wine_name, vintage, country, region, appellation, colour, confidence. Use empty strings if unknown. Confidence is a number from 0 to 1.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Identify this wine label.' },
              { type: 'input_image', image_url: image }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    console.log('OpenAI raw response:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'OpenAI request failed.'
      });
    }

    const text =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      data.output?.[1]?.content?.[0]?.text ||
      '';

    console.log('Extracted text:', text);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(200).json({
        producer: '',
        wine_name: '',
        vintage: '',
        country: '',
        region: '',
        appellation: '',
        colour: '',
        confidence: 0,
        raw_text: text
      });
    }

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
    console.error('Function error:', error);
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
