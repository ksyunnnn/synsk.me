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

const CREATED_AT = '2026-09-16T15:00:00.000Z';
const SAVED_AT = '2026-09-16T15:10:00.000Z';
const FIRST_PUBLISHED_AT = '2026-09-16T15:30:00.000Z';
const REPUBLISHED_AT = '2026-09-20T01:00:00.000Z';
const DELETED_AT = '2026-10-01T03:00:00.000Z';
const DELETED_LATER_AT = '2026-10-02T03:00:00.000Z';

const createNote = async (overrides: Partial<NoteContent> = {}) => {
  const result = await notes.create(content(overrides), CREATED_AT);
  if (!result.ok) throw new Error(`note を作れなかった: ${result.reason}`);
  return result.id;
};

const countRows = async (table: 'note' | 'note_revision') => {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n;
};

/** note の版を、古いものから読む */
const readRevisions = async (noteId: number) => {
  const { results } = await env.DB.prepare(
    'SELECT title, body, created_at FROM note_revision WHERE note_id = ? ORDER BY id',
  )
    .bind(noteId)
    .all<{ title: string; body: string; created_at: string }>();
  return results;
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  // note_revision は外部キーの ON DELETE CASCADE で一緒に消える
  await env.DB.prepare('DELETE FROM note').run();
});

describe('作る', () => {
  it('下書きの note と、最初の版ができる', async () => {
    const id = await createNote();
    expect(await notes.findForEdit(id)).toEqual({
      id,
      slug: 'first-note',
      title: '題',
      body: '本文',
      status: 'draft',
      slugFixed: false,
    });
    expect(await notes.listForAuthor()).toEqual([
      { id, slug: 'first-note', title: '題', status: 'draft', hasUnpublishedChanges: false },
    ]);
    expect(await readRevisions(id)).toEqual([
      { title: '題', body: '本文', created_at: CREATED_AT },
    ]);
  });

  it('他の note が使っている slug では作らず、版も足さない', async () => {
    await createNote();
    expect(await notes.create(content({ title: '別の題' }), CREATED_AT)).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
    expect(await countRows('note')).toBe(1);
    expect(await countRows('note_revision')).toBe(1);
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
  it('入力した内容を版として保存し、その版を公開する', async () => {
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
      publishedAt: FIRST_PUBLISHED_AT,
    });
    expect(await notes.findForEdit(id)).toMatchObject({
      title: '公開する題',
      body: '公開する本文',
      status: 'published',
      slugFixed: true,
    });
    expect(await readRevisions(id)).toEqual([
      { title: '題', body: '本文', created_at: CREATED_AT },
      { title: '公開する題', body: '公開する本文', created_at: FIRST_PUBLISHED_AT },
    ]);
  });

  it('入力が最新の版と同じなら、版を足さずに最新の版を公開する', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(await countRows('note_revision')).toBe(1);
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
  });

  it('公開し直しても、初めて公開した日時は変わらない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.publish(id, content({ title: '書き換えた題' }), REPUBLISHED_AT);

    expect(await notes.findPublishedBySlug('first-note')).toEqual({
      slug: 'first-note',
      title: '書き換えた題',
      body: '本文',
      publishedAt: FIRST_PUBLISHED_AT,
    });
  });

  it('公開の途中の文が失敗すると、足した版も slug の変更も残らない', async () => {
    const id = await createNote({ title: '保存してある題' });

    // 空の題の版は足せるが、公開する版にはトリガが拒む
    await expect(
      notes.publish(id, content({ slug: 'renamed', title: '' }), FIRST_PUBLISHED_AT),
    ).rejects.toThrow(/note_published_revision_invalid/);

    expect(await notes.findForEdit(id)).toMatchObject({
      slug: 'first-note',
      title: '保存してある題',
      status: 'draft',
    });
    expect(await countRows('note_revision')).toBe(1);
  });

  it('存在しない note は公開せず、何も書き込まない', async () => {
    expect(await notes.publish(999, content(), FIRST_PUBLISHED_AT)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(await countRows('note')).toBe(0);
    expect(await countRows('note_revision')).toBe(0);
  });
});

describe('保存する', () => {
  it('版を足し、公開している版は変えない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(await notes.save(id, content({ title: '書き換えた題' }), SAVED_AT)).toEqual({
      ok: true,
    });

    expect(await notes.findForEdit(id)).toMatchObject({ title: '書き換えた題' });
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
    expect(await readRevisions(id)).toEqual([
      { title: '題', body: '本文', created_at: CREATED_AT },
      { title: '書き換えた題', body: '本文', created_at: SAVED_AT },
    ]);
  });

  it('保存のたびに版を足し、前の版を残す', async () => {
    const id = await createNote();
    await notes.save(id, content({ title: '2つ目' }), SAVED_AT);
    await notes.save(id, content({ title: '3つ目' }), REPUBLISHED_AT);

    expect((await readRevisions(id)).map((revision) => revision.title)).toEqual([
      '題',
      '2つ目',
      '3つ目',
    ]);
  });

  it('題と本文が最新の版と同じなら、版を足さない', async () => {
    const id = await createNote();
    expect(await notes.save(id, content(), SAVED_AT)).toEqual({ ok: true });
    expect(await countRows('note_revision')).toBe(1);
  });

  it('題と本文を変えずに slug だけを変えると、版を足さずに slug を変える', async () => {
    const id = await createNote();
    expect(await notes.save(id, content({ slug: 'renamed' }), SAVED_AT)).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'renamed' });
    expect(await countRows('note_revision')).toBe(1);
  });

  it('他の note が使っている slug には変えず、版も足さない', async () => {
    await createNote({ slug: 'taken' });
    const id = await createNote();
    expect(
      await notes.save(id, content({ slug: 'taken', title: '書き換えた題' }), SAVED_AT),
    ).toEqual({ ok: false, reason: 'slug-taken' });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'first-note', title: '題' });
    expect(await readRevisions(id)).toHaveLength(1);
  });

  it('存在しない note は保存しない', async () => {
    expect(await notes.save(999, content(), SAVED_AT)).toEqual({ ok: false, reason: 'not-found' });
    expect(await countRows('note')).toBe(0);
    expect(await countRows('note_revision')).toBe(0);
  });
});

describe('公開後の slug', () => {
  it('保存で変えようとすると拒まれ、版も足さない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(
      await notes.save(id, content({ slug: 'renamed', title: '書き換えた題' }), SAVED_AT),
    ).toEqual({ ok: false, reason: 'slug-fixed' });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'first-note', title: '題' });
    expect(await countRows('note_revision')).toBe(1);
  });

  it('公開し直すときに変えようとすると拒まれ、公開している内容も変わらない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);

    expect(
      await notes.publish(id, content({ slug: 'renamed', title: '書き換えた題' }), REPUBLISHED_AT),
    ).toEqual({ ok: false, reason: 'slug-fixed' });
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
  });

  it('下書きで戻した note でも変えられない', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.delete(id, DELETED_AT);
    await notes.restore(id, 'draft');

    expect(await notes.findForEdit(id)).toMatchObject({ status: 'draft', slugFixed: true });
    expect(await notes.save(id, content({ slug: 'renamed' }), SAVED_AT)).toEqual({
      ok: false,
      reason: 'slug-fixed',
    });
  });

  it('一度も公開していないうちは変えられる', async () => {
    const id = await createNote();
    expect(await notes.save(id, content({ slug: 'renamed' }), SAVED_AT)).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({ slug: 'renamed', slugFixed: false });
  });
});

describe('削除する', () => {
  it('行も版も残したまま、訪問者向けの取り出しにも作り手の一覧にも出さない', async () => {
    const id = await createNote();
    await notes.publish(id, content({ title: '公開した題' }), FIRST_PUBLISHED_AT);

    expect(await notes.delete(id, DELETED_AT)).toEqual({ ok: true });

    expect(await countRows('note')).toBe(1);
    expect(await countRows('note_revision')).toBe(2);
    expect(await notes.findPublishedBySlug('first-note')).toBeNull();
    expect(await notes.findForEdit(id)).toBeNull();
    expect(await notes.listForAuthor()).toEqual([]);
  });

  it('存在しない note は削除しない', async () => {
    expect(await notes.delete(999, DELETED_AT)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('削除した note をもう一度削除せず、削除した日時を変えない', async () => {
    const id = await createNote();
    await notes.delete(id, DELETED_AT);

    expect(await notes.delete(id, DELETED_LATER_AT)).toEqual({ ok: false, reason: 'not-found' });
    const row = await env.DB.prepare('SELECT deleted_at FROM note WHERE id = ?')
      .bind(id)
      .first<{ deleted_at: string }>();
    expect(row?.deleted_at).toBe(DELETED_AT);
  });

  it('削除した note の slug は、新しい note に使えない', async () => {
    const id = await createNote();
    await notes.delete(id, DELETED_AT);
    expect(await notes.create(content(), CREATED_AT)).toEqual({ ok: false, reason: 'slug-taken' });
  });

  it('削除した note は保存も公開もせず、版も足さない', async () => {
    const id = await createNote();
    await notes.delete(id, DELETED_AT);

    expect(await notes.save(id, content({ title: '削除した後の保存' }), SAVED_AT)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(
      await notes.publish(id, content({ title: '削除した後の公開' }), FIRST_PUBLISHED_AT),
    ).toEqual({ ok: false, reason: 'not-found' });
    expect(await countRows('note_revision')).toBe(1);
    expect(await notes.listDeletedForAuthor()).toEqual([
      { id, slug: 'first-note', title: '題', status: 'draft', hasBeenPublished: false },
    ]);
  });

  it('削除した note の id を使い回さない', async () => {
    const deletedId = await createNote();
    await notes.delete(deletedId, DELETED_AT);

    const id = await createNote({ slug: 'second-note' });
    expect(id).toBeGreaterThan(deletedId);
    // 削除した note を開いたままの画面からの保存は、後から作った note を変えない
    expect(await notes.save(deletedId, content({ title: '古い画面からの保存' }), SAVED_AT)).toEqual(
      { ok: false, reason: 'not-found' },
    );
    expect(await notes.findForEdit(id)).toMatchObject({ title: '題' });
  });
});

describe('削除した note を戻す', () => {
  it('公開で戻すと、最後に公開した版と初めて公開した日時を見せ、書き換えも保つ', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.save(id, content({ title: '公開し直していない題' }), SAVED_AT);
    await notes.delete(id, DELETED_AT);

    expect(await notes.restore(id, 'published')).toEqual({ ok: true });

    expect(await notes.findPublishedBySlug('first-note')).toEqual({
      slug: 'first-note',
      title: '題',
      body: '本文',
      publishedAt: FIRST_PUBLISHED_AT,
    });
    expect(await notes.listForAuthor()).toEqual([
      {
        id,
        slug: 'first-note',
        title: '公開し直していない題',
        status: 'published',
        hasUnpublishedChanges: true,
      },
    ]);
    expect(await notes.listDeletedForAuthor()).toEqual([]);
  });

  it('公開していた note を下書きで戻すと訪問者に見えず、公開し直すと公開日は初めて公開した日のまま', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.delete(id, DELETED_AT);

    expect(await notes.restore(id, 'draft')).toEqual({ ok: true });

    expect(await notes.findPublishedBySlug('first-note')).toBeNull();
    expect(await notes.listForAuthor()).toEqual([
      { id, slug: 'first-note', title: '題', status: 'draft', hasUnpublishedChanges: false },
    ]);

    await notes.publish(id, content({ title: '直した題' }), REPUBLISHED_AT);
    expect(await notes.findPublishedBySlug('first-note')).toEqual({
      slug: 'first-note',
      title: '直した題',
      body: '本文',
      publishedAt: FIRST_PUBLISHED_AT,
    });
  });

  it('一度も公開していない note は、下書きで戻せて、公開では戻せない', async () => {
    const id = await createNote();
    await notes.delete(id, DELETED_AT);

    expect(await notes.restore(id, 'published')).toEqual({ ok: false, reason: 'not-found' });
    expect(await notes.findDeleted(id)).not.toBeNull();

    expect(await notes.restore(id, 'draft')).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toEqual({
      id,
      slug: 'first-note',
      title: '題',
      body: '本文',
      status: 'draft',
      slugFixed: false,
    });
    expect(await notes.findPublishedBySlug('first-note')).toBeNull();
  });

  it('下書きで戻してから削除した、公開したことのある note は、公開で戻せる', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.delete(id, DELETED_AT);
    await notes.restore(id, 'draft');
    await notes.delete(id, DELETED_LATER_AT);

    expect(await notes.findDeleted(id)).toMatchObject({ status: 'draft', hasBeenPublished: true });
    expect(await notes.restore(id, 'published')).toEqual({ ok: true });
    expect(await notes.findPublishedBySlug('first-note')).toMatchObject({ title: '題' });
  });

  it('削除していない note と存在しない note は戻さない', async () => {
    const id = await createNote();
    expect(await notes.restore(id, 'draft')).toEqual({ ok: false, reason: 'not-found' });
    expect(await notes.restore(999, 'draft')).toEqual({ ok: false, reason: 'not-found' });
  });

  it('削除した note だけを、後から削除したものを先に一覧する', async () => {
    const first = await createNote({ slug: 'deleted-first' });
    const second = await createNote({ slug: 'deleted-second' });
    await createNote({ slug: 'kept' });
    await notes.publish(second, content({ slug: 'deleted-second' }), FIRST_PUBLISHED_AT);
    await notes.delete(second, DELETED_AT);
    await notes.delete(first, DELETED_LATER_AT);

    expect(await notes.listDeletedForAuthor()).toEqual([
      { id: first, slug: 'deleted-first', title: '題', status: 'draft', hasBeenPublished: false },
      {
        id: second,
        slug: 'deleted-second',
        title: '題',
        status: 'published',
        hasBeenPublished: true,
      },
    ]);
  });

  it('削除した note だけを id で取り出す', async () => {
    const id = await createNote();
    expect(await notes.findDeleted(id)).toBeNull();

    await notes.delete(id, DELETED_AT);
    expect(await notes.findDeleted(id)).toEqual({
      id,
      slug: 'first-note',
      title: '題',
      status: 'draft',
      hasBeenPublished: false,
    });
    expect(await notes.findDeleted(999)).toBeNull();
  });
});

describe('公開し直していない書き換え', () => {
  it('公開済みで、最新の版の題か本文が公開した版と異なるときだけ、書き換えがあると判定する', async () => {
    const draftId = await createNote({ slug: 'draft' });
    const sameId = await createNote({ slug: 'same' });
    const titleId = await createNote({ slug: 'title-changed' });
    const bodyId = await createNote({ slug: 'body-changed' });
    const revertedId = await createNote({ slug: 'reverted' });
    for (const id of [sameId, titleId, bodyId, revertedId]) {
      const note = await notes.findForEdit(id);
      await notes.publish(id, content({ slug: note?.slug }), FIRST_PUBLISHED_AT);
    }
    await notes.save(titleId, content({ slug: 'title-changed', title: '書き換えた題' }), SAVED_AT);
    await notes.save(bodyId, content({ slug: 'body-changed', body: '書き換えた本文' }), SAVED_AT);
    // 書き換えてから、公開した版と同じ内容に戻した
    await notes.save(
      revertedId,
      content({ slug: 'reverted', title: '一度書き換えた題' }),
      SAVED_AT,
    );
    await notes.save(revertedId, content({ slug: 'reverted' }), REPUBLISHED_AT);

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
    expect(summaries.get(revertedId)).toMatchObject({
      status: 'published',
      hasUnpublishedChanges: false,
    });
  });

  it('公開し直すと、書き換えがなくなる', async () => {
    const id = await createNote();
    await notes.publish(id, content(), FIRST_PUBLISHED_AT);
    await notes.save(id, content({ title: '書き換えた題' }), SAVED_AT);
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
  const insertNote = (slug: string) =>
    env.DB.prepare('INSERT INTO note (slug) VALUES (?)').bind(slug).run();

  const insertRevision = (noteId: number, title = '題', body = '本文', createdAt = CREATED_AT) =>
    env.DB.prepare(
      'INSERT INTO note_revision (note_id, title, body, created_at) VALUES (?, ?, ?, ?) RETURNING id',
    )
      .bind(noteId, title, body, createdAt)
      .first<{ id: number }>();

  /** 版を1つ持つ下書きの note を作り、その id と版の id を返す */
  const draftWithRevision = async (title = '題', slug = 'first-note') => {
    const noteId = await createNote({ title, slug });
    const row = await env.DB.prepare('SELECT max(id) AS id FROM note_revision WHERE note_id = ?')
      .bind(noteId)
      .first<{ id: number }>();
    return { noteId, revisionId: row?.id ?? 0 };
  };

  const setPublication = (noteId: number, revisionId: number | null, publishedAt: string | null) =>
    env.DB.prepare('UPDATE note SET published_revision_id = ?, published_at = ? WHERE id = ?')
      .bind(revisionId, publishedAt, noteId)
      .run();

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

    it('公開したことのある note の slug の変更を拒む', async () => {
      const { noteId, revisionId } = await draftWithRevision();
      await setPublication(noteId, revisionId, FIRST_PUBLISHED_AT);
      await expect(
        env.DB.prepare("UPDATE note SET slug = 'renamed' WHERE id = ?").bind(noteId).run(),
      ).rejects.toThrow(/note_slug_fixed_after_publication/);
    });
  });

  describe('版の題と本文の長さ', () => {
    it('コードポイントで数え、題200文字と本文100,000文字を受け付ける', async () => {
      await insertNote('emoji');
      const { results } = await env.DB.prepare("SELECT id FROM note WHERE slug = 'emoji'").all<{
        id: number;
      }>();
      await expect(
        insertRevision(results[0]?.id ?? 0, '😀'.repeat(200), '😀'.repeat(100_000)),
      ).resolves.toBeTruthy();
    });

    it('題201文字を拒む', async () => {
      const { noteId } = await draftWithRevision();
      await expect(insertRevision(noteId, 'あ'.repeat(201))).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('本文100,001文字を拒む', async () => {
      const { noteId } = await draftWithRevision();
      await expect(insertRevision(noteId, '題', 'a'.repeat(100_001))).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });
  });

  describe('日時の形', () => {
    const INVALID_DATES = [
      '2026-09-17',
      '2026-09-17 10:00:00',
      '2026-09-17T10:00:00Z',
      '2026-13-01T00:00:00.000Z',
      '日時ではない',
    ];

    it.each(INVALID_DATES)('版を作った日時 %s を拒む', async (value) => {
      const { noteId } = await draftWithRevision();
      await expect(insertRevision(noteId, '題', '本文', value)).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it.each(INVALID_DATES)('初めて公開した日時 %s を拒む', async (value) => {
      const { noteId, revisionId } = await draftWithRevision();
      await expect(setPublication(noteId, revisionId, value)).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it.each(INVALID_DATES)('削除した日時 %s を拒む', async (value) => {
      const { noteId } = await draftWithRevision();
      await expect(
        env.DB.prepare('UPDATE note SET deleted_at = ? WHERE id = ?').bind(value, noteId).run(),
      ).rejects.toThrow(/CHECK constraint failed/);
    });
  });

  describe('公開', () => {
    it('公開した版と初めて公開した日時の、片方だけを持つことを拒む', async () => {
      const { noteId, revisionId } = await draftWithRevision();
      await expect(setPublication(noteId, revisionId, null)).rejects.toThrow(
        /CHECK constraint failed/,
      );
      await expect(setPublication(noteId, null, FIRST_PUBLISHED_AT)).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('公開した版を持たない公開を拒む', async () => {
      const { noteId } = await draftWithRevision();
      await expect(
        env.DB.prepare("UPDATE note SET status = 'published' WHERE id = ?").bind(noteId).run(),
      ).rejects.toThrow(/CHECK constraint failed/);
    });

    it('空の題の版の公開を拒む', async () => {
      const { noteId, revisionId } = await draftWithRevision('');
      await expect(setPublication(noteId, revisionId, FIRST_PUBLISHED_AT)).rejects.toThrow(
        /note_published_revision_invalid/,
      );
    });

    it('別の note の版の公開を拒む', async () => {
      const other = await draftWithRevision('題', 'other-note');
      const { noteId } = await draftWithRevision();
      await expect(setPublication(noteId, other.revisionId, FIRST_PUBLISHED_AT)).rejects.toThrow(
        /note_published_revision_invalid/,
      );
    });

    it('初めて公開した日時の変更を拒む', async () => {
      const { noteId, revisionId } = await draftWithRevision();
      await setPublication(noteId, revisionId, FIRST_PUBLISHED_AT);
      await expect(setPublication(noteId, revisionId, REPUBLISHED_AT)).rejects.toThrow(
        /note_published_at_fixed/,
      );
    });
  });

  describe('版', () => {
    it('書き換えを拒む', async () => {
      const { revisionId } = await draftWithRevision();
      await expect(
        env.DB.prepare("UPDATE note_revision SET title = '書き換えた題' WHERE id = ?")
          .bind(revisionId)
          .run(),
      ).rejects.toThrow(/note_revision_immutable/);
    });

    it('存在しない note の版を拒む', async () => {
      await expect(insertRevision(999)).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    it('note の行を消すと、公開した版を含めて版も消える', async () => {
      const { noteId, revisionId } = await draftWithRevision();
      await setPublication(noteId, revisionId, FIRST_PUBLISHED_AT);
      await insertRevision(noteId, '2つ目');

      await env.DB.prepare('DELETE FROM note WHERE id = ?').bind(noteId).run();

      expect(await countRows('note')).toBe(0);
      expect(await countRows('note_revision')).toBe(0);
    });
  });
});

describe('有無だけを確かめる', () => {
  /** 状態の違う note を 4 つ作り、存在しない id と slug を 1 つずつ加える */
  const createNotesInEveryState = async () => {
    const draft = await createNote({ slug: 'draft' });
    const published = await createNote({ slug: 'published' });
    await notes.publish(published, content({ slug: 'published' }), FIRST_PUBLISHED_AT);
    const deletedDraft = await createNote({ slug: 'deleted-draft' });
    await notes.delete(deletedDraft, DELETED_AT);
    const deletedPublished = await createNote({ slug: 'deleted-published' });
    await notes.publish(
      deletedPublished,
      content({ slug: 'deleted-published' }),
      FIRST_PUBLISHED_AT,
    );
    await notes.delete(deletedPublished, DELETED_AT);
    return {
      ids: [draft, published, deletedDraft, deletedPublished, 999_999],
      slugs: ['draft', 'published', 'deleted-draft', 'deleted-published', 'nothing'],
    };
  };

  it('hasPublished は、findPublishedBySlug が note を返す slug でだけ true', async () => {
    const { slugs } = await createNotesInEveryState();
    for (const slug of slugs) {
      expect(await notes.hasPublished(slug)).toBe((await notes.findPublishedBySlug(slug)) !== null);
    }
    expect(await notes.hasPublished('published')).toBe(true);
  });

  it('hasEditable は、findForEdit が note を返す id でだけ true', async () => {
    const { ids } = await createNotesInEveryState();
    for (const id of ids) {
      expect(await notes.hasEditable(id)).toBe((await notes.findForEdit(id)) !== null);
    }
    expect(await notes.hasEditable(ids[0])).toBe(true);
  });

  it('hasDeleted は、findDeleted が note を返す id でだけ true', async () => {
    const { ids } = await createNotesInEveryState();
    for (const id of ids) {
      expect(await notes.hasDeleted(id)).toBe((await notes.findDeleted(id)) !== null);
    }
    expect(await notes.hasDeleted(ids[2])).toBe(true);
  });
});
