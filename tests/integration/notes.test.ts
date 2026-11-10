import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';
import { readRows } from './support/send';
import {
  deleteNoteRow,
  insertLinkPreview,
  insertNote,
  insertNoteMedia,
  insertNoteRevision,
  insertSyndication,
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
let draft: { id: number; uid: string; revision: { uid: string } };
const DRAFT_SYNDICATION = 'https://example.com/integration-syndicated';
let republishedId: number;
let publishedUid: string;
let deletedUid: string;
let lifecycleUid: string;
let revert: { uid: string; firstRevisionUid: string; latestRevisionUid: string };
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

/**
 * オーナーとして画面を開き、`marker`（入力の名前など）を含むフォームの操作を取り出し、`values` を
 * JavaScript なしのブラウザと同じ multipart で送る。ファイルを送れるよう、値に Blob を取る
 */
const submitFormWith = async ({
  formPath,
  marker,
  values,
  asAuthor,
  to = formPath,
}: {
  formPath: string;
  marker: string;
  values: Record<string, string | Blob>;
  asAuthor: boolean;
  to?: string;
}) => {
  const page = await ctx.server.fetch(formPath, { headers: await authorHeaders() });
  expect(page.status).toBe(200);
  const forms = (await page.text()).match(/<form\b[\s\S]*?<\/form>/g) ?? [];
  const form = forms.find((html) => html.includes(marker));
  if (!form) throw new Error(`${formPath} に ${marker} を含むフォームがない`);
  const body = new FormData();
  for (const [name, value] of Object.entries(readActionFields(form))) body.append(name, value);
  for (const [name, value] of Object.entries(values)) body.append(name, value);
  const encoded = new Response(body);
  return ctx.server.fetch(to, {
    method: 'POST',
    body: await encoded.arrayBuffer(),
    headers: {
      ...(asAuthor ? await authorHeaders() : {}),
      'content-type': encoded.headers.get('content-type') ?? '',
    },
    redirect: 'manual',
  });
};

/** 1×1 の PNG（作り物）。共有担当の media-storage.ts が先頭のバイトで形式を見分ける */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

const readNoteTables = async () => ({
  note: await readRows(ctx, 'note'),
  note_revision: await readRows(ctx, 'note_revision'),
  syndication: await readRows(ctx, 'syndication'),
});

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      draft = await insertNote(db, HIDDEN.draft);
      await insertSyndication(db, draft.id, DRAFT_SYNDICATION);

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

      const reverting = await insertNote(db, {
        slug: 'integration-revert',
        title: '戻す前の版の題',
        body: '戻す先の版の本文',
      });
      const latest = await insertNoteRevision(db, reverting.id, {
        title: '公開した版の題',
        body: '戻す前に公開していた本文',
      });
      await publishNoteRow(db, reverting.id);
      revert = {
        uid: reverting.uid,
        firstRevisionUid: reverting.revision.uid,
        latestRevisionUid: latest.uid,
      };

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
          `![自分の画像の代替テキスト](media:${ownMediaKey} "自分の画像のホバーの文")\n*自分の画像のキャプション*`,
          `![無い画像の代替テキスト](media:${MISSING_MEDIA_KEY})\n*無い画像のキャプション*`,
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

  it('URL だけの段落は、参照先の情報を持てばカードで、持たなければリンクで出し、表示では取りに行かない（FR-027・FR-028・SC-005）', async () => {
    await insertLinkPreview(ctx.db, {
      url: 'https://example.com/integration-visitor-known',
      title: '訪問者のカードの題',
      imageUrl: 'https://example.com/integration-visitor-known.png',
    });
    // 取りに行けば取れる名前の URL。表示で取れば `link_preview` に行が増える
    const unknown = 'https://example.com/integration-visitor-unknown';
    const note = await insertNote(ctx.db, {
      slug: 'integration-visitor-links',
      body: `https://example.com/integration-visitor-known\n\n${unknown}`,
    });
    await publishNoteRow(ctx.db, note.id);
    const countRows = async () =>
      ctx.db.prepare('SELECT count(*) AS n FROM link_preview').first('n');
    const before = await countRows();

    const html = await (await ctx.server.fetch('/notes/integration-visitor-links')).text();

    expect(html).toContain('訪問者のカードの題');
    expect(html).toContain('src="https://example.com/integration-visitor-known.png"');
    expect(html).toContain(`<p><a href="${unknown}">${unknown}</a></p>`);
    expect(await countRows()).toBe(before);
  });

  it('説明文が空なら、本文の最初の段落が説明に出る', async () => {
    const html = await (await ctx.server.fetch('/notes/integration-no-description')).text();
    expect(html).toMatch(/<meta name="description" content="本文の最初の段落"/);
    expect(html).toMatch(/<meta property="og:description" content="本文の最初の段落"/);
    expect(html).toMatch(/<meta name="twitter:title" content="説明文の無い題"/);
    expect(html).toMatch(/<meta name="twitter:description" content="本文の最初の段落"/);
    // twitter を書き直しても、root layout のカードの種類と作者は残す
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
    expect(html).toMatch(/<meta name="twitter:creator" content="@ksyunnnn"/);
  });

  it('公開し直すと直した本文が出て、初めて公開した日時が変わらない（SC-004）', async () => {
    await insertNoteRevision(ctx.db, republishedId, { title: '直した題', body: '直した本文' });
    await publishNoteRow(ctx.db, republishedId, '2026-11-05T00:00:00.000Z');
    const html = await (await ctx.server.fetch('/notes/integration-republished')).text();
    expect(html).toContain('直した本文');
    expect(html).not.toContain('直す前の本文');
    expect(html).toContain('dateTime="2026-11-01T00:00:00.000Z"');
  });

  it('画像の印は figure・img alt・title・figcaption で出し、その note の画像に無い印は出さない（T040）', async () => {
    const html = await (await ctx.server.fetch('/notes/integration-media')).text();
    expect(html).toMatch(
      new RegExp(
        `<figure><img src="/notes/integration-media/media/${ownMediaKey}" alt="自分の画像の代替テキスト" title="自分の画像のホバーの文"/><figcaption>自分の画像のキャプション</figcaption></figure>`,
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
      [
        'revertNote',
        `/dash/notes/${revert.uid}/revisions/${revert.firstRevisionUid}`,
        0,
        {
          noteUid: revert.uid,
          revisionUid: revert.firstRevisionUid,
          openedRevisionUid: revert.latestRevisionUid,
        },
      ],
      [
        'removeNoteSyndication',
        `/dash/notes/${draft.uid}`,
        2,
        { noteUid: draft.uid, syndicationUrl: DRAFT_SYNDICATION },
      ],
      [
        'addNoteSyndication',
        `/dash/notes/${draft.uid}`,
        3,
        { noteUid: draft.uid, syndicationUrl: 'https://example.com/integration-added' },
      ],
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

describe('過去の版（FR-008・FR-009、User Story 3 の 3）', () => {
  it('別の note の版の画面は 404', async () => {
    const res = await ctx.server.fetch(
      `/dash/notes/${draft.uid}/revisions/${revert.firstRevisionUid}`,
      {
        headers: await authorHeaders(),
      },
    );
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('戻す先の版の本文');
  });

  it('公開した note を過去の版に戻し、公開し直さなければ、戻す前に公開していた版が出る', async () => {
    const before = (await readRows(ctx, 'note_revision')).length;
    const res = await sendNoteForm({
      how: 'submit',
      formPath: `/dash/notes/${revert.uid}/revisions/${revert.firstRevisionUid}`,
      values: {
        noteUid: revert.uid,
        revisionUid: revert.firstRevisionUid,
        openedRevisionUid: revert.latestRevisionUid,
      },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    expect((await readRows(ctx, 'note_revision')).length).toBe(before + 1);

    const html = await (await ctx.server.fetch('/notes/integration-revert')).text();
    expect(html).toContain('戻す前に公開していた本文');
    expect(html).not.toContain('戻す先の版の本文');
  });
});

describe('note の画像と代表画像（FR-023〜FR-026、SC-001、User Story 5 の 1・4・5）', () => {
  /** オーナーとして画像を足し、足した画像の置き場のキーを返す */
  const upload = async (noteUid: string) => {
    const res = await submitFormWith({
      formPath: `/dash/notes/${noteUid}`,
      marker: 'name="mediaFile"',
      values: {
        noteUid,
        mediaFile: new Blob([PNG], { type: 'image/png' }),
      },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    const row = await ctx.db
      .prepare(
        'SELECT m.storage_key FROM media m JOIN note n ON n.id = m.note_id WHERE n.uid = ? ORDER BY m.id DESC',
      )
      .bind(noteUid)
      .first<{ storage_key: string }>();
    if (!row) throw new Error('画像が記録されていない');
    return row.storage_key;
  };

  const fetchMedia = (slug: string, key: string) => ctx.server.fetch(`/notes/${slug}/media/${key}`);

  const expectHidden = async (res: Awaited<ReturnType<typeof fetchMedia>>) => {
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  };

  it('下書きの note の画像は 404 で no-store。公開した版の本文が指せば 200 で原本を返す', async () => {
    const note = await insertNote(ctx.db, { slug: 'integration-image' });
    const key = await upload(note.uid);
    await expectHidden(await fetchMedia('integration-image', key));

    await insertNoteRevision(ctx.db, note.id, {
      title: '画像の題',
      body: `![代替テキスト](media:${key})\n*キャプション*`,
    });
    await publishNoteRow(ctx.db, note.id);
    const res = await fetchMedia('integration-image', key);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('公開した後に保存した版にだけ置いた画像は、公開し直すまで返らない（User Story 5 の 5）', async () => {
    const note = await insertNote(ctx.db, { slug: 'integration-later-image' });
    await publishNoteRow(ctx.db, note.id);
    const key = await upload(note.uid);
    await insertNoteRevision(ctx.db, note.id, { body: `![後の画像](media:${key})` });
    await expectHidden(await fetchMedia('integration-later-image', key));
  });

  it('別の note の画像は、その note の経路で返らない', async () => {
    const other = await insertNote(ctx.db, { slug: 'integration-other-image' });
    const key = await upload(other.uid);
    await expectHidden(await fetchMedia('integration-published', key));
  });

  it('削除した note の画像は返らない', async () => {
    const note = await insertNote(ctx.db, { slug: 'integration-deleted-image' });
    const key = await upload(note.uid);
    await insertNoteRevision(ctx.db, note.id, { title: '題', body: `![画像](media:${key})` });
    await publishNoteRow(ctx.db, note.id);
    await deleteNoteRow(ctx.db, note.id);
    await expectHidden(await fetchMedia('integration-deleted-image', key));
  });

  it('代表画像に選んだ画像は、本文に無くても返り、OGP に出る', async () => {
    const note = await insertNote(ctx.db, {
      slug: 'integration-card-media',
      title: '代表画像の題',
    });
    const key = await upload(note.uid);
    const res = await submitFormWith({
      formPath: `/dash/notes/${note.uid}`,
      marker: 'name="cardImage"',
      values: { noteUid: note.uid, cardImage: `media:${key}` },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    await publishNoteRow(ctx.db, note.id);
    expect((await fetchMedia('integration-card-media', key)).status).toBe(200);
    const html = await (await ctx.server.fetch('/notes/integration-card-media')).text();
    expect(html).toMatch(
      new RegExp(
        `<meta property="og:image" content="[^"]*/notes/integration-card-media/media/${key}"`,
      ),
    );
  });

  it('代表画像を site にすると、サイト共通の画像が OGP に出る（FR-024）', async () => {
    const note = await insertNote(ctx.db, {
      slug: 'integration-card-site',
      title: 'サイトの画像の題',
    });
    const res = await submitFormWith({
      formPath: `/dash/notes/${note.uid}`,
      marker: 'name="cardImage"',
      values: { noteUid: note.uid, cardImage: 'site' },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    await publishNoteRow(ctx.db, note.id);
    const html = await (await ctx.server.fetch('/notes/integration-card-site')).text();
    expect(html).toMatch(/<meta property="og:image" content="[^"]*\/opengraph-image"/);
  });

  it('JWT のない changeNoteCardImage・addNoteMedia は D1 を変えない（FR-033）', async () => {
    const before = { ...(await readNoteTables()), media: await readRows(ctx, 'media') };
    for (const [marker, values] of [
      ['name="cardImage"', { noteUid: draft.uid, cardImage: 'site' }],
      [
        'name="mediaFile"',
        { noteUid: draft.uid, mediaFile: new Blob([PNG], { type: 'image/png' }) },
      ],
    ] as const) {
      const res = await submitFormWith({
        formPath: `/dash/notes/${draft.uid}`,
        marker,
        values,
        asAuthor: false,
        to: '/',
      });
      await res.arrayBuffer();
    }
    expect({ ...(await readNoteTables()), media: await readRows(ctx, 'media') }).toEqual(before);
  });
});

describe('説明文が空のときの説明（FR-034・FR-033）', () => {
  const FIELD = 'isFirstParagraphAsDescription';

  it('本文の最初の段落を使わないにすると、説明文の空な note の説明が出ない', async () => {
    const note = await insertNote(ctx.db, {
      slug: 'integration-no-first-paragraph',
      title: '最初の段落を使わない題',
      body: '説明に出さない最初の段落',
    });
    await publishNoteRow(ctx.db, note.id);
    const res = await submitFormWith({
      formPath: `/dash/notes/${note.uid}`,
      marker: `name="${FIELD}"`,
      values: { noteUid: note.uid, [FIELD]: '0' },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    const html = await (await ctx.server.fetch('/notes/integration-no-first-paragraph')).text();
    expect(html).toContain('説明に出さない最初の段落');
    expect(html).not.toMatch(/<meta name="description"/);
    expect(html).not.toMatch(/<meta property="og:description"/);
    expect(html).not.toMatch(/<meta name="twitter:description"/);
  });

  it('JWT のない changeNoteFirstParagraphAsDescription は D1 を変えない', async () => {
    const before = await readNoteTables();
    const res = await submitFormWith({
      formPath: `/dash/notes/${draft.uid}`,
      marker: `name="${FIELD}"`,
      values: { noteUid: draft.uid, [FIELD]: '0' },
      asAuthor: false,
      to: '/',
    });
    await res.arrayBuffer();
    expect(await readNoteTables()).toEqual(before);
  });
});

describe('見た目の確認（REQUIREMENTS.md の FR-13、T049）', () => {
  it('下書きの note でも、最も新しい版を訪問者向けの部品で出す', async () => {
    const note = await insertNote(ctx.db, {
      slug: 'integration-preview',
      title: '見た目の確認の古い題',
    });
    await insertNoteRevision(ctx.db, note.id, {
      title: '見た目の確認の新しい題',
      body: '見た目の確認の **新しい** 本文',
    });
    const res = await ctx.server.fetch(`/dash/notes/${note.uid}/preview`, {
      headers: await authorHeaders(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<h1 class="text-3xl font-bold">見た目の確認の新しい題</h1>');
    expect(html).toContain('<strong>新しい</strong>');
    expect(html).toContain('公開していません');
    expect(html).not.toContain('見た目の確認の古い題');
  });

  it('参照先の情報を持つ URL はカードで、取れない URL はリンクで出し、取れない URL を書かない（U9）', async () => {
    await insertLinkPreview(ctx.db, {
      url: 'https://example.com/integration-preview-known',
      title: '見た目の確認のカードの題',
      imageUrl: 'https://example.com/integration-preview-known.png',
    });
    // `.invalid` は公開のインターネットで引けない名前（RFC 6761）。取得の部品は要求を出さずに失敗にする
    const unfetched = 'https://integration-preview.invalid/a';
    const note = await insertNote(ctx.db, {
      slug: 'integration-preview-links',
      body: `https://example.com/integration-preview-known\n\n${unfetched}`,
    });
    const res = await ctx.server.fetch(`/dash/notes/${note.uid}/preview`, {
      headers: await authorHeaders(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('見た目の確認のカードの題');
    expect(html).toContain('src="https://example.com/integration-preview-known.png"');
    expect(html).toContain(`<p><a href="${unfetched}">${unfetched}</a></p>`);
    expect(
      await ctx.db
        .prepare('SELECT count(*) AS n FROM link_preview WHERE url = ?')
        .bind(unfetched)
        .first('n'),
    ).toBe(0);
  });

  it('オーナーの JWT がなければ 403 で、中身を返さない', async () => {
    const note = await insertNote(ctx.db, { title: '見た目の確認の隠す題' });
    const res = await ctx.server.fetch(`/dash/notes/${note.uid}/preview`);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('見た目の確認の隠す題');
  });
});

describe('見た目の確認の画像（REQUIREMENTS.md の FR-13、NFR-09）', () => {
  /** オーナーとして画像を足し、足した画像の置き場のキーを返す */
  const uploadAsOwner = async (noteUid: string) => {
    const res = await submitFormWith({
      formPath: `/dash/notes/${noteUid}`,
      marker: 'name="mediaFile"',
      values: { noteUid, mediaFile: new Blob([PNG], { type: 'image/png' }) },
      asAuthor: true,
    });
    expect(res.status).toBe(303);
    const row = await ctx.db
      .prepare(
        'SELECT m.storage_key FROM media m JOIN note n ON n.id = m.note_id WHERE n.uid = ? ORDER BY m.id DESC',
      )
      .bind(noteUid)
      .first<{ storage_key: string }>();
    if (!row) throw new Error('画像が記録されていない');
    return row.storage_key;
  };

  const fetchPreviewMedia = async (noteUid: string, key: string, asAuthor = true) =>
    ctx.server.fetch(`/dash/notes/${noteUid}/preview/media/${key}`, {
      headers: asAuthor ? await authorHeaders() : {},
    });

  it('下書きの最も新しい版の本文が指す画像を、オーナーに no-store で返し、画面の src もこの経路', async () => {
    const note = await insertNote(ctx.db, { slug: 'integration-preview-media' });
    const key = await uploadAsOwner(note.uid);
    await insertNoteRevision(ctx.db, note.id, {
      title: '見た目の確認の画像の題',
      body: `![確認する画像](media:${key})`,
    });

    const res = await fetchPreviewMedia(note.uid, key);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('etag')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);

    const html = await (
      await ctx.server.fetch(`/dash/notes/${note.uid}/preview`, { headers: await authorHeaders() })
    ).text();
    expect(html).toContain(`src="/dash/notes/${note.uid}/preview/media/${key}"`);

    // 訪問者の経路は、公開した版の画像だけを返す（spec の FR-026）
    expect((await ctx.server.fetch(`/notes/integration-preview-media/media/${key}`)).status).toBe(
      404,
    );
  });

  it('オーナーの JWT がなければ 403 で、中身を返さない', async () => {
    const note = await insertNote(ctx.db);
    const key = await uploadAsOwner(note.uid);
    await insertNoteRevision(ctx.db, note.id, { body: `![画像](media:${key})` });
    const res = await fetchPreviewMedia(note.uid, key, false);
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(new Uint8Array(await res.arrayBuffer())).not.toEqual(PNG);
  });

  it('確認している版の本文に無い画像と、別の note の画像は 404 で no-store', async () => {
    const note = await insertNote(ctx.db);
    const unused = await uploadAsOwner(note.uid);
    const other = await insertNote(ctx.db);
    const foreign = await uploadAsOwner(other.uid);
    await insertNoteRevision(ctx.db, note.id, { body: `![別の画像](media:${foreign})` });
    for (const key of [unused, foreign]) {
      const res = await fetchPreviewMedia(note.uid, key);
      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toContain('no-store');
      await res.arrayBuffer();
    }
  });
});
