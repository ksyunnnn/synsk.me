import { refreshNextSourcesNow } from '@/features/activity/server/refresh-queries';
import { sweepOrphanedMediaNow } from '@/shared/server/sweep-orphaned-media';

/**
 * 定期実行（Cron Triggers）の入口。`wrangler.jsonc` の `triggers.crons` が 1 日 7 回起動する
 * （specs/004-external-activity/research.md の R8・R9）。起動ごとに外部の取得元を 1 つ取り直し、
 * UTC の 0 時の回だけ、続けて消し損ねた画像を突き合わせる（src/shared/server/sweep-orphaned-media.ts）。
 *
 * 2 つは Workers Free の 1 回の起動の上限（CPU 時間 10 ms、subrequest 50 本）を分け合う。
 * 突き合わせは画像を置いてから 1 日を過ぎるまで消さないので、1 日 1 回より多く回しても早くは
 * 消えない。1 回に回して CPU 時間を足すのを 7 回のうち 1 回にする。取り直しを先にし、突き合わせで
 * 実行が止まっても、取り直しの結果は書き終えている
 */

/** 消し損ねた画像を突き合わせる回の時（UTC）。`wrangler.jsonc` の式の最初の時と同じ */
export const SWEEP_HOUR_UTC = 0;

export type ScheduledJobs = {
  refresh: (now: string) => Promise<unknown>;
  sweep: (now: Date) => Promise<unknown>;
};

const PRODUCTION_JOBS: ScheduledJobs = {
  refresh: refreshNextSourcesNow,
  sweep: sweepOrphanedMediaNow,
};

/**
 * `scheduledTime` は予定の時刻（ミリ秒）。1 つが投げてもほかを行い、最後に投げて起動を失敗にする。
 * 失敗は Workers Logs の起動の記録に残る
 */
export const runScheduled = async (
  scheduledTime: number,
  jobs: ScheduledJobs = PRODUCTION_JOBS,
): Promise<void> => {
  const now = new Date(scheduledTime);
  const errors: unknown[] = [];
  await jobs.refresh(now.toISOString()).catch((error: unknown) => errors.push(error));
  if (now.getUTCHours() === SWEEP_HOUR_UTC) {
    await jobs.sweep(now).catch((error: unknown) => errors.push(error));
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, '定期実行の処理が複数失敗した');
};
