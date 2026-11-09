import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import type {
  GoneCheck,
  NotModified,
  SourceListing,
  SourceName,
  Validators,
} from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';

/** activity のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type ActivityDeps = {
  activities: ActivityRepository;
  /**
   * 一覧を取る取得元の項目を取る。取得元の名前から取得元ごとの処理
   * （src/features/activity/server/sources/）を引く関数を、組み立て用の関数が渡す。
   * 取れなければ投げる。`previous` は前の取得で持った値で、あれば条件付きの要求にする（R9）
   */
  fetchListing: (
    source: SourceName,
    limits: FetchLimits,
    previous?: Validators | null,
  ) => Promise<SourceListing | NotModified>;
  /**
   * すべて取らない取得元で、1 つの URL が取得元で消えたかを確かめる（research.md の R6）。確かめる
   * 手段を持つ取得元（Zenn・Speaker Deck）だけで渡す。無ければ確かめない
   */
  checkGone?: (source: SourceName, url: string, limits: FetchLimits) => Promise<GoneCheck>;
};
