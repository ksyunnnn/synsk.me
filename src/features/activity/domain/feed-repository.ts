import type { FeedPage } from '@/features/activity/domain/feed';

/**
 * 一覧の取り出し方（docs/SOFTWARE_DESIGN.md の Repository）。D1 の実装は
 * src/features/activity/server/d1-feed-repository.ts にあり、ビュー activity_feed だけを読む
 * （ADR-0046）。単体の検査は、作り物の実装を渡してユースケースを確かめる
 */
export type FeedRepository = {
  /**
   * 一覧の `page` ページ目（1 から数える）。並びの日付の新しい順、同じ日付なら `FEED_ITEM_TYPES`
   * の順、同じ種類なら元の行の主キーの大きい順（FR-010）で、`FEED_PAGE_SIZE` 件ずつに区切る。
   * 最後のページの先と、1 以上の整数でない `page` は項目を持たない（research.md の R8）
   */
  list: (page: number) => Promise<FeedPage>;
};
