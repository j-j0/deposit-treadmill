import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Open Graph tags need ABSOLUTE URLs — Twitter, Slack, Facebook and iMessage all
 * ignore a relative `og:image`, so the share card would silently never appear in
 * an unfurl. The source HTML keeps a relative path (so it works when opened from
 * disk or a dev server), and this rewrites it at build time once the deploy
 * knows its own address.
 *
 * `VITE_SITE_URL` is supplied by the Pages workflow. Without it the tags stay
 * relative rather than becoming a broken absolute URL.
 */
function absoluteOgUrls(): Plugin {
  return {
    name: 'absolute-og-urls',
    transformIndexHtml(html) {
      const site = process.env.VITE_SITE_URL?.replace(/\/+$/, '');
      if (!site) return html;

      return html
        .replace(/content="\.\/og-default\.png"/g, `content="${site}/og-default.png"`)
        .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/" />\n    <meta property="og:type"`);
    },
  };
}

// Relative base so the built bundle can be dropped on any static host
// (GitHub Pages project sites, S3 subpaths, Netlify, plain nginx) without
// rewriting asset URLs.
export default defineConfig({
  plugins: [react(), absoluteOgUrls()],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
});
