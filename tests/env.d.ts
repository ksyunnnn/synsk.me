/**
 * テストの中だけで使う binding の型。
 *
 * `cloudflare-env.d.ts` は `wrangler types` が `wrangler.jsonc` から生成する。
 * テスト専用の binding はそこに現れないため、ここで足す。
 */
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('@cloudflare/vitest-plugin').D1Migration[];
  }
}
