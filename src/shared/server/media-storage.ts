import 'server-only';

import { readEnv } from '@/shared/server/env';

/**
 * 画像の置き場（R2、binding `NOTE_IMAGES`）の読み書き。R2 の型と binding を使うのはこのファイル
 * だけ（constitution VIII）。使い手は note の画像（specs/003-note/research.md の R7）と、
 * 実績・職歴の画像（specs/001-career-and-project/research.md の R14）。
 *
 * バケットは公開せず、配るときはサイトを通す（specs/003-note/spec.md の FR-026）
 */

export type StoredMedia = {
  body: ReadableStream;
  size: number;
};

export type MediaStorage = {
  put: (key: string, body: ArrayBuffer, contentType: string) => Promise<void>;
  /** 無ければ null */
  get: (key: string) => Promise<StoredMedia | null>;
  delete: (keys: string[]) => Promise<void>;
};

export const createR2MediaStorage = (bucket: R2Bucket): MediaStorage => ({
  put: async (key, body, contentType) => {
    await bucket.put(key, body, { httpMetadata: { contentType } });
  },
  get: async (key) => {
    const object = await bucket.get(key);
    return object ? { body: object.body, size: object.size } : null;
  },
  delete: async (keys) => {
    if (keys.length > 0) await bucket.delete(keys);
  },
});

export const getMediaStorage = async (): Promise<MediaStorage> =>
  createR2MediaStorage((await readEnv()).NOTE_IMAGES);
