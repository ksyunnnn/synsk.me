import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REFRESH_STARTED_REASON,
  refreshNextSources,
} from '@/features/activity/application/refresh-next-sources';
import { PRODUCTION_REFRESH_LIMITS, SOURCES_PER_RUN } from '@/features/activity/domain/limits';
import { LIST_SOURCES } from '@/features/activity/domain/sources';
import { DEFAULT_SWEEP_LIMITS } from '@/shared/server/sweep-orphaned-media';
import { runScheduled, SWEEP_HOUR_UTC } from '../../worker/scheduled';
import { createFakeActivityRepository } from '../support/activity-fakes';

/**
 * 定期実行の入口（specs/004-external-activity/tasks.md の T040、research.md の R8・R9、FR-036）。
 * 値はすべて作り物
 */

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const NOW = '2026-11-10T03:00:00.000Z';

const LIMITS = { maxRequests: 1, timeoutMs: 1000, maxBytes: 1000, maxRemovals: 5 };

/** wrangler.jsonc の `triggers.crons` を読む。JSONC の注記を含むため、正規表現で取り出す */
const readCrons = async (): Promise<string[]> => {
  const source = await readFile(join(process.cwd(), 'wrangler.jsonc'), 'utf8');
  const block = /"triggers"\s*:\s*\{\s*"crons"\s*:\s*\[([^\]]*)\]/.exec(source)?.[1];
  if (block === undefined) return [];
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? '');
};

describe('wrangler.jsonc の定期実行', () => {
  it('式は 1 本で、毎日 UTC の 0 時から 7 回、間を 4 時間以内にして起動する', async () => {
    const crons = await readCrons();
    expect(crons).toHaveLength(1);
    const [minute, hour, ...rest] = (crons[0] ?? '').split(' ');
    expect(minute).toBe('0');
    expect(rest).toEqual(['*', '*', '*']);
    const hours = (hour ?? '').split(',').map(Number);
    expect(hours).toHaveLength(7);
    expect(hours[0]).toBe(SWEEP_HOUR_UTC);
    const gaps = hours.map((h, i) => (hours[i + 1] ?? (hours[0] ?? 0) + 24) - h);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(4);
  });

  it('1 日の起動の回数で、一覧を取る取得元をすべて 1 度ずつ回る', async () => {
    const [hour = ''] = (await readCrons()).map((cron) => cron.split(' ')[1]);
    expect(hour.split(',').length * SOURCES_PER_RUN).toBeGreaterThanOrEqual(LIST_SOURCES.length);
  });
});

describe('本番の上限の値（research.md の R8）', () => {
  it('1 回の起動の subrequest は、取り直しと消し損ねた画像の突き合わせを合わせて 50 本以下', () => {
    // D1 の呼び出しは、起動ごとに 1 本（listFetchedAt）と、取得元ごとに 5 本以下（順番を取る・
    // readValidators・listStoredForRefresh・applyRefresh・失敗の書き込み）。突き合わせは、続きの
    // 位置の読み書き 2 本と、頁ごとに 3 本以下（src/shared/server/sweep-orphaned-media.ts）
    const perSource =
      PRODUCTION_REFRESH_LIMITS.maxRequests + (PRODUCTION_REFRESH_LIMITS.maxGoneChecks ?? 0) + 5;
    const refresh = 1 + SOURCES_PER_RUN * perSource;
    const sweep = 2 + 3 * DEFAULT_SWEEP_LIMITS.maxPages;
    expect(refresh + sweep).toBeLessThanOrEqual(50);
  });
});

describe('refreshNextSources', () => {
  it('最後に取り直した日時の古い取得元を上限の数だけ選び、順番を取ってから取り直す', async () => {
    const fake = createFakeActivityRepository();
    const repository = { ...fake.repository, listFetchedAt: async () => ({ a: T2, b: T1 }) };
    const fetched: string[] = [];
    const deps = {
      activities: repository,
      fetchListing: async (source: string) => {
        fetched.push(source);
        // 取り直す前に、順番を取る失敗が書かれている
        expect(fake.failures).toEqual([
          { source: 'b', fetchedAt: NOW, reason: REFRESH_STARTED_REASON },
        ]);
        return { items: [], isComplete: false };
      },
    };

    const outcomes = await refreshNextSources(deps, ['a', 'b'], NOW, LIMITS, 1);

    expect(fetched).toEqual(['b']);
    expect(outcomes).toEqual([expect.objectContaining({ source: 'b', ok: true })]);
    expect(fake.applied.map(({ source, result }) => [source, result.fetchedAt])).toEqual([
      ['b', NOW],
    ]);
  });

  it('取り直したことの無い取得元を先に選ぶ', async () => {
    const fake = createFakeActivityRepository();
    const repository = { ...fake.repository, listFetchedAt: async () => ({ a: T1 }) };
    const deps = {
      activities: repository,
      fetchListing: async () => ({ items: [], isComplete: false }),
    };

    const outcomes = await refreshNextSources(deps, ['a', 'b'], NOW, LIMITS, 1);

    expect(outcomes.map((outcome) => outcome.source)).toEqual(['b']);
  });
});

describe('runScheduled', () => {
  const at = (iso: string) => new Date(iso).getTime();

  const recorder = (options: { failRefresh?: boolean } = {}) => {
    const calls: string[] = [];
    return {
      calls,
      jobs: {
        refresh: async (now: string) => {
          calls.push(`refresh ${now}`);
          if (options.failRefresh) throw new Error('作り物の失敗');
        },
        sweep: async (now: Date) => {
          calls.push(`sweep ${now.toISOString()}`);
        },
      },
    };
  };

  it('毎回、予定の時刻で取り直す', async () => {
    const { calls, jobs } = recorder();
    await runScheduled(at(NOW), jobs);
    expect(calls).toEqual([`refresh ${NOW}`]);
  });

  it('UTC の 0 時の回だけ、取り直しの後に消し損ねた画像を突き合わせる', async () => {
    const { calls, jobs } = recorder();
    const midnight = '2026-11-10T00:00:00.000Z';
    await runScheduled(at(midnight), jobs);
    expect(calls).toEqual([`refresh ${midnight}`, `sweep ${midnight}`]);
  });

  it('取り直しが投げても突き合わせを行い、最後に投げて実行を失敗にする', async () => {
    const { calls, jobs } = recorder({ failRefresh: true });
    const midnight = '2026-11-10T00:00:00.000Z';
    await expect(runScheduled(at(midnight), jobs)).rejects.toThrow('作り物の失敗');
    expect(calls).toEqual([`refresh ${midnight}`, `sweep ${midnight}`]);
  });
});
