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
      systemPrompt = current_code 
        ? `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`
        : `You are a cloud architect and Mermaid.js expert. 
Convert the following software infrastructure description into a valid Mermaid.js flowchart.
- Use 'graph TD' or 'graph LR'.
- Use descriptive node names.
- Output ONLY the mermaid code block content. 
- Do NOT include markdown code fences (like \`\`\`mermaid).
- Do NOT include any explanations or extra text.`;
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
    
    // 2. Remove common AI "chatter" if it appears at the start or end
    // Look for the actual start of the graph
    const graphStartIndex = mermaidCode.indexOf('graph ');
    if (graphStartIndex !== -1) {
      mermaidCode = mermaidCode.substring(graphStartIndex);
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
