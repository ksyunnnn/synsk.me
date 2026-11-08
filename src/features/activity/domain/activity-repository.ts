import type { Uid } from '@/shared/domain/uid';
import type {
  ActivityId,
  ExternalActivity,
  FetchResult,
} from '@/features/activity/domain/activity';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { StoredActivityKey } from '@/features/activity/domain/gone';
import type { ExternalSource, UrlSource } from '@/features/activity/domain/source';

/**
 * 外部の activity と取得の結果の取り出し方と保存の仕方（docs/SOFTWARE_DESIGN.md の
 * Repository）。D1 の実装は src/features/activity/server/d1-activity-repository.ts にある。
 * 単体の検査は、作り物の実装を渡してユースケースを確かめる。
 *
 * どの書き込みも外部の activity と取得の結果だけを書き、life event の行を書かない（FR-032）
 */

/** 取得の結果として書く値。`last_succeeded_at` は成功のときだけ `fetchedAt` にする（FR-016） */
export type FetchResultInput = { fetchedAt: string; isOk: boolean; reason: string | null };

/** URL を指名した activity の取り直しで書き換える値。日付は書き換えない（FR-012） */
export type RefreshedValues = { id: ActivityId; title: string; imageUrl: string | null };

export type ActivityRepository = {
  /** その取得元の保存した activity。消えたかの候補を選ぶのに使う */
  listStoredKeys: (source: ExternalSource) => Promise<StoredActivityKey[]>;
  /**
   * 1 回の取得の書き込みを 1 つのトランザクションで行う。項目は値が変わった行だけを書き
   * （research.md の R5）、`removeIds` の行を消し、取得の結果を成功として書く。
   * 書いた項目の数と消した行の数を返す
   */
  applyFetch: (
    source: ExternalSource,
    write: {
      items: readonly FetchedItem[];
      removeIds: readonly ActivityId[];
      result: FetchResultInput;
    },
  ) => Promise<{ written: number; removed: number }>;
  /** 取得の結果だけを書く。失敗したときに使い、activity は書き換えない（FR-014） */
  recordFetchResult: (source: ExternalSource, result: FetchResultInput) => Promise<void>;
  /** 取得元ごとの取得の結果。取得元の名前の順 */
  listFetchResults: () => Promise<FetchResult[]>;

  /** 管理画面の一覧。公開日の新しい順 */
  list: () => Promise<ExternalActivity[]>;
  findForEdit: (id: ActivityId) => Promise<ExternalActivity | null>;
  /** 管理画面の URL とフォームの uid が指す外部の activity の id。life event の uid は null */
  findIdByUid: (uid: Uid) => Promise<ActivityId | null>;
  /** オーナーの登録（FR-009・FR-010）。同じ取得元に同じ項目があれば `duplicate` */
  register: (
    source: ExternalSource,
    item: FetchedItem & { publishedAt: string },
  ) => Promise<{ ok: true; id: ActivityId; uid: Uid } | { ok: false; reason: 'duplicate' }>;
  /** オーナーの書き換え。無ければ `not-found`、同じ項目があれば `duplicate` */
  edit: (
    id: ActivityId,
    values: { url: string; externalId: string | null; title: string; publishedAt: string },
  ) => Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'duplicate' }>;
  /** 物理削除する。無い id なら `ok: false` */
  delete: (id: ActivityId) => Promise<{ ok: boolean }>;

  /**
   * URL を指名した activity を id の順に並べ、`offset` から `limit` 件を返す。末尾を過ぎたら
   * 先頭に戻る。行が無ければ空
   */
  listRefreshTargets: (
    sources: readonly UrlSource[],
    offset: number,
    limit: number,
  ) => Promise<{ id: ActivityId; source: UrlSource; url: string }[]>;
  /**
   * URL を指名した activity の取り直しを 1 つのトランザクションで書く。題と代表の画像の URL
   * だけを書き換え、`removeIds` の行を消し、取得元ごとの取得の結果を書く
   */
  applyRefresh: (write: {
    updates: readonly RefreshedValues[];
    removeIds: readonly ActivityId[];
    results: readonly { source: ExternalSource; result: FetchResultInput }[];
  }) => Promise<void>;
};
