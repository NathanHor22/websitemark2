import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from '@openai/sites-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  return {
    plugins: [
      sites(),
      cloudflare({
        viteEnvironment: { name: 'server' },
        config: {
          name: 'nathan-hor-portfolio',
          main: './worker/index.js',
          compatibility_date: '2026-08-28',
          assets: {
            binding: 'ASSETS',
            not_found_handling: '404-page',
          },
        },
      }),
    ],
  };
});
