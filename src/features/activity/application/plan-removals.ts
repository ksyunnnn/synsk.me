import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type { SourceListing } from '@/features/activity/domain/fetched-item';

/**
 * 1 つの取得元の取り直しで、取得元で消えたと確かめた行を求める（docs/SOFTWARE_DESIGN.md の
 * 「読む → 計算 → 書く」の計算、specs/004-external-activity/research.md の R6）
 *
 * - 取得元の項目をすべて取ったとき（`isComplete`）だけ、一覧に無い行を消す候補にする（FR-017・FR-018）
 * - 消す候補が上限を超えた回は、1 件も消さない（FR-019）。一度に多く消えるのは取得元の誤り
 *   （空の一覧が返るなど）の兆しで、消したものは取り消せないため（原則 2）
 * - 同じ項目の判定は `planRefresh` と同じ。ID を返す取得元は ID で、返さない取得元は URL で
 */
export const planRemovals = (
  stored: StoredItem[],
  listing: SourceListing,
  maxRemovals: number,
): { deletes: number[]; keptOverLimit: number } => {
  if (!listing.isComplete) return { deletes: [], keptOverLimit: 0 };

  const externalIds = new Set<string>();
  const urls = new Set<string>();
  for (const item of listing.items) {
    if (item.externalId === undefined) urls.add(item.url);
    else externalIds.add(item.externalId);
  }
  const candidates = stored
    .filter((row) =>
      row.externalId === null ? !urls.has(row.url) : !externalIds.has(row.externalId),
    )
    .map((row) => row.id);

  return candidates.length > maxRemovals
    ? { deletes: [], keptOverLimit: candidates.length }
    : { deletes: candidates, keptOverLimit: 0 };
};
