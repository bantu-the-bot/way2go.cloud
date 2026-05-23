import { defineConfig } from 'vite'
import { execSync } from 'child_process'

process.noDeprecation = true;

const { default: react } = await import('@vitejs/plugin-react');
const { default: tailwindcss } = await import('@tailwindcss/vite');

// Get commit SHA from environment or git
let commitSha = process.env.CF_PAGES_COMMIT_SHA || '';
if (!commitSha) {
  try {
    commitSha = execSync('git rev-parse HEAD').toString().trim();
  } catch {
    commitSha = 'unknown';
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(commitSha),
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
