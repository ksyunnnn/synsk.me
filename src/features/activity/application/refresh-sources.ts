import type { ActivityDeps } from '@/features/activity/application/deps';
import { planRefresh } from '@/features/activity/application/plan-refresh';
import type { RefreshOutcome, SourceName } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';

/**
 * 一覧を取る取得元から取り直す（specs/004-external-activity/contracts/fetch.md、research.md の R4）。
 * 取得元ごとに「読む → 計算 → 書く」を行い、1 つの取得元の書き込みと取得の結果を 1 回の
 * `batch()` で書く。書き込みが失敗したら、その取得元の取得の結果に失敗と理由を別に書く
 * （FR-016）。取得元ごとの成否を返す
 */
export const refreshSources = async (
  deps: ActivityDeps,
  sources: SourceName[],
  now: string,
  limits: FetchLimits,
): Promise<RefreshOutcome[]> => {
  const outcomes: RefreshOutcome[] = [];
  for (const source of sources) {
    outcomes.push(await refreshSource(deps, source, now, limits));
  }
  return outcomes;
};

const refreshSource = async (
  deps: ActivityDeps,
  source: SourceName,
  now: string,
  limits: FetchLimits,
): Promise<RefreshOutcome> => {
  const [listing, stored] = await Promise.all([
    deps.fetchListing(source, limits),
    deps.activities.listStoredForRefresh(source),
  ]);
  const plan = planRefresh(stored, listing.items);
  const reason =
    plan.skippedWithoutDate > 0
      ? `公開日の無い項目を ${plan.skippedWithoutDate} 件、取り込まなかった`
      : null;

  try {
    await deps.activities.applyRefresh(source, plan, { fetchedAt: now, reason });
  } catch (error) {
    const failure = `書き込みに失敗した: ${messageOf(error)}`;
    await deps.activities.recordFetchFailure(source, now, failure);
    return { source, ok: false, reason: failure };
  }
  return {
    source,
    ok: true,
    added: plan.inserts.length,
    updated: plan.updates.length,
    skippedWithoutDate: plan.skippedWithoutDate,
  };
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
