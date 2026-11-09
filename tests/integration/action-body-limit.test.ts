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
 * JavaScript なしのブラウザと同じ multipart で、スキルの登録のフォームに `fileBytes` のファイルを足して
 * `to` へ送る。Server Action はどの経路へ送っても動く
 */
const submitWithFile = async (name: string, fileBytes: number, to = '/dash/skills/new') => {
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
  return ctx.server.fetch(to, {
    method: 'POST',
    body: await encoded.arrayBuffer(),
    headers: {
      'cf-access-jwt-assertion': jwt,
      'content-type': encoded.headers.get('content-type') ?? '',
    },
    redirect: 'manual',
  });
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

  it('上限を超える本文は、Server Action を動かさずに 413 で拒む', async () => {
    const response = await submitWithFile('結合の検査の上限の外側', 12 * 1024 * 1024);
    expect(response.status).toBe(413);
    const row = await ctx.db
      .prepare('SELECT 1 FROM skill WHERE name = ?')
      .bind('結合の検査の上限の外側')
      .first();
    expect(row).toBeNull();
  }, 30_000);
});

/**
 * `/dash` の外への大きい POST（worker/index.ts と src/shared/server/post-limit.ts）。上の 10.5 MB の
 * 上限は経路で分けられないため、`/dash` の外では Worker の入口が既定の 1 MB で止める（原則 1・2）
 */
describe('/dash の外への POST の本文の上限', () => {
  const skillExists = async (name: string) =>
    (await ctx.db.prepare('SELECT 1 FROM skill WHERE name = ?').bind(name).first()) !== null;

  it('1 MB を超える本文は、Server Action を動かさずに 413 で拒む', async () => {
    const response = await submitWithFile(
      '結合の検査の dash の外の大きい本文',
      2 * 1024 * 1024,
      '/',
    );
    expect(response.status).toBe(413);
    expect(await skillExists('結合の検査の dash の外の大きい本文')).toBe(false);
  }, 30_000);

  it('1 MB までの本文は、入口で止めない', async () => {
    const response = await submitWithFile('結合の検査の dash の外の小さい本文', 512 * 1024, '/');
    expect(response.status).not.toBe(413);
    expect(response.status).not.toBe(411);
  }, 30_000);

  it('本文の長さを示さない POST は 411 で拒む', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('a=1'));
        controller.close();
      },
    });
    const response = await ctx.server.fetch('/', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      duplex: 'half',
    } as unknown as Parameters<typeof ctx.server.fetch>[1]);
    expect(response.status).toBe(411);
  });

  it('/dash への 1 MB を超える本文は、入口で止めない', async () => {
    const response = await submitWithFile('結合の検査の dash の大きい本文', 2 * 1024 * 1024);
    expect(response.status).toBe(303);
  }, 30_000);
});
