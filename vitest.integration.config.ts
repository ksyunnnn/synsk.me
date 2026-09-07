import { defineConfig } from 'vitest/config';

/**
 * 結合テストの設定。`createTestHarness()` が本番のビルド出力を workerd で起動し、
 * HTTP を投げる。
 *
 * ビルドが前提になる。`npm run test:integration` が `vinext build` に続けて走る
 * 形にしてある。古い `dist/` に対して通ると、これから commit するのとは別の
 * コードに対して緑が出る。条件付きの skip は入れない。黙って skip するテストは、
 * 黙って守らなくなる。
 *
 * ADR-0019 が定める PR の CI の層に置く。
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    // harness が workerd を起こす。ファイル間で port を奪い合わないようにする
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
