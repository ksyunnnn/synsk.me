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
/** 1 つの URL が取得元で消えたかを確かめる */
export type GoneChecker = (url: string, limits: FetchLimits) => Promise<GoneCheck>;

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
   * 取得元で 1 つの URL が消えたかを確かめる関数を、取得元ごとに引く（research.md の R6）。確かめる
   * 手段を持つ取得元（Zenn・Speaker Deck）だけが関数を返し、ほかは undefined で、確かめない
   */
  goneCheckOf?: (source: SourceName) => GoneChecker | undefined;
};
