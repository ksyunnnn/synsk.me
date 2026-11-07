import type { ActionResult } from '@/shared/domain/action-result';
import { parseOrganizationName, type Organization } from '@/shared/domain/organization';
import { toPeriod, type Period } from '@/shared/domain/period';
import { parseSiteStatus, type SiteStatus } from '@/shared/domain/site-status';
import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 職歴の型と決まり（specs/001-career-and-project/spec.md の FR-007・FR-008・FR-010・FR-044）。
 * 訪問者に職歴を出すのは一覧（005）と職務経歴書（002）で、001 は訪問者向けの形を持たない
 * （research.md の R15）
 */

export type CareerId = number;

export const parseCareerId = (value: string): CareerId | null =>
  /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null;

/** 作り手が編集する職歴 */
export type Career = {
  id: CareerId;
  organization: Pick<Organization, 'id' | 'name' | 'nameMasked'>;
  role: string;
  isMasked: boolean;
  /** サイトに載せるか（FR-044） */
  status: SiteStatus;
  period: Period;
  description: string | null;
  url: string | null;
  /** 更新日時。編集の画面を開いたときの値を、楽観ロックに使う（research.md の R7） */
  updatedAt: string;
};

export type CareerSummary = Pick<Career, 'id' | 'role' | 'isMasked' | 'status' | 'period'> & {
  organizationName: string;
};

/** 保存する内容。組織は組織名で指し、無ければ作る（FR-002・FR-003） */
export type CareerContent = {
  organizationName: string;
  organizationNameMasked: string | null;
  role: string;
  isMasked: boolean;
  status: SiteStatus;
  period: Period;
  description: string | null;
  url: string | null;
};

export const CAREER_FIELDS = [
  'organizationName',
  'organizationNameMasked',
  'role',
  'isMasked',
  'status',
  'startedOn',
  'endedOn',
  'description',
  'url',
] as const;
export type CareerField = (typeof CAREER_FIELDS)[number];
export type CareerFieldError =
  'missing' | 'invalid' | 'ended-before-started' | 'masked-name-required';
export type CareerFormValues = Record<CareerField, string>;
export type CareerFormResult = ActionResult<CareerField, CareerFieldError>;

export const CAREER_ID_FIELD = 'careerId';
export const OPENED_UPDATED_AT_FIELD = 'openedUpdatedAt';

/** `isMasked` の値。送られた値が秘匿化しないことを示すときだけ、秘匿化しない（FR-010） */
export const IS_MASKED_VALUES = { masked: '1', unmasked: '0' } as const;

const emptyToNull = (value: string) => (value.trim() === '' ? null : value);

/**
 * フォームの値を保存する内容に読み替える。秘匿化するかは、既定で秘匿化する（FR-010）。
 * サイトに載せるかは、既定で載せない（FR-044）
 */
export const parseCareerContent = (
  values: CareerFormValues,
):
  | { ok: true; content: CareerContent }
  | { ok: false; errors: Partial<Record<CareerField, CareerFieldError>> } => {
  const errors: Partial<Record<CareerField, CareerFieldError>> = {};

  const organizationName = parseOrganizationName(values.organizationName);
  if (organizationName === null) errors.organizationName = 'missing';
  if (values.role.trim() === '') errors.role = 'missing';

  const period = toPeriod(values.startedOn, values.endedOn);
  if (!period.ok) {
    if (period.error === 'invalid-started-on')
      errors.startedOn = values.startedOn === '' ? 'missing' : 'invalid';
    else if (period.error === 'invalid-ended-on') errors.endedOn = 'invalid';
    else errors.endedOn = 'ended-before-started';
  }

  const url = emptyToNull(values.url);
  if (url !== null && !isWebUrl(url.trim())) errors.url = 'invalid';

  if (Object.keys(errors).length > 0 || organizationName === null || !period.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    content: {
      organizationName,
      organizationNameMasked: emptyToNull(values.organizationNameMasked)?.trim() ?? null,
      role: values.role.trim(),
      isMasked: values.isMasked !== IS_MASKED_VALUES.unmasked,
      status: parseSiteStatus(values.status),
      period: period.period,
      description: emptyToNull(values.description.replace(/\r\n?/g, '\n')),
      url: url?.trim() ?? null,
    },
  };
};

export const toCareerFormValues = (career?: Career): CareerFormValues =>
  career
    ? {
        organizationName: career.organization.name,
        organizationNameMasked: career.organization.nameMasked ?? '',
        role: career.role,
        isMasked: career.isMasked ? IS_MASKED_VALUES.masked : IS_MASKED_VALUES.unmasked,
        status: career.status,
        startedOn: career.period.startedOn,
        endedOn: career.period.endedOn ?? '',
        description: career.description ?? '',
        url: career.url ?? '',
      }
    : {
        organizationName: '',
        organizationNameMasked: '',
        role: '',
        isMasked: IS_MASKED_VALUES.masked,
        status: 'draft',
        startedOn: '',
        endedOn: '',
        description: '',
        url: '',
      };
