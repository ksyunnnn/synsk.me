import { describe, expect, it, vi } from 'vitest';
import { addNoteMedia } from '@/features/note/application/add-note-media';
import { addNoteSyndication } from '@/features/note/application/add-note-syndication';
import { changeNoteCardImage } from '@/features/note/application/change-note-card-image';
import { createNote } from '@/features/note/application/create-note';
import { deleteNote } from '@/features/note/application/delete-note';
import { getPreviewNoteMedia } from '@/features/note/application/get-preview-note-media';
import { getVisitorNoteMedia } from '@/features/note/application/get-visitor-note-media';
import { publishNote } from '@/features/note/application/publish-note';
import { purgeNote } from '@/features/note/application/purge-note';
import { removeNoteSyndication } from '@/features/note/application/remove-note-syndication';
import { restoreNote } from '@/features/note/application/restore-note';
import { revertNote } from '@/features/note/application/revert-note';
import { saveNote } from '@/features/note/application/save-note';
import { unpublishNote } from '@/features/note/application/unpublish-note';
import {
  toNoteFormValues,
  type Note,
  type NoteFormValues,
  type NotePreview,
  type VisitorNote,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';

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
    changeCardImage: vi.fn(async () => ({ ok: true as const })),
    addMedia: vi.fn(async () => ({ ok: true })),
    findPreview: vi.fn(async () => null),
    purge: vi.fn(async () => ({ ok: true as const, storageKeys: [] as string[] })),
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

describe('changeNoteCardImage（FR-024・FR-025・FR-033）', () => {
  const KEY = '11111111-1111-4111-8111-111111111111';

  it('オーナーでなければ書かない', async () => {
    const notes = fakeNotes();
    expect(await changeNoteCardImage(notes, null, 1, 'site')).toEqual({ status: 'forbidden' });
    expect(notes.changeCardImage).not.toHaveBeenCalled();
  });

  it.each([
    ['ほかの値', 'other'],
    ['キーの無い media', 'media'],
    ['形の違うキーの media', 'media:1'],
  ])('%sは書かない', async (_, input) => {
    const notes = fakeNotes();
    expect(await changeNoteCardImage(notes, OWNER, 1, input)).toEqual({
      status: 'invalid',
      error: 'invalid',
    });
    expect(notes.changeCardImage).not.toHaveBeenCalled();
  });

  it('media はキーを渡して書く', async () => {
    const notes = fakeNotes();
    expect(await changeNoteCardImage(notes, OWNER, 1, `media:${KEY}`)).toEqual({
      status: 'changed',
    });
    expect(notes.changeCardImage).toHaveBeenCalledWith(1, { kind: 'media', storageKey: KEY });
  });

  it('その note の画像でなければ項目の誤りで返す', async () => {
    const notes = fakeNotes(note(), {
      changeCardImage: vi.fn(async () => ({
        ok: false as const,
        reason: 'media-not-owned' as const,
      })),
    });
    expect(await changeNoteCardImage(notes, OWNER, 1, `media:${KEY}`)).toEqual({
      status: 'invalid',
      error: 'media-not-owned',
    });
  });
});

describe('addNoteMedia（FR-023・FR-033、research.md の R12）', () => {
  const KEY = '22222222-2222-4222-8222-222222222222';
  const file = new Blob(['作り物']);

  const fakeStorage = (overrides: Partial<MediaStorage> = {}) =>
    ({
      save: vi.fn(async () => ({
        ok: true as const,
        media: { storageKey: KEY, type: 'image/png' as const, size: 3 },
      })),
      read: vi.fn(async () => null),
      remove: vi.fn(async () => {}),
      ...overrides,
    }) satisfies MediaStorage;

  it('オーナーでなければ置かず、記録しない', async () => {
    const notes = fakeNotes();
    const media = fakeStorage();
    expect(await addNoteMedia({ notes, media }, null, 1, file)).toEqual({ status: 'forbidden' });
    expect(media.save).not.toHaveBeenCalled();
    expect(notes.addMedia).not.toHaveBeenCalled();
  });

  it.each(['empty', 'too-large', 'unsupported-type'] as const)(
    'media-storage.ts が %s で拒んだ画像を項目の誤りで返し、記録しない',
    async (reason) => {
      const notes = fakeNotes();
      const media = fakeStorage({ save: vi.fn(async () => ({ ok: false as const, reason })) });
      expect(await addNoteMedia({ notes, media }, OWNER, 1, file)).toEqual({
        status: 'invalid',
        error: reason,
      });
      expect(notes.addMedia).not.toHaveBeenCalled();
    },
  );

  it('ファイルが無ければ empty', async () => {
    const media = fakeStorage();
    expect(await addNoteMedia({ notes: fakeNotes(), media }, OWNER, 1, null)).toEqual({
      status: 'invalid',
      error: 'empty',
    });
    expect(media.save).not.toHaveBeenCalled();
  });

  it('削除した note には置かない', async () => {
    const media = fakeStorage();
    const notes = fakeNotes(note({ deletedAt: NOW }));
    expect(await addNoteMedia({ notes, media }, OWNER, 1, file)).toEqual({ status: 'not-found' });
    expect(media.save).not.toHaveBeenCalled();
  });

  it('置いた画像を記録する', async () => {
    const notes = fakeNotes();
    const media = fakeStorage();
    expect(await addNoteMedia({ notes, media }, OWNER, 1, file)).toEqual({
      status: 'added',
      storageKey: KEY,
    });
    expect(notes.addMedia).toHaveBeenCalledWith(1, KEY);
  });

  it('記録の前に note が消えていたら、置いた画像を消す', async () => {
    const notes = fakeNotes(note(), { addMedia: vi.fn(async () => ({ ok: false })) });
    const media = fakeStorage();
    expect(await addNoteMedia({ notes, media }, OWNER, 1, file)).toEqual({ status: 'not-found' });
    expect(media.remove).toHaveBeenCalledWith([KEY]);
  });

  it('記録が例外で失敗したら、置いた画像を消してから投げ直す', async () => {
    const failure = new Error('D1 の失敗');
    const notes = fakeNotes(note(), {
      addMedia: vi.fn(async () => {
        throw failure;
      }),
    });
    const media = fakeStorage();
    await expect(addNoteMedia({ notes, media }, OWNER, 1, file)).rejects.toBe(failure);
    expect(media.remove).toHaveBeenCalledWith([KEY]);
  });
});

describe('getVisitorNoteMedia（FR-026）', () => {
  const BODY_KEY = '33333333-3333-4333-8333-333333333333';
  const CARD_KEY = '44444444-4444-4444-8444-444444444444';
  const visitorNote: VisitorNote = {
    slug: 'sample-note',
    title: '作り物の題',
    description: null,
    summary: null,
    body: '',
    publishedAt: NOW,
    cardImage: { kind: 'media', storageKey: CARD_KEY },
    media: [BODY_KEY],
    linkPreviews: [],
  };

  it('公開した版の本文が指す画像と代表画像だけを public にする', async () => {
    const notes = fakeNotes(note(), { findVisitorBySlug: vi.fn(async () => visitorNote) });
    expect(await getVisitorNoteMedia(notes, 'sample-note', BODY_KEY)).toBe('public');
    expect(await getVisitorNoteMedia(notes, 'sample-note', CARD_KEY)).toBe('public');
    expect(await getVisitorNoteMedia(notes, 'sample-note', crypto.randomUUID())).toBe('hidden');
  });

  it('訪問者に見せない note の画像は hidden', async () => {
    expect(await getVisitorNoteMedia(fakeNotes(), 'sample-note', BODY_KEY)).toBe('hidden');
  });
});

describe('purgeNote（FR-017・FR-033、research.md の R6）', () => {
  const KEY = '55555555-5555-4555-8555-555555555555';
  const storage = () =>
    ({
      save: vi.fn(),
      read: vi.fn(async () => null),
      remove: vi.fn(async () => {}),
    }) satisfies MediaStorage;

  it('オーナーでなければ何も消さない', async () => {
    const notes = fakeNotes();
    const media = storage();
    expect(await purgeNote({ notes, media }, null, 1)).toEqual({ status: 'forbidden' });
    expect(notes.purge).not.toHaveBeenCalled();
    expect(media.remove).not.toHaveBeenCalled();
  });

  it('D1 の行を消してから、置き場の画像を消す', async () => {
    const order: string[] = [];
    const notes = fakeNotes(note(), {
      purge: vi.fn(async () => {
        order.push('d1');
        return { ok: true as const, storageKeys: [KEY] };
      }),
    });
    const media = storage();
    media.remove.mockImplementation(async () => {
      order.push('r2');
    });
    expect(await purgeNote({ notes, media }, OWNER, 1)).toEqual({ status: 'purged' });
    expect(media.remove).toHaveBeenCalledWith([KEY]);
    expect(order).toEqual(['d1', 'r2']);
  });

  it('置き場の画像を消せなくても、D1 を消した後なら成功を返す（T057）', async () => {
    const notes = fakeNotes(note(), {
      purge: vi.fn(async () => ({ ok: true as const, storageKeys: [KEY] })),
    });
    const media = storage();
    media.remove.mockRejectedValue(new Error('R2 の作り物の失敗'));
    expect(await purgeNote({ notes, media }, OWNER, 1)).toEqual({ status: 'purged' });
    expect(media.remove).toHaveBeenCalledWith([KEY]);
  });

  it('無い note は置き場を触らない', async () => {
    const notes = fakeNotes(note(), { purge: vi.fn(async () => ({ ok: false as const })) });
    const media = storage();
    expect(await purgeNote({ notes, media }, OWNER, 1)).toEqual({ status: 'not-found' });
    expect(media.remove).not.toHaveBeenCalled();
  });
});

describe('getPreviewNoteMedia（REQUIREMENTS.md の FR-13）', () => {
  const BODY_KEY = '66666666-6666-4666-8666-666666666666';
  const CARD_KEY = '77777777-7777-4777-8777-777777777777';
  const preview: NotePreview = {
    slug: 'sample-note',
    title: '作り物の題',
    description: null,
    summary: null,
    body: '',
    publishedAt: null,
    cardImage: { kind: 'media', storageKey: CARD_KEY },
    media: [BODY_KEY],
    linkPreviews: [],
  };

  it('オーナーには、確認している版の本文が指す画像と代表画像を restricted にする', async () => {
    const notes = fakeNotes(note(), { findPreview: vi.fn(async () => preview) });
    expect(await getPreviewNoteMedia(notes, OWNER, 1, BODY_KEY)).toBe('restricted');
    expect(await getPreviewNoteMedia(notes, OWNER, 1, CARD_KEY)).toBe('restricted');
    expect(await getPreviewNoteMedia(notes, OWNER, 1, crypto.randomUUID())).toBe('hidden');
  });

  it('オーナーでなければ、note を読まずに hidden', async () => {
    const notes = fakeNotes(note(), { findPreview: vi.fn(async () => preview) });
    expect(await getPreviewNoteMedia(notes, null, 1, BODY_KEY)).toBe('hidden');
    expect(notes.findPreview).not.toHaveBeenCalled();
  });

  it('無い note は hidden', async () => {
    expect(await getPreviewNoteMedia(fakeNotes(), OWNER, 1, BODY_KEY)).toBe('hidden');
  });
});
