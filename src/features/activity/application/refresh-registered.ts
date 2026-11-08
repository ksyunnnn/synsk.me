import type {
  FetchResultInput,
  RefreshedValues,
} from '@/features/activity/domain/activity-repository';
import { MAX_CHECKS_PER_FETCH, selectRemovals } from '@/features/activity/domain/gone';
import { URL_SOURCES, type UrlSource } from '@/features/activity/domain/source';
import type { ActivityDeps } from './deps';

/** 1 回に取り直す URL を指名した activity の数。外への要求の上限（research.md の R6） */
export const REFRESH_REGISTERED_LIMIT = MAX_CHECKS_PER_FETCH;

export type RefreshRegisteredOutcome = { refreshed: number; removed: number; failed: number };

/**
 * URL を指名した activity を取り直す（research.md の R9、contracts/fetch.md）。`cycle` 番目の
 * 5 件を取り直し、題と代表の画像の URL だけを書き換える。日付は書き換えない（FR-012）。
 * 取得元が 404・410 を返したものは消す（FR-017）。取得元ごとに、取得の結果を書く
 */
export const refreshRegistered = async (
  { activities, fetchRegistered }: Pick<ActivityDeps, 'activities' | 'fetchRegistered'>,
  cycle: number,
  now: Date,
): Promise<RefreshRegisteredOutcome> => {
  const targets = await activities.listRefreshTargets(
    URL_SOURCES,
    cycle * REFRESH_REGISTERED_LIMIT,
    REFRESH_REGISTERED_LIMIT,
  );
  if (targets.length === 0) return { refreshed: 0, removed: 0, failed: 0 };

  const outcomes = await Promise.all(
    targets.map(async (target) => ({
      target,
      outcome: await fetchRegistered(target.source, target.url),
    })),
  );

  const updates: RefreshedValues[] = [];
  const failures = new Map<UrlSource, string>();
  const touched = new Set<UrlSource>();
  for (const { target, outcome } of outcomes) {
    touched.add(target.source);
    if (outcome.ok)
      updates.push({ id: target.id, title: outcome.title, imageUrl: outcome.imageUrl });
    else if (!outcome.gone && !failures.has(target.source)) {
      failures.set(target.source, outcome.reason);
    }
  }
  const removeIds = selectRemovals(
    outcomes.map(({ target, outcome }) => ({
      id: target.id,
      check: !outcome.ok && outcome.gone ? 'gone' : 'present',
    })),
  );

  const fetchedAt = now.toISOString();
  const results = [...touched].map((source) => {
    const reason = failures.get(source);
    const result: FetchResultInput =
      reason === undefined
        ? { fetchedAt, isOk: true, reason: 'URL を指名した activity を取り直した' }
        : { fetchedAt, isOk: false, reason };
    return { source, result };
  });

  await activities.applyRefresh({ updates, removeIds, results });
  return {
    refreshed: updates.length,
    removed: removeIds.length,
    failed: outcomes.filter(({ outcome }) => !outcome.ok && !outcome.gone).length,
  };
};
