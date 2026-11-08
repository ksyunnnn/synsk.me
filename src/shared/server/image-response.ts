import 'server-only';

import { contentTypeOf } from '@/shared/domain/media-image';
import type { StoredMedia } from '@/shared/server/media-storage';

/**
 * 本文の画像と代表画像を返す route handler の応答（specs/003-note/spec.md の FR-026、
 * specs/001-career-and-project/spec.md の FR-030）。返せない画像は 404。公開をやめた後や秘匿化した
 * 後に残さないため、どのキャッシュにも残さない（NFR-09）。種類はファイル名から決め、送り手が
 * 種類を推し量らないようにする
 */
export const imageResponse = (file: string, image: StoredMedia | null | 'forbidden'): Response => {
  if (image === 'forbidden') return new Response('Forbidden', { status: 403 });
  if (!image) return new Response('Not Found', { status: 404 });
  return new Response(image.body, {
    headers: {
      'Content-Type': contentTypeOf(file),
      'Content-Length': String(image.size),
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
