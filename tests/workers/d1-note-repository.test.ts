import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NoteContent } from '@/features/note/domain/note';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';

/**
 * `NoteRepository` の D1 の実装を、本番と同じ `migrations/` を当てた D1 で確かめる。
 *
 * 規則のうち、データベースが止めるもの（specs/005-note-write-and-read/data-model.md の
 * 「データベースで止める規則」）もここで確かめる。入力の規則を JavaScript で
 * 確かめることは `tests/unit/note-domain.test.ts` が持つ。
 */

const notes = createD1NoteRepository(env.DB);

const content = (overrides: Partial<NoteContent> = {}): NoteContent => ({
  slug: 'first-note',
  title: '題',
  body: '本文',
  ...overrides,
});

const FIRST_PUBLISHED_AT = '2026-09-16T15:30:00.000Z';
const REPUBLISHED_AT = '2026-09-20T01:00:00.000Z';

const createNote = async (overrides: Partial<NoteContent> = {}) => {
  const result = await notes.create(content(overrides));
  if (!result.ok) throw new Error(`note を作れなかった: ${result.reason}`);
  return result.id;
};

const countRows = async (table: 'note' | 'note_publication') => {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n;
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  // note_publication は外部キーの ON DELETE CASCADE で一緒に消える
  await env.DB.prepare('DELETE FROM note').run();
});

describe('作る', () => {
  it('下書きの note ができる', async () => {
    const id = await createNote();
    expect(await notes.findForEdit(id)).toEqual({
      id,
      slug: 'first-note',
      title: '題',
      body: '本文',
      status: 'draft',
    });
    expect(await notes.listForAuthor()).toEqual([
      { id, slug: 'first-note', title: '題', status: 'draft', hasUnpublishedChanges: false },
    ]);
  });

  it('他の note が使っている slug では作らない', async () => {
    await createNote();
    expect(await notes.create(content({ title: '別の題' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(await countRows('note')).toBe(1);
  });
});

describe('訪問者向けの取り出し', () => {
  it('下書きは公開済みの取り出しに出ない', async () => {
    await createNote();
    expect(await notes.findPublishedBySlug('first-note')).toBeNull();
  });

  it('存在しない slug は下書きと同じく null', async () => {
    expect(await notes.findPublishedBySlug('nothing')).toBeNull();
  });
});

describe('公開する', () => {
  it('入力した内容を保存し、その題と本文を公開する', async () => {
    const id = await createNote();
    const result = await notes.publish(
      id,
      content({ title: '公開する題', body: '公開する本文' }),
      FIRST_PUBLISHED_AT,
    );

    expect(result).toEqual({ ok: true });
    expect(await notes.findPublishedBySlug('first-note')).toEqual({
      slug: 'first-note',
      title: '公開する題',
      body: '公開する本文',
      firstPublishedAt: FIRST_PUBLISHED_AT,
    });
    expect(await notes.findForEdit(id)).toMatchObject({
      title: '公開する題',
      body: '公開する本文',
      status: 'published',
    });
  });

  it('公開し直しても、初めて公開した日時は変わらない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.publish(id, content({ title: '書き換えた題' }), REPUBLISHED_AT);

    expect(await notes.findPublishedBySlug('first-note')).toEqual({
      slug: 'first-note',
      title: '書き換えた題',
      body: '本文',
      firstPublishedAt: FIRST_PUBLISHED_AT,
    });
  });

  it('公開の2文目が失敗すると、1文目の保存も残らない', async () => {
    const id = await createNote({ title: '保存してある題' });

    // 空の題は note には保存できるが、note_publication の制約が拒む
    await expect(notes.publish(id, content({ title: '' }), FIRST_PUBLISHED_AT)).rejects.toThrow();

    expect(await notes.findForEdit(id)).toMatchObject({ title: '保存してある題', status: 'draft' });
    expect(await countRows('note_publication')).toBe(0);
  });

  it('存在しない note は公開せず、何も書き込まない', async () => {
    expect(await notes.publish(999, content(), FIRST_PUBLISHED_AT)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(await countRows('note')).toBe(0);
    expect(await countRows('note_publication')).toBe(0);
  });
});

describe('保存する', () => {
  it('書き換えている内容だけを変え、公開している内容は変えない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(await notes.save(id, content({ title: '書き換えた題' }))).toEqual({ ok: true });

    expect(await notes.findForEdit(id)).toMatchObject({ title: '書き換えた題' });
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
  });

  it('他の note が使っている slug には変えない', async () => {
    await createNote({ slug: 'taken' });
    const id = await createNote();
    expect(await notes.save(id, content({ slug: 'taken' }))).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'first-note' });
  });

  it('存在しない note は保存しない', async () => {
    expect(await notes.save(999, content())).toEqual({ ok: false, reason: 'not-found' });
    expect(await countRows('note')).toBe(0);
  });
});

describe('公開後の slug', () => {
  it('保存で変えようとすると拒まれる', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(await notes.save(id, content({ slug: 'renamed', title: '書き換えた題' }))).toEqual({
      ok: false,
      reason: 'slug-fixed',
    });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'first-note', title: '題' });
  });

  it('公開し直すときに変えようとすると拒まれ、公開している内容も変わらない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(
      await notes.publish(id, content({ slug: 'renamed', title: '書き換えた題' }), REPUBLISHED_AT),
    ).toEqual({ ok: false, reason: 'slug-fixed' });
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
  });

  it('下書きのうちは変えられる', async () => {
    const id = await createNote();
    expect(await notes.save(id, content({ slug: 'renamed' }))).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'renamed' });
  });
});

describe('削除する', () => {
  it('公開している内容も一緒に消え、訪問者向けの取り出しに出ない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(await notes.delete(id)).toEqual({ ok: true });

    expect(await countRows('note')).toBe(0);
    expect(await countRows('note_publication')).toBe(0);
    expect(await notes.findPublishedBySlug('first-note')).toBeNull();
    expect(await notes.findForEdit(id)).toBeNull();
  });

  it('存在しない note は削除しない', async () => {
    expect(await notes.delete(999)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('削除した note の slug を使い回せる', async () => {
    const id = await createNote();
    await notes.delete(id);
    expect((await notes.create(content())).ok).toBe(true);
  });

  it('削除した note の id を使い回さない', async () => {
    const deletedId = await createNote();
    await notes.delete(deletedId);

    const id = await createNote();
    expect(id).toBeGreaterThan(deletedId);
    // 削除した note を開いたままの画面からの保存は、後から作った note を変えない
    expect(await notes.save(deletedId, content({ title: '古い画面からの保存' }))).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(await notes.findForEdit(id)).toMatchObject({ title: '題' });
  });
});

describe('公開し直していない書き換え', () => {
  it('公開済みで題か本文が異なるときだけ、書き換えがあると判定する', async () => {
    const draftId = await createNote({ slug: 'draft' });
    const sameId = await createNote({ slug: 'same' });
    const titleId = await createNote({ slug: 'title-changed' });
    const bodyId = await createNote({ slug: 'body-changed' });
    for (const id of [sameId, titleId, bodyId]) {
      const note = await notes.findForEdit(id);
      await notes.publish(id, content({ slug: note?.slug }), FIRST_PUBLISHED_AT);
    }
    await notes.save(titleId, content({ slug: 'title-changed', title: '書き換えた題' }));
    await notes.save(bodyId, content({ slug: 'body-changed', body: '書き換えた本文' }));

    const summaries = new Map((await notes.listForAuthor()).map((n) => [n.id, n]));
    expect(summaries.get(draftId)).toMatchObject({ status: 'draft', hasUnpublishedChanges: false });
    expect(summaries.get(sameId)).toMatchObject({
      status: 'published',
      hasUnpublishedChanges: false,
    });
    expect(summaries.get(titleId)).toMatchObject({
      title: '書き換えた題',
      status: 'published',
      hasUnpublishedChanges: true,
    });
    expect(summaries.get(bodyId)).toMatchObject({
      status: 'published',
      hasUnpublishedChanges: true,
    });
  });

  it('公開し直すと、書き換えがなくなる', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.save(id, content({ title: '書き換えた題' }));
    await notes.publish(id, content({ title: '書き換えた題' }), REPUBLISHED_AT);

    expect(await notes.listForAuthor()).toEqual([
      {
        id,
        slug: 'first-note',
        title: '書き換えた題',
        status: 'published',
        hasUnpublishedChanges: false,
      },
    ]);
  });
});

describe('データベースの制約', () => {
  const insertNote = (slug: string, title = '題', body = '本文') =>
    env.DB.prepare('INSERT INTO note (slug, title, body) VALUES (?, ?, ?)')
      .bind(slug, title, body)
      .run();

  const insertPublication = async (title: string, firstPublishedAt = FIRST_PUBLISHED_AT) => {
    const id = await createNote();
    return env.DB.prepare(
      'INSERT INTO note_publication (note_id, title, body, first_published_at) VALUES (?, ?, ?, ?)',
    )
      .bind(id, title, '本文', firstPublishedAt)
      .run();
  };

  describe('slug', () => {
    it('小文字の英字・数字・ハイフンからなる 1〜100 文字を受け付ける', async () => {
      await expect(insertNote('a-0')).resolves.toBeTruthy();
      await expect(insertNote('b'.repeat(100))).resolves.toBeTruthy();
    });

    it.each([
      ['空', ''],
      ['101文字', 'a'.repeat(101)],
      ['大文字', 'Hello'],
      ['下線', 'hello_world'],
      ['空白', 'hello world'],
      ['ASCII 以外', 'é'],
    ])('%s を拒む', async (_, slug) => {
      await expect(insertNote(slug)).rejects.toThrow(/CHECK constraint failed/);
    });

    it('重複を拒む', async () => {
      await insertNote('dup');
      await expect(insertNote('dup')).rejects.toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('題と本文の長さ', () => {
    it('コードポイントで数え、題200文字と本文100,000文字を受け付ける', async () => {
      await expect(
        insertNote('emoji', '😀'.repeat(200), '😀'.repeat(100_000)),
      ).resolves.toBeTruthy();
    });

    it('題201文字を拒む', async () => {
      await expect(insertNote('long-title', 'あ'.repeat(201))).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('本文100,001文字を拒む', async () => {
      await expect(insertNote('long-body', '題', 'a'.repeat(100_001))).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('公開する題201文字を拒む', async () => {
      await expect(insertPublication('あ'.repeat(201))).rejects.toThrow(/CHECK constraint failed/);
    });
  });

  it('空の題の公開を拒む', async () => {
    await expect(insertPublication('')).rejects.toThrow(/CHECK constraint failed/);
  });

  it.each([
    '2026-09-17',
    '2026-09-17 10:00:00',
    '2026-09-17T10:00:00Z',
    '2026-13-01T00:00:00.000Z',
    '日時ではない',
  ])('日時の形 %s を拒む', async (value) => {
    await expect(insertPublication('題', value)).rejects.toThrow(/CHECK constraint failed/);
  });

  it('公開した note の slug の変更を拒む', async () => {
    await insertPublication('題');
    await expect(
      env.DB.prepare("UPDATE note SET slug = 'renamed' WHERE slug = 'first-note'").run(),
    ).rejects.toThrow(/note_slug_fixed_after_publication/);
  });

  it('存在しない note の公開を拒む', async () => {
    await expect(
      env.DB.prepare(
        'INSERT INTO note_publication (note_id, title, body, first_published_at) VALUES (?, ?, ?, ?)',
      )
        .bind(999, '題', '本文', FIRST_PUBLISHED_AT)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });
});
