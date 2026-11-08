/**
 * 本文の画像と代表画像の決まり（specs/003-note/research.md の R7、
 * specs/001-career-and-project/research.md の R14）。使い手は note・実績・職歴。
 *
 * 形式はファイルの先頭のバイトで見分け、送られた種類の名前を信じない。SVG はスクリプトを持てるため
 * 受け付けない
 */

/** 1 枚の大きさの上限（constitution II） */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** 1 つの持ち主（note・実績・職歴）が持てる画像の数の上限（constitution II） */
export const IMAGE_MAX_COUNT = 30;

export const IMAGE_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
export type ImageExtension = keyof typeof IMAGE_TYPES;

/** `<input type="file">` の `accept` */
export const IMAGE_ACCEPT = Object.values(IMAGE_TYPES).join(',');

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** 先頭のバイトから形式を見分ける。受け付けない形式なら null */
export const detectImageExtension = (head: Uint8Array): ImageExtension | null => {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF....WEBP
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8))
    return 'webp';
  return null;
};

export type ImageError = 'missing' | 'too-large' | 'unsupported';

/** 送られた画像の大きさを確かめる。中身を読む前に呼ぶ。通れば null */
export const checkImageSize = (size: number): ImageError | null => {
  if (size === 0) return 'missing';
  return size > IMAGE_MAX_BYTES ? 'too-large' : null;
};

/** 読んだ画像の大きさと形式を確かめる。形式は先頭のバイトで見分ける */
export const checkImage = (
  bytes: Uint8Array,
): { ok: true; extension: ImageExtension } | { ok: false; error: ImageError } => {
  const sizeError = checkImageSize(bytes.byteLength);
  if (sizeError) return { ok: false, error: sizeError };
  const extension = detectImageExtension(bytes.subarray(0, 16));
  return extension ? { ok: true, extension } : { ok: false, error: 'unsupported' };
};

/** 画像のファイル名。推測できない uuid に拡張子を付ける */
export const newImageFile = (extension: ImageExtension): string =>
  `${crypto.randomUUID()}.${extension}`;

/** URL と本文の `media:{file}` で受け付けるファイル名の形 */
export const isImageFile = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/.test(value);

/** ファイル名から応答の種類を決める */
export const contentTypeOf = (file: string): string => {
  const extension = file.split('.').pop() as ImageExtension;
  return IMAGE_TYPES[extension] ?? 'application/octet-stream';
};

/** 持ち主の種類ごとの R2 のキーの頭。キーは `{頭}/{ファイル名}` */
export type MediaOwnerKind = 'notes' | 'projects' | 'careers';

export const toStorageKey = (owner: MediaOwnerKind, file: string): string => `${owner}/${file}`;

/** R2 のキーからファイル名を取り出す */
export const toImageFile = (storageKey: string): string => storageKey.replace(/^[a-z]+\//, '');

/** 送られた画像。中身は大きさを確かめた後に読む */
export type UploadedImage = {
  size: number;
  read: () => Promise<ArrayBuffer>;
};

/** 画像の置き場のうち、書き込みのユースケースが使う操作（src/shared/server/media-storage.ts） */
export type ImageStorage = {
  put: (key: string, body: ArrayBuffer, contentType: string) => Promise<void>;
  delete: (keys: string[]) => Promise<void>;
};

/** 本文の `media:{file}` の印 */
export const MEDIA_SCHEME = 'media:';

/**
 * 本文に貼る書き方（specs/003-note/research.md の R6）。キャプションは Markdown の画像の題
 * （`"..."`）に書く（specs/001-career-and-project/plan.md の U4）
 */
export const toMarkdownImage = (file: string): string => `![](${MEDIA_SCHEME}${file})`;
