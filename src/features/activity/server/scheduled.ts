import 'server-only';

import { runScheduledFetch } from '@/features/activity/application/run-scheduled-fetch';
import type { Env } from '@/shared/server/env';
import { createActivityDeps } from './deps';

/**
 * Cron Triggers の入口（specs/004-external-activity/research.md の R6、contracts/fetch.md）。
 * `worker/index.ts` の `scheduled()` が呼ぶ。HTTP の経路を持たないため、訪問者は呼べない。
 * 取得の成否は `fetch_result` に残り、`/dash/activities` に出る
 */
export const handleScheduled = (scheduledTime: number, env: Env) =>
  runScheduledFetch(createActivityDeps(env), new Date(scheduledTime));
