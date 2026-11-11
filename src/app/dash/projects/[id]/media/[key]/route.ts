import { respondWithOwnerProjectMedia } from '@/features/project/server/queries';

/**
 * 管理画面の実績の一覧（`/dash/projects`）が描く画像を、オーナーにだけ返す（issue #330）。その
 * 実績の画像だけを返し、どのキャッシュにも残さない（docs/REQUIREMENTS.md の NFR-09）。形は
 * `src/app/dash/notes/[id]/preview/media/[key]/route.ts` と同じ。訪問者の経路
 * `/projects/{slug}/media/{key}` は、サイトに載せる秘匿化しない実績の画像だけを返す（FR-030）
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) => {
  const { id, key } = await params;
  return respondWithOwnerProjectMedia(id, key);
};
