import { describe, expect, it } from 'vitest';
import {
  FEED_ITEM_TYPES,
  readFeedPage,
  toTokyoCalendarDate,
} from '@/features/activity/domain/feed';
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
  source: null,
  source_kind: null,
  url: null,
  created_at: null,
  published_at: null,
  slug: null,
  card_storage_key: null,
  image_url: null,
  ...overrides,
});

describe('FEED_ITEM_TYPES', () => {
  it('詰められる種類を、並びの日付が同じときの順で持つ（plan.md の U2 の仮の順）', () => {
    expect(FEED_ITEM_TYPES).toEqual([
      'note',
      'external_activity',
      'life_event',
      'project',
      'career',
    ]);
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
          slug: 'fake-contract-work',
        }),
      ),
    ).toStrictEqual({
      type: 'project',
      isMasked: false,
      title: '作り物の受託開発',
      organizationName: '作り物株式会社',
      projectKind: 'talk',
      period: { startedOn: '2021-04-01', endedOn: null },
      slug: 'fake-contract-work',
      imageUrl: null,
    });
  });

  it('秘匿化した実績は、秘匿化した題と秘匿化した組織名で詰める', () => {
    expect(
      toFeedItem(
        row({
          is_masked: 1,
          title_masked: '業務システムの開発',
          organization_name_masked: 'ある会社',
          project_kind: 'develop',
          slug: '0123456789abcdef0123456789abcdef',
        }),
      ),
    ).toStrictEqual({
      type: 'project',
      isMasked: true,
      title: '業務システムの開発',
      organizationName: 'ある会社',
      projectKind: 'develop',
      period: { startedOn: '2021-04-01', endedOn: null },
      // 秘匿化した実績も個別のページを持つ（001 の spec の Edge Cases）。識別子は uid の形
      slug: '0123456789abcdef0123456789abcdef',
      imageUrl: null,
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
        project_kind: 'develop',
      }),
    );
    const text = JSON.stringify(item);
    expect(text).not.toContain('作り物の実際の題');
    expect(text).not.toContain('作り物の実際の組織');
  });

  it('読めない実績の種類は、その他として詰める', () => {
    expect(
      toFeedItem(
        row({
          title: '作り物の題',
          organization_name: '作り物株式会社',
          project_kind: 'x',
          slug: 'fake-project',
        }),
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

  it('識別子の欠けた実績は詰めない（個別のページへのリンクを作れない）', () => {
    expect(
      toFeedItem(row({ title: '作り物の題', organization_name: '作り物株式会社', slug: null })),
    ).toBeNull();
  });

  it('職歴は、ビューの行に識別子があっても識別子を持たない（個別のページが無い）', () => {
    const item = toFeedItem(
      row({
        item_type: 'career',
        organization_name: '作り物株式会社',
        role: '作り物の肩書',
        slug: 'fake-career',
      }),
    );
    expect(item).not.toHaveProperty('slug');
  });
});

describe('toFeedItem の note（FR-006）', () => {
  const noteRow = (overrides: Partial<FeedRow> = {}) =>
    row({
      item_type: 'note',
      title: '作り物の note の題',
      description: '作り物の説明文',
      // ビューは並びの値を Asia/Tokyo の時刻にする（migrations/0022）。作成日は元の列から詰める
      sort_at: '2020-01-15T18:00:00.000',
      created_at: '2020-01-15T09:00:00.000Z',
      started_on: null,
      slug: 'fake-note',
      ...overrides,
    });

  it('題・説明文・作成日・識別子だけを持つ', () => {
    const viewRow = { ...noteRow(), item_number: 3 };
    expect(toFeedItem(viewRow)).toStrictEqual({
      type: 'note',
      title: '作り物の note の題',
      description: '作り物の説明文',
      createdAt: '2020-01-15T09:00:00.000Z',
      slug: 'fake-note',
      imageUrl: null,
    });
  });

  it('説明文が空の note は、説明文を null で持つ', () => {
    expect(toFeedItem(noteRow({ description: null }))).toMatchObject({ description: null });
  });

  it('題か作成日の欠けた行は詰めない', () => {
    expect(toFeedItem(noteRow({ title: null }))).toBeNull();
    expect(toFeedItem(noteRow({ created_at: null }))).toBeNull();
  });

  it('識別子の欠けた行は詰めない（個別のページへのリンクを作れない）', () => {
    expect(toFeedItem(noteRow({ slug: null }))).toBeNull();
  });
});

describe('toFeedItem の外部の activity（FR-018・FR-019）', () => {
  const activityRow = (overrides: Partial<FeedRow> = {}) =>
    row({
      item_type: 'external_activity',
      title: '作り物の記事',
      sort_at: '2024-05-01T21:00:00.000',
      published_at: '2024-05-01T12:00:00.000Z',
      source: 'zenn',
      source_kind: 'article',
      url: 'https://example.com/fake-article',
      started_on: null,
      ...overrides,
    });

  it('題・URL・公開日・取得元・分類だけを持つ', () => {
    // 外部の activity は取得元へリンクし、個別のページを持たない。識別子を詰めない
    const viewRow = { ...activityRow({ slug: 'fake-activity' }), item_number: 5 };
    expect(toFeedItem(viewRow)).toStrictEqual({
      type: 'external_activity',
      title: '作り物の記事',
      url: 'https://example.com/fake-article',
      publishedAt: '2024-05-01T12:00:00.000Z',
      source: 'zenn',
      sourceKind: 'article',
      imageUrl: null,
    });
  });

  it('分類が埋め込みの取得元は、分類を埋め込みで持つ', () => {
    expect(toFeedItem(activityRow({ source: 'speakerdeck', source_kind: 'embed' }))).toMatchObject({
      source: 'speakerdeck',
      sourceKind: 'embed',
    });
  });

  it('題が空の行は、題を null で持つ', () => {
    expect(toFeedItem(activityRow({ title: null }))).toMatchObject({ title: null });
  });

  it('読めない分類は、その他として詰める', () => {
    expect(toFeedItem(activityRow({ source_kind: 'x' }))).toMatchObject({ sourceKind: 'other' });
  });

  it('URL・取得元・公開日の欠けた行は詰めない', () => {
    expect(toFeedItem(activityRow({ url: null }))).toBeNull();
    expect(toFeedItem(activityRow({ source: null }))).toBeNull();
    expect(toFeedItem(activityRow({ published_at: null }))).toBeNull();
  });

  it('http か https でない URL の行は詰めない', () => {
    expect(toFeedItem(activityRow({ url: 'javascript:alert(1)' }))).toBeNull();
    expect(toFeedItem(activityRow({ url: 'data:text/html,x' }))).toBeNull();
  });
});

describe('toFeedItem の life event（FR-018・FR-019）', () => {
  const lifeEventRow = (overrides: Partial<FeedRow> = {}) =>
    row({
      item_type: 'life_event',
      title: '作り物の出来事',
      description: '作り物の説明',
      sort_at: '2020-04-01',
      source: 'life_event',
      source_kind: 'life_event',
      started_on: null,
      slug: 'fake-life-event',
      ...overrides,
    });

  it('題・説明・起きた日・取得元・分類・識別子だけを持つ', () => {
    const viewRow = { ...lifeEventRow(), item_number: 9 };
    expect(toFeedItem(viewRow)).toStrictEqual({
      type: 'life_event',
      title: '作り物の出来事',
      description: '作り物の説明',
      happenedOn: '2020-04-01',
      source: 'life_event',
      sourceKind: 'life_event',
      slug: 'fake-life-event',
      imageUrl: null,
    });
  });

  it('説明が空の行は、説明を null で持つ', () => {
    expect(toFeedItem(lifeEventRow({ description: null }))).toMatchObject({ description: null });
  });

  it('題の欠けた行は詰めない（004 の FR-024。行は migrations/0021 の CHECK が拒む）', () => {
    expect(toFeedItem(lifeEventRow({ title: null }))).toBeNull();
  });

  it('識別子の欠けた行は詰めない（個別のページへのリンクを作れない）', () => {
    expect(toFeedItem(lifeEventRow({ slug: null }))).toBeNull();
  });
});

/**
 * 代表画像（plan.md の U5 の決定）。note・実績・life event はそれぞれの画像を配る経路の URL、外部の
 * activity は取得元が返した画像の URL を持つ。秘匿化した実績は画像を持たない（FR-013）
 */
describe('toFeedItem の代表画像（U5）', () => {
  const KEY = '0f0e0d0c-0b0a-4908-8706-050403020100';

  it('秘匿化しない実績は、実績の画像を配る経路の URL を持つ', () => {
    expect(
      toFeedItem(
        row({
          title: '作り物の題',
          organization_name: '作り物株式会社',
          project_kind: 'develop',
          slug: 'fake-project',
          card_storage_key: KEY,
        }),
      ),
    ).toMatchObject({ imageUrl: `/projects/fake-project/media/${KEY}` });
  });

  it('秘匿化した実績は、ビューの行に画像のキーがあっても画像を持たない（FR-013）', () => {
    const item = toFeedItem(
      row({
        is_masked: 1,
        title_masked: '業務システムの開発',
        organization_name_masked: 'ある会社',
        project_kind: 'develop',
        slug: '0123456789abcdef0123456789abcdef',
        card_storage_key: KEY,
      }),
    );
    expect(item).toMatchObject({ imageUrl: null });
    expect(JSON.stringify(item)).not.toContain(KEY);
  });

  it('note は、note の画像を配る経路の URL を持ち、識別子を符号化する', () => {
    expect(
      toFeedItem(
        row({
          item_type: 'note',
          title: '作り物の note の題',
          created_at: '2020-01-15T09:00:00.000Z',
          started_on: null,
          slug: '作り物',
          card_storage_key: KEY,
        }),
      ),
    ).toMatchObject({ imageUrl: `/notes/${encodeURIComponent('作り物')}/media/${KEY}` });
  });

  it('life event は、life event の画像を配る経路の URL を持つ', () => {
    expect(
      toFeedItem(
        row({
          item_type: 'life_event',
          title: '作り物の出来事',
          sort_at: '2020-04-01',
          started_on: null,
          slug: 'fake-life-event',
          card_storage_key: KEY,
        }),
      ),
    ).toMatchObject({ imageUrl: `/life-events/fake-life-event/media/${KEY}` });
  });

  const activityRow = (imageUrl: string | null) =>
    row({
      item_type: 'external_activity',
      title: '作り物の記事',
      published_at: '2024-05-01T12:00:00.000Z',
      source: 'zenn',
      source_kind: 'article',
      url: 'https://example.com/fake-article',
      started_on: null,
      image_url: imageUrl,
    });

  it('外部の activity は、取得元が返した画像の URL を持つ', () => {
    expect(toFeedItem(activityRow('https://example.com/fake-image.png'))).toMatchObject({
      imageUrl: 'https://example.com/fake-image.png',
    });
  });

  it('外部の activity の画像の URL が http か https でなければ、画像を持たずに詰める', () => {
    expect(toFeedItem(activityRow('javascript:alert(1)'))).toMatchObject({ imageUrl: null });
    expect(toFeedItem(activityRow('data:image/png;base64,AAAA'))).toMatchObject({
      imageUrl: null,
    });
  });

  it('職歴は、ビューの行に画像の列があっても画像を持たない', () => {
    const item = toFeedItem(
      row({
        item_type: 'career',
        organization_name: '作り物株式会社',
        role: '作り物の肩書',
        card_storage_key: KEY,
        image_url: 'https://example.com/fake-image.png',
      }),
    );
    expect(item).not.toHaveProperty('imageUrl');
  });
});

describe('toTokyoCalendarDate', () => {
  it('日時を、日本時間の暦の日付の YYYY-MM-DD にする（001 の職歴・実績の日付と同じ形）', () => {
    expect(toTokyoCalendarDate('2020-01-15T14:59:59.999Z')).toBe('2020-01-15');
    expect(toTokyoCalendarDate('2020-01-15T15:00:00.000Z')).toBe('2020-01-16');
    expect(toTokyoCalendarDate('2024-12-31T15:00:00.000Z')).toBe('2025-01-01');
  });
});

describe('readFeedPage', () => {
  it('1 以上の整数の文字列は、その番号のページとして読む（research.md の R8）', () => {
    expect(readFeedPage('1')).toBe(1);
    expect(readFeedPage('2')).toBe(2);
    expect(readFeedPage('120')).toBe(120);
  });

  it('無い値・数でない値・1 より小さい値・整数でない値は 1 ページ目として読む（T033）', () => {
    for (const value of [undefined, '', 'abc', '0', '-1', '1.5', '2e3', ' 2', '0x2']) {
      expect(readFeedPage(value), String(value)).toBe(1);
    }
  });

  it('同じ名前が複数あるときは、最初の値を読む', () => {
    expect(readFeedPage(['3', '5'])).toBe(3);
  });

  it('安全な整数を超える番号は、丸めずに最後のページの先として扱える値のまま返す', () => {
    expect(Number.isSafeInteger(readFeedPage('99999999999999999999'))).toBe(false);
  });
});
