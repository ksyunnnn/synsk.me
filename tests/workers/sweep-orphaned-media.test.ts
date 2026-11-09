import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ORPHAN_GRACE_MS } from '@/shared/domain/media';
import { createR2MediaSweepStorage } from '@/shared/server/media-storage';
import { createD1MediaReferences, sweepOrphanedMedia } from '@/shared/server/sweep-orphaned-media';
import { insertNote, insertNoteMedia } from '../support/note-rows';

/**
 * 消し損ねた画像の突き合わせ（src/shared/server/sweep-orphaned-media.ts）。workerd の R2 と D1 で
 * 確かめる
 */

const storage = createR2MediaSweepStorage(env.NOTE_IMAGES);
const deps = { storage, references: createD1MediaReferences(env.DB) };

/** 置いてから猶予を過ぎた時刻 */
const afterGrace = () => new Date(Date.now() + ORPHAN_GRACE_MS + 60_000);

const putImage = async () => {
  const key = crypto.randomUUID();
  await env.NOTE_IMAGES.put(key, new Uint8Array([1]));
  return key;
};

const keysInBucket = async () => (await env.NOTE_IMAGES.list()).objects.map((o) => o.key);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  const keys = await keysInBucket();
  if (keys.length > 0) await env.NOTE_IMAGES.delete(keys);
});

describe('sweepOrphanedMedia', () => {
  it('どの行も指さず猶予を過ぎた画像だけを消し、行が指す画像は残す', async () => {
    const note = await insertNote(env.DB);
    const referenced = await putImage();
    await insertNoteMedia(env.DB, note.id, referenced);
    const orphan = await putImage();

    const outcome = await sweepOrphanedMedia(deps, afterGrace(), { maxPages: 10, pageSize: 100 });

    expect(outcome).toEqual({ removed: [orphan], reachedEnd: true });
    expect(await keysInBucket()).toEqual([referenced]);
  });

  it('置いてから猶予を過ぎていない画像は、どの行も指さなくても消さない', async () => {
    const fresh = await putImage();
    const outcome = await sweepOrphanedMedia(deps, new Date(), { maxPages: 10, pageSize: 100 });
    expect(outcome.removed).toEqual([]);
    expect(await keysInBucket()).toContain(fresh);
  });

  it('1 回で読む頁の数を超えたら、続きの位置を残して次の回へ送る', async () => {
    const orphans = [await putImage(), await putImage(), await putImage()].sort();
    const limits = { maxPages: 1, pageSize: 2 };

    const first = await sweepOrphanedMedia(deps, afterGrace(), limits);
    expect(first).toEqual({ removed: orphans.slice(0, 2), reachedEnd: false });

    const second = await sweepOrphanedMedia(deps, afterGrace(), limits);
    expect(second.removed).toEqual(orphans.slice(2));
    // 続きの位置は画像でないため、突き合わせの対象にならない。終わりまで読んだら消える
    expect(await keysInBucket()).toEqual([]);
  });

  it('途中の頁で失敗したら、その前の頁までの位置を残して投げ、次の回は続きから読む', async () => {
    const orphans = [await putImage(), await putImage(), await putImage()].sort();
    let lists = 0;
    const failing = {
      ...storage,
      list: async (options: Parameters<typeof storage.list>[0]) => {
        lists += 1;
        if (lists === 2) throw new Error('作り物の失敗');
        return storage.list(options);
      },
    };
    const limits = { maxPages: 2, pageSize: 2 };

    await expect(
      sweepOrphanedMedia({ ...deps, storage: failing }, afterGrace(), limits),
    ).rejects.toThrow('作り物の失敗');
    expect(await keysInBucket()).toContain(orphans[2]);
    expect(await storage.readSweepCursor()).toBe(orphans[1]);

    const second = await sweepOrphanedMedia(deps, afterGrace(), limits);
    expect(second).toEqual({ removed: [orphans[2]], reachedEnd: true });
  });

  it('D1 の 1 つの文の値の数の上限（100）を超えるキーを、1 本の問い合わせで調べる', async () => {
    const note = await insertNote(env.DB);
    const keys = Array.from({ length: 150 }, () => crypto.randomUUID());
    await insertNoteMedia(env.DB, note.id, keys[149]);
    const referenced = await deps.references.findReferenced(keys);
    expect([...referenced]).toEqual([keys[149]]);
  });
});
