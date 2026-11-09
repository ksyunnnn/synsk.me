import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import type { SourceListing, SourceName } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';

/** activity のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency Injection） */
export type ActivityDeps = {
  activities: ActivityRepository;
  /**
   * 一覧を取る取得元の項目を取る。取得元の名前から取得元ごとの処理
   * （src/features/activity/server/sources/）を引く関数を、組み立て用の関数が渡す。
   * 取れなければ投げる
   */
  fetchListing: (source: SourceName, limits: FetchLimits) => Promise<SourceListing>;
};
