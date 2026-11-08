import type { ActionResult } from '@/shared/domain/action-result';
import { emptyToNull } from '@/shared/domain/empty-to-null';
import { parseOrganizationName, type Organization } from '@/shared/domain/organization';
import { toPeriod, type Period } from '@/shared/domain/period';
import { parseSiteStatus, type SiteStatus } from '@/shared/domain/site-status';
import type { Uid } from '@/shared/domain/uid';
import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 実績の型と決まり（specs/001-career-and-project/spec.md の FR-011〜FR-019・FR-026・FR-044、
 * data-model.md の「アプリケーションが守る決まり」）。
 */

/**
 * 実績の種類（FR-012）。`project.kind` の CHECK と同じ値を、ここ 1 か所に置く
 * （research.md の R3）。順は入力の選択肢の順
 */
export const PROJECT_KINDS = ['application', 'talk', 'event', 'other'] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  application: 'アプリ',
  talk: '登壇',
  event: 'イベント',
  other: 'その他',
};

const isProjectKind = (value: string): value is ProjectKind =>
  (PROJECT_KINDS as readonly string[]).includes(value);

export type ProjectId = number;

/** 文字列の id を読む。正の整数でなければ null。使い手はスキルの id の読み取り */
export const parseProjectId = (value: string): ProjectId | null =>
  /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null;

/** 実績の識別子の形（FR-013、`project.slug` の CHECK）。1〜100 文字の英小文字・数字・ハイフン */
export const isProjectSlug = (value: string): boolean => /^[a-z0-9-]{1,100}$/.test(value);

/**
 * 新しい識別子（FR-013、research.md の R6）。題や組織名から推測できない uid で、
 * 36 文字の英小文字（16 進）・数字・ハイフンのため `isProjectSlug` を満たす
 */
export const newProjectSlug = (): string => crypto.randomUUID();

/** 作り手が編集する実績 */
export type Project = {
  id: ProjectId;
  /** 管理画面の URL とフォームで実績を指す識別子。訪問者向けの URL は slug */
  uid: Uid;
  slug: string;
  organization: Pick<Organization, 'id' | 'name' | 'nameMasked'>;
  kind: ProjectKind;
  title: string;
  titleMasked: string;
  isMasked: boolean;
  /** サイトに載せるか（FR-044） */
  status: SiteStatus;
  period: Period;
  description: string | null;
  url: string | null;
  /** つないだスキルの id（FR-032） */
  skillIds: number[];
  /** 更新日時。編集の画面を開いたときの値を、楽観ロックに使う（research.md の R7） */
  updatedAt: string;
};

/** 作り手の一覧の 1 行 */
export type ProjectSummary = Pick<
  Project,
  'id' | 'uid' | 'slug' | 'kind' | 'title' | 'isMasked' | 'status' | 'period'
> & {
  organizationName: string;
};

/**
 * 保存する内容。組織は組織名で指し、無ければ作る（FR-002・FR-003）。
 * `organizationNameMasked` は、組織を作るときと、組織が秘匿化した組織名を持たないときに入れる
 */
export type ProjectContent = {
  organizationName: string;
  organizationNameMasked: string | null;
  kind: ProjectKind;
  title: string;
  titleMasked: string;
  isMasked: boolean;
  status: SiteStatus;
  period: Period;
  description: string | null;
  url: string | null;
  /** つなぐスキルの id。0 個以上（FR-032） */
  skillIds: number[];
};

/** 入力の項目の名前。フォームの値の名前と同じ */
export const PROJECT_FIELDS = [
  'organizationName',
  'organizationNameMasked',
  'kind',
  'title',
  'titleMasked',
  'isMasked',
  'status',
  'startedOn',
  'endedOn',
  'description',
  'url',
  'slug',
  /** つなぐスキルの id をカンマで区切った値。フォームはチェックボックスの並びで送る */
  'skillIds',
] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number];

/** 編集の画面のフォームが、入力の項目とは別に送る値 */
export const PROJECT_UID_FIELD = 'projectUid';
export const OPENED_UPDATED_AT_FIELD = 'openedUpdatedAt';

export type ProjectFieldError =
  | 'missing'
  | 'invalid'
  | 'ended-before-started'
  | 'slug-taken'
  | 'masked-slug-locked'
  | 'masked-name-required';

export type ProjectFormValues = Record<ProjectField, string>;

export type ProjectFormResult = ActionResult<ProjectField, ProjectFieldError>;

/** `isMasked` の値。送られた値が秘匿化しないことを示すときだけ、秘匿化しない（FR-015） */
export const IS_MASKED_VALUES = { masked: '1', unmasked: '0' } as const;

/**
 * フォームの値を保存する内容に読み替える。秘匿化するかは、秘匿化しないと選んだときだけ
 * false にし、値が無いか読めなければ秘匿化する（FR-015）。サイトに載せるかは、載せると選んだ
 * ときだけ載せる（FR-044）。識別子はここで読まない
 */
export const parseProjectContent = (
  values: ProjectFormValues,
):
  | { ok: true; content: ProjectContent }
  | { ok: false; errors: Partial<Record<ProjectField, ProjectFieldError>> } => {
  const errors: Partial<Record<ProjectField, ProjectFieldError>> = {};

  const organizationName = parseOrganizationName(values.organizationName);
  if (organizationName === null) errors.organizationName = 'missing';
  if (!isProjectKind(values.kind)) errors.kind = 'invalid';
  if (values.title.trim() === '') errors.title = 'missing';
  if (values.titleMasked.trim() === '') errors.titleMasked = 'missing';

  const period = toPeriod(values.startedOn, values.endedOn);
  if (!period.ok) {
    if (period.error === 'invalid-started-on')
      errors.startedOn = values.startedOn === '' ? 'missing' : 'invalid';
    else if (period.error === 'invalid-ended-on') errors.endedOn = 'invalid';
    else errors.endedOn = 'ended-before-started';
  }

  const url = emptyToNull(values.url);
  if (url !== null && !isWebUrl(url.trim())) errors.url = 'invalid';

  const skillIdTexts = values.skillIds.split(',').filter((id) => id !== '');
  const skillIds = skillIdTexts.map(parseProjectId);
  if (skillIds.some((id) => id === null)) errors.skillIds = 'invalid';

  if (Object.keys(errors).length > 0 || organizationName === null || !period.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    content: {
      organizationName,
      organizationNameMasked: emptyToNull(values.organizationNameMasked)?.trim() ?? null,
      kind: values.kind as ProjectKind,
      title: values.title.trim(),
      titleMasked: values.titleMasked.trim(),
      isMasked: values.isMasked !== IS_MASKED_VALUES.unmasked,
      status: parseSiteStatus(values.status),
      period: period.period,
      description: emptyToNull(values.description.replace(/\r\n?/g, '\n')),
      url: url?.trim() ?? null,
      skillIds: [...new Set(skillIds as number[])],
    },
  };
};

/**
 * 編集で保存する識別子を決める（FR-013）。
 * - 秘匿化しない実績を秘匿化に切り替えたら、新しい uid
 * - 秘匿化した実績は、送られた識別子が今の識別子と違えば拒む。秘匿化を外すときも、
 *   その保存では識別子を変えない（data-model.md の「状態の切り替え」）
 * - 秘匿化しない実績は、送られた識別子の形を確かめて使う
 */
export const decideProjectSlug = (
  current: Pick<Project, 'slug' | 'isMasked'>,
  next: { isMasked: boolean; requestedSlug: string },
): { ok: true; slug: string } | { ok: false; error: ProjectFieldError } => {
  if (current.isMasked) {
    return next.requestedSlug === current.slug
      ? { ok: true, slug: current.slug }
      : { ok: false, error: 'masked-slug-locked' };
  }
  if (next.isMasked) return { ok: true, slug: newProjectSlug() };
  if (next.requestedSlug === '') return { ok: false, error: 'missing' };
  return isProjectSlug(next.requestedSlug)
    ? { ok: true, slug: next.requestedSlug }
    : { ok: false, error: 'invalid' };
};

/** フォームの初めの値。登録の画面は空で、秘匿化し、サイトに載せない（FR-015・FR-044） */
export const toProjectFormValues = (project?: Project): ProjectFormValues =>
  project
    ? {
        organizationName: project.organization.name,
        organizationNameMasked: project.organization.nameMasked ?? '',
        kind: project.kind,
        title: project.title,
        titleMasked: project.titleMasked,
        isMasked: project.isMasked ? IS_MASKED_VALUES.masked : IS_MASKED_VALUES.unmasked,
        status: project.status,
        startedOn: project.period.startedOn,
        endedOn: project.period.endedOn ?? '',
        description: project.description ?? '',
        url: project.url ?? '',
        slug: project.slug,
        skillIds: project.skillIds.join(','),
      }
    : {
        organizationName: '',
        organizationNameMasked: '',
        kind: PROJECT_KINDS[0],
        title: '',
        titleMasked: '',
        isMasked: IS_MASKED_VALUES.masked,
        status: 'draft',
        startedOn: '',
        endedOn: '',
        description: '',
        url: '',
        slug: '',
        skillIds: '',
      };

/*
 * 訪問者向けの DTO（contracts/visitor-project.md）。Repository の実装が `is_masked` を見て、
 * 出してよい列だけを読んで詰める。画面・`<title>`・OGP はこの値だけを使う
 */

/** 秘匿化しない実績。代表画像は配る経路が決まるまで持たない（plan.md の U5） */
export type UnmaskedVisitorProject = {
  isMasked: false;
  slug: string;
  kind: ProjectKind;
  title: string;
  organizationName: string;
  period: Period;
  skills: string[];
  /** 表示は本文の書式が決まってから（plan.md の U4） */
  body: string | null;
  url: string | null;
};

/** 秘匿化した実績。本文・関連 URL・画像を持たない（FR-021・FR-022・FR-026・FR-030） */
export type MaskedVisitorProject = {
  isMasked: true;
  slug: string;
  kind: ProjectKind;
  title: string;
  /** 秘匿化した組織名。持たない組織を指す秘匿化した実績は、訪問者に出さない（plan.md の U2） */
  organizationName: string;
  period: Period;
  skills: string[];
};

export type VisitorProject = UnmaskedVisitorProject | MaskedVisitorProject;
