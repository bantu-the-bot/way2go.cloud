interface Env {
  AI: {
    run: (model: string, options: Record<string, unknown>) => Promise<{ response?: string }>;
  };
}

const ARCHITECTURE_SIMPLIFIER_PROMPT = `You are a senior systems architect. Your sole task is to ingest infrastructure descriptions and translate them into clean, valid Mermaid.js graph definitions using a Top-Down (TD) layout.

CRITICAL RULES:
1. ONLY return the raw Mermaid.js code block starting with \`\`\`mermaid and ending with \`\`\`. Do not include conversational text, summaries, or introductions.
2. Group logical boundaries using 'subgraph'.
3. Apply clean node styling constants at the top of the graph definition to maintain a professional, dark-mode architect aesthetic.
4. Ensure all node IDs are strictly alphanumeric and contain no special characters or spaces.`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route API requests
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const { current_code, instruction, mode } = await request.json() as { current_code?: string; instruction: string; mode?: 'default' | 'architecture' };

        if (!instruction) {
          return new Response(JSON.stringify({ error: 'No instruction provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        let systemPrompt = '';
        let temperature = 0.6;

        if (mode === 'architecture') {
          systemPrompt = ARCHITECTURE_SIMPLIFIER_PROMPT;
          temperature = 0.2;
        } else {
          systemPrompt = current_code
            ? `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`
            : `You are an elite cloud architect and Mermaid.js specialist.
Your task is to convert infrastructure descriptions into professional, high-fidelity Mermaid.js diagrams.

- Use 'graph TD'.
- LOGICAL GROUPING: Use 'subgraph' blocks to represent containment (e.g., VMs inside a Physical Server).
- CLARITY: Use descriptive, quoted labels for all nodes (e.g., A["Domain Controller"]).
- STYLING: Aim for a clean, hierarchical layout.
- STRICT RULE: Output ONLY the raw mermaid code.
- NO markdown markers (\`\`\`mermaid or \`\`\`).
- NO explanations, NO introductory text, NO "Here is your code". 
- Just the graph syntax.`;
        }

        const userPrompt = (mode !== 'architecture' && current_code)
          ? `CURRENT CODE:\n${current_code}\n\nMODIFICATION REQUEST:\n${instruction}`
          : instruction;

        console.log("Processing diagram request:", { isUpdate: !!current_code, mode });

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
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

    return new Response('Not Found', { status: 404 });
  },
};
