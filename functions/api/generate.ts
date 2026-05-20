interface Env {
  AI: {
    run: (model: string, options: Record<string, unknown>) => Promise<{ response?: string }>;
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const { current_code, instruction } = await request.json() as { current_code?: string; instruction: string };

    if (!instruction) {
      return new Response(JSON.stringify({ error: 'No instruction provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = current_code 
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

    const userPrompt = current_code 
      ? `CURRENT CODE:\n${current_code}\n\nMODIFICATION REQUEST:\n${instruction}`
      : instruction;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    // Workers AI returns an object with a 'response' string for text generation
    const mermaidCode = response.response || (typeof response === 'string' ? response : '');

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
