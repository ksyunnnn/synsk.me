import type { FetchedItem, SourceName } from '@/features/activity/domain/fetched-item';

/**
 * activity の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の Repository）。
 * D1 の実装は src/features/activity/server/d1-activity-repository.ts にある。
 * 単体の検査は、作り物の実装（tests/support/activity-fakes.ts）を渡してユースケースを確かめる。
 * 取得の書き込みは外部の行だけを書き、life event の行を書かない（FR-032）
 */

/** 取り直しで比べる、保存した外部の activity の 1 行 */
export type StoredItem = {
  id: number;
  externalId: string | null;
  url: string;
  title: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
};

/** 保存した行で直す列。値の変わった列だけを持つ（research.md の R5） */
export type ItemChanges = Partial<{
  url: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
}>;

/** 1 つの取得元の取り直しで足す行と直す行。`planRefresh` が求める */
export type UpsertPlan = {
  /** 足す行。どれも公開日を持つ（FR-011） */
  inserts: (FetchedItem & { publishedAt: string })[];
  updates: { id: number; changes: ItemChanges }[];
  /** 公開日が無いので足さなかった項目の数 */
  skippedWithoutDate: number;
};

/** 1 つの取得元の取り直しで書くもの。消す行は `planRemovals` が求める */
export type RefreshPlan = UpsertPlan & {
  /** 取得元で消えたと確かめた行の id（FR-017） */
  deletes: number[];
};

/** 成功した取り直しの取得の結果。`last_succeeded_at` は `fetchedAt` になる */
export type FetchResultWrite = { fetchedAt: string; reason: string | null };

export type ActivityRepository = {
  /** 取得元の外部の activity。取り直しで比べる列だけを読む */
  listStoredForRefresh: (source: SourceName) => Promise<StoredItem[]>;
  /**
   * 1 つの取得元の書き込みと取得の結果を、1 回の `batch()` で書く（research.md の R4）。
   * 1 文でも失敗すれば全体を戻して投げる
   */
  applyRefresh: (source: SourceName, plan: RefreshPlan, result: FetchResultWrite) => Promise<void>;
  /** 取得の結果に失敗と理由を書く。`last_succeeded_at` は前の値を残す（FR-016） */
  recordFetchFailure: (source: SourceName, fetchedAt: string, reason: string) => Promise<void>;
};
