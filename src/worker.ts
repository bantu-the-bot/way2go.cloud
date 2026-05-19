interface Env {
  AI: {
    run: (model: string, options: Record<string, unknown>) => Promise<{ response?: string }>;
  };
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
- LOGICAL GROUPING: Use 'subgraph' blocks to represent containment (e.g., VMs inside a Physical Server).
- CLARITY: Use descriptive, quoted labels for all nodes (e.g., A["Domain Controller"]).
- STYLING: Aim for a clean, hierarchical layout.
- STRICT RULE: Output ONLY the raw mermaid code.
- NO markdown markers (\`\`\`mermaid or \`\`\`).
- NO explanations, NO introductory text, NO "Here is your code". 
- Just the graph syntax.`;

        console.log("Generating diagram for prompt:", prompt);

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        });

        let mermaidCode = aiResponse.response || '';
        
        if (!mermaidCode && typeof aiResponse === 'string') {
          mermaidCode = aiResponse;
        }

        // Robust Sanitization:
        // 1. Strip markdown code fences (```mermaid or ```)
        mermaidCode = mermaidCode.replace(/```mermaid\n?/g, '');
        mermaidCode = mermaidCode.replace(/```\n?/g, '');
        
        // 2. Remove common AI "chatter" if it appears at the start or end
        // Look for the actual start of the graph
        const graphStartIndex = mermaidCode.indexOf('graph ');
        if (graphStartIndex !== -1) {
          mermaidCode = mermaidCode.substring(graphStartIndex);
        }
        
        // 3. Trim any trailing text (AI often adds "Hope this helps!" at the end)
        // We look for the last closing bracket or semicolon if we want to be aggressive, 
        // but a simple trim of trailing whitespace is usually enough if we start at 'graph'
        mermaidCode = mermaidCode.trim();

        console.log("Sanitized Mermaid Code:", mermaidCode);

        return new Response(JSON.stringify({ chart: mermaidCode }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error("Worker Error:", message);
        return new Response(JSON.stringify({ error: message }), {
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
