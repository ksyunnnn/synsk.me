import type { FetchedItem, SourceName, Validators } from '@/features/activity/domain/fetched-item';

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
  /**
   * 取得元で消えたかを最後に確かめた日時（migrations/0015）。確かめる順を決めるためだけの値で、
   * 消えた印ではない（research.md の R6）
   */
  goneCheckedAt?: string | null;
  /**
   * 個別の URL を取り直して 404 が続いた回数。続けて `GONE_STREAK_TO_REMOVE` 回 404 の行を消す
   * （research.md の R6）。D1 の列 `consecutive_gone_count`（migration 0019）の読み書きは T048b が
   * 足す。無ければ 0 として扱う
   */
  goneStreak?: number;
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
  /** 個別の URL を取り直して消さなかった行（残っていた行と、判定できなかった行）の id と、404 が続いた回数。確かめた日時と回数を書く（R6） */
  goneChecked?: { id: number; goneStreak: number }[];
};

/** 成功した取り直しの取得の結果。`last_succeeded_at` は `fetchedAt` になる */
export type FetchResultWrite = {
  fetchedAt: string;
  reason: string | null;
  /** 次の取得で条件に使う値。null なら持っていた値を消し、次も中身を取る（research.md の R9） */
  validators: Validators | null;
};

export type ActivityRepository = {
  /** 取得元の外部の activity。取り直しで比べる列だけを読む */
  listStoredForRefresh: (source: SourceName) => Promise<StoredItem[]>;
  /**
   * 1 つの取得元の書き込みと取得の結果を、1 回の `batch()` で書く（research.md の R4）。
   * 1 文でも失敗すれば全体を戻して投げる
   */
  applyRefresh: (source: SourceName, plan: RefreshPlan, result: FetchResultWrite) => Promise<void>;
  /**
   * 取得の結果に失敗と理由を書く。`last_succeeded_at` は前の値を残す（FR-016）。条件に使う値は消す
   * （research.md の R9）
   */
  recordFetchFailure: (source: SourceName, fetchedAt: string, reason: string) => Promise<void>;
  /** 前の取得で持った、条件に使う値。無ければ null */
  readValidators: (source: SourceName) => Promise<Validators | null>;
  /**
   * 取得元が変わっていないと答えた（304）回の取得の結果を、成功として書く。activity と条件に使う値は
   * 書き換えない（research.md の R9）
   */
  recordNotModified: (source: SourceName, fetchedAt: string) => Promise<void>;
  /** 取得元ごとの、最後に取り直した日時（成否を問わない）。取り直したことの無い取得元は持たない */
  listFetchedAt: () => Promise<Partial<Record<SourceName, string>>>;
};
