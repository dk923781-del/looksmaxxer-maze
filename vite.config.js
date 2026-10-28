import { defineConfig } from 'vite';

// GitHub Actions sets GITHUB_REPOSITORY=owner/repo; locally a relative base works anywhere.
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : null;

export default defineConfig({
  base: repo ? `/${repo}/` : './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
