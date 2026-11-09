import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type { FetchedItem, SourceListing } from '@/features/activity/domain/fetched-item';

/**
 * 1 つの取得元の取り直しで、取得元で消えたと確かめた行を求める（docs/SOFTWARE_DESIGN.md の
 * 「読む → 計算 → 書く」の計算、specs/004-external-activity/research.md の R6）
 *
 * - 取得元の項目をすべて取ったとき（`isComplete`）は、一覧に無い行を消す候補にする（FR-017・FR-018）
 * - すべて取らないときは、個別の URL を取り直して消えたと確かめた行（`confirmedGone`）だけを候補にする
 * - 消す候補が上限を超えた回は、1 件も消さない（FR-019）。一度に多く消えるのは取得元の誤り
 *   （空の一覧が返るなど）の兆しで、消したものは取り消せないため（原則 2）
 * - 同じ項目の判定は `planRefresh` と同じ。ID を返す取得元は ID で、返さない取得元は URL で
 */
export const planRemovals = (
  stored: StoredItem[],
  listing: SourceListing,
  maxRemovals: number,
  confirmedGone: number[] = [],
): { deletes: number[]; keptOverLimit: number } => {
  const candidates = listing.isComplete
    ? missingFrom(stored, listing.items).map((row) => row.id)
    : confirmedGone;
  return candidates.length > maxRemovals
    ? { deletes: [], keptOverLimit: candidates.length }
    : { deletes: candidates, keptOverLimit: 0 };
};

/**
 * すべて取らない取得元で、個別の URL を取り直して確かめる行を選ぶ（R6）。一覧に無い行のうち、
 * 確かめたことの無い行を先に、次に確かめた日時（`gone_checked_at`）の古い順に、上限の数まで。
 * 確かめた日時は確かめる順を決めるためだけの値で、消えた印ではない
 */
export const pickGoneChecks = (
  stored: StoredItem[],
  listed: FetchedItem[],
  maxChecks: number,
): StoredItem[] =>
  missingFrom(stored, listed)
    .sort((a, b) => {
      const at = a.goneCheckedAt ?? '';
      const bt = b.goneCheckedAt ?? '';
      return at === bt ? a.id - b.id : at < bt ? -1 : 1;
    })
    .slice(0, Math.max(0, maxChecks));

/** 保存した行のうち、取った一覧に無いもの */
const missingFrom = (stored: StoredItem[], listed: FetchedItem[]): StoredItem[] => {
  const externalIds = new Set<string>();
  const urls = new Set<string>();
  for (const item of listed) {
    if (item.externalId === undefined) urls.add(item.url);
    else externalIds.add(item.externalId);
  }
  return stored.filter((row) =>
    row.externalId === null ? !urls.has(row.url) : !externalIds.has(row.externalId),
  );
};
