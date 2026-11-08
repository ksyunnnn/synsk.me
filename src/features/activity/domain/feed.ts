import type { CalendarDate, Period } from '@/shared/domain/period';

/**
 * 訪問者の一覧（timeline）の型と決まり（specs/005-feed/spec.md、contracts/visitor-feed.md）。
 *
 * 一覧はビュー `activity_feed`（migrations/0025）だけを読む。公開と秘匿化の決まりはビューが
 * 持ち、ここはビューの行を、出してよい項目だけを列挙した DTO に詰める（ADR-0028）
 */

/** 1 ページの件数（research.md の R7） */
export const FEED_PAGE_SIZE = 50;

/** 読めるページの番号の上限（research.md の R7、constitution II） */
export const FEED_PAGE_MAX = 1000;

/**
 * `?page=` の値を読む。1 以上の整数でなければ 1、上限より大きければ上限にする
 */
export const parseFeedPage = (value: string | string[] | undefined): number => {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined || !/^[1-9]\d{0,15}$/.test(text)) return 1;
  return Math.min(Number(text), FEED_PAGE_MAX);
};

/** 一覧の種類（spec の Terms）。`activity_feed.item_type` の値と同じ */
export const FEED_ITEM_TYPES = [
  'note',
  'external_activity',
  'life_event',
  'project',
  'career',
] as const;
export type FeedItemType = (typeof FEED_ITEM_TYPES)[number];

export const FEED_ITEM_TYPE_LABELS: Record<FeedItemType, string> = {
  note: 'note',
  external_activity: '外部の activity',
  life_event: 'life event',
  project: '実績',
  career: '職歴',
};

/**
 * 実績の種類。`project.kind` の CHECK と同じ値。機能どうしは import しないため
 * （ADR-0026）、`src/features/project/domain/project.ts` と別に持つ
 */
export const FEED_PROJECT_KINDS = ['application', 'talk', 'event', 'other'] as const;
export type FeedProjectKind = (typeof FEED_PROJECT_KINDS)[number];

export const FEED_PROJECT_KIND_LABELS: Record<FeedProjectKind, string> = {
  application: 'アプリ',
  talk: '登壇',
  event: 'イベント',
  other: 'その他',
};

/** 取得元の分類。`activity_source.kind` の CHECK と同じ値 */
export type FeedSourceKind = 'article' | 'embed' | 'life_event' | 'other';

type FeedItemBase = {
  /** 種類ごとの番号。種類と組にして 1 件を指す */
  id: number;
  /** 並びの日付の、日本時間の暦の日付 */
  date: CalendarDate;
};

export type FeedNote = FeedItemBase & {
  type: 'note';
  slug: string;
  /** 公開した版の題と説明文（FR-006） */
  title: string;
  description: string | null;
};

export type FeedExternalActivity = FeedItemBase & {
  type: 'external_activity';
  /** 取得元の URL。一覧から直接リンクする（FR-020） */
  url: string;
  /** 取得元が返さなかったときは空 */
  title: string | null;
  source: string;
  sourceKind: FeedSourceKind;
};

export type FeedLifeEvent = FeedItemBase & {
  type: 'life_event';
  slug: string;
  title: string;
};

/** 秘匿化した実績の `title` と `organizationName` は、秘匿化した値（FR-012） */
export type FeedProject = FeedItemBase & {
  type: 'project';
  slug: string;
  title: string;
  organizationName: string;
  projectKind: FeedProjectKind;
  period: Period;
  skills: string[];
  isMasked: boolean;
};

/** 秘匿化した職歴の `organizationName` は、秘匿化した組織名（FR-012） */
export type FeedCareer = FeedItemBase & {
  type: 'career';
  organizationName: string;
  role: string;
  period: Period;
  isMasked: boolean;
};

export type FeedItem = FeedNote | FeedExternalActivity | FeedLifeEvent | FeedProject | FeedCareer;

export type FeedPage = {
  items: FeedItem[];
  page: number;
  hasNext: boolean;
};

/** ビュー `activity_feed` の 1 行（data-model.md） */
export type FeedRow = {
  item_type: string;
  item_id: number;
  sort_key: string;
  slug: string | null;
  url: string | null;
  visible_title: string | null;
  description: string | null;
  source: string | null;
  source_kind: string | null;
  visible_organization_name: string | null;
  role: string | null;
  project_kind: string | null;
  started_on: string | null;
  ended_on: string | null;
  is_masked: number;
  skills: string | null;
};

const SOURCE_KINDS: readonly FeedSourceKind[] = ['article', 'embed', 'life_event', 'other'];

const isProjectKind = (value: string | null): value is FeedProjectKind =>
  value !== null && (FEED_PROJECT_KINDS as readonly string[]).includes(value);

const toSkills = (value: string | null): string[] => {
  if (value === null) return [];
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : [];
};

const toPeriod = (row: FeedRow): Period => ({
  startedOn: row.started_on as CalendarDate,
  endedOn: row.ended_on as CalendarDate | null,
});

/**
 * ビューの行を DTO に詰める。種類ごとに、DTO が持つ項目だけを列挙して写す。
 * 種類の値が読めない行と、種類に要る値が欠けた行は null にし、一覧から外す
 */
export const toFeedItem = (row: FeedRow): FeedItem | null => {
  const base = { id: row.item_id, date: row.sort_key.slice(0, 10) as CalendarDate };
  switch (row.item_type) {
    case 'note':
      if (row.slug === null || row.visible_title === null) return null;
      return {
        ...base,
        type: 'note',
        slug: row.slug,
        title: row.visible_title,
        description: row.description,
      };
    case 'external_activity':
      if (row.url === null || row.source === null) return null;
      return {
        ...base,
        type: 'external_activity',
        url: row.url,
        title: row.visible_title === '' ? null : row.visible_title,
        source: row.source,
        sourceKind: SOURCE_KINDS.find((kind) => kind === row.source_kind) ?? 'other',
      };
    case 'life_event':
      if (row.slug === null || row.visible_title === null) return null;
      return { ...base, type: 'life_event', slug: row.slug, title: row.visible_title };
    case 'project':
      if (
        row.slug === null ||
        row.visible_title === null ||
        row.visible_organization_name === null ||
        !isProjectKind(row.project_kind) ||
        row.started_on === null
      )
        return null;
      return {
        ...base,
        type: 'project',
        slug: row.slug,
        title: row.visible_title,
        organizationName: row.visible_organization_name,
        projectKind: row.project_kind,
        period: toPeriod(row),
        skills: toSkills(row.skills),
        isMasked: row.is_masked === 1,
      };
    case 'career':
      if (row.visible_organization_name === null || row.role === null || row.started_on === null)
        return null;
      return {
        ...base,
        type: 'career',
        organizationName: row.visible_organization_name,
        role: row.role,
        period: toPeriod(row),
        isMasked: row.is_masked === 1,
      };
    default:
      return null;
  }
};

/** URL のホスト名。題の無い外部の activity を見せるときに使う。読めなければ URL のまま */
export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
