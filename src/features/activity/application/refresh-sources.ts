import type { ActivityDeps } from '@/features/activity/application/deps';
import { planRefresh } from '@/features/activity/application/plan-refresh';
import type { RefreshOutcome, SourceName } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';

/**
 * 一覧を取る取得元から取り直す（specs/004-external-activity/contracts/fetch.md、research.md の R4）。
 * 取得元ごとに「読む → 計算 → 書く」を行い、1 つの取得元の書き込みと取得の結果を 1 回の
 * `batch()` で書く。取得元どうしは `Promise.allSettled` で並べ、1 つの失敗でほかを止めない
 * （FR-015、docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。取得か書き込みが失敗した取得元は、
 * activity を書き換えず、取得の結果に失敗と理由を書く（FR-014・FR-016）。取得元ごとの成否を返し、投げない
 */
export const refreshSources = async (
  deps: ActivityDeps,
  sources: SourceName[],
  now: string,
  limits: FetchLimits,
): Promise<RefreshOutcome[]> => {
  const settled = await Promise.allSettled(
    sources.map((source) => refreshSource(deps, source, now, limits)),
  );
  return settled.map((result, index): RefreshOutcome =>
    result.status === 'fulfilled'
      ? result.value
      : { source: sources[index] ?? '', ok: false, reason: messageOf(result.reason) },
  );
};

const refreshSource = async (
  deps: ActivityDeps,
  source: SourceName,
  now: string,
  limits: FetchLimits,
): Promise<RefreshOutcome> => {
  let read;
  try {
    read = await Promise.all([
      deps.fetchListing(source, limits),
      deps.activities.listStoredForRefresh(source),
    ]);
  } catch (error) {
    return fail(deps, source, now, `取得に失敗した: ${messageOf(error)}`);
  }
  const [listing, stored] = read;
  const plan = planRefresh(stored, listing.items);
  const reason =
    plan.skippedWithoutDate > 0
      ? `公開日の無い項目を ${plan.skippedWithoutDate} 件、取り込まなかった`
      : null;

  try {
    await deps.activities.applyRefresh(source, plan, { fetchedAt: now, reason });
  } catch (error) {
    return fail(deps, source, now, `書き込みに失敗した: ${messageOf(error)}`);
  }
  return {
    source,
    ok: true,
    added: plan.inserts.length,
    updated: plan.updates.length,
    skippedWithoutDate: plan.skippedWithoutDate,
  };
};

/** 取得の結果に失敗を書く。それも失敗したら、両方の理由を返す */
const fail = async (
  deps: ActivityDeps,
  source: SourceName,
  now: string,
  reason: string,
): Promise<RefreshOutcome> => {
  try {
    await deps.activities.recordFetchFailure(source, now, reason);
    return { source, ok: false, reason };
  } catch (error) {
    return {
      source,
      ok: false,
      reason: `${reason}。取得の結果も書けなかった: ${messageOf(error)}`,
    };
  }
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
