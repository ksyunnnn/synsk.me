import type { ActionResult } from '@/shared/domain/action-result';
import type { Period } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';

/**
 * スキルの型と決まり（specs/001-career-and-project/spec.md の FR-031〜FR-034）。
 * 大文字と小文字だけ違う名前の重複は、`skill.name` の `COLLATE NOCASE` の UNIQUE が止める。
 * 親子が 1 段で自分を親にしないこと、役割の値、子を持つ行が役割を持たないことは、`skill.parent_id`・
 * `skill.role` の CHECK とトリガが止める（migrations/0029）
 */

/**
 * スキルの役割と表示名（FR-031）。`skill.role` の CHECK と同じ値を、ここ 1 か所に置く。値を英字の
 * 識別子で持つのは `project.kind` と同じ（ADR-0055）
 */
export const SKILL_ROLES = [
  'language',
  'framework',
  'ui',
  'state_management',
  'data',
  'auth',
  'hosting',
  'testing',
  'ci_quality',
  'design',
  'dev_tool',
  'domain_specific',
  'other',
] as const;
export type SkillRole = (typeof SKILL_ROLES)[number];

export const SKILL_ROLE_LABELS: Record<SkillRole, string> = {
  language: '言語',
  framework: 'フレームワーク',
  ui: 'UI',
  state_management: '状態管理',
  data: 'データ',
  auth: '認証',
  hosting: 'ホスティング',
  testing: 'テスト',
  ci_quality: 'CI・品質',
  design: 'デザイン',
  dev_tool: '開発の道具',
  /** 特定の領域の依頼で効くもの（marked、MapLibre GL など） */
  domain_specific: '領域特化',
  /** どこにも入らないもの（axios など） */
  other: 'その他',
};

export type SkillId = number;

export type Skill = {
  id: SkillId;
  /** 管理画面の URL とフォームでスキルを指す識別子 */
  uid: Uid;
  name: string;
  /** 経験年数を手で上書きした月数。null なら実績の期間から求める（FR-034） */
  monthsOverride: number | null;
  /** 親のスキル（Cloudflare に対する D1 など）の id。null なら親を持たない（FR-031） */
  parentId: SkillId | null;
  /** 役割。親のスキルは持たない。null なら役割を付けていない（FR-031） */
  role: SkillRole | null;
};

/**
 * スキルの一覧の 1 行。そのスキルをつないだ実績の期間を持ち、経験年数をユースケースが求める。
 * 子をつないだ実績の期間は含めない。親の経験年数に使う期間は `experiencePeriodsBySkill` が求める
 */
export type SkillWithPeriods = Skill & { periods: Period[] };

/**
 * 経験年数を求める期間（FR-033）。スキルの id ごとに返す。親は、親か子のどれかをつないだ
 * 実績の期間。子と親を持たないスキルは、そのスキルをつないだ実績の期間。同じ実績が親と子の
 * 両方をつないでいても、重なる月は `countExperienceMonths` が 1 回だけ数える
 */
export const experiencePeriodsBySkill = (
  skills: readonly SkillWithPeriods[],
): Map<SkillId, Period[]> => {
  const bySkill = new Map(skills.map((skill) => [skill.id, [...skill.periods]]));
  for (const skill of skills) {
    if (skill.parentId !== null) bySkill.get(skill.parentId)?.push(...skill.periods);
  }
  return bySkill;
};

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

/** 保存する内容。id と uid は DB が決める。親と役割は入力の項目に無く、保存で変えない */
export type SkillContent = Omit<Skill, 'id' | 'uid' | 'parentId' | 'role'>;

/** スキルを消す確認のフォームの Server Action が返す結果。消せたときは別の画面へ移る */
export type DeleteSkillResult = { status: 'forbidden' | 'has-children' };

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
