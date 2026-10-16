import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * エッジのキャッシュに載りうる経路を、`vinext build` の出力から確かめる。
 *
 * デプロイの `--experimental-warm-cdn-cache` は、`dist/server/vinext-prerender-paths.json`
 * の `paths`・`rscPaths`・`loadingShellPaths`・`pagesDataPaths`・`routeHandlerPaths` にある
 * URL を、キャッシュできるか判定する（`@vinext/cloudflare` の `cdn-warm.js` の
 * `createCdnWarmTargets`）。判定の結果に載らない経路は、実行時に `no-store` になる（`vinext` の
 * `server/cacheability-request.js`）。エッジのキャッシュそのものは手元の workerd で
 * 起きないため（`routes.test.ts`）、載りうる経路の一覧をここで確かめる。
 *
 * キャッシュしてよいのは、誰が要求しても同じになる応答だけ。作り手の画面と note の
 * 画面がこの一覧に入ると、作り手の画面や、削除した note が訪問者に返りうる。`/dash`
 * 配下が判定から外れることは `dash.test.ts` が確かめる。
 */

const PRERENDER_PATHS = './dist/server/vinext-prerender-paths.json';

/** `cdn-warm.js` が判定の対象にする配列。 */
const WARMED_KEYS = [
  'paths',
  'rscPaths',
  'loadingShellPaths',
  'pagesDataPaths',
  'routeHandlerPaths',
] as const;

const readWarmedPaths = async () => {
  const manifest = JSON.parse(await readFile(PRERENDER_PATHS, 'utf8')) as Partial<
    Record<(typeof WARMED_KEYS)[number], string[]>
  >;
  return [...new Set(WARMED_KEYS.flatMap((key) => manifest[key] ?? []))].sort();
};

/**
 * キャッシュに載ってよい経路のホワイトリスト。誰が要求しても同じ応答になるものだけを置く。
 * 経路を足すときは、データや認証によって応答が変わらないことを確かめてから足す。
 */
const CACHEABLE_PATHS = [
  '/',
  // トップの下書きと、そのリンク先のモック。データも認証も使わない（#148）
  '/top-draft',
  '/about',
  '/contact',
  '/resume',
];

describe('エッジのキャッシュに載りうる経路', () => {
  it('誰が要求しても同じになる経路だけ', async () => {
    expect(await readWarmedPaths()).toEqual([...CACHEABLE_PATHS].sort());
  });
});
