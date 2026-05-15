# way2go.cloud

**Natural Language Cloud Architecture Visualizer**

way2go.cloud is an enterprise-grade platform that transforms natural language descriptions into high-fidelity cloud architecture diagrams. By leveraging advanced generative models and Mermaid.js, it allows architects and engineers to quickly prototype and visualize complex infrastructure topologies.

## Key Features

- **Natural Language Synthesis**: Describe your infrastructure in plain English and get an instant visual representation.
- **Dark Mode Architect Theme**: A premium, high-contrast interface designed for professional cloud architects.
- **Glassmorphism Editor**: A clean, focused environment for writing infrastructure specifications.
- **High-Contrast Canvas**: Optimized diagram rendering for maximum legibility and presentation quality.
- **Enterprise Integration**: Export diagrams as SVG or copy Mermaid code directly into your documentation.

## Tech Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v4
- **Rendering**: Mermaid.js
- **Backend**: Cloudflare Workers & AI (Llama 3.1)
- **Deployment**: Cloudflare Pages (Unified Workers Assets)

## Getting Started

1. **Describe**: Enter a description of your architecture in the "Design Specification" panel.
2. **Generate**: Click "Generate Architecture" to synthesize the diagram.
3. **Refine**: Adjust your description to add detail or modify the topology.
4. **Export**: Use the preview tools to copy the code or export the SVG for use in professional reports or design documents.

## Configuration

The application uses a `wrangler.toml` for deployment on Cloudflare. Ensure your environment has the necessary AI bindings configured if you are self-hosting.

```toml
name = "way2go-cloud"
compatibility_date = "2026-05-15"

[assets]
directory = "./dist"

[ai]
binding = "AI"
```

---

&copy; 2026 way2go.cloud. All rights reserved.
