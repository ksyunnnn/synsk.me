import { respondWithLifeEventImage } from '@/features/activity/server/queries';

/**
 * life event の代表画像を配る（specs/004-external-activity/contracts/visitor-life-event.md の
 * 「画像の経路」、FR-029・FR-030）。その life event の代表画像だけを返し、ほかは 404。R2 の原本を
 * 変換せずに返す（U5 の決定）
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> => {
  const { slug, id } = await params;
  return respondWithLifeEventImage(slug, id, request.headers.get('If-None-Match'));
};
