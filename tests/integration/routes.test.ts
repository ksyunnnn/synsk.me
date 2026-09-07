import { access } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';

/**
 * 本番のビルド出力を workerd で起動し、訪問者が到達する経路を検査する。
 *
 * `vinext build` が `wrangler.jsonc` を読み、binding とアセットの位置を解決した
 * 設定を `dist/server/wrangler.json` に書き出す。直下の `wrangler.jsonc` を渡すと
 * `dist/client` が未解決のまま扱われる。
 *
 * `scripts/verify-deploy.mjs` は同じ経路を本番の URL に対して検査する。あちらは
 * 環境と設定が原因の欠陥を、こちらは変更が原因の欠陥を担う。Google SRE Book が
 * traditional test と production test を別系統と定義するのに従う。
 *
 * エッジのキャッシュはここで検査しない。ADR-0018 が定める 3 つ目の条件は
 * `--experimental-warm-cdn-cache` の二段アップロードで、ローカルの workerd では
 * 起きない。ここに書けば通るが何も守らない。
 */

const CONFIG = './dist/server/wrangler.json';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

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

describe('訪問者が到達する経路', () => {
  it.each(['/', '/archives/2024'])('%s が HTML を返す', async (path) => {
    const res = await server.fetch(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
  });

  it('/ が題を持つ', async () => {
    const html = await (await server.fetch('/')).text();
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  it('存在しない経路は 404 を返す', async () => {
    const res = await server.fetch('/__nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('画像を生成する経路', () => {
  /**
   * `next/og` の `ImageResponse` は satori と resvg の上に載る。vinext の README は
   * これらが Vite の RSC 開発環境で落ちうると挙げている。本番ビルドに対して
   * 実際に生成できることを確かめる。
   */
  it.each(['/icon', '/opengraph-image'])('%s が PNG を返す', async (path) => {
    const res = await server.fetch(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^image\/png/);

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual(PNG_SIGNATURE);
  });
});
