const ARCHITECTURE_SIMPLIFIER_PROMPT = `You are a senior systems architect. Your sole task is to ingest infrastructure descriptions and translate them into clean, valid Mermaid.js graph definitions.

CRITICAL RULES:
1. ONLY return the raw Mermaid.js code block starting with \`\`\`mermaid and ending with \`\`\`. Do not include conversational text, summaries, or introductions.
2. Use 'flowchart TD' for the layout.
3. Group logical boundaries using 'subgraph'.
4. Ensure all node IDs are strictly alphanumeric and contain no special characters or spaces.
5. Node IDs MUST be unique. A node cannot have the same ID as a subgraph.
6. Wrap ALL node labels in double quotes (e.g., NodeID["Label Text"]).
7. MANDATORY: DO NOT use double quotes INSIDE a label. If you need to emphasize something, use single quotes (e.g., NodeID["'Port Channel' Solution"]). Nested double quotes will break the parser.
8. Edge labels must be formatted as NodeA -->|Label| NodeB. NEVER add a trailing '>' inside the label pipes.
9. Avoid using reserved words like 'end', 'graph', or 'subgraph' as node IDs or unquoted labels.
10. Do NOT use semicolons at the end of Mermaid syntax lines.`;

const DEFAULT_SYSTEM_PROMPT = `You are an elite cloud architect and Mermaid.js specialist.
Your task is to convert infrastructure descriptions into professional, high-fidelity Mermaid.js diagrams.

- Use 'flowchart TD'.
- LOGICAL GROUPING: Use 'subgraph' blocks to represent containment (e.g., VMs inside a Physical Server).
- CLARITY: Use descriptive labels wrapped in double quotes for all nodes (e.g., A["Domain Controller"]).
- MANDATORY: DO NOT use double quotes INSIDE a label. Use single quotes instead.
- Node IDs MUST be unique and must not conflict with subgraph IDs.
- Edge labels must be formatted as NodeA -->|Label| NodeB.
- STYLING: Aim for a clean, hierarchical layout.
- STRICT RULE: Output ONLY the raw mermaid code.
- NO markdown markers (\`\`\`mermaid or \`\`\`).
- NO explanations, NO introductory text, NO "Here is your code". 
- Just the graph syntax.`;

const UPDATE_SYSTEM_PROMPT = `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible and wrap ALL labels in double quotes.
MANDATORY: DO NOT use double quotes INSIDE a label. Use single quotes instead.
Node IDs MUST be unique and must not conflict with subgraph IDs.
Edge labels must be formatted as NodeA -->|Label| NodeB. NEVER add a trailing '>' after the second pipe.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`;

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
        // 1. If backticks are present, extract only the content between the first and last triple backtick
        if (mermaidCode.includes('```')) {
          const parts = mermaidCode.split('```');
          mermaidCode = parts.reduce((a, b) => a.length > b.length ? a : b);
          mermaidCode = mermaidCode.replace(/^mermaid\n?/, '');
        }

        // 2. Identify the likely start of the diagram to strip any remaining leading chatter
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

        // 4. Post-processing fixes for common AI syntax slips:
        // Remove trailing semicolons from lines (Mermaid doesn't need them and they can break some versions)
        mermaidCode = mermaidCode.split('\n').map(line => line.trimEnd().replace(/;$/, '')).join('\n');
        
        // Fix malformed edge labels like -->|label|> which should be -->|label|
        mermaidCode = mermaidCode.replace(/-->\s*\|([^|]+)\|\s*>/g, '-->|$1|');

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
