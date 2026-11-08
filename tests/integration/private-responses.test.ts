import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { isNoStore } from '../../scripts/lib/verify-deploy.mjs';

/**
 * 認証を要する応答を、どのキャッシュにも残さない（docs/REQUIREMENTS.md の NFR-09）。
 * オーナーでない要求に、オーナーの画面を返さない（NFR-08）。
 *
 * 各機能の画面と書き込みの操作の検査は、その機能の結合テストが持つ。ここでは `/dash` の
 * 入口と、プレビュー配信のヘッダを確かめる。状態コードは、検査する応答が意図した応答で
 * あることの前提として見る。
 */

/**
 * 画面の要求は、HTML と、画面の間を移るときの RSC の 2 通りで送られる。RSC の要求に
 * `_rsc` がないと、vinext は `_rsc` を付けた URL へ 307 で移す
 * （`vinext/dist/server/app-rsc-cache-busting.js`）。ブラウザと同じく初めから付ける
 */
const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

/**
 * 意図した応答であることを確かめ、本文を返す。RSC の要求では、vinext は描画を始めてから
 * 403 と 404 を決めるため、状態コードは 200 のまま、本文に
 * `NEXT_HTTP_ERROR_FALLBACK;<状態コード>` を含める（ADR-0042）
 */
const readExpected = async (
  res: { status: number; text: () => Promise<string> },
  as: typeof AS_HTML,
  status: number,
) => {
  const text = await res.text();
  if (as === AS_RSC && status !== 200) {
    expect(res.status).toBe(200);
    expect(text).toContain(`NEXT_HTTP_ERROR_FALLBACK;${status}`);
  } else {
    expect(res.status).toBe(status);
    // RSC の要求では 403 と 404 も 200 で返るため、本文で拒否でないことを見る
    if (as === AS_RSC) expect(text).not.toContain('NEXT_HTTP_ERROR_FALLBACK');
  }
  return text;
};

/** どのキャッシュにも残らない形であることを確かめる。判定は `verify:deploy` と同じものを使う */
const expectNoStore = (res: { headers: { get: (name: string) => string | null } }) => {
  expect(isNoStore(res.headers), `cache-control: ${res.headers.get('cache-control')}`).toBe(true);
};

/** プレビュー配信の URL の形（`<branch>-synsk-me.<account>.workers.dev`） */
const PREVIEW_ORIGIN = 'https://feature-test-synsk-me.is-syunsukekobashi.workers.dev';

/** オーナーの画面 */
const AUTHOR_PAGES = ['/dash'];

let ctx: TestServer;
const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

beforeAll(async () => {
  ctx = await startTestServer();
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
])('画面の要求（%s）', (_, as) => {
  it.each(AUTHOR_PAGES)('オーナーの %s は、どのキャッシュにも残らない', async (path) => {
    const res = await ctx.server.fetch(`${path}${as.query}`, {
      headers: { ...(await authorHeaders()), ...as.headers },
      redirect: 'manual',
    });
    await readExpected(res, as, 200);
    expectNoStore(res);
  });

  it.each(AUTHOR_PAGES)(
    'オーナーの JWT がない %s は 403 で、どのキャッシュにも残らない',
    async (path) => {
      const res = await ctx.server.fetch(`${path}${as.query}`, {
        headers: as.headers,
        redirect: 'manual',
      });
      await readExpected(res, as, 403);
      expectNoStore(res);
    },
  );

  it.each(AUTHOR_PAGES)(
    'オーナーでないメールアドレスの JWT の %s は 403 で、どのキャッシュにも残らない',
    async (path) => {
      const res = await ctx.server.fetch(`${path}${as.query}`, {
        headers: {
          'cf-access-jwt-assertion': await ctx.signAuthorJwt({ email: 'visitor@synsk.test' }),
          ...as.headers,
        },
        redirect: 'manual',
      });
      await readExpected(res, as, 403);
      expectNoStore(res);
    },
  );
});

it('プレビュー配信では、キャッシュしてよい / の RSC も、どのキャッシュにも残らない', async () => {
  // Worker の入口 worker/index.ts が、ホスト名でプレビュー配信を見分ける
  const res = await ctx.server.fetch(`${PREVIEW_ORIGIN}/${AS_RSC.query}`, {
    headers: AS_RSC.headers,
    redirect: 'manual',
  });
  await res.arrayBuffer();
  expect(res.status).toBe(200);
  expectNoStore(res);
});

it('対照: キャッシュしてよい / の RSC は、no-store を返さない', async () => {
  // 上の検査が、どの応答にも no-store が付く状態で素通りしていないことを確かめる
  const res = await ctx.server.fetch(`/${AS_RSC.query}`, {
    headers: AS_RSC.headers,
    redirect: 'manual',
  });
  await res.arrayBuffer();
  expect(res.status).toBe(200);
  expect(() => expectNoStore(res)).toThrow();
});
