import { defineConfig } from 'vitest/config';
import workers from './vitest.workers.config';

/**
 * 既にある行を移すマイグレーションを、当てる前に一度だけ確かめるテストの設定。
 *
 * `tests/migrations/` だけを回す。workerd の中で本物の `migrations/` を当てる仕組みは
 * `vitest.workers.config.ts` のものをそのまま使う。CI は `migrations/` か
 * `tests/migrations/` が変わったときだけ回す（`.github/workflows/migrations.yml`）。
 */
export default defineConfig({
  ...workers,
  test: { ...workers.test, include: ['tests/migrations/**/*.test.ts'] },
});
