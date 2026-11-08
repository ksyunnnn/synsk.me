import { LIST_SOURCES, type ListSource } from '@/features/activity/domain/source';
import type { ActivityDeps } from './deps';
import { refreshRegistered } from './refresh-registered';
import { refreshSource } from './refresh-source';

/**
 * Cron Triggers が 1 時間に 1 回呼ぶ取得（specs/004-external-activity/research.md の R6、
 * contracts/fetch.md）。1 回に 1 つの枠だけを取る
 */

/** 取得の枠。一覧を取る取得元と、URL を指名した activity の取り直し */
export const FETCH_SLOTS = [...LIST_SOURCES, 'registered'] as const;
export type FetchSlot = ListSource | 'registered';

const HOUR_MS = 60 * 60 * 1000;

/** その時刻（UTC の時）の枠。24 は枠の数 8 で割り切れるため、毎日同じ時に同じ枠になる */
export const slotAt = (time: Date): FetchSlot =>
  FETCH_SLOTS[time.getUTCHours() % FETCH_SLOTS.length];

/** URL を指名した activity の取り直しの何巡目か。枠が 1 周するたびに 1 つ進む */
export const cycleAt = (time: Date): number =>
  Math.floor(time.getTime() / (HOUR_MS * FETCH_SLOTS.length));

export const runScheduledFetch = async (deps: ActivityDeps, time: Date) => {
  const slot = slotAt(time);
  if (slot === 'registered') {
    return { slot, outcome: await refreshRegistered(deps, cycleAt(time), time) };
  }
  return { slot, outcome: await refreshSource(deps, slot, time) };
};
