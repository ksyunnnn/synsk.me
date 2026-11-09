import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MEDIA_MAX_BYTES } from '../../src/shared/domain/media';
import { startTestServer, type TestServer } from './support/d1';
import { readActionFields } from './support/form';

/**
 * Server Action が受ける本文の大きさの上限（next.config.js の
 * `experimental.serverActions.bodySizeLimit`）。U5 の決定の 1 枚 10 MB（`MEDIA_MAX_BYTES`）の画像と
 * フォームのほかの値を受け、上限を超える本文は Server Action を動かさずに拒む（constitution II）。
 *
 * 画像を上げるフォームはまだ無いため、スキルの登録のフォームに、画像の代わりのファイルを
 * 足して送る。Server Action は知らない名前の値を読まない
 */

let ctx: TestServer;

beforeAll(async () => {
  ctx = await startTestServer();
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

/**
 * JavaScript なしのブラウザと同じ multipart で、スキルの登録のフォームに `fileBytes` のファイルを
 * 足して送る準備をする。フォームの画面を取る GET はここで済ませ、返した関数が POST だけを送る
 */
const prepareSubmitWithFile = async (name: string, fileBytes: number) => {
  const jwt = await ctx.signAuthorJwt();
  const page = await ctx.server.fetch('/dash/skills/new', {
    headers: { 'cf-access-jwt-assertion': jwt },
  });
  expect(page.status).toBe(200);
  const form = new FormData();
  for (const [field, value] of Object.entries(readActionFields(await page.text())))
    form.append(field, value);
  form.append('name', name);
  form.append('overrideYears', '');
  form.append('overrideMonths', '');
  form.append('image', new Blob([new Uint8Array(fileBytes)], { type: 'image/png' }), 'a.png');
  const encoded = new Response(form);
  const body = await encoded.arrayBuffer();
  return () =>
    ctx.server.fetch('/dash/skills/new', {
      method: 'POST',
      body,
      headers: {
        'cf-access-jwt-assertion': jwt,
        'content-type': encoded.headers.get('content-type') ?? '',
      },
      redirect: 'manual',
    });
};

/**
 * 送った本文が拒まれたか。vinext は `Content-Length` だけを見て 413 を返し、本文を読まない
 * （`app-server-action-execution.js`）。読まれない本文を検査がまだ書いている間に、workerd か
 * 検査の道具の側が接続を閉じると、次のどれかになる（2026-11-09 に、12 MB を 30 回送って、413 の
 * ほかに 2 と 3 が起きることを確かめた）。`send` は POST だけを送る関数にする。前段の GET の失敗を
 * 拒みと取り違えないため
 * 1. 413 の応答
 * 2. `fetch` が投げる（undici の `TypeError` で、文言は `terminated` か `fetch failed`。2026-11-09 に
 *    両方を見た）
 * 3. 検査の道具（wrangler の `createTestHarness`）が、送り先の接続が切れたことを 500 と
 *    `Network connection lost.` で返す
 * どれも、Worker が本文を受け取らずに拒んだことを表す。製品の 500 と見分けるため、3 は本文の
 * 文言で確かめる
 */
type Sent = Awaited<ReturnType<TestServer['server']['fetch']>>;

const expectRejected = async (send: () => Promise<Sent>) => {
  let response: Sent;
  try {
    response = await send();
  } catch (error) {
    // 検査の書き誤りの TypeError（undefined の読み出しなど）を拒みと取り違えないよう、文言で絞る
    expect(error).toBeInstanceOf(TypeError);
    expect(['terminated', 'fetch failed']).toContain((error as TypeError).message);
    return;
  }
  if (response.status === 500) {
    expect(await response.text()).toContain('Network connection lost.');
    return;
  }
  expect(response.status).toBe(413);
  await response.body?.cancel();
};

describe('Server Action の本文の上限', () => {
  it('10 MB の画像とフォームのほかの値を受ける', async () => {
    const send = await prepareSubmitWithFile('結合の検査の上限の内側', MEDIA_MAX_BYTES);
    const response = await send();
    expect(response.status).toBe(303);
    const row = await ctx.db
      .prepare('SELECT 1 FROM skill WHERE name = ?')
      .bind('結合の検査の上限の内側')
      .first();
    expect(row).not.toBeNull();
  }, 30_000);

  it('上限を超える本文は、Server Action を動かさずに拒む', async () => {
    await expectRejected(await prepareSubmitWithFile('結合の検査の上限の外側', 12 * 1024 * 1024));
    const row = await ctx.db
      .prepare('SELECT 1 FROM skill WHERE name = ?')
      .bind('結合の検査の上限の外側')
      .first();
    expect(row).toBeNull();
  }, 30_000);
});
