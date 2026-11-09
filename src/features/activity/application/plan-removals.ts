import type { StoredItem } from '@/features/activity/domain/activity-repository';
import { urlKey } from '@/features/activity/application/plan-refresh';
import type { FetchedItem, SourceListing } from '@/features/activity/domain/fetched-item';

/**
 * 個別の URL を取り直して、続けてこの回数 404 が返った行を消えたと確かめる（research.md の R6、
 * 2026-11-09 の PM の決定、原則 2）。1 回の 404 は取得元の一時の誤りでも返りうるため
 */
export const GONE_STREAK_TO_REMOVE = 2;

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
  // すべて取ったと言う一覧が空なのは取得元の誤りの兆し。件数が上限より少ない取得元では、すべてを消してしまう
  if (listing.isComplete && listing.items.length === 0) return { deletes: [], keptOverLimit: 0 };
  const candidates = listing.isComplete
    ? missingFrom(stored, listing.items).map((row) => row.id)
    : confirmedGone;
  return candidates.length > maxRemovals
    ? { deletes: [], keptOverLimit: candidates.length }
    : { deletes: candidates, keptOverLimit: 0 };
};

/**
 * すべて取らない取得元で、個別の URL を取り直して確かめる行を選ぶ（R6）。一覧に無い行のうち、
 * 404 が続いている行を先に、次に確かめたことの無い行、確かめた日時（`gone_checked_at`）の古い順、同じなら公開日の古い順に、上限の数まで。
 * 確かめた日時は確かめる順を決めるためだけの値で、消えた印ではない
 */
export const pickGoneChecks = (
  stored: StoredItem[],
  listed: FetchedItem[],
  maxChecks: number,
): StoredItem[] =>
  missingFrom(stored, listed)
    .sort((a, b) => {
      // 404 が続いている行を先にする。後に回すと、2 回目を確かめるまでほかの行をすべて回る
      const as = (a.goneStreak ?? 0) > 0 ? 0 : 1;
      const bs = (b.goneStreak ?? 0) > 0 ? 0 : 1;
      if (as !== bs) return as - bs;
      const at = a.goneCheckedAt ?? '';
      const bt = b.goneCheckedAt ?? '';
      if (at !== bt) return at < bt ? -1 : 1;
      // 同じなら公開日の古い順。304 の回は一覧に載る新しい行も候補に入るので、載らない古い行を先にする
      const ap = a.publishedAt ?? '';
      const bp = b.publishedAt ?? '';
      return ap === bp ? a.id - b.id : ap < bp ? -1 : 1;
    })
    .slice(0, Math.max(0, maxChecks));

/** 保存した行のうち、取った一覧に無いもの */
const missingFrom = (stored: StoredItem[], listed: FetchedItem[]): StoredItem[] => {
  const externalIds = new Set<string>();
  const urls = new Set<string>();
  for (const item of listed) {
    if (item.externalId === undefined) urls.add(urlKey(item.url));
    else externalIds.add(item.externalId);
  }
  return stored.filter((row) =>
    row.externalId === null ? !urls.has(urlKey(row.url)) : !externalIds.has(row.externalId),
  );
};
