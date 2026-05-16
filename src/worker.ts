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

        const systemPrompt = `You are an elite cloud architect and Mermaid.js specialist.
Your task is to convert infrastructure descriptions into professional, high-fidelity Mermaid.js diagrams.

- Use 'graph TD'.
- LOGICAL GROUPING: Use 'subgraph' blocks to represent containment (e.g., VMs inside a Physical Server, Resources inside a VPC/Subnet).
- CLARITY: Use descriptive, quoted labels for all nodes (e.g., A["Domain Controller"]).
- STYLING: Aim for a clean, hierarchical layout that represents the actual physical or logical architecture.
- Output ONLY the raw mermaid code.
- No markdown code fences, no explanations, no prefix/suffix text.`;

        console.log("Generating diagram for prompt:", prompt);

        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        });

        const mermaidCode = response.response || response;
        console.log("Generated Mermaid Code:", mermaidCode);

        return new Response(JSON.stringify({ chart: mermaidCode }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error("Worker Error:", error.message);
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
