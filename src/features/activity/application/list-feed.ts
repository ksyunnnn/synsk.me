import type { FeedItem } from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';

/** 訪問者に見せる一覧（specs/005-feed/spec.md の FR-007・FR-010） */
export const listFeed = (feed: FeedRepository): Promise<FeedItem[]> => feed.list();
