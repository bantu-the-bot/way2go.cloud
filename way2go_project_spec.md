# Project Specification: way2go.cloud

## Overview
**way2go.cloud** is a premium, serverless Cloud Architecture Visualizer. It allows architects to describe software infrastructure in plain English and instantly generates high-fidelity visual diagrams using Mermaid.js.

## Technical Requirements
- **Hosting:** Cloudflare Pages (Direct Integration via GitHub).
- **Domain:** way2go.cloud (Managed via Cloudflare).
- **Backend/AI:** Cloudflare Workers AI (Running Llama 3.1).
- **Frontend:** React + Vite (Tailwind CSS v4).
- **Visuals:** Mermaid.js (Client-side rendering).
- **Branding:** Enterprise-grade "Dark Mode Architect" theme.

## Infrastructure Design
- **Platform:** Cloudflare Ecosystem.
- **Workflow:** Automated CI/CD via GitHub Actions and Cloudflare Pages.

## Feature Roadmap
- **Input:** Natural language text area with glassmorphism styling.
- **Processing:** Worker AI prompt engineering to ensure valid Mermaid.js output.
- **Output:** Live SVG rendering of the architecture.
- **Tools:** Export to SVG and copy Mermaid code functionality.
