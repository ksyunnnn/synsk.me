import { defineConfig } from 'vitest/config';

/**
 * 単体テストの設定。
 *
 * `vite.config.ts` とは別に置き、vinext を読み込まない。vinext は Next.js の
 * API を Vite プラグインとして再実装したもので、RSC の変換と仮想モジュールを
 * 伴う。単体テストの対象は純関数とソースの静的な検査であり、その機構を要さない。
 *
 * D1 を workerd の中で扱うテストは `@cloudflare/vitest-plugin` が別の設定を持つ。
 *
 * 根拠は docs/decisions/0019-testing-strategy.md にある。
 */
export default defineConfig({
  resolve: {
    alias: {
      // tsconfig.json の paths と同じ。src のコードが `@/` で読み込み合う
      '@': new URL('src', import.meta.url).pathname,
      // `server-only` の既定の入口は、読み込んだだけで例外を投げる。Server
      // Component の外（クライアントの bundle）に混ざったことを知らせるための
      // もので、Node で走る単体テストには当たらない。React Server Components の
      // 環境で解決される空の入口に向ける
      'server-only': new URL('node_modules/server-only/empty.js', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // 手元の watch がマシンを占有しないようにする。既定は watch 時がコアの
    // 半分、それ以外は全並列
    maxWorkers: '50%',
  },
});
