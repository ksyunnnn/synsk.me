import 'server-only';

import {
  FEED_ITEM_TYPES,
  isFeedItemType,
  isFeedProjectKind,
  type FeedItem,
} from '@/features/activity/domain/feed';
import type { FeedRepository } from '@/features/activity/domain/feed-repository';
import type { CalendarDate, Period } from '@/shared/domain/period';

/**
 * `FeedRepository` の D1 の実装。ビュー activity_feed（migrations/0013・0016〜0018）だけを読み、表を
 * 読まない（ADR-0046）。サイトに載せる行だけを出す決まりと秘匿化の決まりはビューが持つ。
 * この実装は、種類ごとに出す項目を列挙して `FeedItem` に詰める（constitution の Allowlist
 * Visibility、specs/005-feed/research.md の R4）。行の型はこのファイルの中だけに置く
 */

/**
 * ビューから読む列。`item_number` は並べる SQL の中だけで使い、読まない（research.md の R6）。
 * `sort_at` は note の作成日として読む（contracts/visitor-feed.md）
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
};

const COLUMNS = `item_type, is_masked, title, title_masked, organization_name,
  organization_name_masked, role, project_kind, started_on, ended_on, sort_at, description`;

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
  if (title === null) return null;
  // 種類は CHECK が 4 値に絞る。読めない値は `other` と同じ扱いにする
  const projectKind =
    row.project_kind !== null && isFeedProjectKind(row.project_kind) ? row.project_kind : 'other';
  return { type: 'project', isMasked, title, organizationName, projectKind, period };
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
      if (row.title === null) return null;
      return {
        type: 'note',
        title: row.title,
        description: row.description,
        createdAt: row.sort_at,
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
    item_number DESC`;

export const createD1FeedRepository = (db: D1Database): FeedRepository => ({
  list: async () => {
    const { results } = await db.prepare(LIST_SQL).all<FeedRow>();
    return results.flatMap((row) => toFeedItem(row) ?? []);
  },
});
