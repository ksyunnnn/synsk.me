import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';
import { readRows } from './support/send';
import {
  deleteNoteRow,
  insertNote,
  insertNoteMedia,
  insertNoteRevision,
  publishNoteRow,
} from '../support/note-rows';

/**
 * 訪問者の note のページと、note の管理画面と書き込みの操作（specs/003-note/spec.md の FR-004・
 * FR-012・FR-015・FR-033、contracts/visitor-note.md・contracts/dash.md）
 */

/** オーナーが入力する値。D1 に残ったかを確かめるため、ほかの値と重ならないものにする */
const INPUT = {
  slug: 'integration-note',
  title: '結合の検査で入力した題',
  description: '',
  body: '結合の検査で入力した本文',
};

let ctx: TestServer;
let draft: { uid: string; revision: { uid: string } };
let republishedId: number;
let publishedUid: string;
let deletedUid: string;
let lifecycleUid: string;
let ownMediaKey: string;
const MISSING_MEDIA_KEY = '00000000-0000-4000-8000-000000000000';

/** 訪問者に見せない note の中身。応答に含まれないことを確かめる */
const HIDDEN = {
  draft: {
    slug: 'integration-draft',
    title: '作り物の下書きの題',
    description: '下書きの説明文',
    body: '下書きの本文',
  },
  later: {
    title: '公開した後に保存した題',
    description: '公開した後の説明文',
    body: '公開した後に保存した本文',
  },
  deleted: {
    slug: 'integration-deleted',
    title: '削除した note の題',
    description: '削除した説明文',
    body: '削除した本文',
  },
};

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

const ABSENT_UID = '0'.repeat(32);
const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

/**
 * オーナーとして画面を開き、`formIndex` 番目（0 から）のフォームの操作を取り出して送る。
 * 編集の画面は公開の操作と保存のフォームを持つため、送るフォームを選ぶ
 */
const sendNoteForm = async ({
  how,
  formPath,
  formIndex = 0,
  to = formPath,
  values,
  asAuthor,
}: {
  how: 'submit' | 'call';
  formPath: string;
  formIndex?: number;
  to?: string;
  values: Record<string, string>;
  asAuthor: boolean;
}) => {
  const page = await ctx.server.fetch(formPath, { headers: await authorHeaders() });
  expect(page.status).toBe(200);
  const html = await page.text();
  const starts = [...html.matchAll(/<form\b/g)].map((m) => m.index);
  const start = starts[formIndex];
  if (start === undefined) throw new Error(`${formPath} に ${formIndex} 番目のフォームがない`);
  const fields = readActionFields(html.slice(start));
  const headers: Record<string, string> = asAuthor ? await authorHeaders() : {};
  if (how === 'submit') {
    const { body, contentType } = await encodeForm(fields, values);
    return ctx.server.fetch(to, {
      method: 'POST',
      body,
      headers: { ...headers, 'content-type': contentType },
      redirect: 'manual',
    });
  }
  const request = await encodeActionCall(fields, values);
  return ctx.server.fetch(to, {
    method: 'POST',
    body: request.body,
    headers: { ...headers, ...request.headers },
    redirect: 'manual',
  });
};

const readNoteTables = async () => ({
  note: await readRows(ctx, 'note'),
  note_revision: await readRows(ctx, 'note_revision'),
});

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      draft = await insertNote(db, HIDDEN.draft);

      const published = await insertNote(db, {
        slug: 'integration-published',
        title: '公開した題',
        description: '公開した説明文',
        body: '公開した本文\n\n<script>alert(1)</script>',
      });
      await publishNoteRow(db, published.id);
      await insertNoteRevision(db, published.id, HIDDEN.later);

      const deleted = await insertNote(db, HIDDEN.deleted);
      await publishNoteRow(db, deleted.id);
      await deleteNoteRow(db, deleted.id);
      deletedUid = deleted.uid;

      publishedUid = published.uid;
      const lifecycle = await insertNote(db, {
        slug: 'integration-lifecycle',
        title: '下書きに戻す・削除する題',
        body: '下書きに戻す・削除する本文',
      });
      lifecycleUid = lifecycle.uid;
      await publishNoteRow(db, lifecycle.id);

      const noDescription = await insertNote(db, {
        slug: 'integration-no-description',
        title: '説明文の無い題',
        body: '本文の最初の段落\n\n二つ目の段落',
      });
      await publishNoteRow(db, noDescription.id);

      const republished = await insertNote(db, {
        slug: 'integration-republished',
        title: '直す前の題',
        body: '直す前の本文',
      });
      republishedId = republished.id;
      await publishNoteRow(db, republished.id, '2026-11-01T00:00:00.000Z');

      const withMedia = await insertNote(db, { slug: 'integration-media' });
      ownMediaKey = (
        await insertNoteMedia(db, withMedia.id, '11111111-1111-4111-8111-111111111111')
      ).storageKey;
      await insertNoteRevision(db, withMedia.id, {
        title: '画像のある題',
        body: [
          `![自分の画像の代替テキスト](media:${ownMediaKey} "自分の画像のキャプション")`,
          `![無い画像の代替テキスト](media:${MISSING_MEDIA_KEY} "無い画像のキャプション")`,
        ].join('\n\n'),
      });
      await publishNoteRow(db, withMedia.id);
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('/notes/{slug}（FR-004・FR-012・FR-015・SC-001）', () => {
  it('公開した note は 200 で、公開した版の題・説明文・本文を出す', async () => {
    const res = await ctx.server.fetch('/notes/integration-published');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('公開した題');
    expect(html).toContain('公開した説明文');
    expect(html).toContain('公開した本文');
  });

  it.each([AS_HTML, AS_RSC])(
    '公開した後に保存した版は応答に無い（%o）',
    async ({ headers, query }) => {
      const text = await (
        await ctx.server.fetch(`/notes/integration-published${query}`, { headers })
      ).text();
      for (const value of Object.values(HIDDEN.later)) expect(text).not.toContain(value);
    },
  );

  it('本文に書いた HTML は要素にならない（U4 の決定）', async () => {
    const html = await (await ctx.server.fetch('/notes/integration-published')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it.each([
    ['下書き', HIDDEN.draft],
    ['削除した', HIDDEN.deleted],
  ])('%sの note は 404 で、HTML と RSC の応答に題・説明文・本文が無い', async (_, note) => {
    for (const { headers, query } of [AS_HTML, AS_RSC]) {
      const res = await ctx.server.fetch(`/notes/${note.slug}${query}`, { headers });
      const text = await res.text();
      // RSC の要求は、404 の画面（`/missing`）の中身を 200 で返す（vinext。/projects/{slug} も同じ）
      if (query === '') expect(res.status).toBe(404);
      else expect(text).toContain(`route:/notes/${note.slug}/missing`);
      for (const value of [note.title, note.description, note.body]) {
        expect(text).not.toContain(value);
      }
    }
  });

  it('説明文が空なら、本文の最初の段落が説明に出る', async () => {
    const html = await (await ctx.server.fetch('/notes/integration-no-description')).text();
    expect(html).toMatch(/<meta name="description" content="本文の最初の段落"/);
    expect(html).toMatch(/<meta property="og:description" content="本文の最初の段落"/);
  });

  it('公開し直すと直した本文が出て、初めて公開した日時が変わらない（SC-004）', async () => {
    await insertNoteRevision(ctx.db, republishedId, { title: '直した題', body: '直した本文' });
    await publishNoteRow(ctx.db, republishedId, '2026-11-05T00:00:00.000Z');
    const html = await (await ctx.server.fetch('/notes/integration-republished')).text();
    expect(html).toContain('直した本文');
    expect(html).not.toContain('直す前の本文');
    expect(html).toContain('dateTime="2026-11-01T00:00:00.000Z"');
  });

  it('画像の印は figure・img alt・figcaption で出し、その note の画像に無い印は出さない（T040）', async () => {
    const html = await (await ctx.server.fetch('/notes/integration-media')).text();
    expect(html).toMatch(
      new RegExp(
        `<figure><img src="/notes/integration-media/media/${ownMediaKey}" alt="自分の画像の代替テキスト"/><figcaption>自分の画像のキャプション</figcaption></figure>`,
      ),
    );
    expect(html).not.toContain(MISSING_MEDIA_KEY);
    expect(html).not.toContain('無い画像のキャプション');
  });
});

describe('オーナーの画面', () => {
  it.each(['/dash/notes', '/dash/notes/new', '/dash/notes/{uid}'])(
    'オーナーの %s は 200',
    async (template) => {
      const res = await ctx.server.fetch(template.replace('{uid}', draft.uid), {
        headers: await authorHeaders(),
      });
      expect(res.status).toBe(200);
    },
  );

  it('無い uid の編集の画面は 404', async () => {
    const res = await ctx.server.fetch(`/dash/notes/${ABSENT_UID}`, {
      headers: await authorHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it.each(['/dash/notes', '/dash/notes/new', '/dash/notes/{uid}'])(
    'オーナーの JWT がない %s は 403 で no-store を持ち、画面の中身を返さない',
    async (template) => {
      const res = await ctx.server.fetch(template.replace('{uid}', draft.uid));
      expect(res.status).toBe(403);
      expect(res.headers.get('cache-control')).toContain('no-store');
      const text = await res.text();
      expect(text).not.toContain('作り物の下書きの題');
      expect(text).not.toContain('<form');
    },
  );
});

describe('オーナーの JWT がない書き込み（FR-033）', () => {
  /**
   * Server Action は経路に縛られない。`/dash` の外の経路へ送り、`src/proxy.ts` の 403 に
   * 頼らずに、Server Action が自分で拒むことを確かめる
   */
  const OUTSIDE_DASH = '/';

  const cases = () =>
    [
      ['createNote', '/dash/notes/new', 0, INPUT],
      ['publishNote', `/dash/notes/${draft.uid}`, 0, { noteUid: draft.uid }],
      [
        'saveNote',
        `/dash/notes/${draft.uid}`,
        1,
        {
          ...INPUT,
          slug: 'integration-draft',
          noteUid: draft.uid,
          openedRevisionUid: draft.revision.uid,
        },
      ],
      ['unpublishNote', `/dash/notes/${publishedUid}`, 1, { noteUid: publishedUid }],
      ['deleteNote', `/dash/notes/${publishedUid}/delete`, 0, { noteUid: publishedUid }],
      ['restoreNote', `/dash/notes/${deletedUid}`, 0, { noteUid: deletedUid }],
    ] as const;

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it('どの書き込みも D1 を変えず、入力した値を返さない', async () => {
      for (const [name, formPath, formIndex, values] of cases()) {
        const before = await readNoteTables();
        const res = await sendNoteForm({
          how,
          formPath,
          formIndex,
          to: OUTSIDE_DASH,
          values,
          asAuthor: false,
        });
        expect(await res.text(), name).not.toContain(INPUT.body);
        expect(await readNoteTables(), name).toEqual(before);
      }
    });

    it('対照: オーナーの JWT があれば、同じ形の作成が書く', async () => {
      const before = (await readRows(ctx, 'note')).length;
      const res = await sendNoteForm({
        how,
        formPath: '/dash/notes/new',
        values: { ...INPUT, slug: `${INPUT.slug}-${how}` },
        asAuthor: true,
      });
      await res.arrayBuffer();
      expect((await readRows(ctx, 'note')).length).toBe(before + 1);
    });
  });
});

describe('下書きに戻す・削除する・元に戻す（FR-014・FR-016・SC-007、User Story 2 の 1・3・5）', () => {
  const PATH = '/notes/integration-lifecycle';
  const BODY = '下書きに戻す・削除する本文';

  const send = async (formPath: string, formIndex: number) => {
    const res = await sendNoteForm({
      how: 'submit',
      formPath,
      formIndex,
      values: { noteUid: lifecycleUid },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
  };

  const visitorStatus = async () => {
    const res = await ctx.server.fetch(PATH);
    return { status: res.status, text: await res.text() };
  };

  it('下書きに戻すと 404 で中身が無く、公開し直すと同じ版が出る', async () => {
    await send(`/dash/notes/${lifecycleUid}`, 1);
    const hidden = await visitorStatus();
    expect(hidden.status).toBe(404);
    expect(hidden.text).not.toContain(BODY);

    await send(`/dash/notes/${lifecycleUid}`, 0);
    const republished = await visitorStatus();
    expect(republished.status).toBe(200);
    expect(republished.text).toContain(BODY);
  });

  it('公開した note を削除すると 404 で中身が無く、元に戻すと同じ版が 200 で出る', async () => {
    await send(`/dash/notes/${lifecycleUid}/delete`, 0);
    const hidden = await visitorStatus();
    expect(hidden.status).toBe(404);
    expect(hidden.text).not.toContain(BODY);

    await send(`/dash/notes/${lifecycleUid}`, 0);
    const restored = await visitorStatus();
    expect(restored.status).toBe(200);
    expect(restored.text).toContain(BODY);
  });
});
