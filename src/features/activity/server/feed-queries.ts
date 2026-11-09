import 'server-only';

import { listFeed } from '@/features/activity/application/list-feed';
import type { FeedItem } from '@/features/activity/domain/feed';
import { createD1FeedRepository } from '@/features/activity/server/d1-feed-repository';
import { readEnv } from '@/shared/server/env';

/**
 * 一覧の画面が呼ぶ組み立て用の関数（ADR-0030）。D1 から読み出せなければ投げる。画面は
 * 投げられた例外で 500 を返す（specs/005-feed/contracts/visitor-feed.md）
 */
export const listFeedItems = async (): Promise<FeedItem[]> => {
  const { DB } = await readEnv();
  return listFeed(createD1FeedRepository(DB));
};
