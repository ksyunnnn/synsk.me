import type {
  LinkPreviewFetchFailure,
  LinkPreviewRefetchError,
  NoteId,
  VisitorLinkPreview,
} from '@/features/note/domain/note';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import type { Author } from '@/shared/domain/author';
import { readMarkdown } from '@/shared/domain/markdown';

/**
 * 1 つの URL の題と画像の URL を取る。投げずに、取れたか取れなかった理由を返す。上限と内部の
 * アドレスの検査は実装が持つ（plan.md の「参照先への取得の上限」）。本番の実装は
 * src/shared/server/link-preview-fetch.ts の `fetchLinkPreview`（`src/features/note/server/actions.ts`）
 */
export type SingleLinkPreviewSource = (
  url: string,
) => Promise<
  | ({ status: 'fetched' } & VisitorLinkPreview)
  | { status: 'failed'; reason: LinkPreviewFetchFailure }
>;

export type RefetchLinkPreviewOutcome =
  | { status: 'refetched' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'invalid'; error: LinkPreviewRefetchError };

/**
 * URL カードの参照先の情報を取り直す（User Story 6 の 3、FR-029。2026-11-10、オーナーの決定）。
 * 最も新しい版の本文の URL だけの段落の URL に限って取りに行き、取れたら `link_preview` の行を
 * 取り直した中身で書き換える。その URL を書いたすべての note のカードが変わる。取れなければ
 * 書かずに前の行を残し、理由を返す（原則 4）。オーナーでなければ読まず、取りに行かず、書かない
 * （FR-033）
 */
export const refetchLinkPreview = async (
  { notes, fetchLinkPreview }: { notes: NoteRepository; fetchLinkPreview: SingleLinkPreviewSource },
  author: Author | null,
  id: NoteId,
  url: string,
  now: string,
): Promise<RefetchLinkPreviewOutcome> => {
  if (!author) return { status: 'forbidden' };
  const preview = await notes.findPreview(id);
  if (preview === null) return { status: 'not-found' };
  if (!readMarkdown(preview.body).urlLines.includes(url))
    return { status: 'invalid', error: 'not-in-body' };

  const result = await fetchLinkPreview(url);
  if (result.status === 'failed') return { status: 'invalid', error: result.reason };
  await notes.saveLinkPreview({
    url,
    title: result.title,
    imageUrl: result.imageUrl,
    fetchedAt: now,
  });
  return { status: 'refetched' };
};
