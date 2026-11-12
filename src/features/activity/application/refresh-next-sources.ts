import type { ActivityDeps } from '@/features/activity/application/deps';
import { pickSourcesForRun } from '@/features/activity/domain/pick-sources';
import { refreshSources } from '@/features/activity/application/refresh-sources';
import type { RefreshOutcome, SourceName } from '@/features/activity/domain/fetched-item';
import type { RefreshLimits } from '@/features/activity/domain/limits';

/** 取り直す前に取得の結果に書く理由。取り直し終えたら結果で上書きする（research.md の R9） */
export const REFRESH_STARTED_REASON = '取り直しを始めて終わらなかった';

/**
 * 1 回の起動の取り直し（research.md の R9）。最後に取り直した日時の古い取得元を `maxSources` の数
 * だけ選び（`pickSourcesForRun`）、順番を取ってから `refreshSources` で取り直す。順番を取るのは、
 * CPU 時間の上限で実行が止まって結果を書けなくても、その取得元が次の回に先に選ばれないため
 */
export const refreshNextSources = async <Name extends SourceName>(
  deps: ActivityDeps,
  candidates: readonly Name[],
  now: string,
  limits: RefreshLimits,
  maxSources: number,
): Promise<RefreshOutcome[]> => {
  const picked = pickSourcesForRun(candidates, await deps.activities.listFetchedAt(), maxSources);
  for (const source of picked) {
    await deps.activities.recordFetchFailure(source, now, REFRESH_STARTED_REASON);
  }
  return refreshSources(deps, picked, now, limits);
};
