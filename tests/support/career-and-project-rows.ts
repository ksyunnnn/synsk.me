import { PERSONAL_ORGANIZATION_ID } from '../../src/shared/domain/organization.ts';

/**
 * workerd と結合の検査が、作り物の組織・職歴・実績・学歴・スキルの行を D1 に入れる道具。
 * 値はすべて作り物。省いた列は、検査が値を気にしないときの既定の値で入れる。
 *
 * 行は Repository を通さずに SQL で入れる。Repository の検査の前提を、検査する実装に
 * 頼らずに作るため。各関数は入れた行の id を返す。
 */

const insertReturningId = async (
  db: D1Database,
  table: string,
  values: Record<string, string | number | null>,
): Promise<number> => {
  const columns = Object.keys(values);
  const row = await db
    .prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) RETURNING id`,
    )
    .bind(...Object.values(values))
    .first<{ id: number }>();
  if (!row) throw new Error(`${table} に行を入れられなかった`);
  return row.id;
};

export type OrganizationRowInput = { name?: string; nameMasked?: string | null };

export const insertOrganization = (
  db: D1Database,
  { name = '作り物株式会社', nameMasked = 'ある会社' }: OrganizationRowInput = {},
) => insertReturningId(db, 'organization', { name, name_masked: nameMasked });

/** 個人の組織を、src/shared/domain/organization.ts の定数の id で入れる（research.md の R9） */
export const insertPersonalOrganization = (
  db: D1Database,
  { name = '作り物の個人', nameMasked = '個人' }: OrganizationRowInput = {},
) =>
  insertReturningId(db, 'organization', {
    id: PERSONAL_ORGANIZATION_ID,
    name,
    name_masked: nameMasked,
  });

export type CareerRowInput = {
  organizationId: number;
  role?: string;
  startedOn?: string;
  endedOn?: string | null;
  description?: string | null;
  url?: string | null;
  /** 省くと列の既定（秘匿化する）で入れる */
  isMasked?: boolean;
};

export const insertCareer = (
  db: D1Database,
  {
    organizationId,
    role = '作り物の肩書',
    startedOn = '2020-04-01',
    endedOn = null,
    description = null,
    url = null,
    isMasked,
  }: CareerRowInput,
) =>
  insertReturningId(db, 'career', {
    organization_id: organizationId,
    role,
    started_on: startedOn,
    ended_on: endedOn,
    description,
    url,
    ...(isMasked === undefined ? {} : { is_masked: isMasked ? 1 : 0 }),
  });

export type ProjectRowInput = {
  organizationId: number;
  kind?: 'application' | 'talk' | 'event' | 'other';
  slug?: string;
  title?: string;
  titleMasked?: string;
  startedOn?: string;
  endedOn?: string | null;
  description?: string | null;
  url?: string | null;
  /** 省くと列の既定（秘匿化する）で入れる */
  isMasked?: boolean;
};

export const insertProject = (
  db: D1Database,
  {
    organizationId,
    kind = 'application',
    slug = crypto.randomUUID(),
    title = '作り物の受託開発',
    titleMasked = '業務システムの開発',
    startedOn = '2021-04-01',
    endedOn = null,
    description = null,
    url = null,
    isMasked,
  }: ProjectRowInput,
) =>
  insertReturningId(db, 'project', {
    organization_id: organizationId,
    kind,
    slug,
    title,
    title_masked: titleMasked,
    started_on: startedOn,
    ended_on: endedOn,
    description,
    url,
    ...(isMasked === undefined ? {} : { is_masked: isMasked ? 1 : 0 }),
  });

export type EducationRowInput = {
  school?: string;
  department?: string | null;
  startedOn?: string;
  endedOn?: string | null;
  remarks?: string | null;
};

export const insertEducation = (
  db: D1Database,
  {
    school = '作り物大学',
    department = null,
    startedOn = '2014-04-01',
    endedOn = '2018-03-31',
    remarks = null,
  }: EducationRowInput = {},
) =>
  insertReturningId(db, 'education', {
    school,
    department,
    started_on: startedOn,
    ended_on: endedOn,
    remarks,
  });

export type SkillRowInput = { name?: string; monthsOverride?: number | null };

export const insertSkill = (
  db: D1Database,
  { name = 'TypeScript', monthsOverride = null }: SkillRowInput = {},
) => insertReturningId(db, 'skill', { name, months_override: monthsOverride });

/** 実績にスキルをつなぐ */
export const linkProjectSkill = async (db: D1Database, projectId: number, skillId: number) => {
  await db
    .prepare('INSERT INTO project_skill (project_id, skill_id) VALUES (?, ?)')
    .bind(projectId, skillId)
    .run();
};

/**
 * 001 の表の行をすべて消す。外部キーは NO ACTION のため、子の行から消す
 * （research.md の R8）。`project.card_media_id` から `media` への外部キーは検査を
 * トランザクションの終わりに送るため、1 つの batch で消す（migration 0008）
 */
export const deleteCareerAndProjectRows = async (db: D1Database) => {
  await db.batch(
    [
      'UPDATE resume_career SET career_id = NULL',
      'UPDATE resume_project SET project_id = NULL',
      'UPDATE resume_education SET education_id = NULL',
      'DELETE FROM project_skill',
      'UPDATE project SET card_media_id = NULL',
      'DELETE FROM media WHERE project_id IS NOT NULL OR career_id IS NOT NULL',
      'DELETE FROM project',
      'DELETE FROM career',
      'DELETE FROM education',
      'DELETE FROM skill',
      'DELETE FROM organization',
    ].map((sql) => db.prepare(sql)),
  );
};
