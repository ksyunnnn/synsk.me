import type { CalendarDate, Period } from '@/shared/domain/period';
import type { ProjectKind } from '@/shared/domain/project-kind';

/**
 * 一覧の 1 件の形（specs/005-feed/contracts/visitor-feed.md、research.md の R5・R6）。
 * 画面・`<title>`・RSC の応答は、この形の値だけを使う。どの種類にも主キー（ビューの
 * `item_number`）を入れない（ADR-0048）。個別のページを持つ種類（実績・note・life event）は、
 * 個別のページの URL に出す識別子 `slug` を持つ（plan.md の U4）
 */

/**
 * Repository の実装が詰められる種類。並びの日付が同じときの種類の順を兼ねる。仮の順
 * （plan.md の U2）
 */
export const FEED_ITEM_TYPES = [
  'note',
  'external_activity',
  'life_event',
  'project',
  'career',
] as const;
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
 * （FR-012・FR-013）。秘匿化した実績も個別のページを持つ（001 の spec の Edge Cases）
 */
export type ProjectFeedItem = {
  type: 'project';
  isMasked: boolean;
  title: string;
  organizationName: string;
  projectKind: ProjectKind;
  period: Period;
  /** 個別のページの識別子。秘匿化した実績では uid で、実際の題や組織名を含まない（001 の FR-013） */
  slug: string;
};

/**
 * note。題と説明文は公開した版のもの。最も新しい版・転載先・代表画像を持たない（FR-006）
 */
export type NoteFeedItem = {
  type: 'note';
  title: string;
  /** 空なら null */
  description: string | null;
  /** 作成日時。`YYYY-MM-DDTHH:MM:SS.sssZ`。並びの日付で、公開の操作で変わらない（FR-008） */
  createdAt: string;
  /** 個別のページの識別子 */
  slug: string;
};

/**
 * 外部の activity の分類（`activity_source.kind` のうち life event でないもの、migration 0007 の
 * CHECK）。画面は分類で見せ方を分ける（FR-019）
 */
export const EXTERNAL_ACTIVITY_SOURCE_KINDS = ['article', 'embed', 'other'] as const;
export type ExternalActivitySourceKind = (typeof EXTERNAL_ACTIVITY_SOURCE_KINDS)[number];

export const isExternalActivitySourceKind = (value: string): value is ExternalActivitySourceKind =>
  (EXTERNAL_ACTIVITY_SOURCE_KINDS as readonly string[]).includes(value);

/**
 * 外部の activity。画面は取得元の URL へ直接リンクする（FR-020）。代表の画像を持たない
 * （plan.md の U5）
 */
export type ExternalActivityFeedItem = {
  type: 'external_activity';
  /** 取得元が題を返さなかった行は null */
  title: string | null;
  url: string;
  /** 公開日時。`YYYY-MM-DDTHH:MM:SS.sssZ` */
  publishedAt: string;
  /** 取得元の名前（`activity.source`）。埋め込みの見せ方は取得元で決める（FR-019） */
  source: string;
  sourceKind: ExternalActivitySourceKind;
};

/** life event。代表画像を持たない（plan.md の U5） */
export type LifeEventFeedItem = {
  type: 'life_event';
  /** 空でない（004 の FR-024） */
  title: string;
  /** 空なら null */
  description: string | null;
  happenedOn: CalendarDate;
  source: 'life_event';
  sourceKind: 'life_event';
  /** 個別のページの識別子 */
  slug: string;
};

export type FeedItem =
  CareerFeedItem | ProjectFeedItem | NoteFeedItem | ExternalActivityFeedItem | LifeEventFeedItem;

/**
 * 日時を出すときの時刻帯。並びの日の境目（migrations/0022 の `'+9 hours'`）と同じ時刻帯にする
 * （specs/005-feed/spec.md の FR-022）。片方を変えるときは、もう片方も変える
 */
const DISPLAY_TIME_ZONE = 'Asia/Tokyo';

/**
 * 日時（`YYYY-MM-DDTHH:MM:SS.sssZ`）を、日本時間の暦の日付（`YYYY-MM-DD`）にする。note の作成日と
 * 外部の activity の公開日を、001 の職歴・実績の日付と同じ形で出すため
 */
export const toTokyoCalendarDate = (dateTime: string): CalendarDate => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(dateTime));
  const valueOf = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}` as CalendarDate;
};

/**
 * 1 ページに並べる件数。仮の値（plan.md の U8）。読み取り行数は件数で変わらない
 * （research.md の R8）
 */
export const FEED_PAGE_SIZE = 20;

/** 番号のページの 1 つ（research.md の R8）。ページは 1 から数える */
export type FeedPage = {
  items: FeedItem[];
  /** 次のページに項目があるか */
  hasNextPage: boolean;
};

/**
 * 一覧の画面の問い合わせの値 `page` を、ページの番号として読む（research.md の R8、tasks.md の
 * T033）。無い値、10 進の数字だけでない値、1 より小さい値は 1 ページ目にする。同じ名前が
 * 複数あるときは最初の値を読む。安全な整数を超える番号は丸めずに返し、Repository が最後の
 * ページの先として項目を返さない
 */
export const readFeedPage = (value: string | string[] | undefined): number => {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === undefined || !/^\d+$/.test(first)) return 1;
  const page = Number(first);
  return page < 1 ? 1 : page;
};
