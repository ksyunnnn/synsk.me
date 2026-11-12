import type { NoteId, NotePreview, VisitorLinkPreview } from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import { readMarkdown } from '@/shared/domain/markdown';

/**
 * 参照先の題と画像の URL を取る。取れた URL だけを返し、取れなかった URL は返さない。取る数・
 * 時間・大きさの上限は実装が持つ（plan.md の「参照先への取得の上限」）。本番の実装は
 * src/features/note/server/link-preview-fetch.ts を包む（`src/features/note/server/queries.ts`）
 */
export type LinkPreviewSource = (urls: string[]) => Promise<VisitorLinkPreview[]>;

/**
 * 公開したときの見た目を確かめる形（REQUIREMENTS.md の FR-13、research.md の R15）。最も新しい版を、
 * 状態と削除に関わらず詰める。無い id なら null。
 *
 * URL だけの段落のうち、参照先の情報（`link_preview`）を持たない URL を、描く前に取って書く
 * （U9 の決定、research.md の R13）。訪問者の表示では取らない（FR-028）。取れなかった URL は
 * 書かず、次に見た目の確認を開いたときに取り直す。書けなかった情報があっても見た目の確認は返す
 * （原則 4）
 */
export const getNotePreview = async (
  { notes, fetchLinkPreviews }: { notes: NoteRepository; fetchLinkPreviews: LinkPreviewSource },
  id: NoteId,
  now: string,
): Promise<NotePreview | null> => {
  const preview = await notes.findPreview(id);
  if (preview === null) return null;

  const { urlLines } = readMarkdown(preview.body);
  const known = new Map(preview.linkPreviews.map((link) => [link.url, link]));
  const missing = urlLines.filter((url) => !known.has(url));
  if (missing.length === 0) return preview;

  const fetched = await fetchLinkPreviews(missing);
  await Promise.allSettled(
    fetched.map((link) => notes.saveLinkPreview({ ...link, fetchedAt: now })),
  );
  for (const link of fetched) known.set(link.url, link);
  return { ...preview, linkPreviews: urlLines.flatMap((url) => known.get(url) ?? []) };
};
