import 'server-only';

import {
  isPastOrphanGrace,
  type MediaReferences,
  type MediaSweepStorage,
  type MediaStorageKey,
} from '@/shared/domain/media';
import { readEnv } from '@/shared/server/env';
import { createR2MediaSweepStorage } from '@/shared/server/media-storage';

/**
 * 消し損ねた画像を見つけて消し直す（src/shared/domain/media.ts の「消し損ねた画像」）。置き場の
 * 一覧を頁ごとに読み、置いてから `ORPHAN_GRACE_MS` を過ぎ、どの `media` の行も指さない画像を
 * 消す。001・003・004 の画像の削除が共通に使う。
 *
 * 定期実行（004 の cron）の中で、取得と同じ実行の上限（Workers Free の CPU 時間と subrequest の
 * 数）を分け合う。1 回の実行で読む頁の数と消す数に上限を持ち、続きの位置を置き場に残して、
 * 次の回へ送る（constitution II）。1 頁ごとに、置き場の一覧 1 本・D1 の問い合わせ 1 本・
 * 置き場の削除 1 本以下を使う
 */

/** D1 の 1 つの文に渡せる値の数の上限（https://developers.cloudflare.com/d1/platform/limits/） */
const D1_MAX_BOUND_PARAMETERS = 100;

export const createD1MediaReferences = (db: D1Database): MediaReferences => ({
  findReferenced: async (storageKeys) => {
    const referenced = new Set<MediaStorageKey>();
    for (let start = 0; start < storageKeys.length; start += D1_MAX_BOUND_PARAMETERS) {
      const chunk = storageKeys.slice(start, start + D1_MAX_BOUND_PARAMETERS);
      const { results } = await db
        .prepare(
          `SELECT storage_key FROM media WHERE storage_key IN (${chunk.map(() => '?').join(', ')})`,
        )
        .bind(...chunk)
        .all<{ storage_key: string }>();
      for (const row of results) referenced.add(row.storage_key);
    }
    return referenced;
  },
});

export type SweepLimits = {
  /** 1 回で読む頁の数 */
  maxPages: number;
  /** 1 頁の件数。D1 の 1 つの文で調べられる数を超えない */
  pageSize: number;
};

/** 既定の上限。subrequest は 1 回あたり、続きの位置の読み書き 2 本と、頁ごとの 3 本以下 */
export const DEFAULT_SWEEP_LIMITS: SweepLimits = {
  maxPages: 2,
  pageSize: D1_MAX_BOUND_PARAMETERS,
};

export type SweepOutcome = {
  /** 消し直したキー */
  removed: MediaStorageKey[];
  /** 置き場の終わりまで読んだか。偽なら、続きは次の回が読む */
  reachedEnd: boolean;
};

/**
 * 1 回分の突き合わせ。前の回が残した位置から読み、読んだところまでの位置を残す。終わりまで
 * 読んだら、次の回は始めから読む
 */
export const sweepOrphanedMedia = async (
  { storage, references }: { storage: MediaSweepStorage; references: MediaReferences },
  now: Date,
  limits: SweepLimits = DEFAULT_SWEEP_LIMITS,
): Promise<SweepOutcome> => {
  const pageSize = Math.min(limits.pageSize, D1_MAX_BOUND_PARAMETERS);
  let cursor = await storage.readSweepCursor();
  const removed: MediaStorageKey[] = [];
  let reachedEnd = false;

  for (let page = 0; page < limits.maxPages; page += 1) {
    const listed = await storage.list({ cursor, limit: pageSize });
    const candidates = listed.items
      .filter((item) => isPastOrphanGrace(item.uploadedAt, now))
      .map((item) => item.storageKey);
    if (candidates.length > 0) {
      const referenced = await references.findReferenced(candidates);
      const orphans = candidates.filter((key) => !referenced.has(key));
      if (orphans.length > 0) {
        await storage.remove(orphans);
        removed.push(...orphans);
      }
    }
    cursor = listed.cursor;
    if (cursor === null) {
      reachedEnd = true;
      break;
    }
  }

  await storage.writeSweepCursor(cursor);
  return { removed, reachedEnd };
};

/** 組み立て用の関数。定期実行の入口（004 の T040）が呼ぶ */
export const sweepOrphanedMediaNow = async (now: Date): Promise<SweepOutcome> => {
  const env = await readEnv();
  return sweepOrphanedMedia(
    {
      storage: createR2MediaSweepStorage(env.NOTE_IMAGES),
      references: createD1MediaReferences(env.DB),
    },
    now,
  );
};
