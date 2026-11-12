import 'server-only';

import type { ActivityDeps } from '@/features/activity/application/deps';
import { refreshNextSources } from '@/features/activity/application/refresh-next-sources';
import type { RefreshOutcome } from '@/features/activity/domain/fetched-item';
import { PRODUCTION_REFRESH_LIMITS, SOURCES_PER_RUN } from '@/features/activity/domain/limits';
import { LIST_SOURCES } from '@/features/activity/domain/sources';
import { createD1ActivityRepository } from '@/features/activity/server/d1-activity-repository';
import { createSourceRegistry } from '@/features/activity/server/sources/registry';
import { readEnv } from '@/shared/server/env';

/**
 * 取得のユースケースの組み立て用の関数（docs/SOFTWARE_DESIGN.md の「組み立て用の関数」、ADR-0030）。
 * 外への要求は Workers の `fetch` で出す
 */
const createActivityDeps = async (): Promise<ActivityDeps> => {
  const env = await readEnv();
  const registry = createSourceRegistry((url, init) => fetch(url, init), env);
  return {
    activities: createD1ActivityRepository(env.DB),
    fetchListing: registry.fetchListing,
    goneCheckOf: registry.goneCheckOf,
  };
};

/**
 * 定期実行の入口（worker/scheduled.ts）が呼ぶ。一覧を取る取得元から、本番の上限
 * （src/features/activity/domain/limits.ts）で次の取得元を取り直す
 */
export const refreshNextSourcesNow = async (now: string): Promise<RefreshOutcome[]> =>
  refreshNextSources(
    await createActivityDeps(),
    LIST_SOURCES,
    now,
    PRODUCTION_REFRESH_LIMITS,
    SOURCES_PER_RUN,
  );
