exports.handler = async function(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not set in Netlify environment variables' } })
    };
  }

  try {
    const body = JSON.parse(event.body);

    // Web search mode — triggered by use_web_search flag
    const useWebSearch = !!body.use_web_search;
    if (useWebSearch) {
      delete body.use_web_search;
      body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
      body.max_tokens = body.max_tokens || 4000;
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    };

    if (useWebSearch) {
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Extract all text blocks into a single _extracted_text field
    if (data.content && Array.isArray(data.content)) {
      data._extracted_text = data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { message: error.message } })
    };
  }
};
