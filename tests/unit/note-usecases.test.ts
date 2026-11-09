import { describe, expect, it, vi } from 'vitest';
import { addNoteSyndication } from '@/features/note/application/add-note-syndication';
import { createNote } from '@/features/note/application/create-note';
import { removeNoteSyndication } from '@/features/note/application/remove-note-syndication';
import { deleteNote } from '@/features/note/application/delete-note';
import { publishNote } from '@/features/note/application/publish-note';
import { restoreNote } from '@/features/note/application/restore-note';
import { revertNote } from '@/features/note/application/revert-note';
import { saveNote } from '@/features/note/application/save-note';
import { unpublishNote } from '@/features/note/application/unpublish-note';
import { toNoteFormValues, type Note, type NoteFormValues } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';

/**
 * note のユースケース（specs/003-note/spec.md の FR-003・FR-011・FR-020・FR-033）。Repository は
 * 作り物の実装を渡す（docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での動きは
 * tests/workers/note-repository.test.ts が持つ
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const NOW = '2026-11-05T00:00:00.000Z';
const OPENED = '11111111111111111111111111111111';

const note = (overrides: Partial<Note> = {}): Note => ({
  id: 1,
  uid: '0123456789abcdef0123456789abcdef',
  slug: 'sample-note',
  status: 'draft',
  publishedAt: null,
  deletedAt: null,
  cardImage: 'generated',
  cardMediaStorageKey: null,
  latestRevision: {
    uid: OPENED,
    title: '作り物の題',
    description: null,
    body: '作り物の本文',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  publishedRevisionUid: null,
  mediaStorageKeys: [],
  syndicationUrls: [],
  ...overrides,
});

const values = (overrides: Partial<NoteFormValues> = {}): NoteFormValues => ({
  ...toNoteFormValues(note()),
  ...overrides,
});

/** 作り物の Repository。書き込みの関数が呼ばれたかで、何も書かないことを確かめる */
const fakeNotes = (current: Note | null = note(), overrides: Partial<NoteRepository> = {}) =>
  ({
    findVisitorBySlug: vi.fn(async () => null),
    hasVisitorSlug: vi.fn(async () => false),
    findForEdit: vi.fn(async () => current),
    findIdByUid: vi.fn(async () => current?.id ?? null),
    list: vi.fn(async () => []),
    create: vi.fn(async () => ({
      ok: true as const,
      id: 7,
      uid: 'fedcba9876543210fedcba9876543210',
    })),
    save: vi.fn(async () => ({ ok: true as const })),
    publish: vi.fn(async () => ({ ok: true as const })),
    unpublish: vi.fn(async () => ({ ok: true })),
    delete: vi.fn(async () => ({ ok: true })),
    restore: vi.fn(async () => ({ ok: true })),
    listRevisions: vi.fn(async () => []),
    findRevision: vi.fn(async () => null),
    revert: vi.fn(async () => ({ ok: true as const })),
    findMissingRevision: vi.fn(async () => null),
    addSyndication: vi.fn(async () => ({ ok: true as const })),
    removeSyndication: vi.fn(async () => ({ ok: true })),
    ...overrides,
  }) satisfies NoteRepository;

describe('createNote', () => {
  it('オーナーでなければ何も書かない（FR-033）', async () => {
    const notes = fakeNotes();
    expect(await createNote(notes, null, values())).toEqual({ status: 'forbidden' });
    expect(notes.create).not.toHaveBeenCalled();
  });

  it('項目の不備を、送られた値つきで返し、書かない', async () => {
    const notes = fakeNotes();
    const sent = values({ slug: 'Bad Slug' });
    expect(await createNote(notes, OWNER, sent)).toEqual({
      status: 'invalid',
      errors: { slug: 'invalid' },
      values: sent,
    });
    expect(notes.create).not.toHaveBeenCalled();
  });

  it('識別子の重複を項目の誤りで返す（FR-002）', async () => {
    const notes = fakeNotes(null, {
      create: vi.fn(async () => ({ ok: false as const, reason: 'slug-taken' as const })),
    });
    expect(await createNote(notes, OWNER, values())).toMatchObject({
      status: 'invalid',
      errors: { slug: 'slug-taken' },
    });
  });

  it('作った note の uid を返す', async () => {
    expect(await createNote(fakeNotes(), OWNER, values())).toEqual({
      status: 'created',
      uid: 'fedcba9876543210fedcba9876543210',
    });
  });
});

describe('saveNote', () => {
  it('オーナーでなければ読まず、書かない（FR-033）', async () => {
    const notes = fakeNotes();
    expect(await saveNote(notes, null, 1, values(), OPENED)).toEqual({ status: 'forbidden' });
    expect(notes.findForEdit).not.toHaveBeenCalled();
    expect(notes.save).not.toHaveBeenCalled();
  });

  it('無い note と削除した note は not-found で、書かない', async () => {
    for (const current of [null, note({ deletedAt: '2026-11-02T00:00:00.000Z' })]) {
      const notes = fakeNotes(current);
      expect(await saveNote(notes, OWNER, 1, values(), OPENED)).toEqual({ status: 'not-found' });
      expect(notes.save).not.toHaveBeenCalled();
    }
  });

  it('公開したことのある note の識別子の書き換えを、書く前に拒む（FR-003）', async () => {
    const notes = fakeNotes(note({ publishedAt: '2026-11-01T00:00:00.000Z' }));
    const sent = values({ slug: 'moved' });
    expect(await saveNote(notes, OWNER, 1, sent, OPENED)).toEqual({
      status: 'invalid',
      errors: { slug: 'slug-locked' },
      values: sent,
    });
    expect(notes.save).not.toHaveBeenCalled();
  });

  it('開いた版を渡して書く', async () => {
    const notes = fakeNotes();
    expect(await saveNote(notes, OWNER, 1, values({ title: ' 新しい題 ' }), OPENED)).toEqual({
      status: 'saved',
    });
    expect(notes.save).toHaveBeenCalledWith(
      1,
      { slug: 'sample-note', title: '新しい題', description: null, body: '作り物の本文' },
      OPENED,
    );
  });

  it('先に保存されていたら conflict を送られた値つきで返す（FR-020）', async () => {
    const notes = fakeNotes(note(), {
      save: vi.fn(async () => ({ ok: false as const, reason: 'conflict' as const })),
    });
    const sent = values({ body: '画面 B で書いた本文' });
    expect(await saveNote(notes, OWNER, 1, sent, OPENED)).toEqual({
      status: 'conflict',
      values: sent,
    });
  });

  it.each([
    ['slug-taken', { status: 'invalid', errors: { slug: 'slug-taken' } }],
    ['slug-locked', { status: 'invalid', errors: { slug: 'slug-locked' } }],
    ['not-found', { status: 'not-found' }],
  ] as const)('Repository の %s を読み替える', async (reason, expected) => {
    const notes = fakeNotes(note(), { save: vi.fn(async () => ({ ok: false as const, reason })) });
    expect(await saveNote(notes, OWNER, 1, values(), OPENED)).toMatchObject(expected);
  });
});

describe('publishNote', () => {
  it('オーナーでなければ書かない（FR-033）', async () => {
    const notes = fakeNotes();
    expect(await publishNote(notes, null, 1, NOW)).toEqual({ status: 'forbidden' });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it('最も新しい版の題が空なら、書かずに題の項目で知らせる（FR-011）', async () => {
    const notes = fakeNotes(note({ latestRevision: { ...note().latestRevision, title: '' } }));
    expect(await publishNote(notes, OWNER, 1, NOW)).toEqual({
      status: 'invalid',
      errors: { title: 'missing' },
      values: {},
    });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it('削除した note は not-found で、書かない', async () => {
    const notes = fakeNotes(note({ deletedAt: '2026-11-02T00:00:00.000Z' }));
    expect(await publishNote(notes, OWNER, 1, NOW)).toEqual({ status: 'not-found' });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it('題があれば公開する', async () => {
    const notes = fakeNotes();
    expect(await publishNote(notes, OWNER, 1, NOW)).toEqual({ status: 'published' });
    expect(notes.publish).toHaveBeenCalledWith(1, NOW);
  });

  it('読んだ後に題の空の版が足されていたら、トリガの拒みを題の項目で知らせる', async () => {
    const notes = fakeNotes(note(), {
      publish: vi.fn(async () => ({ ok: false as const, reason: 'untitled' as const })),
    });
    expect(await publishNote(notes, OWNER, 1, NOW)).toMatchObject({
      status: 'invalid',
      errors: { title: 'missing' },
    });
  });
});

describe('unpublishNote・deleteNote・restoreNote（FR-014・FR-016・FR-033）', () => {
  it('オーナーでなければ書かない', async () => {
    const notes = fakeNotes();
    expect(await unpublishNote(notes, null, 1)).toEqual({ status: 'forbidden' });
    expect(await deleteNote(notes, null, 1, NOW)).toEqual({ status: 'forbidden' });
    expect(await restoreNote(notes, null, 1)).toEqual({ status: 'forbidden' });
    expect(notes.unpublish).not.toHaveBeenCalled();
    expect(notes.delete).not.toHaveBeenCalled();
    expect(notes.restore).not.toHaveBeenCalled();
  });

  it('書けなければ not-found', async () => {
    const notes = fakeNotes(note(), {
      unpublish: vi.fn(async () => ({ ok: false })),
      delete: vi.fn(async () => ({ ok: false })),
      restore: vi.fn(async () => ({ ok: false })),
    });
    expect(await unpublishNote(notes, OWNER, 1)).toEqual({ status: 'not-found' });
    expect(await deleteNote(notes, OWNER, 1, NOW)).toEqual({ status: 'not-found' });
    expect(await restoreNote(notes, OWNER, 1)).toEqual({ status: 'not-found' });
  });

  it('書ければ、それぞれの結果を返す', async () => {
    const notes = fakeNotes();
    expect(await unpublishNote(notes, OWNER, 1)).toEqual({ status: 'unpublished' });
    expect(await deleteNote(notes, OWNER, 1, NOW)).toEqual({ status: 'deleted' });
    expect(notes.delete).toHaveBeenCalledWith(1, NOW);
    expect(await restoreNote(notes, OWNER, 1)).toEqual({ status: 'restored' });
  });

  it('削除した note への保存と公開は not-found（User Story 2）', async () => {
    const notes = fakeNotes(note({ deletedAt: NOW }));
    expect(await saveNote(notes, OWNER, 1, values(), OPENED)).toEqual({ status: 'not-found' });
    expect(await publishNote(notes, OWNER, 1, NOW)).toEqual({ status: 'not-found' });
  });
});

describe('revertNote（FR-009・FR-020・FR-033）', () => {
  const REVISION = '22222222222222222222222222222222';

  it('オーナーでなければ書かない', async () => {
    const notes = fakeNotes();
    expect(await revertNote(notes, null, 1, REVISION, OPENED)).toEqual({ status: 'forbidden' });
    expect(notes.revert).not.toHaveBeenCalled();
  });

  it('戻す版と開いた版を渡して書く', async () => {
    const notes = fakeNotes();
    expect(await revertNote(notes, OWNER, 1, REVISION, OPENED)).toEqual({ status: 'reverted' });
    expect(notes.revert).toHaveBeenCalledWith(1, REVISION, OPENED);
  });

  it.each([
    ['conflict', 'conflict'],
    ['not-found', 'not-found'],
    ['revision-not-found', 'not-found'],
  ] as const)('Repository の %s を %s にする', async (reason, status) => {
    const notes = fakeNotes(note(), {
      revert: vi.fn(async () => ({ ok: false as const, reason })),
    });
    expect(await revertNote(notes, OWNER, 1, REVISION, OPENED)).toEqual({ status });
  });
});

describe('転載先（FR-031・FR-032・FR-033）', () => {
  it('オーナーでなければ書かない', async () => {
    const notes = fakeNotes();
    expect(await addNoteSyndication(notes, null, 1, 'https://example.com/a')).toEqual({
      status: 'forbidden',
    });
    expect(await removeNoteSyndication(notes, null, 1, 'https://example.com/a')).toEqual({
      status: 'forbidden',
    });
    expect(notes.addSyndication).not.toHaveBeenCalled();
    expect(notes.removeSyndication).not.toHaveBeenCalled();
  });

  it.each([
    ['空', '', 'missing'],
    ['http・https でない', 'ftp://example.com/a', 'invalid'],
    ['URL でない', 'example.com/a', 'invalid'],
  ])('URL が%sなら書かない', async (_, url, error) => {
    const notes = fakeNotes();
    expect(await addNoteSyndication(notes, OWNER, 1, url)).toEqual({ status: 'invalid', error });
    expect(notes.addSyndication).not.toHaveBeenCalled();
  });

  it('前後の空白を除いて記録する', async () => {
    const notes = fakeNotes();
    expect(await addNoteSyndication(notes, OWNER, 1, ' https://example.com/a ')).toEqual({
      status: 'added',
    });
    expect(notes.addSyndication).toHaveBeenCalledWith(1, 'https://example.com/a');
  });

  it('記録済みの URL は項目の誤りで返す（FR-032）', async () => {
    const notes = fakeNotes(note(), {
      addSyndication: vi.fn(async () => ({ ok: false as const, reason: 'url-taken' as const })),
    });
    expect(await addNoteSyndication(notes, OWNER, 1, 'https://example.com/a')).toEqual({
      status: 'invalid',
      error: 'taken',
    });
  });

  it('その note に無い URL は外さず not-found', async () => {
    const notes = fakeNotes(note(), { removeSyndication: vi.fn(async () => ({ ok: false })) });
    expect(await removeNoteSyndication(notes, OWNER, 1, 'https://example.com/a')).toEqual({
      status: 'not-found',
    });
  });
});
