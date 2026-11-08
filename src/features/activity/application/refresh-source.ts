import { selectGoneCandidates, selectRemovals } from '@/features/activity/domain/gone';
import type { ListSource } from '@/features/activity/domain/source';
import type { ActivityDeps } from './deps';

export type RefreshSourceOutcome =
  | { status: 'failed'; reason: string }
  | { status: 'refreshed'; fetched: number; written: number; removed: number };

/**
 * 一覧を取る取得元を 1 つ取り直す（specs/004-external-activity/contracts/fetch.md）。
 * 読む → 取る → 計算する → 確かめる → 書く の順に行う（docs/SOFTWARE_DESIGN.md の「読む →
 * 計算 → 書く」）。
 *
 * 取得に失敗したら、取得の結果に失敗を書くだけで、activity を書き換えない（FR-014）。
 * 取り直した一覧に無い activity は、URL が 404・410 を返したと確かめたものだけを、上限まで
 * 消す（FR-017〜FR-020）
 */
export const refreshSource = async (
  { activities, fetchList, checkUrl }: Pick<ActivityDeps, 'activities' | 'fetchList' | 'checkUrl'>,
  source: ListSource,
  now: Date,
): Promise<RefreshSourceOutcome> => {
  const fetchedAt = now.toISOString();
  const [stored, outcome] = await Promise.all([
    activities.listStoredKeys(source),
    fetchList(source),
  ]);

  if (!outcome.ok) {
    await activities.recordFetchResult(source, { fetchedAt, isOk: false, reason: outcome.reason });
    return { status: 'failed', reason: outcome.reason };
  }

  const candidates = selectGoneCandidates(stored, outcome);
  const checks = await Promise.all(
    candidates.map(async (candidate) => ({
      id: candidate.id,
      check: await checkUrl(candidate.url),
    })),
  );
  const removeIds = selectRemovals(checks);

  const reason = [
    `${outcome.items.length} 件を取得`,
    outcome.skipped > 0 ? `題・URL・公開日の読めない ${outcome.skipped} 件を保存しない` : null,
    candidates.length > 0 ? `一覧に無い ${candidates.length} 件を確かめた` : null,
    removeIds.length > 0 ? `取得元で消えた ${removeIds.length} 件を消す` : null,
  ]
    .filter(Boolean)
    .join('。');

  const { written, removed } = await activities.applyFetch(source, {
    items: outcome.items,
    removeIds,
    result: { fetchedAt, isOk: true, reason },
  });
  return { status: 'refreshed', fetched: outcome.items.length, written, removed };
};
