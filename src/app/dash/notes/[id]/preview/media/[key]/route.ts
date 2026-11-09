import { respondWithPreviewNoteMedia } from '@/features/note/server/queries';

/**
 * 見た目の確認の画面（`/dash/notes/{uid}/preview`）が描く画像を、オーナーにだけ返す
 * （docs/REQUIREMENTS.md の FR-13、specs/003-note/research.md の R15）。確認している版の本文が指す
 * 画像と代表画像だけを返し、どのキャッシュにも残さない（NFR-09）。訪問者の経路
 * `/notes/{slug}/media/{key}` は、公開した版の画像だけを返す（spec の FR-026）
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) => {
  const { id, key } = await params;
  return respondWithPreviewNoteMedia(id, key);
};
