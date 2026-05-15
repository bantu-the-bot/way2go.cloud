# Project Specification: way2go.cloud

## Overview
**way2go.cloud** is a zero-cost, serverless Cloud Architecture Architect tool. It allows users to describe software infrastructure in plain English and instantly generates visual diagrams using Mermaid.js.

## Technical Requirements
- **Hosting:** Cloudflare Pages (Direct Integration via GitHub).
- **Domain:** way2go.cloud (Managed via Cloudflare).
- **Backend/AI:** Cloudflare Workers AI (Running Llama 3.1 or Mistral).
- **Frontend:** React + Vite (Tailwind CSS for styling).
- **Visuals:** Mermaid.js (Client-side rendering).
- **Cost Target:** $0.00/month (utilizing free tiers).

## Local Environment (Bantu-Bot AI Lab)
- **Device:** Windows 11 ARM64 (Snapdragon X Elite).
- **User Identity:** bantu.the.bot@gmail.com.
- **Workflow:** Stateless recovery via GitHub (Private Repo) and Gmail-linked MFA.

## Setup Instructions for Gemini CLI
1. **Repository Initialization:**
   - Initialize a local Git repository.
   - Link to a private GitHub repository under the service account.
2. **Cloudflare Configuration:**
   - Install `wrangler` (Cloudflare CLI).
   - Configure a Cloudflare Pages project linked to the GitHub repo.
   - Bind the `Workers AI` catalog to the project.
3. **Project Scaffolding:**
   - Initialize a Vite + React (TypeScript) project.
   - Install `mermaid` and `@cloudflare/workers-types`.
4. **Environment Secrets:**
   - Set up Cloudflare API tokens for deployment via GitHub Actions or Wrangler.

## Feature Roadmap
- **Input:** Natural language text area.
- **Processing:** Worker AI prompt engineering to ensure valid Mermaid.js output.
- **Output:** Live SVG rendering of the architecture.
- **Shareability:** URL-encoded project states (no database required).
