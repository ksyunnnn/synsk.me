import 'server-only';

import {
  MEDIA_SIGNATURE_BYTES,
  checkMediaSize,
  detectMediaType,
  isMediaType,
  parseMediaStorageKey,
  type MediaAccess,
  type MediaStorage,
} from '@/shared/domain/media';
import { readEnv } from '@/shared/server/env';
import { withNoStore } from '@/shared/server/preview-no-store';

/**
 * 画像の置き場の R2 の実装と、画像の応答の組み立て（U5 の決定、2026-11-09）。R2 を使うのは
 * このファイルだけ（constitution の VIII. Portable Core）。R2 のバケットは公開せず、Worker を通して
 * 配る（migrations/0005_rebuild_note_and_create_media.sql の `media`）。
 *
 * 見せてよいかは各機能が持ち主の状態から決め、`respondWithMedia` に `MediaAccess` で渡す
 */

/** 条件つきで読んだときは、条件に合わず中身を返さなければ `body` を持たない */
const hasBody = (object: R2Object | R2ObjectBody): object is R2ObjectBody => 'body' in object;

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
    const object: R2Object | R2ObjectBody | null = ifNoneMatch
      ? await bucket.get(storageKey, { onlyIf: new Headers({ 'If-None-Match': ifNoneMatch }) })
      : await bucket.get(storageKey);
    if (object === null) return null;
    const type = object.httpMetadata?.contentType ?? '';
    // 受ける形式を確かめて置いた画像だけを返す。ほかの経路で置かれた値は配らない
    if (!isMediaType(type)) return null;
    if (!hasBody(object)) return { notModified: true, etag: object.httpEtag };
    return { body: object.body, type, size: object.size, etag: object.httpEtag };
  },

  remove: async (storageKeys) => {
    if (storageKeys.length > 0) await bucket.delete(storageKeys);
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

const notFound = () => new Response(null, { status: 404 });

/**
 * 画像の応答を作る。`hidden` と、形の違うキーは置き場を読まずに 404。公開していない画像
 * （`restricted`）は、どのキャッシュにも残さない（NFR-09）。`ifNoneMatch` は要求の
 * `If-None-Match`。公開している画像でだけ使う
 */
export const respondWithMedia = async (
  storage: MediaStorage,
  key: string,
  access: MediaAccess,
  ifNoneMatch: string | null = null,
): Promise<Response> => {
  const storageKey = parseMediaStorageKey(key);
  if (access === 'hidden' || storageKey === null) return notFound();

  const media = await storage.read(storageKey, {
    ifNoneMatch: access === 'public' ? ifNoneMatch : null,
  });
  if (media === null) return notFound();

  const headers = new Headers({
    ETag: media.etag,
    'Cache-Control': PUBLIC_CACHE_CONTROL,
    // 宣言した形式のまま扱わせる。ブラウザに中身から形式を推測させない
    'X-Content-Type-Options': 'nosniff',
  });
  if ('notModified' in media) return new Response(null, { status: 304, headers });

  headers.set('Content-Type', media.type);
  headers.set('Content-Length', String(media.size));
  const response = new Response(media.body, { headers });
  return access === 'public' ? response : withNoStore(response);
};
