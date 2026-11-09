import type { FeedItem } from '@/features/activity/domain/feed';

/**
 * 一覧の取り出し方（docs/SOFTWARE_DESIGN.md の Repository）。D1 の実装は
 * src/features/activity/server/d1-feed-repository.ts にあり、ビュー activity_feed だけを読む
 * （ADR-0046）。単体の検査は、作り物の実装を渡してユースケースを確かめる
 */
export type FeedRepository = {
  /**
   * 一覧に並べる項目。並びの日付の新しい順、同じ日付なら `FEED_ITEM_TYPES` の順、同じ種類なら
   * 元の行の主キーの大きい順（FR-010）。ページの引数は tasks.md の T032 で足す
   */
  list: () => Promise<FeedItem[]>;
};
