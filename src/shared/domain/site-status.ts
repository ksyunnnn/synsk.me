/**
 * 職歴・実績をサイトに載せるか（specs/001-career-and-project/spec.md の FR-044〜FR-046）。
 * `career.status`・`project.status` の CHECK と同じ値を、ここ 1 か所に置く。
 * published はサイトに載せ、draft は載せない。秘匿化するか（`isMasked`）とは別の軸。
 * 使い手は career と project
 */
export const SITE_STATUSES = ['draft', 'published'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

/**
 * フォームの値を読む。送られた値がサイトに載せることを示すときだけ載せ、値が無いか読めなければ
 * 載せない（FR-044 の既定）
 */
export const parseSiteStatus = (value: string): SiteStatus =>
  value === 'published' ? 'published' : 'draft';

/** 管理画面の一覧に出す、サイトに載せるかの言葉 */
export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  draft: 'サイトに載せない',
  published: 'サイトに載せる',
};
