interface Env {
  AI: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route API requests
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const { prompt } = await request.json() as { prompt: string };

        if (!prompt) {
          return new Response(JSON.stringify({ error: 'No prompt provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const systemPrompt = `You are a cloud architect and Mermaid.js expert. 
Convert the following software infrastructure description into a valid Mermaid.js flowchart.
- Use 'graph TD' or 'graph LR'.
- Use descriptive node names.
- Output ONLY the mermaid code block content. 
- Do NOT include markdown code fences (like \`\`\`mermaid).
- Do NOT include any explanations or extra text.`;

        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        });

        const mermaidCode = response.response || response;

        return new Response(JSON.stringify({ chart: mermaidCode }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback to assets for non-API routes is handled by Cloudflare 
    // when [assets] is present in wrangler.toml and no response is returned 
    // or when we don't match the route.
    // However, for safety in some configurations, we can return nothing 
    // or a 404 which the assets middleware will catch.
    return new Response('Not Found', { status: 404 });
  },
};
