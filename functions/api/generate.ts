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
   - RECOMMENDATION: Prefix subgraph IDs with 'SG_' to avoid collisions (e.g., subgraph SG_DMZ ["DMZ"]).
4. Ensure all node IDs are strictly alphanumeric and contain no special characters or spaces.
5. Node IDs MUST be unique. A node cannot have the same ID as a subgraph.
6. A node belongs to exactly ONE subgraph. Do not define or reference a node inside multiple 'subgraph' blocks. If a node connects multiple boundaries, define it outside or in its primary parent.
7. Wrap ALL node labels in double quotes (e.g., NodeID["Label Text"]).
8. MANDATORY: DO NOT use double quotes INSIDE a label. If you need to emphasize something, use single quotes (e.g., NodeID["'Port Channel' Solution"]). Nested double quotes will break the parser.
9. MANDATORY: DO NOT use literal newlines inside label quotes. If you need a line break inside a label, use <br> instead (e.g., NodeID["First Line<br>Second Line"]).
10. Edge labels must be formatted as NodeA -->|Label| NodeB. NEVER add a trailing '>' inside the label pipes.
11. Avoid using reserved words like 'end', 'graph', or 'subgraph' as node IDs or unquoted labels.
12. Do NOT use semicolons at the end of Mermaid syntax lines.`;

const DEFAULT_SYSTEM_PROMPT = `You are a cloud architect and Mermaid.js expert. 
Convert the following software infrastructure description into a valid Mermaid.js flowchart.
- Use 'flowchart TD' or 'flowchart LR'.
- Use descriptive node names and wrap ALL labels in double quotes.
- MANDATORY: DO NOT use double quotes INSIDE a label. Use single quotes instead.
- MANDATORY: DO NOT use literal newlines inside label quotes. Use <br> instead.
- Node IDs MUST be unique and must not conflict with subgraph IDs. Use 'SG_' prefix for subgraphs if helpful.
- A node can only belong to one subgraph.
- Edge labels must be formatted as NodeA -->|Label| NodeB.
- Output ONLY the mermaid code block content. 
- Do NOT include markdown code fences (like \`\`\`mermaid).
- Do NOT include any explanations or extra text.`;

const UPDATE_SYSTEM_PROMPT = `You are an expert systems architect and Mermaid.js syntax master. 
You will receive the CURRENT Mermaid code of an architecture diagram and a MODIFICATION REQUEST. 
Perform a surgical update to the code to satisfy the request. 
Maintain the existing structure where possible and wrap ALL labels in double quotes.
MANDATORY: DO NOT use double quotes INSIDE a label. Use single quotes instead.
MANDATORY: DO NOT use literal newlines inside label quotes. Use <br> instead.
Node IDs MUST be unique and must not conflict with subgraph IDs. Use 'SG_' prefix for subgraphs to avoid collisions.
A node can only belong to one subgraph. Do not place the same node in multiple subgraphs.
Edge labels must be formatted as NodeA -->|Label| NodeB. NEVER add a trailing '>' after the second pipe.
Return ONLY the raw, updated Mermaid code block. 
Do NOT include markdown code fences (like \`\`\`mermaid).
Do NOT include any explanations or extra text.`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const { current_code, instruction, mode, messages } = await request.json() as { 
      current_code?: string; 
      instruction: string; 
      mode?: 'default' | 'architecture';
      messages?: { role: 'user' | 'assistant'; content: string }[];
    };

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

    const messagesToSend: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (messages && messages.length > 0) {
      // Map previous messages, filtering out welcome messages and errors
      const history = messages.filter(msg => {
        if (msg.role === 'assistant' && msg.content.startsWith('Welcome!')) return false;
        if (msg.role === 'assistant' && msg.content.startsWith('Error:')) return false;
        return true;
      });

      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        if (i === history.length - 1 && msg.role === 'user') {
          // Format the latest user message with the current code so the LLM acts surgically on the latest state
          const formattedContent = (mode !== 'architecture' && current_code)
            ? `CURRENT CODE:\n${current_code}\n\nMODIFICATION REQUEST:\n${msg.content}`
            : msg.content;
          messagesToSend.push({ role: 'user', content: formattedContent });
        } else {
          messagesToSend.push({ role: msg.role, content: msg.content });
        }
      }
    } else {
      // Fallback if no messages array is provided
      const userPrompt = (mode !== 'architecture' && current_code)
        ? `CURRENT CODE:\n${current_code}\n\nMODIFICATION REQUEST:\n${instruction}`
        : instruction;
      messagesToSend.push({ role: 'user', content: userPrompt });
    }

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: messagesToSend,
      temperature,
      max_tokens: 2500,
    });

    // Workers AI returns an object with a 'response' string for text generation
    let mermaidCode = response.response || (typeof response === 'string' ? response : '');

    // Robust Sanitization:
    const keywords = ['graph ', 'flowchart ', 'sequenceDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'classDiagram', 'gitGraph', 'pie', 'journey', 'architecture'];

    // 1. If backticks are present, extract only the content inside the actual code block
    if (mermaidCode.includes('```')) {
      const parts = mermaidCode.split('```');
      let foundBlock = '';
      
      // Look for a block (at odd indices) that contains standard Mermaid keywords or "mermaid"
      for (let i = 1; i < parts.length; i += 2) {
        const partClean = parts[i].trim();
        const hasKeyword = keywords.some(kw => partClean.includes(kw)) || partClean.startsWith('mermaid');
        if (hasKeyword) {
          foundBlock = parts[i];
          break;
        }
      }
      
      // Fallback: if no block matched the keywords, take the first code block (index 1) if it exists
      if (!foundBlock && parts.length >= 3) {
        foundBlock = parts[1];
      }
      
      if (foundBlock) {
        mermaidCode = foundBlock.replace(/^mermaid\n?/, '');
      }
    }

    // 2. Identify the likely start of the diagram to strip any remaining leading chatter
    const strictStarters = ['flowchart ', 'flowchart\n', 'graph ', 'graph\n', 'sequenceDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'classDiagram', 'gitGraph', 'pie', 'journey', 'architecture'];
    let startIndex = -1;

    for (const kw of strictStarters) {
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

    // Replace literal newlines inside double-quoted strings with <br> to prevent syntax errors
    mermaidCode = mermaidCode.replace(/"([^"]*)"/g, (_match, p1) => {
      return `"${p1.replace(/\r?\n/g, '<br>')}"`;
    });

    // Auto-wrap unquoted node labels in double quotes to prevent syntax errors on spaces
    mermaidCode = mermaidCode.replace(/\b([A-Za-z0-9_]+)\[([^"\]]+)\]/g, '$1["$2"]');
    mermaidCode = mermaidCode.replace(/\b([A-Za-z0-9_]+)\(([^"\)]+)\)/g, '$1("$2")');
    mermaidCode = mermaidCode.replace(/\b([A-Za-z0-9_]+)\{([^"\}]+)\}/g, '$1{"$2"}');

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
