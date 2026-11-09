import 'server-only';

import {
  MEDIA_SIGNATURE_BYTES,
  checkMediaSize,
  detectMediaType,
  isMediaType,
  parseMediaStorageKey,
  type MediaAccess,
  type MediaStorage,
  type MediaSweepStorage,
} from '@/shared/domain/media';
import { readEnv } from '@/shared/server/env';
import { NO_STORE } from '@/shared/server/preview-no-store';

/**
 * 画像の置き場の R2 の実装と、画像の応答の組み立て（U5 の決定、2026-11-09）。R2 を使うのは
 * このファイルだけ（constitution の VIII. Portable Core）。R2 のバケットは公開せず、Worker を通して
 * 配る（migrations/0005_rebuild_note_and_create_media.sql の `media`）。
 *
 * 見せてよいかは各機能が持ち主の状態から決め、`respondWithMedia` に `MediaAccess` で渡す
 */

/** 条件つきで読んだときは、条件に合わず中身を返さなければ `body` を持たない */
const hasBody = (object: R2Object | R2ObjectBody): object is R2ObjectBody => 'body' in object;

/**
 * 消し損ねの突き合わせの続きの位置を置くキー。画像と同じバケットに置き、表を足さない。
 * UUID の形でないため、画像として配らず、突き合わせの対象にもならない
 */
const SWEEP_CURSOR_KEY = 'sweep-orphaned-media/cursor';

/** R2 の `delete` が 1 回で受けるキーの数の上限 */
const R2_DELETE_MAX_KEYS = 1000;

/**
 * `If-None-Match` の値が ETag の並びの形（RFC 9110 の 13.1.2）か。R2 は形の違う値で例外を投げる
 * ため、形の違う値は条件として渡さない
 */
const ENTITY_TAG = String.raw`(?:W\/)?"[\x21\x23-\x7e]*"`;
const IF_NONE_MATCH = new RegExp(`^(?:\\*|${ENTITY_TAG}(?:[ \\t]*,[ \\t]*${ENTITY_TAG})*)$`);
const isIfNoneMatch = (value: string) => IF_NONE_MATCH.test(value.trim());

export const createR2MediaStorage = (bucket: R2Bucket): MediaStorage => ({
  save: async (file) => {
    const sizeRejection = checkMediaSize(file.size);
    if (sizeRejection) return { ok: false, reason: sizeRejection };
    const head = new Uint8Array(await file.slice(0, MEDIA_SIGNATURE_BYTES).arrayBuffer());
    const type = detectMediaType(head);
    if (type === null) return { ok: false, reason: 'unsupported-type' };

    const storageKey = crypto.randomUUID();
    await bucket.put(storageKey, file, { httpMetadata: { contentType: type } });
    return { ok: true, media: { storageKey, type, size: file.size } };
  },

  read: async (storageKey, options = {}) => {
    const { ifNoneMatch } = options;
    const object: R2Object | R2ObjectBody | null =
      ifNoneMatch && isIfNoneMatch(ifNoneMatch)
        ? await bucket.get(storageKey, { onlyIf: new Headers({ 'If-None-Match': ifNoneMatch }) })
        : await bucket.get(storageKey);
    if (object === null) return null;
    const type = object.httpMetadata?.contentType ?? '';
    // 受ける形式を確かめて置いた画像だけを返す。ほかの経路で置かれた値は配らない
    if (!isMediaType(type)) {
      if (hasBody(object)) await object.body.cancel();
      return null;
    }
    if (!hasBody(object)) return { notModified: true, etag: object.httpEtag };
    return { body: object.body, type, size: object.size, etag: object.httpEtag };
  },

  remove: async (storageKeys) => {
    for (let start = 0; start < storageKeys.length; start += R2_DELETE_MAX_KEYS) {
      await bucket.delete(storageKeys.slice(start, start + R2_DELETE_MAX_KEYS));
    }
  },
});

/** 突き合わせが使う置き場の操作の R2 の実装（src/shared/server/sweep-orphaned-media.ts） */
export const createR2MediaSweepStorage = (bucket: R2Bucket): MediaSweepStorage => ({
  remove: createR2MediaStorage(bucket).remove,
  list: async ({ cursor, limit }) => {
    const listed = await bucket.list({ limit, ...(cursor === null ? {} : { cursor }) });
    return {
      items: listed.objects.flatMap((object) => {
        const storageKey = parseMediaStorageKey(object.key);
        return storageKey === null ? [] : [{ storageKey, uploadedAt: object.uploaded }];
      }),
      cursor: listed.truncated ? listed.cursor : null,
    };
  },

  readSweepCursor: async () => {
    const object = await bucket.get(SWEEP_CURSOR_KEY);
    return object === null ? null : await object.text();
  },

  writeSweepCursor: async (cursor) => {
    if (cursor === null) await bucket.delete(SWEEP_CURSOR_KEY);
    else await bucket.put(SWEEP_CURSOR_KEY, cursor);
  },
});

/** 組み立て用の関数。binding の名前は `wrangler.jsonc` の `r2_buckets` */
export const createMediaStorage = async (): Promise<MediaStorage> =>
  createR2MediaStorage((await readEnv()).NOTE_IMAGES);

/**
 * 公開している画像のキャッシュの決まり。キャッシュしてよいが、使う前に毎回 Worker に確かめさせる。
 * 長く持たせると、秘匿化や下書きに戻した後も古い画像が返る（docs/REQUIREMENTS.md の NFR-08、
 * docs/SOFTWARE_DESIGN.md の原則 1）。確かめ直しは ETag と 304 で転送を省く。速さは測ってから直す
 * （原則 6）
 */
const PUBLIC_CACHE_CONTROL = 'no-cache';

/**
 * 404 は、どのキャッシュにも残さない。公開していない画像の経路の応答をキャッシュに置かず（NFR-09）、
 * 見せない画像を公開した後に 404 が残らないようにする
 */
const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': NO_STORE } });

/**
 * 画像の応答を作る。`hidden` と、形の違うキーは置き場を読まずに 404。公開していない画像
 * （`restricted`）は、どのキャッシュにも残さず、ETag を付けない（NFR-09）。`ifNoneMatch` は要求の
 * `If-None-Match`。公開している画像でだけ使い、ETag の並びの形でない値は無視する
 */
export const respondWithMedia = async (
  storage: MediaStorage,
  key: string,
  access: MediaAccess,
  ifNoneMatch: string | null = null,
): Promise<Response> => {
  const storageKey = parseMediaStorageKey(key);
  if (access === 'hidden' || storageKey === null) return notFound();

  const isPublic = access === 'public';
  const media = await storage.read(storageKey, { ifNoneMatch: isPublic ? ifNoneMatch : null });
  if (media === null) return notFound();

  const headers = new Headers({
    'Cache-Control': isPublic ? PUBLIC_CACHE_CONTROL : NO_STORE,
    // 宣言した形式のまま扱わせる。ブラウザに中身から形式を推測させない
    'X-Content-Type-Options': 'nosniff',
  });
  if (isPublic) headers.set('ETag', media.etag);
  if ('notModified' in media) return new Response(null, { status: 304, headers });

  headers.set('Content-Type', media.type);
  headers.set('Content-Length', String(media.size));
  return new Response(media.body, { headers });
};
