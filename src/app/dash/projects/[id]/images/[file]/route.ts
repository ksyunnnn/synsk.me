import { getOwnerProjectImage } from '@/features/project/server/queries';
import { imageResponse } from '@/shared/server/image-response';

/**
 * オーナーが管理画面で見る実績の画像（specs/001-career-and-project/contracts/dash.md）。秘匿化した
 * 実績とサイトに載せない実績の画像も返す。オーナーでなければ 403、その実績の画像でなければ 404
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) => {
  const { id, file } = await params;
  return imageResponse(file, await getOwnerProjectImage(id, file));
};
