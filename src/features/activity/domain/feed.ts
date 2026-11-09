import type { Period } from '@/shared/domain/period';
import type { ProjectKind } from '@/shared/domain/project-kind';

/**
 * 一覧の 1 件の形（specs/005-feed/contracts/visitor-feed.md、research.md の R5・R6）。
 * 画面・`<title>`・RSC の応答は、この形の値だけを使う。どの種類にも主キー（ビューの
 * `item_number`）を入れない（ADR-0048）
 */

/**
 * Repository の実装が詰められる種類。並びの日付が同じときの種類の順を兼ねる。仮の順は
 * note・external_activity・life_event・project・career（plan.md の U2）で、note・外部の
 * activity・life event は詰める実装を足すときに、仮の順の位置に足す
 */
export const FEED_ITEM_TYPES = ['project', 'career'] as const;
export type FeedItemType = (typeof FEED_ITEM_TYPES)[number];

export const isFeedItemType = (value: string): value is FeedItemType =>
  (FEED_ITEM_TYPES as readonly string[]).includes(value);

/**
 * 職歴。秘匿化した職歴の組織名は秘匿化した組織名。本文・関連 URL・画像を持たない
 * （FR-012・FR-013）。秘匿化した行の本文は、画面が `isMasked` を見て伏せた見た目で出す
 */
export type CareerFeedItem = {
  type: 'career';
  isMasked: boolean;
  organizationName: string;
  role: string;
  period: Period;
};

/**
 * 実績。秘匿化した実績の題と組織名は秘匿化した値。本文・関連 URL・画像を持たない
 * （FR-012・FR-013）
 */
export type ProjectFeedItem = {
  type: 'project';
  isMasked: boolean;
  title: string;
  organizationName: string;
  projectKind: ProjectKind;
  period: Period;
};

export type FeedItem = CareerFeedItem | ProjectFeedItem;
