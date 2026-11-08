import { getVisitorNoteImage } from '@/features/note/server/queries';
import { imageResponse } from '@/shared/server/image-response';

/**
 * 訪問者に返す note の画像（specs/003-note/spec.md の FR-026、contracts/visitor-note.md）。
 * 公開で削除していない note の、公開した版の本文が指す画像か代表画像だけを返し、ほかは 404
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) => {
  const { slug, file } = await params;
  return imageResponse(file, await getVisitorNoteImage(slug, file));
};
