import 'server-only';

import type { ActivityDeps } from '@/features/activity/application/deps';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Env } from '@/shared/server/env';
import { createD1ActivityRepository } from './d1-activity-repository';
import { createD1FeedRepository } from './d1-feed-repository';
import { createD1LifeEventRepository } from './d1-life-event-repository';
import { checkUrl, type Http } from './sources/http';
import { LIST_FETCHERS } from './sources/list-sources';
import { fetchRegisteredItem } from './sources/url-sources';

/**
 * activity の機能が使うものを、Worker の env から組み立てる（ADR-0030 の組み立て用の関数）。
 * 画面と Server Action は `queries.ts` から、Cron Triggers は `scheduled.ts` から呼ぶ
 */
export const createActivityDeps = (
  env: Env,
  http: Http = (url, init) => fetch(url, init),
): ActivityDeps & { lifeEvents: LifeEventRepository; feed: FeedRepository } => ({
  activities: createD1ActivityRepository(env.DB),
  lifeEvents: createD1LifeEventRepository(env.DB),
  feed: createD1FeedRepository(env.DB),
  fetchList: (source) => LIST_FETCHERS[source](http, env),
  fetchRegistered: (source, url) => fetchRegisteredItem(http, source, url),
  checkUrl: (url) => checkUrl(http, url),
});
