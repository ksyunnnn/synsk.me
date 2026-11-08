import type { FeedPage } from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';

/** 訪問者が一覧の `page` ページ目を読む（specs/005-feed/spec.md の User Story 1） */
export const listFeed = (feed: FeedRepository, page: number): Promise<FeedPage> =>
  feed.listPage(page);
