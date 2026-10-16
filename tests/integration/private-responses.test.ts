import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_NOTES, readNoteRows, startNoteTestServer, type NoteTestServer } from './support/d1';
import { isNoStore } from '../../scripts/lib/verify-deploy.mjs';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';

/**
 * 認証を要する応答と、公開していない内容を含む応答を、どのキャッシュにも残さない
 * （docs/REQUIREMENTS.md の NFR-09）。公開していない内容を、作り手以外への応答に
 * 含めない（NFR-08）。
 *
 * 状態コードと HTML の応答の中身は notes.test.ts と dash.test.ts が持つ。ここではヘッダと、
 * それらが見ない RSC の応答の中身を確かめる。状態コードは、検査する応答が意図した
 * 応答であることの前提として見る。
 */

const { published, publishedWithChanges, draft, deleted } = SEEDED_NOTES;

/** 作り手が入力する値。応答に残ることを確かめるため、他の値と重ならないものにする */
const INPUT = { title: 'キャッシュの検査で入力した題', body: 'キャッシュの検査で入力した本文' };

/**
 * 画面の要求は、HTML と、画面の間を移るときの RSC の 2 通りで送られる。RSC の要求に
 * `_rsc` がないと、vinext は `_rsc` を付けた URL へ 307 で移す
 * （`vinext/dist/server/app-rsc-cache-busting.js`）。ブラウザと同じく初めから付ける
 */
const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

/** どのキャッシュにも残らない形であることを確かめる。判定は `verify:deploy` と同じものを使う */
const expectNoStore = (res: { headers: { get: (name: string) => string | null } }) => {
  expect(isNoStore(res.headers), `cache-control: ${res.headers.get('cache-control')}`).toBe(true);
};

/** プレビュー配信の URL の形（`<branch>-synsk-me.<account>.workers.dev`） */
const PREVIEW_ORIGIN = 'https://feature-test-synsk-me.is-syunsukekobashi.workers.dev';

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
      const res = await ctx.server.fetch(`${path}${as.query}`, {
        headers: { ...(await authorHeaders()), ...as.headers },
        redirect: 'manual',
      });
      await res.arrayBuffer();
      expect(res.status).toBe(200);
      expectNoStore(res);
    });

    it('作り手の、存在しない id の画面は、どのキャッシュにも残らない', async () => {
      const res = await ctx.server.fetch(`/dash/notes/999${as.query}`, {
        headers: { ...(await authorHeaders()), ...as.headers },
        redirect: 'manual',
      });
      await res.arrayBuffer();
      expect(res.status).toBe(404);
      expectNoStore(res);
    });

    it.each(AUTHOR_PAGES)('作り手の JWT がない %s は、どのキャッシュにも残らない', async (path) => {
      const res = await ctx.server.fetch(`${path}${as.query}`, {
        headers: as.headers,
        redirect: 'manual',
      });
      await res.arrayBuffer();
      expect(res.status).toBe(403);
      expectNoStore(res);
    });

    it.each([draft, deleted])(
      '訪問者の /notes/$slug は、どのキャッシュにも残らない',
      async (note) => {
        const res = await ctx.server.fetch(`/notes/${note.slug}${as.query}`, {
          headers: as.headers,
          redirect: 'manual',
        });
        await res.arrayBuffer();
        expect(res.status).toBe(404);
        expectNoStore(res);
      },
    );
  });

  it.each([draft, deleted])('訪問者の /notes/$slug の RSC は、題と本文を含めない', async (note) => {
    const res = await ctx.server.fetch(`/notes/${note.slug}${AS_RSC.query}`, {
      headers: AS_RSC.headers,
      redirect: 'manual',
    });
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(text).not.toContain(note.title);
    expect(text).not.toContain(note.body);
  });

  it('プレビュー配信では、キャッシュしてよい / の RSC も、どのキャッシュにも残らない', async () => {
    // Worker の入口 src/worker.ts が、ホスト名でプレビュー配信を見分ける
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

    /**
     * 削除と戻すの検査のための note を作る。種の note を書き換えると、ほかの検査の前提が崩れる。
     * `deletedAt` を渡すと、公開してから削除した note にする
     */
    const createNote = async (slug: string, deletedAt?: string) => {
      const note = await ctx.db
        .prepare('INSERT INTO note (slug) VALUES (?) RETURNING id')
        .bind(slug)
        .first<{ id: number }>();
      const id = note?.id ?? 0;
      const revision = await ctx.db
        .prepare(
          'INSERT INTO note_revision (note_id, title, body, created_at) VALUES (?, ?, ?, ?) RETURNING id',
        )
        .bind(id, INPUT.title, INPUT.body, '2026-09-01T00:00:00.000Z')
        .first<{ id: number }>();
      if (deletedAt) {
        await ctx.db
          .prepare(
            "UPDATE note SET status = 'published', published_revision_id = ?, published_at = ?, deleted_at = ? WHERE id = ?",
          )
          .bind(revision?.id, '2026-09-02T00:00:00.000Z', deletedAt, id)
          .run();
      }
      return id;
    };

    /** 操作が書き込んだ note の行。応答が要求の形の誤りで返ったものでないことを確かめる */
    const readNote = async (id: number) =>
      (await readNoteRows(ctx.db)).note.find((note) => note.id === id);

    it('「作る」の結果は、どのキャッシュにも残らない', async () => {
      const slug = `cache-create-${how}`;
      const res = await send('/dash/notes/new', { slug, ...INPUT }, await authorHeaders());
      await res.arrayBuffer();
      expect((await readNoteRows(ctx.db)).note.some((note) => note.slug === slug)).toBe(true);
      expectNoStore(res);
    });

    it('「削除する」の結果は、どのキャッシュにも残らない', async () => {
      const id = await createNote(`cache-delete-${how}`);
      const res = await send(`/dash/notes/${id}/delete`, { noteId: id }, await authorHeaders());
      await res.arrayBuffer();
      expect((await readNote(id))?.deleted_at).not.toBeNull();
      expectNoStore(res);
    });

    it.each(['draft', 'published'])(
      '「戻す」（%s）の結果は、どのキャッシュにも残らない',
      async (restoreAs) => {
        const id = await createNote(
          `cache-restore-${restoreAs}-${how}`,
          '2026-09-03T00:00:00.000Z',
        );
        const res = await send(
          `/dash/notes/${id}/restore`,
          { restoreAs, noteId: id },
          await authorHeaders(),
        );
        await res.arrayBuffer();
        expect(await readNote(id)).toMatchObject({ status: restoreAs, deleted_at: null });
        expectNoStore(res);
      },
    );

    // 状態コードは見ない。JavaScript なしの送信は 403 を返す（dash.test.ts）。要求の形が
    // 正しいことは、同じ `send` で送る上の検査が書き込みを確かめて示す
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
