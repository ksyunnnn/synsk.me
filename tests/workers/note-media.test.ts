import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NOTE_IMAGE_MAX_COUNT } from '@/features/note/domain/note-image';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';
import { createR2MediaStorage } from '@/shared/server/media-storage';
import { deleteNoteRows, insertNote } from '../support/note-rows';

/**
 * note の画像の記録と、訪問者に返す条件（specs/003-note/spec.md の FR-023〜FR-026、
 * research.md の R7）。R2 の読み書きは src/shared/server/media-storage.ts を通す
 */

const notes = createD1NoteRepository(env.DB);

const FILE_A = '00000000-0000-4000-8000-00000000000a.png';
const FILE_B = '00000000-0000-4000-8000-00000000000b.png';
const KEY_A = `notes/${FILE_A}`;
const KEY_B = `notes/${FILE_B}`;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await deleteNoteRows(env.DB);
});

/** 版 1 に画像 A を置いて公開し、版 2 にだけ画像 B を置いた note。削除の印は画像の後に付ける */
const seed = async ({
  deleted,
  unpublished,
}: { deleted?: boolean; unpublished?: boolean } = {}) => {
  const { id } = await insertNote(env.DB, {
    slug: 'with-images',
    revisions: [
      { title: '題', body: `![](media:${FILE_A})` },
      { title: '題', body: `![](media:${FILE_A})\n\n![](media:${FILE_B})` },
    ],
    publishedRevision: 1,
    unpublished,
  });
  expect(await notes.addImage(id, KEY_A)).toEqual({ ok: true });
  expect(await notes.addImage(id, KEY_B)).toEqual({ ok: true });
  if (deleted) await notes.delete(id, '2026-11-02T00:00:00.000Z');
  return id;
};

describe('訪問者に返す画像（FR-026）', () => {
  it('公開した版の本文が指す画像だけを返す（User Story 5 の 1・5）', async () => {
    await seed();
    expect(await notes.findVisitorImage('with-images', KEY_A)).toBe(KEY_A);
    expect(await notes.findVisitorImage('with-images', KEY_B)).toBeNull();
  });

  it('代表画像に選んだ画像は、本文に無くても返す', async () => {
    const id = await seed();
    expect(await notes.chooseCardImage(id, 'media', KEY_B)).toEqual({ ok: true });
    expect(await notes.findVisitorImage('with-images', KEY_B)).toBe(KEY_B);
    expect(await notes.findVisitorBySlug('with-images')).toMatchObject({
      cardImage: { source: 'media', file: FILE_B },
    });
  });

  it('下書きと削除した note の画像は返さない（User Story 5 の 4）', async () => {
    await seed({ unpublished: true });
    expect(await notes.findVisitorImage('with-images', KEY_A)).toBeNull();
    await deleteNoteRows(env.DB);
    await seed({ deleted: true });
    expect(await notes.findVisitorImage('with-images', KEY_A)).toBeNull();
  });

  it('オーナーには、その note の画像をすべて返し、ほかの note の画像は返さない', async () => {
    const id = await seed();
    const other = await insertNote(env.DB, {
      slug: 'other',
      revisions: [{ title: '別', body: '' }],
    });
    expect(await notes.findOwnerImage(id, KEY_B)).toBe(KEY_B);
    expect(await notes.findOwnerImage(other.id, KEY_A)).toBeNull();
  });
});

describe('代表画像（FR-024・FR-025）', () => {
  it('選んでいなければ題を入れて自動で作る画像で、ほかの note の画像は選べない（User Story 5 の 2・3）', async () => {
    await seed();
    const other = await insertNote(env.DB, {
      slug: 'other',
      revisions: [{ title: '別', body: '' }],
    });
    expect(await notes.findVisitorBySlug('with-images')).toMatchObject({
      cardImage: { source: 'generated', file: null },
    });
    expect(await notes.chooseCardImage(other.id, 'media', KEY_A)).toEqual({
      ok: false,
      reason: 'not-own-image',
    });
  });

  it('サイト共通の画像を選ぶと、選んでいた画像を外す', async () => {
    const id = await seed();
    await notes.chooseCardImage(id, 'media', KEY_A);
    expect(await notes.chooseCardImage(id, 'site', null)).toEqual({ ok: true });
    expect(await notes.findForEdit(id)).toMatchObject({
      cardImage: { source: 'site', file: null },
    });
  });
});

describe('画像の数の上限（research.md の R7）', () => {
  it(`1 つの note に ${NOTE_IMAGE_MAX_COUNT} 枚を超えて足さない`, async () => {
    const { id } = await insertNote(env.DB, {
      slug: 'many',
      revisions: [{ title: '題', body: '' }],
    });
    for (let i = 0; i < NOTE_IMAGE_MAX_COUNT; i++) {
      expect(await notes.addImage(id, `notes/many-${i}.png`)).toEqual({ ok: true });
    }
    expect(await notes.addImage(id, 'notes/many-over.png')).toEqual({
      ok: false,
      reason: 'too-many-images',
    });
  });
});

describe('src/shared/server/media-storage.ts', () => {
  it('書いて読み、消す', async () => {
    const storage = createR2MediaStorage(env.NOTE_IMAGES);
    await storage.put('notes/storage-test.png', new Uint8Array([1, 2, 3]).buffer, 'image/png');
    const stored = await storage.get('notes/storage-test.png');
    expect(stored?.size).toBe(3);
    expect(new Uint8Array(await new Response(stored!.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await storage.delete(['notes/storage-test.png']);
    expect(await storage.get('notes/storage-test.png')).toBeNull();
  });
});
