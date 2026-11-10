import { respondWithNoteCardMedia } from '@/features/note/server/queries';

/**
 * note を共有したときの画像（代表画像を小さい正方形に縮めたもの。specs/003-note/plan.md の U8、
 * research.md の R12）。見せてよいかはここで 1 回だけ確かめる。描画しないため、`src/proxy.ts` では
 * D1 を読まない
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string; key: string }> },
) => {
  const { slug, key } = await params;
  return respondWithNoteCardMedia(slug, key, request.headers.get('if-none-match'));
};
