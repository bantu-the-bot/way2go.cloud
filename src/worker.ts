interface Env {
  AI: {
    run: (model: string, options: Record<string, unknown>) => Promise<{ response?: string }>;
  };
}

const ARCHITECTURE_SIMPLIFIER_PROMPT = `You are a senior systems architect. Your sole task is to ingest infrastructure descriptions and translate them into clean, valid Mermaid.js graph definitions.

CRITICAL RULES:
1. ONLY return the raw Mermaid.js code block starting with \`\`\`mermaid and ending with \`\`\`. Do not include conversational text, summaries, or introductions.
2. Use 'flowchart TD' for the layout.
3. Group logical boundaries using 'subgraph'.
4. Ensure all node IDs are strictly alphanumeric and contain no special characters or spaces.
5. Wrap ALL node labels in double quotes (e.g., NodeID["Label Text"]). This is mandatory for preventing syntax errors.
6. Avoid using reserved words like 'end', 'graph', or 'subgraph' as node IDs or unquoted labels.`;

const DEFAULT_SYSTEM_PROMPT = `You are an elite cloud architect and Mermaid.js specialist.
Your task is to convert infrastructure descriptions into professional, high-fidelity Mermaid.js diagrams.

- Use 'flowchart TD'.
- LOGICAL GROUPING: Use 'subgraph' blocks to represent containment (e.g., VMs inside a Physical Server).
- CLARITY: Use descriptive labels wrapped in double quotes for all nodes (e.g., A["Domain Controller"]).
- STYLING: Aim for a clean, hierarchical layout.
- STRICT RULE: Output ONLY the raw mermaid code.
- NO markdown markers (\`\`\`mermaid or \`\`\`).
- NO explanations, NO introductory text, NO "Here is your code". 
- Just the graph syntax.`;

const UPDATE_SYSTEM_PROMPT = `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible and wrap ALL labels in double quotes.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`;

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
          systemPrompt = current_code ? UPDATE_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
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
        
        // 2. Identify the likely start of the diagram
        const keywords = ['graph ', 'flowchart ', 'sequenceDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'classDiagram', 'gitGraph', 'pie', 'journey', 'architecture'];
        let startIndex = -1;

        for (const kw of keywords) {
          const idx = mermaidCode.indexOf(kw);
          if (idx !== -1 && (startIndex === -1 || idx < startIndex)) {
            startIndex = idx;
          }
        }

        if (startIndex !== -1) {
          mermaidCode = mermaidCode.substring(startIndex);
        }
        
        // 3. Trim any trailing text
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
