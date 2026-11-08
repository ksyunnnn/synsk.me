import { describe, expect, it, vi } from 'vitest';
import { addNoteImage } from '@/features/note/application/add-note-image';
import { createNote } from '@/features/note/application/create-note';
import type { NoteDeps } from '@/features/note/application/deps';
import { publishNote } from '@/features/note/application/publish-note';
import { restoreRevision } from '@/features/note/application/restore-revision';
import { saveNote } from '@/features/note/application/save-note';
import type { NoteForEdit } from '@/features/note/domain/note';
import { IMAGE_MAX_BYTES } from '@/shared/domain/media-image';
import type { NoteRepository } from '@/features/note/domain/note-repository';

/**
 * note のユースケースの分岐（specs/003-note/spec.md の FR-003・FR-020・FR-033、research.md の
 * R4・R7・R9）。Repository は作り物の実装を渡す。D1 の上の動きは tests/workers/ が持つ
 */

const OWNER = { email: 'owner@synsk.test' };
const NOW = '2026-11-09T00:00:00.000Z';

const note = (overrides: Partial<NoteForEdit> = {}): NoteForEdit => ({
  id: 1,
  uid: '0123456789abcdef0123456789abcdef',
  slug: 'fake-note',
  status: 'draft',
  isDeleted: false,
  publishedAt: null,
  publishedRevisionNumber: null,
  latest: { number: 2, title: '作り物', description: null, body: '', createdAt: NOW },
  cardImage: { source: 'generated', file: null },
  images: [],
  syndications: [],
  ...overrides,
});

const fakeDeps = (repository: Partial<NoteRepository> = {}) => {
  const notes = {
    findForEdit: vi.fn(async () => note()),
    create: vi.fn(async () => ({ ok: true as const, id: 1, uid: 'u' })),
    save: vi.fn(async () => ({ ok: true as const, revision: 3 })),
    publish: vi.fn(async () => ({ ok: true as const })),
    addImage: vi.fn(async () => ({ ok: true as const })),
    findRevision: vi.fn(async () => ({
      number: 1,
      title: '1 つ目の題',
      description: '1 つ目の説明',
      body: '1 つ目の本文',
      createdAt: NOW,
    })),
    findLinkPreviews: vi.fn(async () => [
      { url: 'https://example.com/known', title: '持っている', imageUrl: null },
    ]),
    saveLinkPreviews: vi.fn(async () => {}),
    ...repository,
  } as unknown as NoteRepository & Record<string, ReturnType<typeof vi.fn>>;
  const deps: NoteDeps = {
    notes,
    images: { put: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
    fetchLinkPreviews: vi.fn(async (urls: string[]) =>
      urls.map((url) => ({ url, title: '取った', imageUrl: null })),
    ),
    now: () => NOW,
  };
  return { deps, notes };
};

const values = { slug: 'fake-note', title: '作り物', description: '', body: '' };

describe('オーナーでなければ何も書かない（FR-033）', () => {
  it('作る・保存・公開・画像の追加', async () => {
    const { deps, notes } = fakeDeps();
    expect(await createNote(deps, null, values)).toEqual({ status: 'forbidden' });
    expect(await saveNote(deps, null, 1, values, 2)).toEqual({ status: 'forbidden' });
    expect(await publishNote(deps, null, 1, 2)).toEqual({ status: 'forbidden' });
    expect(
      await addNoteImage(deps, null, 1, { size: 10, read: async () => new ArrayBuffer(10) }),
    ).toEqual({ status: 'forbidden' });
    expect(notes.create).not.toHaveBeenCalled();
    expect(notes.save).not.toHaveBeenCalled();
    expect(notes.publish).not.toHaveBeenCalled();
    expect(deps.images.put).not.toHaveBeenCalled();
  });
});

describe('saveNote', () => {
  it('一度でも公開した note の識別子を変えようとすると、書かずに止める（FR-003）', async () => {
    const { deps, notes } = fakeDeps({
      findForEdit: vi.fn(async () => note({ publishedAt: NOW, status: 'published' })),
    });
    const outcome = await saveNote(deps, OWNER, 1, { ...values, slug: 'other-slug' }, 2);
    expect(outcome).toMatchObject({ status: 'invalid', errors: { slug: 'slug-locked' } });
    expect(notes.save).not.toHaveBeenCalled();
  });

  it('先に別の画面で保存されていたら、送られた内容を返す（FR-020）', async () => {
    const { deps } = fakeDeps({
      save: vi.fn(async () => ({ ok: false as const, reason: 'conflict' as const })),
    });
    const sent = { ...values, body: '残す本文' };
    expect(await saveNote(deps, OWNER, 1, sent, 2)).toEqual({ status: 'conflict', values: sent });
  });

  it('開いたときの版の番号が読めなければ、書かずに止める', async () => {
    const { deps, notes } = fakeDeps();
    expect(await saveNote(deps, OWNER, 1, values, null)).toMatchObject({ status: 'conflict' });
    expect(notes.save).not.toHaveBeenCalled();
  });

  it('保存した後、持っていないカードの URL だけ参照先の情報を取る（research.md の R9）', async () => {
    const { deps, notes } = fakeDeps();
    const body = 'https://example.com/known\n\nhttps://example.com/new';
    expect(await saveNote(deps, OWNER, 1, { ...values, body }, 2)).toEqual({
      status: 'saved',
      revision: 3,
    });
    expect(deps.fetchLinkPreviews).toHaveBeenCalledWith(['https://example.com/new']);
    expect(notes.saveLinkPreviews).toHaveBeenCalledWith(
      [{ url: 'https://example.com/new', title: '取った', imageUrl: null }],
      NOW,
    );
  });
});

describe('publishNote', () => {
  it('開いたときの版の番号が読めなければ、公開しない（research.md の R4）', async () => {
    const { deps, notes } = fakeDeps();
    expect(await publishNote(deps, OWNER, 1, null)).toEqual({ status: 'conflict' });
    expect(notes.publish).not.toHaveBeenCalled();
  });

  it('題が空の版は公開しない（FR-011）', async () => {
    const { deps } = fakeDeps({
      publish: vi.fn(async () => ({ ok: false as const, reason: 'empty-title' as const })),
    });
    expect(await publishNote(deps, OWNER, 1, 2)).toEqual({ status: 'empty-title' });
  });
});

describe('restoreRevision', () => {
  it('戻す版の中身を、今の識別子のまま新しい版として保存する（FR-009）', async () => {
    const { deps, notes } = fakeDeps();
    expect(await restoreRevision(deps, OWNER, 1, 1, 2)).toEqual({ status: 'done' });
    expect(notes.save).toHaveBeenCalledWith(
      1,
      'fake-note',
      { title: '1 つ目の題', description: '1 つ目の説明', body: '1 つ目の本文' },
      2,
    );
  });
});

describe('addNoteImage', () => {
  const png = () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return bytes.buffer;
  };

  it('大きすぎる画像は、中身を読まずに止める', async () => {
    const { deps } = fakeDeps();
    const read = vi.fn(async () => png());
    expect(await addNoteImage(deps, OWNER, 1, { size: IMAGE_MAX_BYTES + 1, read })).toEqual({
      status: 'too-large',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('記録を入れられなければ、置き場に書いた物を消す', async () => {
    const { deps } = fakeDeps({
      addImage: vi.fn(async () => ({ ok: false as const, reason: 'too-many-images' as const })),
    });
    expect(await addNoteImage(deps, OWNER, 1, { size: 32, read: async () => png() })).toEqual({
      status: 'too-many-images',
    });
    const [[key]] = (deps.images.put as ReturnType<typeof vi.fn>).mock.calls;
    expect(key).toMatch(/^notes\/[0-9a-f-]{36}\.png$/);
    expect(deps.images.delete).toHaveBeenCalledWith([key]);
  });
});
