import { respondWithResumeMedia } from '@/features/resume/server/queries';

/**
 * 限定公開用の職務経歴書の本文の画像を訪問者に配る。実績の画像の経路
 * （src/app/projects/[slug]/media/[key]/route.ts）と同じ形。見せてよいかはここで 1 回だけ確かめ、
 * 見せない画像は 404 と `Cache-Control: no-store` を返す
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string; key: string }> },
) => {
  const { slug, key } = await params;
  return respondWithResumeMedia(slug, key);
};
