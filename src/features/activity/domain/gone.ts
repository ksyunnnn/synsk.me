import type { FetchedItem, UrlCheck } from '@/features/activity/domain/fetched-item';

/**
 * 取得元で消えたかを確かめる候補と、消す件数（specs/004-external-activity/research.md の R7）。
 * 副作用を持たない。読み書きはユースケースが行う
 */

/** 1 回の取得で URL を確かめる候補の上限 */
export const MAX_CHECKS_PER_FETCH = 5;
/** 1 回の取得で一覧から消す activity の上限（FR-019） */
export const MAX_REMOVALS_PER_FETCH = 5;

/** 保存した外部の activity のうち、候補を選ぶのに要る値 */
export type StoredActivityKey = {
  id: number;
  externalId: string | null;
  url: string;
  publishedAt: string | null;
};

/** ID を持つ項目は ID で、持たない項目は URL で、同じ項目かを判定する（FR-008） */
const keyOf = (item: { externalId: string | null; url: string }) =>
  item.externalId === null ? `url:${item.url}` : `id:${item.externalId}`;

/**
 * 取り直した一覧に無い activity から、URL を確かめる候補を選ぶ。
 * 一覧がすべての項目を含まない取得元（`isComplete` が false）では、取り直した一覧の最も古い
 * 公開日より前の activity を選ばない。一覧に無いことだけでは消さない（FR-018）。
 * 候補は新しい順に、上限まで
 */
export const selectGoneCandidates = (
  stored: readonly StoredActivityKey[],
  fetched: { items: readonly FetchedItem[]; isComplete: boolean },
): StoredActivityKey[] => {
  const present = new Set(fetched.items.map(keyOf));
  const missing = stored.filter((row) => !present.has(keyOf(row)));

  let window = missing;
  if (!fetched.isComplete) {
    const dates = fetched.items
      .map((item) => item.publishedAt)
      .filter((date): date is string => date !== null)
      .sort();
    const oldest = dates[0];
    // 取り直した一覧が空なら、どこまでが一覧に入るはずかが分からない。候補を選ばない
    if (oldest === undefined) return [];
    window = missing.filter((row) => row.publishedAt !== null && row.publishedAt >= oldest);
  }

  return [...window]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || b.id - a.id)
    .slice(0, MAX_CHECKS_PER_FETCH);
};

/**
 * 確かめた結果から、消す activity の id を選ぶ。`gone` だけを消し、`unknown` は残す（FR-020）。
 * 上限を超えた分は残す（FR-019）
 */
export const selectRemovals = (checks: readonly { id: number; check: UrlCheck }[]): number[] =>
  checks
    .filter(({ check }) => check === 'gone')
    .slice(0, MAX_REMOVALS_PER_FETCH)
    .map(({ id }) => id);
