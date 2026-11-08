import { describe, expect, it } from 'vitest';
import {
  NOTE_IMAGE_MAX_BYTES,
  checkNoteImage,
  checkNoteImageSize,
  isNoteImageFile,
  newNoteImageFile,
} from '@/features/note/domain/note-image';

/** note の画像の形式と上限（specs/003-note/research.md の R7、constitution II） */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const SVG = [...new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')];

const bytes = (head: number[], size = head.length) => {
  const array = new Uint8Array(size);
  array.set(head);
  return array;
};

describe('checkNoteImage', () => {
  it.each([
    ['png', PNG],
    ['jpg', JPEG],
    ['gif', GIF],
    ['webp', WEBP],
  ])('先頭のバイトで %s を見分ける', (extension, head) => {
    expect(checkNoteImage(bytes(head, 64))).toEqual({ ok: true, extension });
  });

  it('SVG と見分けられない形式は受け付けない', () => {
    expect(checkNoteImage(bytes(SVG, 64))).toEqual({ ok: false, error: 'unsupported' });
    expect(checkNoteImage(bytes([1, 2, 3, 4], 64))).toEqual({ ok: false, error: 'unsupported' });
  });

  it('5 MB を超えると拒み、5 MB ちょうどは受け付ける', () => {
    expect(checkNoteImage(bytes(PNG, NOTE_IMAGE_MAX_BYTES))).toMatchObject({ ok: true });
    expect(checkNoteImage(bytes(PNG, NOTE_IMAGE_MAX_BYTES + 1))).toEqual({
      ok: false,
      error: 'too-large',
    });
  });
});

describe('checkNoteImageSize', () => {
  it('中身を読む前に、空と大きすぎるものを止める', () => {
    expect(checkNoteImageSize(0)).toBe('missing');
    expect(checkNoteImageSize(NOTE_IMAGE_MAX_BYTES + 1)).toBe('too-large');
    expect(checkNoteImageSize(10)).toBeNull();
  });
});

describe('画像のファイル名', () => {
  it('新しいファイル名は uuid と拡張子で、受け付ける形', () => {
    expect(isNoteImageFile(newNoteImageFile('webp'))).toBe(true);
  });

  it('ほかの形を受け付けない', () => {
    expect(isNoteImageFile('../secret.png')).toBe(false);
    expect(isNoteImageFile('0123.svg')).toBe(false);
  });
});
