import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://rubberducktechsolutions.com',
  output: 'static',
  adapter: vercel(),
  // Canonicalize all URLs with a trailing slash so sitemap entries match
  // canonical link tags (avoids Google treating /a and /a/ as separate pages).
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
  ],
  vite: {
    ssr: {
      noExternal: ['@fontsource/*'],
    },
  },
});
