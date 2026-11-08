import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm } from './support/form';
import { insertNote, insertNoteMedia } from '../support/note-rows';

/**
 * note のページ・画像・管理画面の応答（specs/003-note/spec.md の SC-001・SC-005・FR-012・
 * FR-015・FR-016・FR-026・FR-033、contracts/visitor-note.md・contracts/dash.md）。
 *
 * 訪問者への応答は、HTML と、画面の間を移るときの RSC のペイロードの両方を調べる
 */

/** 訪問者に出してはいけない値。どれも作り物で、ほかの値と重ならない */
const HIDDEN = {
  laterRevisionTitle: '公開した後に保存した版の作り物の題',
  laterRevisionBody: '公開した後に保存した版の作り物の本文',
  draftTitle: '下書きの作り物の note の題',
  unpublishedTitle: '下書きに戻した作り物の note の題',
  deletedTitle: '削除した作り物の note の題',
};

const SHOWN = {
  title: '公開した作り物の note の題',
  body: '公開した作り物の note の本文',
  cardTitle: '作り物の参照先の題',
};

const FILE_IN_PUBLISHED = '00000000-0000-4000-8000-0000000000a1.png';
const FILE_ONLY_LATER = '00000000-0000-4000-8000-0000000000b2.png';
const FILE_OF_DRAFT = '00000000-0000-4000-8000-0000000000c3.png';
const CARD_URL = 'https://example.com/fake-card';

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

let ctx: TestServer;
let publishedUid: string;
let draftUid: string;

const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

const fetchText = async (
  path: string,
  init: NonNullable<Parameters<TestServer['server']['fetch']>[1]> = {},
) => {
  const res = await ctx.server.fetch(path, { redirect: 'manual', ...init });
  return { res, text: await res.text() };
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const published = await insertNote(db, {
        slug: 'fake-published',
        revisions: [
          {
            title: SHOWN.title,
            body: `${SHOWN.body}\n\n![図](media:${FILE_IN_PUBLISHED})\n\n${CARD_URL}`,
          },
          {
            title: HIDDEN.laterRevisionTitle,
            body: `${HIDDEN.laterRevisionBody}\n\n![](media:${FILE_ONLY_LATER})`,
          },
        ],
        publishedRevision: 1,
      });
      publishedUid = published.uid;
      await insertNoteMedia(db, published.id, `notes/${FILE_IN_PUBLISHED}`);
      await insertNoteMedia(db, published.id, `notes/${FILE_ONLY_LATER}`);
      await db
        .prepare(
          'INSERT INTO link_preview (url, title, image_url, fetched_at) VALUES (?, ?, NULL, ?)',
        )
        .bind(CARD_URL, SHOWN.cardTitle, '2026-11-01T00:00:00.000Z')
        .run();

      const draft = await insertNote(db, {
        slug: 'fake-draft',
        revisions: [{ title: HIDDEN.draftTitle, body: `![](media:${FILE_OF_DRAFT})` }],
      });
      draftUid = draft.uid;
      await insertNoteMedia(db, draft.id, `notes/${FILE_OF_DRAFT}`);

      await insertNote(db, {
        slug: 'fake-unpublished',
        revisions: [{ title: HIDDEN.unpublishedTitle, body: '' }],
        publishedRevision: 1,
        unpublished: true,
      });
      await insertNote(db, {
        slug: 'fake-deleted',
        revisions: [{ title: HIDDEN.deletedTitle, body: '' }],
        publishedRevision: 1,
        deleted: true,
      });
    },
  });
  // R2 の物を入れる。画像の記録と同じキーに置く
  const { NOTE_IMAGES } = await ctx.server.getWorker<{ NOTE_IMAGES: R2Bucket }>().getEnv();
  for (const file of [FILE_IN_PUBLISHED, FILE_ONLY_LATER, FILE_OF_DRAFT]) {
    await NOTE_IMAGES.put(`notes/${file}`, PNG, { httpMetadata: { contentType: 'image/png' } });
  }
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
] as const)('/notes/{slug} の %s', (_name, as) => {
  it('公開した note は 200 で、公開した版だけを出し、公開した後に保存した版を出さない（FR-012）', async () => {
    const { res, text } = await fetchText(`/notes/fake-published${as.query}`, {
      headers: as.headers,
    });
    expect(res.status).toBe(200);
    expect(text).toContain(SHOWN.title);
    expect(text).toContain(SHOWN.body);
    expect(text).not.toContain(HIDDEN.laterRevisionTitle);
    expect(text).not.toContain(HIDDEN.laterRevisionBody);
    expect(text).not.toContain(FILE_ONLY_LATER);
  });

  it.each([
    ['下書き', 'fake-draft', HIDDEN.draftTitle],
    ['下書きに戻した', 'fake-unpublished', HIDDEN.unpublishedTitle],
    ['削除した', 'fake-deleted', HIDDEN.deletedTitle],
    ['無い', 'no-such-note', HIDDEN.draftTitle],
  ])('%s note は 404 で、中身を含まない（SC-001）', async (_label, slug, title) => {
    const { res, text } = await fetchText(`/notes/${slug}${as.query}`, { headers: as.headers });
    // RSC の応答は、状態コードではなく 404 の印で返る（tests/integration/project-masking.test.ts と同じ）
    if (as === AS_RSC) expect(text).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
    else expect(res.status).toBe(404);
    expect(text).not.toContain(title);
  });
});

describe('note のページの中身', () => {
  it('本文の画像を訪問者の経路で出し、保存した参照先の情報でカードを出す（FR-027・SC-005）', async () => {
    const { text } = await fetchText('/notes/fake-published');
    expect(text).toContain(`/notes/fake-published/images/${FILE_IN_PUBLISHED}`);
    expect(text).toContain(SHOWN.cardTitle);
  });

  it('代表画像を選んでいなければ、題を入れて自動で作る画像を og:image にする（User Story 5 の 2）', async () => {
    const { text } = await fetchText('/notes/fake-published');
    expect(text).toMatch(
      /<meta property="og:image" content="[^"]*\/notes\/fake-published\/card-image"/,
    );
    expect(text).toContain('summary_large_image');
  });

  it('題を入れて自動で作る画像は、公開した note だけに PNG で返す', async () => {
    const published = await ctx.server.fetch('/notes/fake-published/card-image');
    expect(published.status).toBe(200);
    expect(published.headers.get('content-type')).toBe('image/png');
    await published.arrayBuffer();
    const draft = await ctx.server.fetch('/notes/fake-draft/card-image');
    expect(draft.status).toBe(404);
    await draft.arrayBuffer();
  });
});

describe('/notes/{slug}/images/{file}（FR-026）', () => {
  it('公開した版の本文が指す画像は、どのキャッシュにも残さない形で返す', async () => {
    const res = await ctx.server.fetch(`/notes/fake-published/images/${FILE_IN_PUBLISHED}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('no-store, must-revalidate');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it.each([
    ['公開した後に保存した版にだけ置いた画像', 'fake-published', FILE_ONLY_LATER],
    ['下書きの note の画像', 'fake-draft', FILE_OF_DRAFT],
    ['ほかの note の画像', 'fake-published', FILE_OF_DRAFT],
    ['形の違うファイル名', 'fake-published', '..%2Fsecret.png'],
  ])('%s は 404', async (_label, slug, file) => {
    const res = await ctx.server.fetch(`/notes/${slug}/images/${file}`);
    expect(res.status).toBe(404);
    await res.arrayBuffer();
  });
});

describe('オーナーの画面', () => {
  it.each(['/dash/notes', '/dash/notes/new', '/dash/notes/{uid}', '/dash/notes/{uid}/preview'])(
    'オーナーの %s は 200',
    async (template) => {
      const res = await ctx.server.fetch(template.replace('{uid}', draftUid), {
        headers: await authorHeaders(),
      });
      expect(res.status).toBe(200);
      await res.arrayBuffer();
    },
  );

  it('プレビューは最新の版を出し、画像をオーナーの経路で出す（REQUIREMENTS.md の FR-13）', async () => {
    const { text } = await fetchText(`/dash/notes/${publishedUid}/preview`, {
      headers: await authorHeaders(),
    });
    expect(text).toContain(HIDDEN.laterRevisionTitle);
    expect(text).toContain(`/dash/notes/${publishedUid}/images/${FILE_ONLY_LATER}`);
  });

  it('オーナーの画像の経路は、下書きの版の画像も返す', async () => {
    const res = await ctx.server.fetch(`/dash/notes/${draftUid}/images/${FILE_OF_DRAFT}`, {
      headers: await authorHeaders(),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store, must-revalidate');
    await res.arrayBuffer();
  });

  it('無い uid と無い版の番号は 404', async () => {
    for (const path of [`/dash/notes/${'0'.repeat(32)}`, `/dash/notes/${draftUid}/revisions/9`]) {
      const res = await ctx.server.fetch(path, { headers: await authorHeaders() });
      expect(res.status, path).toBe(404);
      await res.arrayBuffer();
    }
  });

  it.each([
    '/dash/notes',
    '/dash/notes/{uid}',
    '/dash/notes/{uid}/preview',
    '/dash/notes/{uid}/revisions',
    '/dash/notes/{uid}/images/' + FILE_OF_DRAFT,
  ])('オーナーの JWT がない %s は 403 で、中身を返さず、no-store を持つ', async (template) => {
    const { res, text } = await fetchText(template.replace('{uid}', draftUid));
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(text).not.toContain(HIDDEN.draftTitle);
    expect(text).not.toContain('<form');
  });

  it('一覧のリンクと編集の画面の隠しフィールドは uid で、主キーを出さない', async () => {
    const { text } = await fetchText('/dash/notes', { headers: await authorHeaders() });
    expect(text).toContain(`/dash/notes/${draftUid}`);
    expect(text).not.toMatch(/\/dash\/notes\/\d+["/?]/);
    const edit = await fetchText(`/dash/notes/${draftUid}`, { headers: await authorHeaders() });
    expect(edit.text).not.toMatch(/name="noteUid" value="\d+"/);
  });
});

describe('オーナーの JWT がない書き込み（FR-033）', () => {
  /** Server Action は経路に縛られない。`/dash` の外の経路へ送り、Server Action が自分で拒むことを確かめる */
  const OUTSIDE_DASH = '/notes/fake-published';

  /** 画面の中の、送るボタンの文字が `label` のフォームの、操作を指す hidden の入力 */
  const readFormFields = async (path: string, label: string) => {
    const { text } = await fetchText(path, { headers: await authorHeaders() });
    const form = [...text.matchAll(/<form\b[\s\S]*?<\/form>/g)]
      .map(([html]) => html)
      .find((html) => html.includes(`>${label}</button>`));
    if (!form) throw new Error(`「${label}」のフォームが無い`);
    const fields: Record<string, string> = {};
    for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
      const name = tag.match(/name="([^"]*)"/)?.[1];
      const value = (tag.match(/value="([^"]*)"/)?.[1] ?? '').replaceAll('&quot;', '"');
      if (name?.startsWith('$ACTION_')) fields[name] = value;
    }
    return fields;
  };

  const send = async (
    how: 'submit' | 'call',
    fields: Record<string, string>,
    values: Record<string, string | number>,
    headers: Record<string, string>,
  ) => {
    if (how === 'submit') {
      const { body, contentType } = await encodeForm(fields, values);
      return ctx.server.fetch(OUTSIDE_DASH, {
        method: 'POST',
        body,
        headers: { ...headers, 'content-type': contentType },
        redirect: 'manual',
      });
    }
    const request = await encodeActionCall(fields, values);
    return ctx.server.fetch(OUTSIDE_DASH, {
      method: 'POST',
      body: request.body,
      headers: { ...headers, ...request.headers },
      redirect: 'manual',
    });
  };

  const readRows = async () =>
    Promise.all(
      ['note', 'note_revision', 'syndication', 'media'].map(
        async (table) => (await ctx.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results,
      ),
    );

  const countNotes = async () =>
    (await ctx.db.prepare('SELECT count(*) AS n FROM note').first<{ n: number }>())?.n ?? 0;

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it.each([
      [
        '作る',
        '/dash/notes/new',
        '作る',
        { slug: 'written-by-stranger', title: '書かれた題', description: '', body: '' },
      ],
      [
        '保存',
        '/dash/notes/{uid}',
        '保存する',
        {
          noteUid: '{uid}',
          openedRevision: 1,
          slug: 'fake-draft',
          title: '書かれた題',
          description: '',
          body: '',
        },
      ],
      ['公開', '/dash/notes/{uid}', '公開する', { noteUid: '{uid}', openedRevision: 1 }],
      [
        '転載先',
        '/dash/notes/{uid}',
        '転載先を記録する',
        { noteUid: '{uid}', syndicationUrl: 'https://example.com/stranger' },
      ],
      ['削除', '/dash/notes/{uid}/delete', '削除する', { noteUid: '{uid}' }],
    ] as const)(
      '%s は D1 を変えず、入力した値を返さない',
      async (_label, path, button, rawValues) => {
        const values = Object.fromEntries(
          Object.entries(rawValues).map(([name, value]) => [
            name,
            typeof value === 'string' ? value.replace('{uid}', draftUid) : value,
          ]),
        );
        const fields = await readFormFields(path.replace('{uid}', draftUid), button);
        const before = await readRows();
        const res = await send(how, fields, values, {});
        expect(await res.text()).not.toContain('書かれた題');
        expect(await readRows()).toEqual(before);
      },
    );

    it('対照: オーナーの JWT があれば、同じ形の作成が書く', async () => {
      const fields = await readFormFields('/dash/notes/new', '作る');
      const before = await countNotes();
      const res = await send(
        how,
        fields,
        { slug: `control-${how}`, title: '対照の題', description: '', body: '' },
        await authorHeaders(),
      );
      await res.arrayBuffer();
      expect(await countNotes()).toBe(before + 1);
    });
  });
});
