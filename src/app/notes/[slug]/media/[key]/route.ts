import { respondWithNoteMedia } from '@/features/note/server/queries';

/**
 * note の画像を訪問者に配る（specs/003-note/contracts/visitor-note.md、research.md の R9・R12）。
 * 見せてよいかはここで 1 回だけ確かめ、見せない画像は 404 と `Cache-Control: no-store` を自分で
 * 返す。描画しないため、`src/proxy.ts` では D1 を読まない
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string; key: string }> },
) => {
  const { slug, key } = await params;
  return respondWithNoteMedia(slug, key, request.headers.get('if-none-match'));
};
