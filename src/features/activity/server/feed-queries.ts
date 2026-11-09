import 'server-only';

import { cache } from 'react';
import { listFeed } from '@/features/activity/application/list-feed';
import type { FeedPage } from '@/features/activity/domain/feed';
import { createD1FeedRepository } from '@/features/activity/server/d1-feed-repository';
import { readEnv } from '@/shared/server/env';

/**
 * 一覧の画面が呼ぶ組み立て用の関数（ADR-0030）。D1 から読み出せなければ投げる。画面は
 * 投げられた例外で 500 を返す（specs/005-feed/contracts/visitor-feed.md）。ページの本体と
 * メタデータの両方が呼ぶため、1 つの要求の中では D1 に 1 回だけ問い合わせる
 */
export const listFeedItems = cache(async (page: number): Promise<FeedPage> => {
  const { DB } = await readEnv();
  return listFeed(createD1FeedRepository(DB), page);
});
