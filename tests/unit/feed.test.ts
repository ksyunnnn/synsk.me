import { describe, expect, it } from 'vitest';
import { FEED_ITEM_TYPES } from '@/features/activity/domain/feed';
import { toFeedItem } from '@/features/activity/server/d1-feed-repository';

/**
 * ビュー activity_feed の行から `FeedItem` への詰め替え（specs/005-feed/spec.md の FR-012・
 * FR-013、contracts/visitor-feed.md）。種類ごとに契約の項目だけを持ち、`item_number` を
 * 持たない。D1 の上での並びと、ビューが値を外すことは tests/workers/feed-repository.test.ts が持つ
 */

type FeedRow = Parameters<typeof toFeedItem>[0];

/** ビューの 1 行。値はすべて作り物。秘匿化しない行と秘匿化した行で、詰める列が違う */
const row = (overrides: Partial<FeedRow>): FeedRow => ({
  item_type: 'project',
  is_masked: 0,
  title: null,
  title_masked: null,
  organization_name: null,
  organization_name_masked: null,
  role: null,
  project_kind: null,
  started_on: '2021-04-01',
  ended_on: null,
  sort_at: '2021-04-01',
  description: null,
  ...overrides,
});

describe('FEED_ITEM_TYPES', () => {
  it('詰められる種類を、並びの日付が同じときの順で持つ（plan.md の U2 の仮の順）', () => {
    expect(FEED_ITEM_TYPES).toEqual(['note', 'project', 'career']);
  });
});

describe('toFeedItem', () => {
  it('秘匿化しない職歴は、種類・秘匿化するか・実際の組織名・肩書・期間だけを持つ', () => {
    // ビューを SELECT * で読んだときの item_number を足しても、詰めない
    const viewRow = {
      ...row({
        item_type: 'career',
        organization_name: '作り物株式会社',
        role: '作り物の肩書',
        started_on: '2020-04-01',
        ended_on: '2021-03-31',
      }),
      item_number: 7,
    };
    expect(toFeedItem(viewRow)).toStrictEqual({
      type: 'career',
      isMasked: false,
      organizationName: '作り物株式会社',
      role: '作り物の肩書',
      period: { startedOn: '2020-04-01', endedOn: '2021-03-31' },
    });
  });

  it('秘匿化した職歴は、秘匿化した組織名で詰める', () => {
    expect(
      toFeedItem(
        row({
          item_type: 'career',
          is_masked: 1,
          organization_name_masked: 'ある会社',
          role: '作り物の肩書',
        }),
      ),
    ).toStrictEqual({
      type: 'career',
      isMasked: true,
      organizationName: 'ある会社',
      role: '作り物の肩書',
      period: { startedOn: '2021-04-01', endedOn: null },
    });
  });

  it('秘匿化しない実績は、種類・秘匿化するか・題・組織名・実績の種類・期間だけを持つ', () => {
    expect(
      toFeedItem(
        row({
          title: '作り物の受託開発',
          organization_name: '作り物株式会社',
          project_kind: 'talk',
        }),
      ),
    ).toStrictEqual({
      type: 'project',
      isMasked: false,
      title: '作り物の受託開発',
      organizationName: '作り物株式会社',
      projectKind: 'talk',
      period: { startedOn: '2021-04-01', endedOn: null },
    });
  });

  it('秘匿化した実績は、秘匿化した題と秘匿化した組織名で詰める', () => {
    expect(
      toFeedItem(
        row({
          is_masked: 1,
          title_masked: '業務システムの開発',
          organization_name_masked: 'ある会社',
          project_kind: 'application',
        }),
      ),
    ).toStrictEqual({
      type: 'project',
      isMasked: true,
      title: '業務システムの開発',
      organizationName: 'ある会社',
      projectKind: 'application',
      period: { startedOn: '2021-04-01', endedOn: null },
    });
  });

  it('秘匿化した行は、実際の値の列に値があっても、その値を詰めない', () => {
    const item = toFeedItem(
      row({
        is_masked: 1,
        title: '作り物の実際の題',
        title_masked: '業務システムの開発',
        organization_name: '作り物の実際の組織',
        organization_name_masked: 'ある会社',
        project_kind: 'application',
      }),
    );
    const text = JSON.stringify(item);
    expect(text).not.toContain('作り物の実際の題');
    expect(text).not.toContain('作り物の実際の組織');
  });

  it('読めない実績の種類は、その他として詰める', () => {
    expect(
      toFeedItem(
        row({ title: '作り物の題', organization_name: '作り物株式会社', project_kind: 'x' }),
      ),
    ).toMatchObject({ projectKind: 'other' });
  });

  it('詰める値が欠けた行と、詰められない種類の行は詰めない', () => {
    expect(
      toFeedItem(row({ is_masked: 1, title: '作り物の題', organization_name: '作り物株式会社' })),
    ).toBeNull();
    expect(
      toFeedItem(row({ item_type: 'career', organization_name: '作り物株式会社' })),
    ).toBeNull();
    expect(toFeedItem(row({ item_type: 'unknown_type', title: '作り物の題' }))).toBeNull();
  });
});

describe('toFeedItem の note（FR-006）', () => {
  const noteRow = (overrides: Partial<FeedRow> = {}) =>
    row({
      item_type: 'note',
      title: '作り物の note の題',
      description: '作り物の説明文',
      sort_at: '2020-01-15T09:00:00.000Z',
      started_on: null,
      ...overrides,
    });

  it('題・説明文・作成日だけを持つ', () => {
    const viewRow = { ...noteRow(), item_number: 3 };
    expect(toFeedItem(viewRow)).toStrictEqual({
      type: 'note',
      title: '作り物の note の題',
      description: '作り物の説明文',
      createdAt: '2020-01-15T09:00:00.000Z',
    });
  });

  it('説明文が空の note は、説明文を null で持つ', () => {
    expect(toFeedItem(noteRow({ description: null }))).toMatchObject({ description: null });
  });

  it('題の欠けた行は詰めない', () => {
    expect(toFeedItem(noteRow({ title: null }))).toBeNull();
  });
});
