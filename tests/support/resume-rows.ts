/**
 * workerd と結合の検査が、作り物の職務経歴書と写した行を D1 に入れる道具。値はすべて作り物。
 * 省いた列は、検査が値を気にしないときの既定の値で入れる。
 *
 * 行は Repository を通さずに SQL で入れる。Repository の検査の前提を、検査する実装に頼らずに
 * 作るため。鍵とハッシュも、src/features/resume/domain/limited-key.ts を使わずに Web Crypto で作る
 * （specs/002-resume/research.md の R5 と同じ作り方）。
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

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** 限定公開用の鍵の平文。32 バイトの乱数の base64url */
export const createTestKey = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

/** 鍵の SHA-256 の 16 進 */
export const hashTestKey = async (key: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export type ResumeRowInput = {
  slug?: string;
  title?: string;
  audience?: 'limited' | 'public';
  status?: 'draft' | 'published';
  /** `YYYY-MM-DDTHH:MM:SS.SSSZ`。null なら期限なし。公開用では使わない */
  expiresAt?: string | null;
};

export type InsertedResume = {
  id: number;
  slug: string;
  /** 限定公開用の鍵の平文。公開用は null */
  key: string | null;
  /** 限定公開用の鍵のハッシュ。公開用は null */
  keyHash: string | null;
};

export const insertResume = async (
  db: D1Database,
  {
    slug = crypto.randomUUID(),
    title = '作り物の職務経歴書',
    audience = 'limited',
    status = 'draft',
    expiresAt = null,
  }: ResumeRowInput = {},
): Promise<InsertedResume> => {
  const key = audience === 'limited' ? createTestKey() : null;
  const keyHash = key === null ? null : await hashTestKey(key);
  const id = await insertReturningId(db, 'resume', {
    slug,
    title,
    audience,
    status,
    limited_token_hash: keyHash,
    limited_expires_at: audience === 'limited' ? expiresAt : null,
  });
  return { id, slug, key, keyHash };
};

export type ResumeCareerRowInput = {
  resumeId: number;
  careerId?: number | null;
  organizationName?: string;
  role?: string;
  startedOn?: string;
  endedOn?: string | null;
  description?: string | null;
  url?: string | null;
  isMasked?: boolean;
};

export const insertResumeCareer = (
  db: D1Database,
  {
    resumeId,
    careerId = null,
    organizationName = '写した作り物株式会社',
    role = '写した作り物の肩書',
    startedOn = '2020-04-01',
    endedOn = null,
    description = null,
    url = null,
    isMasked = true,
  }: ResumeCareerRowInput,
) =>
  insertReturningId(db, 'resume_career', {
    resume_id: resumeId,
    career_id: careerId,
    organization_name: organizationName,
    role,
    started_on: startedOn,
    ended_on: endedOn,
    description,
    url,
    is_masked: isMasked ? 1 : 0,
  });

export type ResumeProjectRowInput = {
  resumeId: number;
  projectId?: number | null;
  organizationName?: string;
  kind?: 'application' | 'talk' | 'event' | 'other';
  title?: string;
  startedOn?: string;
  endedOn?: string | null;
  description?: string | null;
  url?: string | null;
  isMasked?: boolean;
  skills?: string[];
};

/** 写した実績と、そのスキルの名前を入れる */
export const insertResumeProject = async (
  db: D1Database,
  {
    resumeId,
    projectId = null,
    organizationName = '写した作り物株式会社',
    kind = 'application',
    title = '写した作り物の受託開発',
    startedOn = '2021-04-01',
    endedOn = null,
    description = null,
    url = null,
    isMasked = true,
    skills = [],
  }: ResumeProjectRowInput,
) => {
  const id = await insertReturningId(db, 'resume_project', {
    resume_id: resumeId,
    project_id: projectId,
    organization_name: organizationName,
    kind,
    title,
    started_on: startedOn,
    ended_on: endedOn,
    description,
    url,
    is_masked: isMasked ? 1 : 0,
  });
  for (const name of skills) {
    await db
      .prepare('INSERT INTO resume_project_skill (resume_project_id, skill_name) VALUES (?, ?)')
      .bind(id, name)
      .run();
  }
  return id;
};

export type ResumeEducationRowInput = {
  resumeId: number;
  educationId?: number | null;
  school?: string;
  department?: string | null;
  startedOn?: string;
  endedOn?: string | null;
  remarks?: string | null;
};

export const insertResumeEducation = (
  db: D1Database,
  {
    resumeId,
    educationId = null,
    school = '写した作り物大学',
    department = null,
    startedOn = '2014-04-01',
    endedOn = '2018-03-31',
    remarks = null,
  }: ResumeEducationRowInput,
) =>
  insertReturningId(db, 'resume_education', {
    resume_id: resumeId,
    education_id: educationId,
    school,
    department,
    started_on: startedOn,
    ended_on: endedOn,
    remarks,
  });

/** 写した経験年数の上書きを入れる。月数で持つ */
export const insertResumeSkillOverride = async (
  db: D1Database,
  resumeId: number,
  skillName: string,
  monthsOverride: number,
) => {
  await db
    .prepare(
      'INSERT INTO resume_skill_override (resume_id, skill_name, months_override) VALUES (?, ?, ?)',
    )
    .bind(resumeId, skillName, monthsOverride)
    .run();
};

/** 職務経歴書の表の行をすべて消す。外部キーは NO ACTION のため、子の行から消す（research.md の R9） */
export const deleteResumeRows = async (db: D1Database) => {
  await db.batch(
    [
      'DELETE FROM resume_project_skill',
      'DELETE FROM resume_project',
      'DELETE FROM resume_career',
      'DELETE FROM resume_education',
      'DELETE FROM resume_skill_override',
      'DELETE FROM resume',
    ].map((sql) => db.prepare(sql)),
  );
};
