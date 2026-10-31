import { defineConfig } from 'vite';

// GitHub Actions sets GITHUB_REPOSITORY=owner/repo; locally a relative base works anywhere.
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : null;

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify('moggman-2.0.0') },
  plugins: [{ name: 'moggman-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({build:'moggman-2.0.0'}) }); } }],
  base: repo ? `/${repo}/` : './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
