import { describe, expect, it } from 'vitest';
import {
  FEED_PAGE_MAX,
  hostOf,
  parseFeedPage,
  toFeedItem,
  type FeedRow,
} from '@/features/activity/domain/feed';

/** 一覧の DTO とページの番号（specs/005-feed/contracts/visitor-feed.md、research.md の R7） */

const row = (over: Partial<FeedRow>): FeedRow => ({
  item_type: 'note',
  item_id: 1,
  sort_key: '2025-01-20T09:00:00.000',
  slug: null,
  url: null,
  visible_title: null,
  description: null,
  source: null,
  source_kind: null,
  visible_organization_name: null,
  role: null,
  project_kind: null,
  started_on: null,
  ended_on: null,
  is_masked: 0,
  skills: null,
  ...over,
});

describe('parseFeedPage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['abc', 1],
    ['01', 1],
    ['2', 2],
    [['3', '4'], 3],
    [String(FEED_PAGE_MAX + 1), FEED_PAGE_MAX],
    ['9999999999999999', FEED_PAGE_MAX],
  ] as const)('%j を %i ページ目として読む', (value, page) => {
    expect(parseFeedPage(value as string | string[] | undefined)).toBe(page);
  });
});

describe('toFeedItem', () => {
  it('並びの日付の先頭 10 文字を日付にする', () => {
    const item = toFeedItem(
      row({ item_type: 'note', slug: 'fake-note', visible_title: '作り物の note' }),
    );
    expect(item).toEqual({
      type: 'note',
      id: 1,
      date: '2025-01-20',
      slug: 'fake-note',
      title: '作り物の note',
      description: null,
    });
  });

  it('外部の activity は取得元と分類を持つ（FR-018・FR-019）', () => {
    const item = toFeedItem(
      row({
        item_type: 'external_activity',
        item_id: 7,
        url: 'https://example.com/fake',
        visible_title: '作り物の記事',
        source: 'x_post',
        source_kind: 'embed',
      }),
    );
    expect(item).toMatchObject({
      type: 'external_activity',
      url: 'https://example.com/fake',
      source: 'x_post',
      sourceKind: 'embed',
    });
  });

  it('題の空の外部の activity も 1 件として残し、題を null にする（NFR-02 の一部欠損）', () => {
    const item = toFeedItem(
      row({
        item_type: 'external_activity',
        url: 'https://example.com/fake',
        visible_title: '',
        source: 'unlisted',
        source_kind: 'other',
      }),
    );
    expect(item).toMatchObject({ type: 'external_activity', title: null });
  });

  it('実績はスキルの JSON を配列にし、秘匿化を真偽で持つ', () => {
    const item = toFeedItem(
      row({
        item_type: 'project',
        slug: 'fake-project',
        sort_key: '2022-10-01',
        visible_title: '業務システムの開発',
        visible_organization_name: '作り物の会社',
        project_kind: 'application',
        started_on: '2022-10-01',
        ended_on: '2024-03-31',
        is_masked: 1,
        skills: '["React","TypeScript"]',
      }),
    );
    expect(item).toEqual({
      type: 'project',
      id: 1,
      date: '2022-10-01',
      slug: 'fake-project',
      title: '業務システムの開発',
      organizationName: '作り物の会社',
      projectKind: 'application',
      period: { startedOn: '2022-10-01', endedOn: '2024-03-31' },
      skills: ['React', 'TypeScript'],
      isMasked: true,
    });
  });

  it('職歴は題を持たず、組織名と肩書を持つ', () => {
    const item = toFeedItem(
      row({
        item_type: 'career',
        sort_key: '2021-04-01',
        visible_organization_name: '作り物の会社',
        role: '作り物の肩書',
        started_on: '2021-04-01',
      }),
    );
    expect(item).toEqual({
      type: 'career',
      id: 1,
      date: '2021-04-01',
      organizationName: '作り物の会社',
      role: '作り物の肩書',
      period: { startedOn: '2021-04-01', endedOn: null },
      isMasked: false,
    });
  });

  it.each([
    ['種類が読めない', row({ item_type: 'education' })],
    ['note の識別子が無い', row({ item_type: 'note', visible_title: '作り物' })],
    [
      '実績の種類が読めない',
      row({
        item_type: 'project',
        slug: 's',
        visible_title: 't',
        visible_organization_name: 'o',
        project_kind: 'x',
        started_on: '2020-01-01',
      }),
    ],
  ])('%s行は null にする', (_name, input) => {
    expect(toFeedItem(input)).toBeNull();
  });
});

describe('hostOf', () => {
  it('URL のホスト名を返し、読めなければ値のまま返す', () => {
    expect(hostOf('https://example.com/fake')).toBe('example.com');
    expect(hostOf('not a url')).toBe('not a url');
  });
});
