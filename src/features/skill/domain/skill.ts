import type { ActionResult } from '@/shared/domain/action-result';
import type { Period } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';

/**
 * スキルの型と決まり（specs/001-career-and-project/spec.md の FR-031〜FR-034）。
 * 大文字と小文字だけ違う名前の重複は、`skill.name` の `COLLATE NOCASE` の UNIQUE が止める
 */

export type SkillId = number;

export type Skill = {
  id: SkillId;
  /** 管理画面の URL とフォームでスキルを指す識別子 */
  uid: Uid;
  name: string;
  /** 経験年数を手で上書きした月数。null なら実績の期間から求める（FR-034） */
  monthsOverride: number | null;
};

/** スキルの一覧の 1 行。つないだ実績の期間を持ち、経験年数をユースケースが求める */
export type SkillWithPeriods = Skill & { periods: Period[] };

/** 一覧に出す、経験年数を求めたスキル */
export type SkillSummary = Skill & {
  /** 実績の期間から求めた月数（FR-033）。保存しない */
  computedMonths: number;
  /** 使う月数。上書きがあればそれ、無ければ求めた月数（FR-034） */
  experienceMonths: number;
};

export const SKILL_FIELDS = ['name', 'overrideYears', 'overrideMonths'] as const;
export type SkillField = (typeof SKILL_FIELDS)[number];
export type SkillFieldError = 'missing' | 'invalid' | 'name-taken';
export type SkillFormValues = Record<SkillField, string>;
export type SkillFormResult = ActionResult<SkillField, SkillFieldError>;

/** 保存する内容。id と uid は DB が決める */
export type SkillContent = Omit<Skill, 'id' | 'uid'>;

/** 編集・削除のフォームが、入力の項目とは別に送る値 */
export const SKILL_UID_FIELD = 'skillUid';

const NON_NEGATIVE_INTEGER = /^\d{1,4}$/;

/**
 * フォームの値を、名前と上書きの月数に読み替える。上書きは年と月で受け取り、月数で持つ
 * （FR-034）。年と月の両方が空なら上書きしない。片方だけなら、空の方を 0 とする
 */
export const parseSkillContent = (
  values: SkillFormValues,
):
  | { ok: true; content: { name: string; monthsOverride: number | null } }
  | { ok: false; errors: Partial<Record<SkillField, SkillFieldError>> } => {
  const errors: Partial<Record<SkillField, SkillFieldError>> = {};
  const name = values.name.trim();
  if (name === '') errors.name = 'missing';

  const years = values.overrideYears.trim();
  const months = values.overrideMonths.trim();
  let monthsOverride: number | null = null;
  if (years !== '' || months !== '') {
    if (years !== '' && !NON_NEGATIVE_INTEGER.test(years)) errors.overrideYears = 'invalid';
    if (months !== '' && (!NON_NEGATIVE_INTEGER.test(months) || Number(months) > 11)) {
      errors.overrideMonths = 'invalid';
    }
    monthsOverride = Number(years || 0) * 12 + Number(months || 0);
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, content: { name, monthsOverride } };
};

export const toSkillFormValues = (skill?: SkillContent): SkillFormValues => {
  if (!skill || skill.monthsOverride === null) {
    return { name: skill?.name ?? '', overrideYears: '', overrideMonths: '' };
  }
  return {
    name: skill.name,
    overrideYears: String(Math.floor(skill.monthsOverride / 12)),
    overrideMonths: String(skill.monthsOverride % 12),
  };
};
