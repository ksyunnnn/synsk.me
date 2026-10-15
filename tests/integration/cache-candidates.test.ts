import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * エッジのキャッシュに載りうる経路を、`vinext build` の出力から確かめる。
 *
 * デプロイの `--experimental-warm-cdn-cache` は、`dist/server/vinext-prerender-paths.json`
 * の `paths` にある URL だけを、キャッシュできるか判定する（`@vinext/cloudflare` の
 * `cdn-warm.js`）。判定の結果に載らない経路は、実行時に `no-store` になる（`vinext` の
 * `server/cacheability-request.js`）。エッジのキャッシュそのものは手元の workerd で
 * 起きないため（`routes.test.ts`）、載りうる経路の一覧をここで確かめる。
 *
 * キャッシュしてよいのは、誰が要求しても同じになる応答だけ。作り手の画面と note の
 * 画面がこの一覧に入ると、作り手の画面や、削除した note が訪問者に返りうる。
 */

const PRERENDER_PATHS = './dist/server/vinext-prerender-paths.json';

const readPrerenderPaths = async () =>
  JSON.parse(await readFile(PRERENDER_PATHS, 'utf8')) as {
    paths: string[];
    excludedWarmPaths: string[];
  };

describe('エッジのキャッシュに載りうる経路', () => {
  it('誰が要求しても同じになる / だけ', async () => {
    expect((await readPrerenderPaths()).paths).toEqual(['/']);
  });

  it('作り手の画面は判定から外れる', async () => {
    const { paths, excludedWarmPaths } = await readPrerenderPaths();
    expect(paths.filter((path) => path.startsWith('/dash'))).toEqual([]);
    expect(excludedWarmPaths).toContain('/dash');
  });
});
