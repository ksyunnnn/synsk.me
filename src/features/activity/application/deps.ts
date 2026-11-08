import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import type {
  FetchOutcome,
  RegisteredFetchOutcome,
  UrlCheck,
} from '@/features/activity/domain/fetched-item';
import type { ListSource, UrlSource } from '@/features/activity/domain/source';

/**
 * 外部の activity のユースケースが受け取るもの（docs/SOFTWARE_DESIGN.md の Dependency
 * Injection）。外への要求は関数で受け取り、検査は固定した応答を返す関数を渡す
 */
export type ActivityDeps = {
  activities: ActivityRepository;
  /** 一覧を取る取得元から一覧を取る */
  fetchList: (source: ListSource) => Promise<FetchOutcome>;
  /** URL を指名する取得元から 1 件の題と代表の画像を取る */
  fetchRegistered: (source: UrlSource, url: string) => Promise<RegisteredFetchOutcome>;
  /** 項目の URL を取り直し、取得元で消えたかを確かめる */
  checkUrl: (url: string) => Promise<UrlCheck>;
};
