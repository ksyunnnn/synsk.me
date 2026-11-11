import { applyD1Migrations, env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import {
  MEDIA_MAX_BYTES,
  MEDIA_TOTAL_MAX_BYTES,
  parseMediaStorageKey,
  type MediaStorage,
} from '@/shared/domain/media';
import { createD1MediaUsage } from '@/shared/server/media-usage';
import { insertNote } from '../support/note-rows';
import { createR2MediaStorage, respondWithMedia } from '@/shared/server/media-storage';

/**
 * 画像の置き場と応答（src/shared/server/media-storage.ts、U5 の決定）。workerd の R2 で確かめる。
 * 形式の見分け方の細部は tests/unit/media.test.ts が持つ
 */

const storage = createR2MediaStorage(env.MEDIA, { totalBytes: async () => 0 });

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size = 64) => {
  const data = new Uint8Array(size);
  data.set(PNG_HEAD);
  return new Blob([data], { type: 'image/png' });
};

const saveOrFail = async (file: Blob) => {
  const result = await storage.save(file);
  if (!result.ok) throw new Error(`保存できなかった: ${result.reason}`);
  return result.media;
};

describe('save', () => {
  it('形式を中身から決めて R2 に置き、推測できないキーを返す', async () => {
    // 送り手の付けた形式は信じない
    const media = await saveOrFail(new Blob([png()], { type: 'text/html' }));
    expect(media.type).toBe('image/png');
    expect(parseMediaStorageKey(media.storageKey)).toBe(media.storageKey);
    const object = await env.MEDIA.head(media.storageKey);
    expect(object?.httpMetadata?.contentType).toBe('image/png');
    expect(object?.size).toBe(64);
  });

  it('SVG を拒み、何も置かない', async () => {
    const before = (await env.MEDIA.list()).objects.length;
    const result = await storage.save(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }));
    expect(result).toEqual({ ok: false, reason: 'unsupported-type' });
    expect((await env.MEDIA.list()).objects.length).toBe(before);
  });

  it('10 MB を超える画像を、中身を読まずに拒む', async () => {
    const file = png(MEDIA_MAX_BYTES + 1);
    const slice = vi.spyOn(file, 'slice');
    expect(await storage.save(file)).toEqual({ ok: false, reason: 'too-large' });
    expect(slice).not.toHaveBeenCalled();
  });
});

describe('置き場の総量（MEDIA_TOTAL_MAX_BYTES）', () => {
  it('置いた量に足すと上限を超える画像を拒み、何も置かない', async () => {
    const full = createR2MediaStorage(env.MEDIA, {
      totalBytes: async () => MEDIA_TOTAL_MAX_BYTES - 63,
    });
    const before = (await env.MEDIA.list()).objects.length;
    expect(await full.save(png(64))).toEqual({ ok: false, reason: 'storage-full' });
    expect((await env.MEDIA.list()).objects.length).toBe(before);
  });

  it('上限ちょうどまでは置く', async () => {
    const nearlyFull = createR2MediaStorage(env.MEDIA, {
      totalBytes: async () => MEDIA_TOTAL_MAX_BYTES - 64,
    });
    const result = await nearlyFull.save(png(64));
    expect(result.ok).toBe(true);
  });

  it('D1 の実装は、すべての持ち主の media.size を合わせる', async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const usage = createD1MediaUsage(env.DB);
    const before = await usage.totalBytes();
    const note = await insertNote(env.DB);
    await env.DB.prepare(
      'INSERT INTO media (note_id, storage_key, size) VALUES (?1, ?2, 100), (?1, ?3, 250)',
    )
      .bind(note.id, crypto.randomUUID(), crypto.randomUUID())
      .run();
    expect(await usage.totalBytes()).toBe(before + 350);
  });
});

describe('remove', () => {
  it('置いた画像を消す。無いキーは無視する', async () => {
    const media = await saveOrFail(png());
    await storage.remove([media.storageKey, crypto.randomUUID()]);
    expect(await env.MEDIA.head(media.storageKey)).toBeNull();
  });

  it('R2 が 1 回で受ける 1000 件を超えるキーも消す', async () => {
    const first = await saveOrFail(png());
    const last = await saveOrFail(png());
    const missing = Array.from({ length: 1000 }, () => crypto.randomUUID());
    await storage.remove([first.storageKey, ...missing, last.storageKey]);
    expect(await env.MEDIA.head(first.storageKey)).toBeNull();
    expect(await env.MEDIA.head(last.storageKey)).toBeNull();
  });
});

describe('respondWithMedia', () => {
  it('公開している画像は、形式と ETag と no-cache を付けて返す', async () => {
    const media = await saveOrFail(png());
    const response = await respondWithMedia(storage, media.storageKey, 'public');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('ETag')).toMatch(/^"/);
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 8)).toEqual(
      new Uint8Array(PNG_HEAD),
    );
  });

  it('公開している画像は、If-None-Match が今の ETag に合えば 304 で中身を返さない', async () => {
    const media = await saveOrFail(png());
    const first = await respondWithMedia(storage, media.storageKey, 'public');
    await first.arrayBuffer();
    const etag = first.headers.get('ETag') as string;

    const revalidated = await respondWithMedia(storage, media.storageKey, 'public', etag);
    expect(revalidated.status).toBe(304);
    expect(revalidated.body).toBeNull();
    expect(revalidated.headers.get('ETag')).toBe(etag);

    const changed = await respondWithMedia(storage, media.storageKey, 'public', '"other"');
    expect(changed.status).toBe(200);
    await changed.arrayBuffer();
  });

  it.each(['foo', 'W/abc', '"a", b', '"a'])(
    '公開している画像は、If-None-Match が ETag の形でなければ（%s）無視して 200',
    async (ifNoneMatch) => {
      const media = await saveOrFail(png());
      const response = await respondWithMedia(storage, media.storageKey, 'public', ifNoneMatch);
      expect(response.status).toBe(200);
      await response.arrayBuffer();
    },
  );

  it('公開していない画像は、どのキャッシュにも残さず、ETag を付けず、If-None-Match に 304 で応えない', async () => {
    const media = await saveOrFail(png());
    const first = await respondWithMedia(storage, media.storageKey, 'restricted');
    await first.arrayBuffer();
    expect(first.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
    expect(first.headers.get('ETag')).toBeNull();

    const publicResponse = await respondWithMedia(storage, media.storageKey, 'public');
    await publicResponse.arrayBuffer();
    const etag = publicResponse.headers.get('ETag') as string;
    const second = await respondWithMedia(storage, media.storageKey, 'restricted', etag);
    expect(second.status).toBe(200);
    await second.arrayBuffer();
  });

  it('見せない画像と形の違うキーは、置き場を読まずに 404', async () => {
    const read = vi.fn<MediaStorage['read']>();
    const spy: MediaStorage = { ...storage, read };
    const media = await saveOrFail(png());
    const hidden = await respondWithMedia(spy, media.storageKey, 'hidden');
    expect(hidden.status).toBe(404);
    expect(hidden.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
    expect((await respondWithMedia(spy, '1', 'public')).status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['public', 'restricted'] as const)(
    '無い画像と、受けない形式で置かれた値は、%s でも 404 で、どのキャッシュにも残さない',
    async (access) => {
      const missing = await respondWithMedia(storage, crypto.randomUUID(), access);
      expect(missing.status).toBe(404);
      expect(missing.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
      const key = crypto.randomUUID();
      await env.MEDIA.put(key, '<svg></svg>', {
        httpMetadata: { contentType: 'image/svg+xml' },
      });
      const svg = await respondWithMedia(storage, key, access);
      expect(svg.status).toBe(404);
      expect(svg.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
    },
  );
});
