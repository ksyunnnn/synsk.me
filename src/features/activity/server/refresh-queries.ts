import 'server-only';

import type { ActivityDeps } from '@/features/activity/application/deps';
import { createD1ActivityRepository } from '@/features/activity/server/d1-activity-repository';
import { createSourceRegistry } from '@/features/activity/server/sources/registry';
import { readEnv } from '@/shared/server/env';

/**
 * 取得のユースケースの組み立て用の関数（docs/SOFTWARE_DESIGN.md の「組み立て用の関数」、ADR-0030）。
 * 呼び手は取得の入口（Cron の `scheduled`、tasks.md の T040）で、U13 の上限の値と一緒に
 * `refreshSources` に渡す。外への要求は Workers の `fetch` で出す
 */
export const createActivityDeps = async (): Promise<ActivityDeps> => {
  const env = await readEnv();
  const registry = createSourceRegistry((url, init) => fetch(url, init), env);
  return {
    activities: createD1ActivityRepository(env.DB),
    fetchListing: registry.fetchListing,
    goneCheckOf: registry.goneCheckOf,
  };
};
