/**
 * note の画像の決まり（specs/003-note/research.md の R7）。形式はファイルの先頭のバイトで
 * 見分け、送られた種類の名前を信じない。SVG はスクリプトを持てるため受け付けない
 */

/** 1 枚の大きさの上限（constitution II） */
export const NOTE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** 1 つの note が持てる画像の数の上限（constitution II） */
export const NOTE_IMAGE_MAX_COUNT = 30;

export const NOTE_IMAGE_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
export type NoteImageExtension = keyof typeof NOTE_IMAGE_TYPES;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** 先頭のバイトから形式を見分ける。受け付けない形式なら null */
export const detectImageExtension = (head: Uint8Array): NoteImageExtension | null => {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF....WEBP
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8))
    return 'webp';
  return null;
};

export type NoteImageError = 'missing' | 'too-large' | 'unsupported' | 'too-many';

/** 送られた画像の大きさを確かめる。中身を読む前に呼ぶ。通れば null */
export const checkNoteImageSize = (size: number): NoteImageError | null => {
  if (size === 0) return 'missing';
  return size > NOTE_IMAGE_MAX_BYTES ? 'too-large' : null;
};

/** 読んだ画像の大きさと形式を確かめる。形式は先頭のバイトで見分ける */
export const checkNoteImage = (
  bytes: Uint8Array,
): { ok: true; extension: NoteImageExtension } | { ok: false; error: NoteImageError } => {
  const sizeError = checkNoteImageSize(bytes.byteLength);
  if (sizeError) return { ok: false, error: sizeError };
  const extension = detectImageExtension(bytes.subarray(0, 16));
  return extension ? { ok: true, extension } : { ok: false, error: 'unsupported' };
};

/** 画像のファイル名。推測できない uuid に拡張子を付ける */
export const newNoteImageFile = (extension: NoteImageExtension): string =>
  `${crypto.randomUUID()}.${extension}`;

/** URL と本文の `media:{file}` で受け付けるファイル名の形 */
export const isNoteImageFile = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/.test(value);

/** ファイル名から応答の種類を決める */
export const contentTypeOf = (file: string): string => {
  const extension = file.split('.').pop() as NoteImageExtension;
  return NOTE_IMAGE_TYPES[extension] ?? 'application/octet-stream';
};

/** R2 のキー。ファイル名に `notes/` を付ける */
export const toStorageKey = (file: string): string => `notes/${file}`;
export const toImageFile = (storageKey: string): string => storageKey.replace(/^notes\//, '');

/** 本文に貼る書き方（research.md の R6） */
export const toMarkdownImage = (file: string): string => `![](media:${file})`;

/** 本文の `media:{file}` の印 */
export const MEDIA_SCHEME = 'media:';
