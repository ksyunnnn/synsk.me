import { defineConfig, devices } from '@playwright/test';
import { ACCESS_CERTS_URL, D1_PERSIST_DIR } from './tests/e2e/support/author';

/**
 * 実ブラウザで確かめるものの設定。
 *
 * ハイドレーション後のふるまい、操作の連なり、見た目の退行を担う。HTTP の
 * 応答とヘッダは `createTestHarness()` が担うので、ここには書かない。
 * ブラウザの起動は 1 本ごとに実時間を足す。
 *
 * ADR-0019 が定める PR の CI の層に置く。
 */
export default defineConfig({
  testDir: './tests/e2e',
  // `vinext build` と `wrangler dev` が前提。CI では 10 分の予算のうち、
  // ブラウザの起動とサーバの立ち上げに数十秒を見込む
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 既定は論理コアの半分。CI の runner は 4 vCPU なので明示する
  workers: process.env.CI ? 2 : undefined,
  // CI では失敗時に html reporter の成果物を回収する。github は注釈だけを出す
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  // 既定は 5 分で緩い。ADR-0019 の予算に合わせて下げる
  reportSlowTests: { max: 5, threshold: 10_000 },

  use: {
    baseURL: 'http://127.0.0.1:8788',
    // 既定で headless。`--headed` を常用しない。手元でブラウザ画面が出ると
    // 操作を奪う
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // 基準画像は Linux の CI でだけ撮る。ファイル名に OS が入るため、
  // macOS の手元で撮ったものは CI と別ファイルになり、追跡しても意味がない
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{platform}{ext}',

  projects: [
    // note が1件もない D1 を前提とするテスト（タグ `@empty-db`）を、ほかのテストが
    // note を作る前に走らせる。テストは同じローカルの D1 を並行して使う
    {
      name: 'empty-db',
      grep: /@empty-db/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      grepInvert: /@empty-db/,
      dependencies: ['empty-db'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    // テスト用の鍵の組を作り、公開鍵を Cloudflare Access の代わりに配る。
    // `wrangler dev` の Worker が、作り手の JWT の検証のために取りに来る。
    // 作り手として操作するテストは tests/e2e/support/author.ts の `actAsAuthor` を使う
    {
      command: `node tests/e2e/support/access-server.ts`,
      url: ACCESS_CERTS_URL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    // 本番のビルド出力を Workers ランタイムで起動する。`vinext dev` ではない。
    // dev は vinext の Known gap（native モジュールが RSC の開発環境で落ちうる）を
    // 踏む。起動の前に、ローカルの D1 へマイグレーションを当て、JWT の検証の
    // 設定値を `dist/server/.dev.vars` に書く。CI も同じコマンドで同じ準備をする
    {
      command: `node tests/e2e/support/prepare-worker.ts && npx wrangler dev --config dist/server/wrangler.json --port 8788 --persist-to ${D1_PERSIST_DIR}`,
      url: 'http://127.0.0.1:8788/',
      // 再利用しない。手元に古い `wrangler dev` が残っていると、これから
      // commit するのとは別のビルドに対して緑が出る
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
