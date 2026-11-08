import type { FeedPage } from '@/features/activity/domain/feed';

/**
 * 訪問者の一覧の取り出し方（docs/SOFTWARE_DESIGN.md の Repository）。D1 の実装は
 * src/features/activity/server/d1-feed-repository.ts にあり、ビュー `activity_feed` だけを読む。
 * 公開と秘匿化の決まりはビューが持つ（specs/005-feed/research.md の R5）
 */
export type FeedRepository = {
  /** `page` ページ目（1 から）。並びの日付の新しい順（spec の FR-010） */
  listPage: (page: number) => Promise<FeedPage>;
};
