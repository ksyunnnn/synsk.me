import 'server-only';

import {
  FEED_ITEM_TYPES,
  FEED_PAGE_SIZE,
  isExternalActivitySourceKind,
  isFeedItemType,
  type FeedItem,
} from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';
import type { CalendarDate, Period } from '@/shared/domain/period';
import { isProjectKind } from '@/shared/domain/project-kind';
import { isWebUrl } from '@/shared/domain/web-url';
import { routes } from '@/shared/routes';

/**
 * `FeedRepository` の D1 の実装。ビュー activity_feed（migrations/0013・0016〜0018・0020〜0022・0026・0027）だけを読み、表を
 * 読まない（ADR-0046）。サイトに載せる行だけを出す決まりと秘匿化の決まりはビューが持つ。
 * この実装は、種類ごとに出す項目を列挙して `FeedItem` に詰める（constitution の Allowlist
 * Visibility、specs/005-feed/research.md の R4）。行の型はこのファイルの中だけに置く
 */

/**
 * ビューから読む列。`item_number` は並べる SQL の中だけで使い、読まない（research.md の R6）。
 * `sort_at` は note と外部の activity では Asia/Tokyo の時刻にした並びの値で、時点ではない
 * （migrations/0022）。並べる SQL の中だけで使い、life event の起きた日（暦の日付）としてだけ読む。
 * note の作成日と外部の activity の公開日は、元の UTC の値の `created_at`・`published_at` から読む
 * （contracts/visitor-feed.md）
 */
type FeedRow = {
  item_type: string;
  is_masked: number;
  title: string | null;
  title_masked: string | null;
  organization_name: string | null;
  organization_name_masked: string | null;
  role: string | null;
  project_kind: string | null;
  started_on: string | null;
  ended_on: string | null;
  sort_at: string;
  description: string | null;
  source: string | null;
  source_kind: string | null;
  url: string | null;
  created_at: string | null;
  published_at: string | null;
  /** 実績・note・life event の個別のページの識別子。職歴と外部の activity は NULL（migrations/0026） */
  slug: string | null;
  /**
   * 実績・note・life event の代表画像の置き場のキー（`media.storage_key`）。秘匿化した実績と職歴と
   * 外部の activity は NULL（migrations/0027）
   */
  card_storage_key: string | null;
  /** 外部の activity の取得元が返した画像の URL。ほかの種類は NULL（migrations/0027） */
  image_url: string | null;
};

const COLUMNS = `item_type, is_masked, title, title_masked, organization_name,
  organization_name_masked, role, project_kind, started_on, ended_on, sort_at, description, source,
  source_kind, url, created_at, published_at, slug, card_storage_key, image_url`;

const periodOf = (row: FeedRow): Period | null =>
  row.started_on === null
    ? null
    : { startedOn: row.started_on as CalendarDate, endedOn: row.ended_on as CalendarDate | null };

/**
 * 職歴・実績の題と組織名は、`is_masked` が 1 なら `_masked` の列から、0 なら実際の値の列から
 * 詰める（data-model.md の「アプリケーションが守る決まり」）
 */
const toCareerOrProjectItem = (row: FeedRow, type: 'career' | 'project'): FeedItem | null => {
  const isMasked = row.is_masked === 1;
  const organizationName = isMasked ? row.organization_name_masked : row.organization_name;
  const period = periodOf(row);
  if (organizationName === null || period === null) return null;

  if (type === 'career') {
    if (row.role === null) return null;
    return { type: 'career', isMasked, organizationName, role: row.role, period };
  }
  const title = isMasked ? row.title_masked : row.title;
  // 一覧の行は個別のページへリンクする（plan.md の U4）。識別子の欠けた行は詰めない
  if (title === null || row.slug === null) return null;
  // 種類は CHECK が 4 値に絞る。読めない値は `other` と同じ扱いにする
  const projectKind =
    row.project_kind !== null && isProjectKind(row.project_kind) ? row.project_kind : 'other';
  // 秘匿化した実績は画像を持たない（FR-013）。ビューも NULL にするが、ここでも詰めない
  const imageUrl =
    !isMasked && row.card_storage_key !== null
      ? routes.projectMedia(row.slug, row.card_storage_key)
      : null;
  return {
    type: 'project',
    isMasked,
    title,
    organizationName,
    projectKind,
    period,
    slug: row.slug,
    imageUrl,
  };
};

/**
 * ビューの 1 行を `FeedItem` に詰める。種類ごとに契約の項目だけを詰める。詰められない種類の行と、
 * 詰める値が欠けた行は null
 */
export const toFeedItem = (row: FeedRow): FeedItem | null => {
  if (!isFeedItemType(row.item_type)) return null;
  switch (row.item_type) {
    case 'career':
    case 'project':
      return toCareerOrProjectItem(row, row.item_type);
    case 'note':
      if (row.title === null || row.created_at === null || row.slug === null) return null;
      return {
        type: 'note',
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        slug: row.slug,
        // note の識別子は符号化して経路に埋める（src/app/notes/[slug]/page.tsx と同じ）
        imageUrl:
          row.card_storage_key === null
            ? null
            : `${routes.noteMedia(encodeURIComponent(row.slug))}/${row.card_storage_key}`,
      };
    case 'external_activity':
      // 画面は URL を `<a href>` にする。取得元の応答の URL を http か https に限る
      // （constitution の Allowlist Visibility）。ほかの scheme の行は詰めない
      if (row.url === null || !isWebUrl(row.url) || row.source === null) return null;
      if (row.published_at === null) return null;
      return {
        type: 'external_activity',
        title: row.title,
        url: row.url,
        publishedAt: row.published_at,
        source: row.source,
        // 分類は CHECK が絞る。読めない値は `other` と同じ扱いにする
        sourceKind:
          row.source_kind !== null && isExternalActivitySourceKind(row.source_kind)
            ? row.source_kind
            : 'other',
        // 画面は画像の URL を `<img src>` にする。URL と同じく http か https に限り、ほかの scheme の
        // 画像は行を残して出さない
        imageUrl: row.image_url !== null && isWebUrl(row.image_url) ? row.image_url : null,
      };
    case 'life_event':
      // 題は空でない（004 の FR-024、migrations/0021 の CHECK）。欠けた行は note と同じく詰めない
      if (row.title === null || row.slug === null) return null;
      return {
        type: 'life_event',
        title: row.title,
        description: row.description,
        happenedOn: row.sort_at as CalendarDate,
        source: 'life_event',
        sourceKind: 'life_event',
        slug: row.slug,
        imageUrl:
          row.card_storage_key === null
            ? null
            : routes.lifeEventMedia(row.slug, row.card_storage_key),
      };
  }
};

/**
 * 種類の値を SQL の文字列にする。`FEED_ITEM_TYPES` はコードの中の定数で、英小文字と `_` だけを
 * 持つ。bind で渡すと、後で `?` を足したときに並びがずれて種類の順が黙って崩れるため、埋め込む
 */
const typeLiterals = FEED_ITEM_TYPES.map((type) => `'${type}'`);

/**
 * 並びの日付の新しい順、同じ日付なら `FEED_ITEM_TYPES` の順、同じ種類なら主キーの大きい順
 * （FR-010、research.md の R5）。種類の順の `CASE` は配列から作る
 */
const LIST_SQL = `SELECT ${COLUMNS} FROM activity_feed
  WHERE item_type IN (${typeLiterals.join(', ')})
  ORDER BY sort_at DESC,
    CASE item_type ${typeLiterals.map((literal, index) => `WHEN ${literal} THEN ${index}`).join(' ')} END,
    item_number DESC
  LIMIT ? OFFSET ?`;

export const createD1FeedRepository = (db: D1Database): FeedRepository => ({
  list: async (page) => {
    // ページは 1 から数える整数。それ以外は OFFSET が負や小数になり、1 ページ目と同じ項目を返すか
    // D1 が投げる。どのページでもないとして項目を返さない
    if (!Number.isSafeInteger(page) || page < 1) return { items: [], hasNextPage: false };
    // 次のページがあるかを知るため、1 件多く読む
    const { results } = await db
      .prepare(LIST_SQL)
      .bind(FEED_PAGE_SIZE + 1, (page - 1) * FEED_PAGE_SIZE)
      .all<FeedRow>();
    return {
      items: results.slice(0, FEED_PAGE_SIZE).flatMap((row) => toFeedItem(row) ?? []),
      hasNextPage: results.length > FEED_PAGE_SIZE,
    };
  },
});
