import 'server-only';

import {
  NOTE_SHARE_IMAGE_SIZE,
  SITE_NOTE_SHARE_IMAGE_PATH,
} from '@/features/note/domain/share-image';
import {
  parseMediaStorageKey,
  type MediaAccess,
  type MediaStorage,
  type MediaType,
} from '@/shared/domain/media';
import { NO_STORE } from '@/shared/server/preview-no-store';

/**
 * 代表画像を、共有したときの小さい正方形に縮めて配る（specs/003-note/plan.md の U8、research.md の
 * R12）。縮めるのは Cloudflare Images の binding（`wrangler.jsonc` の `images`）。Free プランは
 * 月に 5,000 の異なる変換までで、同じ画像と同じ値の変換は月に 1 回と数える
 * （https://developers.cloudflare.com/images/pricing/ ）。縮めるのは代表画像だけのため、数は
 * 代表画像に選んだ画像の数を超えない。
 *
 * キャッシュの決まりは原本の配り方（`src/shared/server/media-storage.ts` の `respondWithMedia`）と
 * 同じく `no-cache` で、使う前に毎回 Worker に見せてよいかを確かめさせる（NFR-08）。ETag は原本の
 * ETag から作り、確かめ直しが合えば、縮めずに 304 を返す
 */

/** 縮めた画像の ETag の頭。原本の ETag と区別し、大きさを変えたら古いキャッシュを使わせない */
const ETAG_PREFIX = `square-${NOTE_SHARE_IMAGE_SIZE}-`;

/** 原本の ETag（`"…"`）から、縮めた画像の ETag を作る */
const toSquareEtag = (etag: string) => `"${ETAG_PREFIX}${etag.replace(/^"/, '')}`;

/**
 * 要求の `If-None-Match` を、原本の ETag の並びに戻す。すべてが縮めた画像の ETag の形のときだけ
 * 戻し、ほかは条件として使わない
 */
const toSourceIfNoneMatch = (value: string | null): string | null => {
  if (value === null) return null;
  const head = `"${ETAG_PREFIX}`;
  const tags = value.split(',').map((tag) => tag.trim());
  if (!tags.every((tag) => tag.startsWith(head) && tag.length > head.length)) return null;
  return tags.map((tag) => `"${tag.slice(head.length)}`).join(', ');
};

/** 透過を持てる形式は PNG で、ほかは JPEG で出す。GIF は動かさず最初の絵だけを使う */
const outputFormat = (type: MediaType): 'image/jpeg' | 'image/png' =>
  type === 'image/jpeg' ? 'image/jpeg' : 'image/png';

const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': NO_STORE } });

/**
 * 縮めた代表画像の応答を作る。`public` 以外と形の違うキーは、置き場を読まずに 404。縮められなければ
 * （Free プランの上限を超えたときなど）、サイト共通の小さい正方形の画像へ移す。その応答は
 * キャッシュに残さず、次の要求で縮め直す
 */
export const respondWithSquareMedia = async (
  storage: MediaStorage,
  images: ImagesBinding,
  key: string,
  access: MediaAccess,
  ifNoneMatch: string | null,
): Promise<Response> => {
  const storageKey = parseMediaStorageKey(key);
  if (access !== 'public' || storageKey === null) return notFound();

  const media = await storage.read(storageKey, { ifNoneMatch: toSourceIfNoneMatch(ifNoneMatch) });
  if (media === null) return notFound();

  const headers = new Headers({
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ETag: toSquareEtag(media.etag),
  });
  if ('notModified' in media) return new Response(null, { status: 304, headers });

  try {
    const result = await images
      .input(media.body)
      .transform({ width: NOTE_SHARE_IMAGE_SIZE, height: NOTE_SHARE_IMAGE_SIZE, fit: 'cover' })
      .output({ format: outputFormat(media.type) });
    return result.response({ headers });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: SITE_NOTE_SHARE_IMAGE_PATH, 'Cache-Control': NO_STORE },
    });
  }
};
