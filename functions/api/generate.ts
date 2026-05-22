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

const DEFAULT_SYSTEM_PROMPT = `You are a cloud architect and Mermaid.js expert. 
Convert the following software infrastructure description into a valid Mermaid.js flowchart.
- Use 'flowchart TD' or 'flowchart LR'.
- Use descriptive node names and wrap ALL labels in double quotes.
- Output ONLY the mermaid code block content. 
- Do NOT include markdown code fences (like \`\`\`mermaid).
- Do NOT include any explanations or extra text.`;

const UPDATE_SYSTEM_PROMPT = `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible and wrap ALL labels in double quotes.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const { current_code, instruction, mode } = await request.json() as { current_code?: string; instruction: string; mode?: 'default' | 'architecture' };

    if (!instruction) {
      return new Response(JSON.stringify({ error: 'No instruction provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt = '';
    let temperature = 0.6; // Default temperature

    if (mode === 'architecture') {
      systemPrompt = ARCHITECTURE_SIMPLIFIER_PROMPT;
      temperature = 0.2;
    } else {
      systemPrompt = current_code ? UPDATE_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT;
    }

    const userPrompt = (mode !== 'architecture' && current_code)
      ? `CURRENT CODE:\n${current_code}\n\nMODIFICATION REQUEST:\n${instruction}`
      : instruction;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    });

    // Workers AI returns an object with a 'response' string for text generation
    let mermaidCode = response.response || (typeof response === 'string' ? response : '');

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

    return new Response(JSON.stringify({ chart: mermaidCode }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
