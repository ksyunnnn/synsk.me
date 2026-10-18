import { access, readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';
import { isNoStore } from '../../scripts/lib/verify-deploy.mjs';

/**
 * エッジのキャッシュに載りうる経路を、本番のビルド出力から確かめる。
 *
 * vinext 1.2 は、ページの応答を Workers Cache を通して返し、応答のキャッシュの指示で
 * 保存するかを決める（`@vinext/cloudflare/dist/cache/cdn-adapter.worker.js` の
 * `forbidsSharedStorage`）。保存できない応答は `no-store` のまま外に出る。保存そのものは
 * 手元の workerd で起きないため、ここでは外に出る指示を見て、`no-store` でないものを
 * 保存できる応答とみなす。
 *
 * キャッシュしてよいのは、誰が要求しても同じになる応答だけ。作り手の画面と note の
 * 画面がキャッシュに載ると、作り手の画面や、削除した note が訪問者に返りうる。
 */

const CONFIG = './dist/server/wrangler.json';

/** `vinext build` が見つけた、動的なセグメントを持たない経路（HTML と RSC） */
const PRERENDER_PATHS = './dist/server/vinext-prerender-paths.json';

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

/**
 * ビルドの経路の一覧に載らない、画像を返す経路。データも認証も使わず、誰が要求しても
 * 同じ画像になるため、キャッシュに載ってよい。Next.js の既定の
 * `public, max-age=0, must-revalidate` を返す
 */
const IMAGE_PATHS = ['/icon', '/opengraph-image'];

/** 画面の間を移るときの RSC の要求（`tests/integration/private-responses.test.ts` と同じ形） */
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

let server: ReturnType<typeof createTestHarness>;

beforeAll(async () => {
  await access(CONFIG).catch(() => {
    throw new Error(
      `${CONFIG} がない。結合テストはビルドを前提とする。npm run test:integration を使う`,
    );
  });
  server = createTestHarness({ workers: [{ configPath: CONFIG }] });
  await server.listen();
}, 60_000);

afterAll(async () => {
  await server?.close();
});

const isStorable = async (path: string, init: { headers?: Record<string, string> } = {}) => {
  const res = await server.fetch(path, { ...init, redirect: 'manual' });
  await res.arrayBuffer();
  return !isNoStore(res.headers);
};

describe('エッジのキャッシュに載りうる経路', () => {
  it('誰が要求しても同じになる経路だけ', async () => {
    const { paths, rscPaths } = JSON.parse(await readFile(PRERENDER_PATHS, 'utf8')) as {
      paths: string[];
      rscPaths: string[];
    };
    // 一覧の経路がビルドから消えていないこと
    expect(paths).toEqual(expect.arrayContaining(CACHEABLE_PATHS));

    const storable = [];
    for (const path of [...paths, ...IMAGE_PATHS]) if (await isStorable(path)) storable.push(path);
    expect(storable.sort()).toEqual([...CACHEABLE_PATHS, ...IMAGE_PATHS].sort());

    const storableRsc = [];
    for (const path of rscPaths)
      if (await isStorable(`${path}${AS_RSC.query}`, { headers: AS_RSC.headers }))
        storableRsc.push(path);
    expect(CACHEABLE_PATHS).toEqual(expect.arrayContaining(storableRsc));
  });
});
