import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_NOTES, startNoteTestServer, type NoteTestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';

/**
 * 認証を要する応答と、公開していない内容を含む応答を、どのキャッシュにも残さない
 * （docs/REQUIREMENTS.md の NFR-09）。公開していない内容を、作り手以外への応答に
 * 含めない（NFR-08）。
 *
 * 状態コードと応答の中身は notes.test.ts と dash.test.ts が持つ。ここではヘッダと、
 * それらが見ない RSC の応答を確かめる。
 */

const { published, publishedWithChanges, draft, deleted } = SEEDED_NOTES;

/** 作り手が入力する値。応答に残ることを確かめるため、他の値と重ならないものにする */
const INPUT = { title: 'キャッシュの検査で入力した題', body: 'キャッシュの検査で入力した本文' };

/** 画面の要求は、HTML と、画面の間を移るときの RSC の 2 通りで送られる */
const AS_HTML = {};
const AS_RSC = { rsc: '1' };

/**
 * どのキャッシュにも残らない形であることを確かめる。`no-store` はブラウザと共有の
 * キャッシュの両方に保存を禁じる（RFC 9111 の 5.2.2.5）。Cloudflare は
 * `CDN-Cache-Control` と `Cloudflare-CDN-Cache-Control` を `Cache-Control` より
 * 優先するため、どちらも付いていないことを見る
 */
const expectNoStore = (res: Response) => {
  const directives = (res.headers.get('cache-control') ?? '')
    .split(',')
    .map((directive) => directive.trim().toLowerCase());
  expect(directives).toContain('no-store');
  expect(res.headers.get('cdn-cache-control')).toBeNull();
  expect(res.headers.get('cloudflare-cdn-cache-control')).toBeNull();
};

/** 作り手の画面。編集の画面は、公開済み・公開し直していない書き換えがある・下書きの 3 つ */
const AUTHOR_PAGES = [
  '/dash',
  '/dash/notes/new',
  `/dash/notes/${published.id}`,
  `/dash/notes/${publishedWithChanges.id}`,
  `/dash/notes/${draft.id}`,
  `/dash/notes/${draft.id}/delete`,
  `/dash/notes/${deleted.id}/restore`,
];

describe('D1 から読める', () => {
  let ctx: NoteTestServer;
  const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

  const readFormOf = async (path: string) => {
    const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
    expect(res.status).toBe(200);
    return readActionFields(await res.text());
  };

  /** JavaScript なしのブラウザと同じ形で、フォームを送る */
  const submit = async (
    path: string,
    values: Record<string, string | number>,
    headers: Record<string, string>,
  ) => {
    const { body, contentType } = await encodeForm(await readFormOf(path), values);
    return ctx.server.fetch(path, {
      method: 'POST',
      body,
      headers: { ...headers, 'content-type': contentType },
      redirect: 'manual',
    });
  };

  /** ハイドレーションの後のブラウザと同じ形で、Server Action を呼ぶ */
  const call = async (
    path: string,
    values: Record<string, string | number>,
    headers: Record<string, string>,
  ) => {
    const request = await encodeActionCall(await readFormOf(path), values);
    return ctx.server.fetch(path, {
      method: 'POST',
      body: request.body,
      headers: { ...headers, ...request.headers },
      redirect: 'manual',
    });
  };

  beforeAll(async () => {
    ctx = await startNoteTestServer();
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  describe.each([
    ['HTML', AS_HTML],
    ['RSC', AS_RSC],
  ])('画面の要求（%s）', (_, as) => {
    it.each(AUTHOR_PAGES)('作り手の %s は、どのキャッシュにも残らない', async (path) => {
      const res = await ctx.server.fetch(path, { headers: { ...(await authorHeaders()), ...as } });
      await res.arrayBuffer();
      expect(res.status).toBe(200);
      expectNoStore(res);
    });

    it('作り手の、存在しない id の画面は、どのキャッシュにも残らない', async () => {
      const res = await ctx.server.fetch('/dash/notes/999', {
        headers: { ...(await authorHeaders()), ...as },
      });
      await res.arrayBuffer();
      expect(res.status).toBe(404);
      expectNoStore(res);
    });

    it.each(AUTHOR_PAGES)('作り手の JWT がない %s は、どのキャッシュにも残らない', async (path) => {
      const res = await ctx.server.fetch(path, { headers: as });
      await res.arrayBuffer();
      expect(res.status).toBe(403);
      expectNoStore(res);
    });

    it.each([draft, deleted])(
      '訪問者の /notes/$slug は、どのキャッシュにも残らず、題と本文を含めない',
      async (note) => {
        const res = await ctx.server.fetch(`/notes/${note.slug}`, { headers: as });
        const text = await res.text();
        expect(res.status).toBe(404);
        expectNoStore(res);
        expect(text).not.toContain(note.title);
        expect(text).not.toContain(note.body);
      },
    );
  });

  describe.each([
    ['JavaScript なしの送信', 'submit'],
    ['JavaScript からの呼び出し', 'call'],
  ] as const)('作り手の操作の結果（%s）', (_, how) => {
    const send = (
      path: string,
      values: Record<string, string | number>,
      headers: Record<string, string>,
    ) => (how === 'submit' ? submit(path, values, headers) : call(path, values, headers));

    it('「保存する」の結果は、どのキャッシュにも残らない', async () => {
      const res = await send(
        `/dash/notes/${draft.id}`,
        { intent: 'save', noteId: draft.id, slug: draft.slug, ...INPUT },
        await authorHeaders(),
      );
      const text = await res.text();
      expect(res.status).toBe(200);
      // 結果の応答が、入力した題と本文を含むこと。含まなければ、この検査は意味をなさない
      expect(text).toContain(INPUT.title);
      expectNoStore(res);
    });

    it('「公開する」に失敗した結果は、どのキャッシュにも残らない', async () => {
      const res = await send(
        `/dash/notes/${draft.id}`,
        { intent: 'publish', noteId: draft.id, slug: draft.slug, title: '', body: INPUT.body },
        await authorHeaders(),
      );
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(text).toContain(INPUT.body);
      expectNoStore(res);
    });

    it('作り手の JWT がない「保存する」の結果は、どのキャッシュにも残らない', async () => {
      const res = await send(
        `/dash/notes/${draft.id}`,
        { intent: 'save', noteId: draft.id, slug: draft.slug, ...INPUT },
        {},
      );
      const text = await res.text();
      expect(text).not.toContain(INPUT.title);
      expectNoStore(res);
    });
  });
});
