import { describe, expect, it, vi } from 'vitest';
import { createNote } from '@/features/note/application/create-note';
import { getNoteForEdit } from '@/features/note/application/get-note-for-edit';
import { getPublishedNote } from '@/features/note/application/get-published-note';
import { listNotes } from '@/features/note/application/list-notes';
import { publishNote } from '@/features/note/application/publish-note';
import { saveNote } from '@/features/note/application/save-note';
import type { NoteContent } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * note のユースケース。`NoteRepository` を偽の実装に差し替えて確かめる。
 *
 * 規則そのもの（文字数の境界など）は `tests/unit/note-domain.test.ts` が、D1 での
 * 振る舞いは `tests/workers/d1-note-repository.test.ts` が持つ。ここでは、規則に
 * 合わない入力で書き込まないことと、結果の種類を確かめる。
 */

const unexpected = (name: string) => () => {
  throw new Error(`${name} は呼ばれない想定`);
};

/** 呼ばれない想定のメソッドは例外を投げる。テストごとに使うものだけを差し替える */
const fakeRepository = (overrides: Partial<NoteRepository> = {}): NoteRepository => ({
  create: vi.fn(unexpected('create')),
  save: vi.fn(unexpected('save')),
  publish: vi.fn(unexpected('publish')),
  delete: vi.fn(unexpected('delete')),
  findPublishedBySlug: vi.fn(unexpected('findPublishedBySlug')),
  findForEdit: vi.fn(unexpected('findForEdit')),
  listForAuthor: vi.fn(unexpected('listForAuthor')),
  ...overrides,
});

const content: NoteContent = { slug: 'first-note', title: '題', body: '本文' };
const PUBLISHED_AT = '2026-09-16T15:30:00.000Z';

describe('作る', () => {
  it('規則に合う入力で note を作り、id を返す', async () => {
    const create = vi.fn(async () => ({ ok: true as const, id: 7 }));
    expect(await createNote(fakeRepository({ create }), content)).toEqual({ ok: true, id: 7 });
    expect(create).toHaveBeenCalledWith(content);
  });

  it('入力が規則に合わなければ、書き込まずに誤りを返す', async () => {
    const notes = fakeRepository();
    expect(await createNote(notes, { ...content, slug: 'Bad Slug' })).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { slug: 'invalid' },
    });
    expect(notes.create).not.toHaveBeenCalled();
  });

  it('題が空でも作れる', async () => {
    const create = vi.fn(async () => ({ ok: true as const, id: 1 }));
    expect(await createNote(fakeRepository({ create }), { ...content, title: '' })).toEqual({
      ok: true,
      id: 1,
    });
  });

  it('slug が他の note と重なれば、そのことを返す', async () => {
    const create = vi.fn(async () => ({ ok: false as const, reason: 'slug-taken' as const }));
    expect(await createNote(fakeRepository({ create }), content)).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });

  it('保存に失敗すれば、失敗を返す', async () => {
    const create = vi.fn(async () => {
      throw new Error('D1_ERROR: 書き込めない');
    });
    expect(await createNote(fakeRepository({ create }), content)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});

describe('保存する', () => {
  it('規則に合う入力で、保存を頼む', async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    expect(await saveNote(fakeRepository({ save }), 3, content)).toEqual({ ok: true });
    expect(save).toHaveBeenCalledWith(3, content);
  });

  it('題が空でも保存できる', async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    expect(await saveNote(fakeRepository({ save }), 3, { ...content, title: '' })).toEqual({
      ok: true,
    });
  });

  it('入力が規則に合わなければ、書き込まずに誤りを返す', async () => {
    const notes = fakeRepository();
    expect(await saveNote(notes, 3, { ...content, title: 'あ'.repeat(201) })).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { title: 'too-long' },
    });
    expect(notes.save).not.toHaveBeenCalled();
  });

  it('公開済みの note の slug を変えようとすれば、そのことを返す', async () => {
    const save = vi.fn(async () => ({ ok: false as const, reason: 'slug-fixed' as const }));
    expect(await saveNote(fakeRepository({ save }), 3, content)).toEqual({
      ok: false,
      reason: 'slug-fixed',
    });
  });

  it('存在しない note は保存せず、そのことを返す', async () => {
    const save = vi.fn(async () => ({ ok: false as const, reason: 'not-found' as const }));
    expect(await saveNote(fakeRepository({ save }), 3, content)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('slug が他の note と重なれば、そのことを返す', async () => {
    const save = vi.fn(async () => ({ ok: false as const, reason: 'slug-taken' as const }));
    expect(await saveNote(fakeRepository({ save }), 3, content)).toEqual({
      ok: false,
      reason: 'slug-taken',
    });
  });

  it('保存に失敗すれば、失敗を返す', async () => {
    const save = vi.fn(async () => {
      throw new Error('D1_ERROR: 書き込めない');
    });
    expect(await saveNote(fakeRepository({ save }), 3, content)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});

describe('公開する', () => {
  it('規則に合う入力で、保存と公開を頼む', async () => {
    const publish = vi.fn(async () => ({ ok: true as const }));
    expect(await publishNote(fakeRepository({ publish }), 3, content, PUBLISHED_AT)).toEqual({
      ok: true,
    });
    expect(publish).toHaveBeenCalledWith(3, content, PUBLISHED_AT);
  });

  it('題が空なら、書き込まずに題が足りないことを返す', async () => {
    const notes = fakeRepository();
    expect(await publishNote(notes, 3, { ...content, title: '' }, PUBLISHED_AT)).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { title: 'missing' },
    });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it('入力が規則に合わなければ、書き込まずに誤りを返す', async () => {
    const notes = fakeRepository();
    expect(
      await publishNote(notes, 3, { ...content, body: 'あ'.repeat(100_001) }, PUBLISHED_AT),
    ).toEqual({ ok: false, reason: 'invalid', errors: { body: 'too-long' } });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it.each(['slug-taken', 'not-found', 'slug-fixed'] as const)(
    'Repository が %s を返せば、そのことを返す',
    async (reason) => {
      const publish = vi.fn(async () => ({ ok: false as const, reason }));
      expect(await publishNote(fakeRepository({ publish }), 3, content, PUBLISHED_AT)).toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('公開に失敗すれば、失敗を返す', async () => {
    const publish = vi.fn(async () => {
      throw new Error('D1_ERROR: 書き込めない');
    });
    expect(await publishNote(fakeRepository({ publish }), 3, content, PUBLISHED_AT)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });
});

describe('公開済みを読む', () => {
  it('公開済みの note を、公開日を日本時間の日付にした形で返す', async () => {
    const findPublishedBySlug = vi.fn(async () => ({
      slug: 'first-note',
      title: '題',
      body: '本文',
      firstPublishedAt: PUBLISHED_AT,
    }));
    expect(await getPublishedNote(fakeRepository({ findPublishedBySlug }), 'first-note')).toEqual({
      slug: 'first-note',
      title: '題',
      body: '本文',
      publishedOn: '2026-09-17',
    });
    expect(findPublishedBySlug).toHaveBeenCalledWith('first-note');
  });

  it('下書きと存在しない slug は null', async () => {
    const findPublishedBySlug = vi.fn(async () => null);
    expect(await getPublishedNote(fakeRepository({ findPublishedBySlug }), 'draft')).toBeNull();
  });

  it('読み出しに失敗すれば投げる。画面が読み出せなかったことを返す', async () => {
    const findPublishedBySlug = vi.fn(async () => {
      throw new Error('D1_ERROR: 読めない');
    });
    await expect(
      getPublishedNote(fakeRepository({ findPublishedBySlug }), 'first-note'),
    ).rejects.toThrow('D1_ERROR');
  });
});

describe('編集する note を読む', () => {
  it('note を画面に渡す形で返す', async () => {
    const note = { id: 3, slug: 'first-note', title: '題', body: '本文', status: 'draft' as const };
    const findForEdit = vi.fn(async () => note);
    expect(await getNoteForEdit(fakeRepository({ findForEdit }), 3)).toEqual(note);
    expect(findForEdit).toHaveBeenCalledWith(3);
  });

  it('存在しない note は null', async () => {
    const findForEdit = vi.fn(async () => null);
    expect(await getNoteForEdit(fakeRepository({ findForEdit }), 3)).toBeNull();
  });
});

describe('一覧する', () => {
  it('すべての note を画面に渡す形で返す', async () => {
    const summaries = [
      { id: 2, slug: 'b', title: '', status: 'draft' as const, hasUnpublishedChanges: false },
      { id: 1, slug: 'a', title: '題', status: 'published' as const, hasUnpublishedChanges: true },
    ];
    const listForAuthor = vi.fn(async () => summaries);
    expect(await listNotes(fakeRepository({ listForAuthor }))).toEqual(summaries);
  });

  it('note が0件なら空の一覧', async () => {
    const listForAuthor = vi.fn(async () => []);
    expect(await listNotes(fakeRepository({ listForAuthor }))).toEqual([]);
  });
});
