import { readFile } from 'node:fs/promises';
import type { BrowserContext } from '@playwright/test';
import {
  ACCESS_CERTS_PATH,
  TEST_ACCESS_AUD,
  TEST_OWNER_EMAIL,
  signAccessJwt,
  type AccessTestKeys,
} from '../../support/access.ts';

/**
 * E2E で作り手として操作するための道具。
 *
 * Playwright の webServer が起動する順に次を行う（playwright.config.ts）。
 * 1. `access-server.ts` がテスト用の鍵の組を作って `ACCESS_KEYS_PATH` に書き、
 *    公開鍵を `ACCESS_ISSUER` で配る
 * 2. `prepare-worker.ts` がローカルの D1 にマイグレーションを当て、
 *    `dist/server/.dev.vars` に `ACCESS_*` を書く
 * 3. `wrangler dev` がビルド出力を起動する
 *
 * webServer は globalSetup より先に起動するため、準備を globalSetup に置けない
 * （`node_modules/playwright/lib/runner/index.js` の `createGlobalSetupTasks`）。
 * 鍵は webServer のプロセスで作り、テストのプロセスへはファイルで渡す。
 *
 * `access-server.ts` と `prepare-worker.ts` は Node が型を取り除いて直接走らせる。
 * そのため、このファイルからの import は拡張子まで書く。
 */

/** 公開鍵のサーバのポート。`wrangler dev` の 8788 と別にする */
export const ACCESS_SERVER_PORT = 8789;
export const ACCESS_ISSUER = `http://127.0.0.1:${ACCESS_SERVER_PORT}`;
export const ACCESS_CERTS_URL = `${ACCESS_ISSUER}${ACCESS_CERTS_PATH}`;

/** テスト用の鍵の組を置く場所。`.wrangler/` は git が追跡しない */
export const ACCESS_KEYS_PATH = '.wrangler/e2e/access-keys.json';
/** `wrangler dev` がローカルの D1 を置く場所。起動のたびに空にする */
export const D1_PERSIST_DIR = '.wrangler/e2e/state';

/** `wrangler dev` に渡す設定値。`dist/server/.dev.vars` に書く */
export const ACCESS_VARS = {
  ACCESS_ISSUER,
  ACCESS_AUD: TEST_ACCESS_AUD,
  ACCESS_OWNER_EMAIL: TEST_OWNER_EMAIL,
};

const readKeys = async (): Promise<AccessTestKeys> =>
  JSON.parse(await readFile(ACCESS_KEYS_PATH, 'utf8')) as AccessTestKeys;

/**
 * ブラウザのこの context から送るすべての要求に、作り手の JWT を付ける。
 * Cloudflare Access がログインした作り手の要求に付けるのと同じヘッダを使う
 */
export const actAsAuthor = async (context: BrowserContext) => {
  const token = await signAccessJwt((await readKeys()).privateJwk, { issuer: ACCESS_ISSUER });
  await context.setExtraHTTPHeaders({ 'cf-access-jwt-assertion': token });
};
