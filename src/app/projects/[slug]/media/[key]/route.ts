import { respondWithProjectMedia } from '@/features/project/server/queries';

/**
 * 実績の画像を訪問者に配る（specs/001-career-and-project/spec.md の FR-030）。note の画像の経路
 * （src/app/notes/[slug]/media/[key]/route.ts）と同じ形。見せてよいかはここで 1 回だけ確かめ、
 * 見せない画像は 404 と `Cache-Control: no-store` を返す。`src/proxy.ts` では D1 を読まない
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string; key: string }> },
) => {
  const { slug, key } = await params;
  return respondWithProjectMedia(slug, key, request.headers.get('if-none-match'));
};
