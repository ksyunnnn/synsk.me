import { basename } from 'node:path';
import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { cdnAdapter } from '@vinext/cloudflare/cache/cdn-adapter';
import { imagesOptimizer } from '@vinext/cloudflare/images/images-optimizer';

export default defineConfig(({ command }) => ({
  define: {
    // 開発サーバのタブの題に付ける名前。src/app/DevTabTitle.tsx が使う
    __WORKSPACE_NAME__: JSON.stringify(command === 'serve' ? basename(process.cwd()) : ''),
  },
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
      images: { optimizer: imagesOptimizer() },
      prerender: { routes: '*' },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
}));
