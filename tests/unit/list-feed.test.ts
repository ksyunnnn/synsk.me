import { describe, expect, it } from 'vitest';
import { listFeed } from '@/features/activity/application/list-feed';
import type { FeedItem } from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 一覧のユースケース（specs/005-feed/tasks.md の T004）。Repository は作り物の実装を渡す
 * （docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での並びと秘匿化は
 * tests/workers/feed-repository.test.ts が持つ
 */

const ITEMS: FeedItem[] = [
  {
    type: 'project',
    isMasked: false,
    title: '作り物の受託開発',
    organizationName: '作り物株式会社',
    projectKind: 'develop',
    period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
    slug: 'fake-contract-work',
    imageUrl: null,
  },
  {
    type: 'career',
    isMasked: true,
    organizationName: 'ある会社',
    role: '作り物の肩書',
    period: { startedOn: '2020-04-01' as CalendarDate, endedOn: '2021-03-31' as CalendarDate },
  },
];

describe('listFeed', () => {
  it('指定したページを Repository から読み、並びを順を変えずに返す', async () => {
    const pages: number[] = [];
    const feed: FeedRepository = {
      list: async (page) => {
        pages.push(page);
        return { items: ITEMS, hasNextPage: true };
      },
    };
    expect(await listFeed(feed, 2)).toEqual({ items: ITEMS, hasNextPage: true });
    expect(pages).toEqual([2]);
  });
});
