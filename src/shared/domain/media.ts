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

/**
 * 置き場に置く画像の総量の上限。note・実績・職歴・life event の画像を合わせて数える。R2 は無料枠
 * （保存 10 GB-month）を超えると課金される（https://developers.cloudflare.com/r2/pricing/ ）ため、
 * 無料枠を下回る値で止める（docs/SOFTWARE_DESIGN.md の原則 2）。無料枠との差の 2 GB は、`media` の
 * 行を持たない消し損ね（`ORPHAN_GRACE_MS` の間は消さない）を吸う。値は 2026-11-10 に PM が承認した
 * （issue #219）
 */
export const MEDIA_TOTAL_MAX_BYTES = 8 * 10 ** 9;

/** 画像を受けない理由。`storage-full` は置き場の総量が上限を超えること */
export type MediaRejection = 'empty' | 'too-large' | 'unsupported-type' | 'storage-full';

/** 大きさを確かめる。中身を読む前に止めるため、形式より先に確かめる */
export const checkMediaSize = (size: number): MediaRejection | null => {
  if (size === 0) return 'empty';
  if (size > MEDIA_MAX_BYTES) return 'too-large';
  return null;
};

/** 置き場の総量が上限を超えるときに、画像を足す画面が出す文言。どの機能の画面も同じ文言にする */
export const MEDIA_STORAGE_FULL_MESSAGE =
  '画像の置き場が上限（8 GB）に達しました。使わない画像を消してから足してください';

/** 置いた量 `usedBytes` に `size` の画像を足すと総量の上限を超えるなら `storage-full` */
export const checkMediaQuota = (usedBytes: number, size: number): MediaRejection | null =>
  usedBytes + size > MEDIA_TOTAL_MAX_BYTES ? 'storage-full' : null;

/**
 * 置いた画像の総量を知る。`media.size` の合計で、置き場を数えない。置き場の一覧は 1 回ごとに
 * 課金の対象の操作（Class A）で、1,000 件ごとに回数が増える
 */
export type MediaUsage = {
  /** `media` の行の `size` の合計（バイト） */
  totalBytes: () => Promise<number>;
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
  /**
   * 形式と大きさと置き場の総量を確かめてから置く。置き場のキーは推測できない値で、持ち主から
   * 作らない。使い手は、返った `size` を `media.size` に記録する（総量の数え方、`MediaUsage`）
   */
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

/*
 * 消し損ねた画像（src/shared/server/sweep-orphaned-media.ts）。`media` の行を消した後に置き場の
 * 削除が失敗するか、その間に Worker が止まると、どの行も指さない画像が置き場に残る。記録せず、
 * 置き場の一覧と `media.storage_key` を突き合わせて見つけ、消し直す
 */

/**
 * 置いてからこの時間を過ぎるまでは、どの行も指さなくても消さない。保存は置き場に置いてから
 * `media` の行を入れるため、その間の画像を消さない
 */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/** 突き合わせの対象にしてよいか。置いてから `ORPHAN_GRACE_MS` を過ぎたもの */
export const isPastOrphanGrace = (uploadedAt: Date, now: Date): boolean =>
  now.getTime() - uploadedAt.getTime() > ORPHAN_GRACE_MS;

/**
 * 突き合わせが使う置き場の操作。画像を保存して配る機能は使わないため、`MediaStorage` と分ける
 */
export type MediaSweepStorage = Pick<MediaStorage, 'remove'> & {
  /**
   * 置いてあるものを、キーの順に `limit` 件ずつ並べる。`cursor` は前の頁が返した続きの位置で、
   * その頁で最後に読んだキー。置き場が返す不透明な続きの印は、後の回で使えなくなっても公式の
   * 説明が無いため持たない。画像でないもの（キーが UUID の形でないもの）は除く
   */
  list: (options: { cursor: string | null; limit: number }) => Promise<{
    items: { storageKey: MediaStorageKey; uploadedAt: Date }[];
    /** 続きの頁の位置。終わりまで並べたら null */
    cursor: string | null;
  }>;
  /** 次の回がどこから続けるか。始めからなら null */
  readSweepCursor: () => Promise<string | null>;
  writeSweepCursor: (cursor: string | null) => Promise<void>;
};

/** `media` の行が指しているキーを調べる。使い手は消し損ねの突き合わせ */
export type MediaReferences = {
  /** 渡したキーのうち、`media` のどれかの行が指すもの */
  findReferenced: (storageKeys: MediaStorageKey[]) => Promise<Set<MediaStorageKey>>;
};
