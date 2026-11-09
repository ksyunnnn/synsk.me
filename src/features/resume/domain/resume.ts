import type { Period } from '@/shared/domain/period';
import type { Uid } from '@/shared/domain/uid';

/**
 * 職務経歴書の型と決まり（specs/002-resume/spec.md の FR-001〜FR-004・FR-037・FR-039、
 * data-model.md の「domain の型」）。行の型は Repository の実装の中だけに置き、ここへ詰め替える
 */

export const RESUME_AUDIENCES = ['limited', 'public'] as const;
/** 限定公開用か公開用か。作った後に変えない（FR-004） */
export type ResumeAudience = (typeof RESUME_AUDIENCES)[number];

export const RESUME_STATUSES = ['draft', 'published'] as const;
/** 下書きか、訪問者に見せるか（FR-021） */
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

export const isResumeStatus = (value: string): value is ResumeStatus =>
  (RESUME_STATUSES as readonly string[]).includes(value);

export type ResumeId = number;

/**
 * 文字列の id を読む。正の整数でなければ null。作成の画面で選んだ写し元の id にも使う。
 * `Number.MAX_SAFE_INTEGER` を超える値は精度を失い別の id に読めるため、null にする
 */
export const parseResumeId = (value: string): ResumeId | null => {
  if (!/^[1-9]\d{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

/**
 * 識別子を手で書き換えられるか。限定公開用は拒み、公開用は許す（FR-037・FR-039）。
 * 限定公開用は URL を出し直すとき（FR-040）だけ、新しい uid に作り直す。
 * 形（`src/shared/domain/slug.ts` の `isSlug`）と重複は書き換えるときに別に確かめる
 */
export const canChangeSlug = (audience: ResumeAudience): boolean => audience === 'public';

/** 写した実績の種類。値の意味は 001 の `project.kind` と同じ（migration 0006 の CHECK） */
export const RESUME_PROJECT_KINDS = ['application', 'talk', 'event', 'other'] as const;
export type ResumeProjectKind = (typeof RESUME_PROJECT_KINDS)[number];

export const RESUME_PROJECT_KIND_LABELS: Record<ResumeProjectKind, string> = {
  application: 'アプリ',
  talk: '登壇',
  event: 'イベント',
  other: 'その他',
};

export const isResumeProjectKind = (value: string): value is ResumeProjectKind =>
  (RESUME_PROJECT_KINDS as readonly string[]).includes(value);

export type Resume = {
  id: ResumeId;
  /** 管理画面の URL とフォームで職務経歴書を指す識別子。slug は書き換わるため使わない */
  uid: Uid;
  title: string;
  slug: string;
  audience: ResumeAudience;
  status: ResumeStatus;
  /** 限定公開用の期限。`YYYY-MM-DDTHH:MM:SS.SSSZ`。null なら期限なし。公開用は常に null */
  limitedExpiresAt: string | null;
  createdAt: string;
  /** 更新日時。開いたときの値を楽観ロックに使う（research.md の R8） */
  updatedAt: string;
};

/** 写した職歴 */
export type ResumeCareer = {
  id: number;
  /** 管理画面の URL とフォームで写した行を指す識別子 */
  uid: Uid;
  /** 写し元の職歴。写し元を消すと null（FR-007） */
  careerId: number | null;
  organizationName: string;
  role: string;
  period: Period;
  description: string | null;
  url: string | null;
  /** 作ったときに写し元が秘匿化していたか（migration 0008）。職務経歴書の中で変えない（FR-031） */
  isMasked: boolean;
};

/** 写した実績 */
export type ResumeProject = {
  id: number;
  uid: Uid;
  projectId: number | null;
  organizationName: string;
  kind: ResumeProjectKind;
  title: string;
  period: Period;
  description: string | null;
  url: string | null;
  isMasked: boolean;
  /** 写したスキルの名前（FR-025） */
  skills: string[];
};

/** 写した学歴 */
export type ResumeEducation = {
  id: number;
  uid: Uid;
  educationId: number | null;
  school: string;
  department: string | null;
  period: Period;
  remarks: string | null;
};

/** 写した経験年数の上書き。月数で持つ（FR-028） */
export type ResumeSkillOverride = { skillName: string; months: number };

/** 写した中身。始まりの日の新しい順（FR-009） */
export type ResumeContent = {
  careers: ResumeCareer[];
  projects: ResumeProject[];
  educations: ResumeEducation[];
  skillOverrides: ResumeSkillOverride[];
};

/** オーナーが編集する職務経歴書 */
export type ResumeForEdit = Resume & ResumeContent;

/** 写した行の種類。管理画面の経路の名前と同じ */
export const RESUME_ROW_KINDS = ['careers', 'projects', 'educations'] as const;
export type ResumeRowKind = (typeof RESUME_ROW_KINDS)[number];

export const isResumeRowKind = (value: string): value is ResumeRowKind =>
  (RESUME_ROW_KINDS as readonly string[]).includes(value);

/*
 * 写し元（001 の職歴・実績・学歴）。作るときと、作成の画面の選択肢に読む。002 は 001 の機能を
 * import しないため（ADR-0026）、写すのに要る列だけをここで持つ
 */

export type ResumeSourceCareer = {
  id: number;
  organizationName: string;
  organizationNameMasked: string | null;
  role: string;
  isMasked: boolean;
  period: Period;
  description: string | null;
  url: string | null;
};

export type ResumeSourceProject = {
  id: number;
  organizationName: string;
  organizationNameMasked: string | null;
  kind: ResumeProjectKind;
  title: string;
  titleMasked: string;
  isMasked: boolean;
  period: Period;
  description: string | null;
  url: string | null;
  /** つないだスキルの名前と、元のスキルの経験年数の上書き（月数） */
  skills: { name: string; monthsOverride: number | null }[];
};

export type ResumeSourceEducation = {
  id: number;
  school: string;
  department: string | null;
  period: Period;
  remarks: string | null;
};

/** 写し元。始まりの日の新しい順 */
export type ResumeSources = {
  careers: ResumeSourceCareer[];
  projects: ResumeSourceProject[];
  educations: ResumeSourceEducation[];
};

/** 作成の画面と足す画面で選んだ写し元の id */
export type ResumeSelection = {
  careerIds: number[];
  projectIds: number[];
  educationIds: number[];
};

/** 写した行の種類ごとの、選んだ写し元の id の名前 */
export const SELECTION_KEY_OF_KIND: Record<ResumeRowKind, keyof ResumeSelection> = {
  careers: 'careerIds',
  projects: 'projectIds',
  educations: 'educationIds',
};

/** 1 つの種類の写し元だけを選んだ選択。足す画面は種類ごとに選ぶ（FR-041） */
export const selectionOf = (kind: ResumeRowKind, ids: number[]): ResumeSelection => ({
  careerIds: [],
  projectIds: [],
  educationIds: [],
  [SELECTION_KEY_OF_KIND[kind]]: ids,
});

/**
 * 職務経歴書が既に写した写し元の id。足す画面の選択肢から外す（FR-041、research.md の R14）。
 * 写し元を消した行（写し元の id が null）は数えない
 */
export const copiedSourceIds = (content: ResumeContent, kind: ResumeRowKind): Set<number> => {
  const ids =
    kind === 'careers'
      ? content.careers.map((row) => row.careerId)
      : kind === 'projects'
        ? content.projects.map((row) => row.projectId)
        : content.educations.map((row) => row.educationId);
  return new Set(ids.filter((id): id is number => id !== null));
};

/** 作るときと足すときに写す中身。id と uid は保存するときに決まる */
export type NewResumeContent = {
  careers: Omit<ResumeCareer, 'id' | 'uid'>[];
  projects: Omit<ResumeProject, 'id' | 'uid'>[];
  educations: Omit<ResumeEducation, 'id' | 'uid'>[];
  skillOverrides: ResumeSkillOverride[];
};

/** 作る職務経歴書。状態は下書き（FR-021、`resume.status` の既定） */
export type NewResume = {
  slug: string;
  title: string;
  audience: ResumeAudience;
  limitedExpiresAt: string | null;
  content: NewResumeContent;
};

/** 職務経歴書の中で直す値（FR-031）。秘匿化していたかと写し元の id は直さない */
export type ResumeCareerContent = Omit<ResumeCareer, 'id' | 'uid' | 'careerId' | 'isMasked'>;
export type ResumeProjectContent = Omit<ResumeProject, 'id' | 'uid' | 'projectId' | 'isMasked'>;
export type ResumeEducationContent = Omit<ResumeEducation, 'id' | 'uid' | 'educationId'>;

/** 設定の画面で直す値。識別子は公開用だけが持つ（FR-037・FR-039） */
export type ResumeSettings = { title: string; limitedExpiresAt: string | null };

/** 楽観ロックに使う日時（research.md の R8） */
export type EditTimes = { openedUpdatedAt: string; now: string };

/*
 * 限定公開用の期限の入力（FR-013）。期限の既定・入力の形・時刻帯は plan.md の U9 で決まって
 * いない。決まるまでの仮の形として、既定は期限なし、入力は日付と時刻（`datetime-local`）、
 * 時刻帯は日本時間にする。保存は `resume.limited_expires_at` の CHECK の形（UTC の ISO 8601）
 */

/** 期限の入力を読む時刻帯の、UTC からのずれ（日本時間は夏時間を持たない） */
const EXPIRES_OFFSET_HOURS = 9;

const EXPIRES_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * 期限の入力（`YYYY-MM-DDTHH:MM`、日本時間）を、保存する形にする。空なら期限なし（null）。
 * 実在しない日時は拒む
 */
export const parseExpiresInput = (
  value: string,
): { ok: true; expiresAt: string | null } | { ok: false } => {
  if (value.trim() === '') return { ok: true, expiresAt: null };
  const match = EXPIRES_INPUT_PATTERN.exec(value.trim());
  if (!match) return { ok: false };
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const isReal =
    local.getUTCFullYear() === year &&
    local.getUTCMonth() === month - 1 &&
    local.getUTCDate() === day &&
    local.getUTCHours() === hour &&
    local.getUTCMinutes() === minute;
  if (!isReal) return { ok: false };
  return {
    ok: true,
    expiresAt: new Date(local.getTime() - EXPIRES_OFFSET_HOURS * 3_600_000).toISOString(),
  };
};

/** 保存した期限を、期限の入力の値（`YYYY-MM-DDTHH:MM`、日本時間）にする。期限なしは空文字 */
export const toExpiresInput = (expiresAt: string | null): string =>
  expiresAt === null
    ? ''
    : new Date(new Date(expiresAt).getTime() + EXPIRES_OFFSET_HOURS * 3_600_000)
        .toISOString()
        .slice(0, 16);

/** 管理画面に出す期限。`YYYY-MM-DD HH:MM（日本時間）`。期限なしは「期限なし」 */
export const formatExpires = (expiresAt: string | null): string =>
  expiresAt === null ? '期限なし' : `${toExpiresInput(expiresAt).replace('T', ' ')}（日本時間）`;

/** 期限を過ぎたか。期限なしは過ぎない（FR-014） */
export const isExpired = (expiresAt: string | null, now: Date): boolean =>
  expiresAt !== null && expiresAt <= now.toISOString();
