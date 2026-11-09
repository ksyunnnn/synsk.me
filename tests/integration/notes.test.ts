import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeActionCall, encodeForm, readActionFields } from './support/form';
import { readRows } from './support/send';
import { insertNote } from '../support/note-rows';

/**
 * note の管理画面と、note の書き込みの操作（specs/003-note/spec.md の FR-033、contracts/dash.md）。
 * 訪問者の `/notes/{slug}` の応答は、本文を描く共有担当の Markdown の部品を待つ
 * （tasks.md の T015 の残り）
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
      draft = await insertNote(db, { slug: 'integration-draft', title: '作り物の下書きの題' });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
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
