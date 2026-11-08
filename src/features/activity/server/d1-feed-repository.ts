import 'server-only';

import {
  FEED_PAGE_SIZE,
  toFeedItem,
  type FeedItem,
  type FeedRow,
} from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';

/**
 * `FeedRepository` の D1 の実装。ビュー `activity_feed`（migrations/0025）だけを読む。
 * 公開と秘匿化の決まりはビューが持ち、ここは並べてページに切る
 * （specs/005-feed/data-model.md の「並び」）
 */

/**
 * 1 ページを読む文。ビューの列を列挙して読む。`?1` は読む件数、`?2` は飛ばす件数。
 * workerd の検査が、同じ文でスキャンする行数を測る（research.md の R13）
 */
export const FEED_PAGE_SQL = `SELECT item_type, item_id, sort_key, slug, url, visible_title, description,
  source, source_kind, visible_organization_name, role, project_kind, started_on, ended_on,
  is_masked, skills
FROM activity_feed
ORDER BY sort_key DESC, type_rank ASC, item_id DESC
LIMIT ?1 OFFSET ?2`;

export const createD1FeedRepository = (db: D1Database): FeedRepository => ({
  listPage: async (page) => {
    // 次のページがあるかを知るため、1 件多く読む
    const { results } = await db
      .prepare(FEED_PAGE_SQL)
      .bind(FEED_PAGE_SIZE + 1, (page - 1) * FEED_PAGE_SIZE)
      .all<FeedRow>();
    const items = results
      .slice(0, FEED_PAGE_SIZE)
      .map(toFeedItem)
      .filter((item): item is FeedItem => item !== null);
    return { items, page, hasNext: results.length > FEED_PAGE_SIZE };
  },
});
