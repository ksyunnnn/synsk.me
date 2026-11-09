/**
 * 画像の形式と大きさの決まりと、画像の置き場のインタフェース（U5 の決定、2026-11-09。
 * specs/001-career-and-project/plan.md の「未決」の U5）。使い手は 001 の実績・職歴、003 の note、
 * 004 の life event の画像。`media` の表の読み書きと、持ち主ごとに見せてよいかの判定は各機能が持つ
 */

/** 1 枚の大きさの上限。スマートフォンの写真が収まり、Images binding の入力の上限 20 MB を下回る */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

/** 受ける形式。SVG はスクリプトを含められるため受けない（docs/SOFTWARE_DESIGN.md の原則 1） */
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const isMediaType = (value: string): value is MediaType =>
  (MEDIA_TYPES as readonly string[]).includes(value);

/** 形式を見分けるのに読む、ファイルの先頭のバイト数 */
export const MEDIA_SIGNATURE_BYTES = 12;

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

/**
 * ファイルの先頭のバイトから形式を見分ける。送り手が付けた形式とファイル名は信じない。
 * どれにも合わなければ null
 */
export const detectMediaType = (head: Uint8Array): MediaType | null => {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(head, ascii('GIF87a')) || startsWith(head, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) return 'image/webp';
  return null;
};

/** 画像を受けない理由 */
export type MediaRejection = 'empty' | 'too-large' | 'unsupported-type';

/** 大きさを確かめる。中身を読む前に止めるため、形式より先に確かめる */
export const checkMediaSize = (size: number): MediaRejection | null => {
  if (size === 0) return 'empty';
  if (size > MEDIA_MAX_BYTES) return 'too-large';
  return null;
};

/**
 * 画像を誰に見せてよいか。持ち主の状態から各機能が決めて渡す
 * - `public`: 訪問者に見せてよい（公開した note、サイトに載せる秘匿化しない実績など）
 * - `restricted`: 見せてよいが、公開していない（オーナーの管理画面、限定公開用の職務経歴書など）
 * - `hidden`: 見せない
 */
export type MediaAccess = 'public' | 'restricted' | 'hidden';

/**
 * 置き場のキー。`media.storage_key` に入れ、配る経路の URL（例 `/notes/{slug}/media/{storageKey}`）
 * でも画像を指す。主キーは URL に出さない（ADR-0048）。保存のときに UUID で作り、推測できない
 */
export type MediaStorageKey = string;

/** URL の値をキーとして読む。UUID の形でなければ、置き場を読まずに無い画像として扱う */
export const parseMediaStorageKey = (value: string): MediaStorageKey | null =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) ? value : null;

export type SavedMedia = { storageKey: MediaStorageKey; type: MediaType; size: number };

/** 置き場から読んだ画像 */
export type StoredMedia = {
  body: ReadableStream;
  type: MediaType;
  size: number;
  /** HTTP の ETag の形（引用符つき） */
  etag: string;
};

export type MediaStorage = {
  /** 形式と大きさを確かめてから置く。置き場のキーは推測できない値で、持ち主から作らない */
  save: (
    file: Blob,
  ) => Promise<{ ok: true; media: SavedMedia } | { ok: false; reason: MediaRejection }>;
  /**
   * 読む。無いか、受けない形式で置かれていれば null。`ifNoneMatch` が今の ETag に合えば、中身を
   * 読まずに `{ notModified: true, etag }` を返す。`ifNoneMatch` が ETag の並びの形でなければ無視する
   */
  read: (
    storageKey: MediaStorageKey,
    options?: { ifNoneMatch?: string | null },
  ) => Promise<StoredMedia | { notModified: true; etag: string } | null>;
  /** 消す。無いキーは無視する */
  remove: (storageKeys: MediaStorageKey[]) => Promise<void>;
};
