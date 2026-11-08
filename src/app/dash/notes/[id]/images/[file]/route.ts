import { contentTypeOf } from '@/features/note/domain/note-image';
import { getOwnerNoteImage } from '@/features/note/server/queries';

/**
 * オーナーが管理画面で見る note の画像（specs/003-note/contracts/dash.md）。下書きの版の画像も
 * 返す。オーナーでなければ 403、その note の画像でなければ 404。どのキャッシュにも残さない
 * （NFR-09）
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) => {
  const { id, file } = await params;
  const image = await getOwnerNoteImage(id, file);
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
