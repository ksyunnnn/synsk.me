import { contentTypeOf } from '@/features/note/domain/note-image';
import { getVisitorNoteImage } from '@/features/note/server/queries';

/**
 * 訪問者に返す note の画像（specs/003-note/spec.md の FR-026、contracts/visitor-note.md）。
 * 公開で削除していない note の、公開した版の本文が指す画像か代表画像だけを返し、ほかは 404。
 * 公開をやめた後に残さないため、どのキャッシュにも残さない（NFR-09）
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) => {
  const { slug, file } = await params;
  const image = await getVisitorNoteImage(slug, file);
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
