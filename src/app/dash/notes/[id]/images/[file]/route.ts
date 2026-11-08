import { getOwnerNoteImage } from '@/features/note/server/queries';
import { imageResponse } from '@/shared/server/image-response';

/**
 * オーナーが管理画面で見る note の画像（specs/003-note/contracts/dash.md）。下書きの版の画像も
 * 返す。オーナーでなければ 403、その note の画像でなければ 404
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) => {
  const { id, file } = await params;
  return imageResponse(file, await getOwnerNoteImage(id, file));
};
