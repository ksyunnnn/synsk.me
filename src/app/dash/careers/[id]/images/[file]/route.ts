import { getOwnerCareerImage } from '@/features/career/server/queries';
import { imageResponse } from '@/shared/server/image-response';

/**
 * オーナーが管理画面で見る職歴の画像（specs/001-career-and-project/contracts/dash.md）。オーナーで
 * なければ 403、その職歴の画像でなければ 404
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) => {
  const { id, file } = await params;
  return imageResponse(file, await getOwnerCareerImage(id, file));
};
