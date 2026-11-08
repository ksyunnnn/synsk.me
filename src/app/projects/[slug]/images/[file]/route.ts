import { getVisitorProjectImage } from '@/features/project/server/queries';
import { imageResponse } from '@/shared/server/image-response';

/**
 * 訪問者に返す実績の画像（specs/001-career-and-project/spec.md の FR-030、
 * contracts/visitor-project.md）。サイトに載せる秘匿化しない実績の、本文が指す画像か代表画像だけを
 * 返す。秘匿化した実績の画像と、ほかの画像は 404
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) => {
  const { slug, file } = await params;
  return imageResponse(file, await getVisitorProjectImage(slug, file));
};
