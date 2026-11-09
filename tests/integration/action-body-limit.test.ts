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

/** JavaScript なしのブラウザと同じ multipart で、スキルの登録のフォームに `fileBytes` のファイルを足して送る */
const submitWithFile = async (name: string, fileBytes: number) => {
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
  return ctx.server.fetch('/dash/skills/new', {
    method: 'POST',
    body: await encoded.arrayBuffer(),
    headers: {
      'cf-access-jwt-assertion': jwt,
      'content-type': encoded.headers.get('content-type') ?? '',
    },
    redirect: 'manual',
  });
};

/**
 * 送った本文が拒まれたか。Worker は `Content-Length` だけを見て 413 を返し、本文を読み切らずに
 * 接続を閉じる（vinext の `app-server-action-execution.js`）。検査がまだ本文を書いている間に閉じられると、次のどれかになる（2026-11-09 に、
 * 12 MB を 30 回送って、413 のほかに 2 と 3 が起きることを確かめた）
 * 1. 413 の応答
 * 2. `fetch` が投げる（undici の `TypeError: terminated`）
 * 3. 検査の道具（wrangler の `createTestHarness`）が、送り先の接続が切れたことを 500 と
 *    `Network connection lost.` で返す
 * どれも、Worker が本文を受け取らずに拒んだことを表す。製品の 500 と見分けるため、3 は本文の
 * 文言で確かめる
 */
type Sent = { status: number; text: () => Promise<string> };

const expectRejected = async (send: () => Promise<Sent>) => {
  let response: Sent;
  try {
    response = await send();
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    return;
  }
  if (response.status === 500) {
    expect(await response.text()).toContain('Network connection lost.');
    return;
  }
  expect(response.status).toBe(413);
};

describe('Server Action の本文の上限', () => {
  it('10 MB の画像とフォームのほかの値を受ける', async () => {
    const response = await submitWithFile('結合の検査の上限の内側', MEDIA_MAX_BYTES);
    expect(response.status).toBe(303);
    const row = await ctx.db
      .prepare('SELECT 1 FROM skill WHERE name = ?')
      .bind('結合の検査の上限の内側')
      .first();
    expect(row).not.toBeNull();
  }, 30_000);

  it('上限を超える本文は、Server Action を動かさずに拒む', async () => {
    await expectRejected(() => submitWithFile('結合の検査の上限の外側', 12 * 1024 * 1024));
    const row = await ctx.db
      .prepare('SELECT 1 FROM skill WHERE name = ?')
      .bind('結合の検査の上限の外側')
      .first();
    expect(row).toBeNull();
  }, 30_000);
});
