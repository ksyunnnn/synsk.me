import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { MEDIA_MAX_BYTES, type MediaStorage } from '@/shared/domain/media';
import { createR2MediaStorage, respondWithMedia } from '@/shared/server/media-storage';

/**
 * 画像の置き場と応答（src/shared/server/media-storage.ts、U5 の決定）。workerd の R2 で確かめる。
 * 形式の見分け方の細部は tests/unit/media.test.ts が持つ
 */

const storage = createR2MediaStorage(env.NOTE_IMAGES);

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
    expect(media.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    const object = await env.NOTE_IMAGES.head(media.storageKey);
    expect(object?.httpMetadata?.contentType).toBe('image/png');
    expect(object?.size).toBe(64);
  });

  it('SVG を拒み、何も置かない', async () => {
    const before = (await env.NOTE_IMAGES.list()).objects.length;
    const result = await storage.save(new Blob(['<svg></svg>'], { type: 'image/svg+xml' }));
    expect(result).toEqual({ ok: false, reason: 'unsupported-type' });
    expect((await env.NOTE_IMAGES.list()).objects.length).toBe(before);
  });

  it('10 MB を超える画像を、中身を読まずに拒む', async () => {
    const file = png(MEDIA_MAX_BYTES + 1);
    const slice = vi.spyOn(file, 'slice');
    expect(await storage.save(file)).toEqual({ ok: false, reason: 'too-large' });
    expect(slice).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  it('置いた画像を消す。無いキーは無視する', async () => {
    const media = await saveOrFail(png());
    await storage.remove([media.storageKey, crypto.randomUUID()]);
    expect(await env.NOTE_IMAGES.head(media.storageKey)).toBeNull();
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

  it('公開していない画像は、どのキャッシュにも残さず、If-None-Match に 304 で応えない', async () => {
    const media = await saveOrFail(png());
    const first = await respondWithMedia(storage, media.storageKey, 'restricted');
    await first.arrayBuffer();
    expect(first.headers.get('Cache-Control')).toBe('no-store, must-revalidate');

    const etag = first.headers.get('ETag') as string;
    const second = await respondWithMedia(storage, media.storageKey, 'restricted', etag);
    expect(second.status).toBe(200);
    await second.arrayBuffer();
  });

  it('見せない画像と形の違うキーは、置き場を読まずに 404', async () => {
    const read = vi.fn<MediaStorage['read']>();
    const spy: MediaStorage = { ...storage, read };
    const media = await saveOrFail(png());
    expect((await respondWithMedia(spy, media.storageKey, 'hidden')).status).toBe(404);
    expect((await respondWithMedia(spy, '1', 'public')).status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  it('無い画像と、受けない形式で置かれた値は 404', async () => {
    expect((await respondWithMedia(storage, crypto.randomUUID(), 'public')).status).toBe(404);
    const key = crypto.randomUUID();
    await env.NOTE_IMAGES.put(key, '<svg></svg>', {
      httpMetadata: { contentType: 'image/svg+xml' },
    });
    expect((await respondWithMedia(storage, key, 'public')).status).toBe(404);
  });
});
