import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

const migrations = await readD1Migrations(
  new URL('tests/fixtures/migrations', import.meta.url).pathname,
);

/**
 * workerd の中で走らせるテストの設定。
 *
 * `vite.config.ts` と `vitest.config.ts` のどちらとも別に置く。vinext を
 * 読み込まない。このプールはテストファイルを workerd の中で走らせ、対象の
 * Worker をプール自身の esbuild で束ねるため、vinext の RSC 変換と仮想モジュールを
 * 前提にできない。
 *
 * 扱うのは binding だけである。RSC のページをここで描画しない。ページの検査は
 * `createTestHarness()` が本番ビルド出力に対して行う。
 *
 * 根拠は docs/decisions/0019-testing-strategy.md にある。
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './tests/wrangler.test.jsonc' },
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    include: ['tests/workers/**/*.test.ts'],
  },
});
