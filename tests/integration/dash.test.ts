import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_NOTES, readNoteRows, startNoteTestServer, type NoteTestServer } from './support/d1';
import { readActionFields, toFormBody } from './support/form';

/**
 * 作り手の経路 `/dash` 配下（specs/005-note-write-and-read/contracts/routes.md）。
 *
 * 作り手であることを確かめられない要求に画面を返さず、書き込まないことを、
 * 状態コードと D1 の行で確かめる。画面に出る文言と操作の連なりは E2E が持つ。
 */

const { published, publishedWithChanges, draft } = SEEDED_NOTES;
const SEEDED_TITLES = [
  published.title,
  publishedWithChanges.title,
  publishedWithChanges.draftTitle,
  draft.title,
];

/** 作り手が入力する値。応答に残ることを確かめるため、他の値と重ならないものにする */
const INPUT = { slug: 'integration-note', title: '結合テストで入力した題', body: '入力した本文' };

/** 要求先のホストと異なる Origin。別のサイトから送られた操作 */
const FOREIGN_ORIGIN = 'https://attacker.example';

const startServer = () => startNoteTestServer();

describe('D1 から読める', () => {
  let ctx: NoteTestServer;
  const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

  /** 作り手として画面を開き、フォームの操作を指す hidden の入力を取り出す */
  const readFormOf = async (path: string) => {
    const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
    expect(res.status).toBe(200);
    return readActionFields(await res.text());
  };

  /** JavaScript なしのブラウザと同じ形で、フォームを送る */
  const submit = (
    path: string,
    actionFields: Record<string, string>,
    values: Record<string, string | number>,
    headers: Record<string, string> = {},
  ) =>
    ctx.server.fetch(path, {
      method: 'POST',
      body: toFormBody(actionFields, values),
      headers,
      redirect: 'manual',
    });

  beforeAll(async () => {
    ctx = await startServer();
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  describe('作り手の JWT がない', () => {
    it.each(['/dash', '/dash/notes/new', `/dash/notes/${draft.id}`])(
      '%s は 403 で、画面の中身を返さない',
      async (path) => {
        const res = await ctx.server.fetch(path);
        expect(res.status).toBe(403);

        const text = await res.text();
        for (const title of SEEDED_TITLES) expect(text).not.toContain(title);
        expect(text).not.toContain('<form');
      },
    );

    it('オーナーでないメールアドレスの JWT も 403', async () => {
      const token = await ctx.signAuthorJwt({ email: 'visitor@synsk.test' });
      const res = await ctx.server.fetch('/dash', {
        headers: { 'cf-access-jwt-assertion': token },
      });
      expect(res.status).toBe(403);
    });

    it('「作る」の操作は書き込まない', async () => {
      const fields = await readFormOf('/dash/notes/new');
      const before = await readNoteRows(ctx.db);

      await submit('/dash/notes/new', fields, INPUT);
      expect(await readNoteRows(ctx.db)).toEqual(before);
    });

    it('「公開する」の操作は書き込まない', async () => {
      const fields = await readFormOf(`/dash/notes/${draft.id}`);
      const before = await readNoteRows(ctx.db);

      await submit(`/dash/notes/${draft.id}`, fields, { id: draft.id, ...INPUT, slug: draft.slug });
      expect(await readNoteRows(ctx.db)).toEqual(before);
    });

    it('操作は画面の経路の外へ送っても書き込まない', async () => {
      // Server Action は経路に縛られない。`/dash` の外への POST からも呼べる
      const fields = await readFormOf('/dash/notes/new');
      const before = await readNoteRows(ctx.db);

      await submit('/', fields, INPUT);
      expect(await readNoteRows(ctx.db)).toEqual(before);
    });
  });

  describe('別のサイトから送られた操作', () => {
    it('作り手の JWT が付いていても「作る」は書き込まない', async () => {
      const fields = await readFormOf('/dash/notes/new');
      const before = await readNoteRows(ctx.db);

      await submit('/dash/notes/new', fields, INPUT, {
        ...(await authorHeaders()),
        origin: FOREIGN_ORIGIN,
      });
      expect(await readNoteRows(ctx.db)).toEqual(before);
    });

    it('作り手の JWT が付いていても「公開する」は書き込まない', async () => {
      const fields = await readFormOf(`/dash/notes/${draft.id}`);
      const before = await readNoteRows(ctx.db);

      await submit(
        `/dash/notes/${draft.id}`,
        fields,
        { id: draft.id, ...INPUT, slug: draft.slug },
        { ...(await authorHeaders()), origin: FOREIGN_ORIGIN },
      );
      expect(await readNoteRows(ctx.db)).toEqual(before);
    });
  });

  describe('作り手の JWT がある', () => {
    it.each(['999', 'abc', '0', '1.5'])('存在しない id の /dash/notes/%s は 404', async (id) => {
      const res = await ctx.server.fetch(`/dash/notes/${id}`, { headers: await authorHeaders() });
      expect(res.status).toBe(404);
    });

    describe('D1 に書き込めない', () => {
      beforeAll(async () => {
        // 読み出しは通し、書き込みだけを失敗させる
        await ctx.db.batch([
          ctx.db.prepare(
            `CREATE TRIGGER fail_note_insert BEFORE INSERT ON note
             BEGIN SELECT RAISE(ABORT, 'integration-write-failure'); END`,
          ),
          ctx.db.prepare(
            `CREATE TRIGGER fail_note_update BEFORE UPDATE ON note
             BEGIN SELECT RAISE(ABORT, 'integration-write-failure'); END`,
          ),
        ]);
      });

      afterAll(async () => {
        await ctx.db.batch([
          ctx.db.prepare('DROP TRIGGER fail_note_insert'),
          ctx.db.prepare('DROP TRIGGER fail_note_update'),
        ]);
      });

      it('「作る」は失敗を返し、入力した値を含む', async () => {
        const fields = await readFormOf('/dash/notes/new');
        const before = await readNoteRows(ctx.db);

        const res = await submit('/dash/notes/new', fields, INPUT, await authorHeaders());
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('保存に失敗しました');
        expect(html).toContain(`value="${INPUT.slug}"`);
        expect(html).toContain(`value="${INPUT.title}"`);
        expect(html).toContain(`>${INPUT.body}</textarea>`);
        expect(await readNoteRows(ctx.db)).toEqual(before);
      });

      it('「公開する」は失敗を返し、入力した値を含む', async () => {
        const fields = await readFormOf(`/dash/notes/${draft.id}`);
        const before = await readNoteRows(ctx.db);

        const res = await submit(
          `/dash/notes/${draft.id}`,
          fields,
          { id: draft.id, ...INPUT, slug: draft.slug },
          await authorHeaders(),
        );
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('公開に失敗しました');
        expect(html).toContain(`value="${INPUT.title}"`);
        expect(html).toContain(`>${INPUT.body}</textarea>`);
        expect(await readNoteRows(ctx.db)).toEqual(before);
      });
    });

    describe('対照: 同じ形の要求で書き込まれる', () => {
      // 上の「書き込まない」検査が、要求の形の誤りで素通りしていないことを確かめる
      it('「作る」は note を作り、編集の画面へ移す', async () => {
        const fields = await readFormOf('/dash/notes/new');

        const res = await submit('/dash/notes/new', fields, INPUT, await authorHeaders());
        expect(res.status).toBe(303);

        const { note } = await readNoteRows(ctx.db);
        const created = note.find((row) => row.slug === INPUT.slug);
        expect(created).toMatchObject(INPUT);
        expect(res.headers.get('location')).toMatch(new RegExp(`/dash/notes/${created?.id}$`));
      });

      it('「公開する」は note を公開する', async () => {
        const fields = await readFormOf(`/dash/notes/${draft.id}`);

        const res = await submit(
          `/dash/notes/${draft.id}`,
          fields,
          { id: draft.id, slug: draft.slug, title: draft.title, body: draft.body },
          await authorHeaders(),
        );
        expect(res.status).toBe(200);

        const { notePublication } = await readNoteRows(ctx.db);
        expect(notePublication.find((row) => row.note_id === draft.id)).toMatchObject({
          title: draft.title,
          body: draft.body,
        });
      });
    });
  });
});

describe('D1 から読めない', () => {
  let ctx: NoteTestServer;

  beforeAll(async () => {
    ctx = await startServer();
    await ctx.db.batch([
      ctx.db.prepare('DROP TABLE note_publication'),
      ctx.db.prepare('DROP TABLE note'),
    ]);
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it.each(['/dash', `/dash/notes/${published.id}`])(
    '作り手の JWT 付きの %s は 500 で、note の題と本文を含めない',
    async (path) => {
      const res = await ctx.server.fetch(path, {
        headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
      });
      expect(res.status).toBe(500);

      const html = await res.text();
      expect(html).toContain('ページを読み出せませんでした');
      for (const title of SEEDED_TITLES) expect(html).not.toContain(title);
    },
  );

  it('作り手の JWT がなければ、D1 を読む前に 403', async () => {
    expect((await ctx.server.fetch('/dash')).status).toBe(403);
  });
});

describe('デプロイ時のキャッシュ判定', () => {
  it('ビルド出力の判定の対象に /dash 配下が入らない', async () => {
    // specs/005-note-write-and-read/research.md の R7
    const manifest = JSON.parse(
      await readFile('./dist/server/vinext-prerender-paths.json', 'utf8'),
    ) as {
      paths: string[];
      appPaths: string[];
      rscPaths: string[];
      routePatterns: Record<string, unknown>;
    };
    const probed = [
      ...manifest.paths,
      ...manifest.appPaths,
      ...manifest.rscPaths,
      ...Object.keys(manifest.routePatterns),
    ];
    // 判定の対象がビルドの誤りで空になっていないこと
    expect(probed).toContain('/');
    expect(probed.filter((path) => path === '/dash' || path.startsWith('/dash/'))).toEqual([]);
  });
});
