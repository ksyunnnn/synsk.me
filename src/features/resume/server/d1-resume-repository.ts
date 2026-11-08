import 'server-only';

import {
  isResumeProjectKind,
  type EditTimes,
  type NewResumeContent,
  type Resume,
  type ResumeCareer,
  type ResumeContent,
  type ResumeEducation,
  type ResumeProject,
  type ResumeProjectKind,
  type ResumeRowKind,
  type ResumeSourceProject,
} from '@/features/resume/domain/resume';
import type { EditResult, ResumeRepository } from '@/features/resume/domain/resume-repository';
import type { CalendarDate, Period } from '@/shared/domain/period';

/**
 * `ResumeRepository` の D1 の実装。行の型はこのファイルの中だけに置く（001 の research.md の R3）。
 * 複数の文は 1 つの `batch()`（1 つのトランザクション）で送る（specs/002-resume/research.md の R4）。
 * 写し元の値は、001 の機能を import せずに SQL で読む（ADR-0026、research.md の R2）
 */

type ResumeRow = {
  id: number;
  uid: string;
  title: string;
  slug: string;
  audience: 'limited' | 'public';
  status: 'draft' | 'published';
  limited_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type PeriodColumns = { started_on: string; ended_on: string | null };

type ResumeCareerRow = PeriodColumns & {
  id: number;
  uid: string;
  career_id: number | null;
  organization_name: string;
  role: string;
  description: string | null;
  url: string | null;
  is_masked: 0 | 1;
};

type ResumeProjectRow = PeriodColumns & {
  id: number;
  uid: string;
  project_id: number | null;
  organization_name: string;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  is_masked: 0 | 1;
};

type ResumeProjectSkillRow = { resume_project_id: number; skill_name: string };

type ResumeEducationRow = PeriodColumns & {
  id: number;
  uid: string;
  education_id: number | null;
  school: string;
  department: string | null;
  remarks: string | null;
};

type ResumeSkillOverrideRow = { skill_name: string; months_override: number };

type SourceCareerRow = PeriodColumns & {
  id: number;
  organization_name: string;
  organization_name_masked: string | null;
  role: string;
  is_masked: 0 | 1;
  description: string | null;
  url: string | null;
};

type SourceProjectRow = PeriodColumns & {
  id: number;
  organization_name: string;
  organization_name_masked: string | null;
  kind: string;
  title: string;
  title_masked: string;
  is_masked: 0 | 1;
  description: string | null;
  url: string | null;
};

type SourceProjectSkillRow = { project_id: number; name: string; months_override: number | null };

type SourceEducationRow = PeriodColumns & {
  id: number;
  school: string;
  department: string | null;
  remarks: string | null;
};

const periodOf = (row: PeriodColumns): Period => ({
  startedOn: row.started_on as CalendarDate,
  endedOn: row.ended_on as CalendarDate | null,
});

/** 種類は CHECK が 4 値に絞る。読めない値は 001 の `other` と同じ扱いにする */
const kindOf = (value: string): ResumeProjectKind => (isResumeProjectKind(value) ? value : 'other');

const toResume = (row: ResumeRow): Resume => ({
  id: row.id,
  uid: row.uid,
  title: row.title,
  slug: row.slug,
  audience: row.audience,
  status: row.status,
  limitedExpiresAt: row.limited_expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toCareer = (row: ResumeCareerRow): ResumeCareer => ({
  id: row.id,
  uid: row.uid,
  careerId: row.career_id,
  organizationName: row.organization_name,
  role: row.role,
  period: periodOf(row),
  description: row.description,
  url: row.url,
  isMasked: row.is_masked === 1,
});

const toProject = (row: ResumeProjectRow, skills: string[]): ResumeProject => ({
  id: row.id,
  uid: row.uid,
  projectId: row.project_id,
  organizationName: row.organization_name,
  kind: kindOf(row.kind),
  title: row.title,
  period: periodOf(row),
  description: row.description,
  url: row.url,
  isMasked: row.is_masked === 1,
  skills,
});

const toEducation = (row: ResumeEducationRow): ResumeEducation => ({
  id: row.id,
  uid: row.uid,
  educationId: row.education_id,
  school: row.school,
  department: row.department,
  period: periodOf(row),
  remarks: row.remarks,
});

const RESUME_COLUMNS =
  'id, uid, title, slug, audience, status, limited_expires_at, created_at, updated_at';

/** 並びは始まりの日の新しい順。同じ日は id の順（data-model.md） */
const NEWEST_FIRST = 'ORDER BY started_on DESC, id ASC';

/** 写した行の表。管理画面の経路の名前から引く */
const ROW_TABLES: Record<ResumeRowKind, string> = {
  careers: 'resume_career',
  projects: 'resume_project',
  educations: 'resume_education',
};

/** 職務経歴書の id の SQL。作るときは、識別子で入れたばかりの行を指す */
const RESUME_ID_BY_SLUG = '(SELECT id FROM resume WHERE slug = ?)';

/**
 * 楽観ロックの後に続く文の条件（research.md の R8）。先頭の文が更新日時を新しい値にしたときだけ
 * 真になる
 */
const LOCKED = 'EXISTS (SELECT 1 FROM resume WHERE id = ? AND updated_at = ?)';

/** SQL の一部と、その `?` に当てる値 */
type SqlPart = { sql: string; binds: unknown[] };

/** 条件を付けない文の条件。`INSERT … SELECT … ON CONFLICT` は WHERE を要する（SQLite の UPSERT の parsing ambiguity） */
const ALWAYS: SqlPart = { sql: 'true', binds: [] };

export const createD1ResumeRepository = (db: D1Database): ResumeRepository => {
  /**
   * 楽観ロックの先頭の文。開いたときの更新日時と一致し、`rowExists` があればその行もあるときだけ、
   * 更新日時を新しい値にする
   */
  const lockStatement = (
    id: number,
    { openedUpdatedAt, now }: EditTimes,
    row?: { kind: ResumeRowKind; rowId: number },
  ) =>
    row
      ? db
          .prepare(
            `UPDATE resume SET updated_at = ? WHERE id = ? AND updated_at = ?
               AND EXISTS (SELECT 1 FROM ${ROW_TABLES[row.kind]} WHERE id = ? AND resume_id = ?)`,
          )
          .bind(now, id, openedUpdatedAt, row.rowId, id)
      : db
          .prepare('UPDATE resume SET updated_at = ? WHERE id = ? AND updated_at = ?')
          .bind(now, id, openedUpdatedAt);

  const hasRow = async (id: number, kind: ResumeRowKind, rowId: number) =>
    (await db
      .prepare(`SELECT 1 AS found FROM ${ROW_TABLES[kind]} WHERE id = ? AND resume_id = ?`)
      .bind(rowId, id)
      .first()) !== null;

  /** 先頭の文が当たらなかった理由を見分ける。行か職務経歴書が無ければ `not-found` */
  const failureOf = async (
    id: number,
    row?: { kind: ResumeRowKind; rowId: number },
  ): Promise<EditResult> => {
    const current = await db
      .prepare('SELECT updated_at FROM resume WHERE id = ?')
      .bind(id)
      .first<{ updated_at: string }>();
    if (!current) return { ok: false, reason: 'not-found' };
    if (row && !(await hasRow(id, row.kind, row.rowId))) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'conflict' };
  };

  /** 先頭に楽観ロックの文を置いて送る。先頭が当たれば、続く文もすべて当たる */
  const runLocked = async (
    id: number,
    times: EditTimes,
    statements: D1PreparedStatement[],
    row?: { kind: ResumeRowKind; rowId: number },
  ): Promise<EditResult> => {
    const results = await db.batch([lockStatement(id, times, row), ...statements]);
    return (results[0]?.meta.changes ?? 0) > 0 ? { ok: true } : failureOf(id, row);
  };

  /**
   * 写した中身を入れる文（research.md の R4・R14）。作るときと足すときが使う。`resumeId` は
   * 職務経歴書の id を指す SQL とその値、`guard` は各文に付ける条件とその値。
   * 1 つのトランザクションの中で順に入れるため、直前に入れた写した実績が、その職務経歴書の
   * 写した実績のうち id が最も大きい行になる（AUTOINCREMENT は id を戻さない）。
   * 写した経験年数の上書きは、同じ名前の上書きが既にあれば入れない（足すとき、R14）
   */
  const contentStatements = (
    content: NewResumeContent,
    resumeId: SqlPart,
    guard: SqlPart,
  ): D1PreparedStatement[] => {
    const insert = (sql: string, values: unknown[]) =>
      db.prepare(sql).bind(...resumeId.binds, ...values, ...guard.binds);
    const statements: D1PreparedStatement[] = [];
    for (const career of content.careers) {
      statements.push(
        insert(
          `INSERT INTO resume_career (resume_id, career_id, organization_name, role,
             started_on, ended_on, description, url, is_masked)
           SELECT ${resumeId.sql}, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.sql}`,
          [
            career.careerId,
            career.organizationName,
            career.role,
            career.period.startedOn,
            career.period.endedOn,
            career.description,
            career.url,
            career.isMasked ? 1 : 0,
          ],
        ),
      );
    }
    for (const project of content.projects) {
      statements.push(
        insert(
          `INSERT INTO resume_project (resume_id, project_id, organization_name, kind, title,
             started_on, ended_on, description, url, is_masked)
           SELECT ${resumeId.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.sql}`,
          [
            project.projectId,
            project.organizationName,
            project.kind,
            project.title,
            project.period.startedOn,
            project.period.endedOn,
            project.description,
            project.url,
            project.isMasked ? 1 : 0,
          ],
        ),
      );
      for (const skill of new Set(project.skills)) {
        statements.push(
          insert(
            `INSERT INTO resume_project_skill (resume_project_id, skill_name)
             SELECT (SELECT max(id) FROM resume_project WHERE resume_id = ${resumeId.sql}), ?
             WHERE ${guard.sql}`,
            [skill],
          ),
        );
      }
    }
    for (const education of content.educations) {
      statements.push(
        insert(
          `INSERT INTO resume_education (resume_id, education_id, school, department,
             started_on, ended_on, remarks)
           SELECT ${resumeId.sql}, ?, ?, ?, ?, ?, ? WHERE ${guard.sql}`,
          [
            education.educationId,
            education.school,
            education.department,
            education.period.startedOn,
            education.period.endedOn,
            education.remarks,
          ],
        ),
      );
    }
    for (const override of content.skillOverrides) {
      statements.push(
        insert(
          `INSERT INTO resume_skill_override (resume_id, skill_name, months_override)
           SELECT ${resumeId.sql}, ?, ? WHERE ${guard.sql}
           ON CONFLICT (resume_id, skill_name) DO NOTHING`,
          [override.skillName, override.months],
        ),
      );
    }
    return statements;
  };

  const readContent = async (id: number): Promise<ResumeContent> => {
    const [careers, projects, skills, educations, overrides] = await db.batch([
      db
        .prepare(
          `SELECT id, uid, career_id, organization_name, role, started_on, ended_on, description, url,
             is_masked
           FROM resume_career WHERE resume_id = ? ${NEWEST_FIRST}`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT id, uid, project_id, organization_name, kind, title, started_on, ended_on,
             description, url, is_masked
           FROM resume_project WHERE resume_id = ? ${NEWEST_FIRST}`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT s.resume_project_id, s.skill_name FROM resume_project_skill s
           JOIN resume_project p ON p.id = s.resume_project_id
           WHERE p.resume_id = ? ORDER BY s.rowid`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT id, uid, education_id, school, department, started_on, ended_on, remarks
           FROM resume_education WHERE resume_id = ? ${NEWEST_FIRST}`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT skill_name, months_override FROM resume_skill_override
           WHERE resume_id = ? ORDER BY skill_name`,
        )
        .bind(id),
    ]);
    const skillsByProject = new Map<number, string[]>();
    for (const row of skills.results as ResumeProjectSkillRow[]) {
      const list = skillsByProject.get(row.resume_project_id) ?? [];
      list.push(row.skill_name);
      skillsByProject.set(row.resume_project_id, list);
    }
    return {
      careers: (careers.results as ResumeCareerRow[]).map(toCareer),
      projects: (projects.results as ResumeProjectRow[]).map((row) =>
        toProject(row, skillsByProject.get(row.id) ?? []),
      ),
      educations: (educations.results as ResumeEducationRow[]).map(toEducation),
      skillOverrides: (overrides.results as ResumeSkillOverrideRow[]).map((row) => ({
        skillName: row.skill_name,
        months: row.months_override,
      })),
    };
  };

  return {
    readSources: async (selection) => {
      const filter = (column: string) =>
        selection === 'all' ? '' : `WHERE ${column} IN (SELECT value FROM json_each(?))`;
      const bindIds = (statement: D1PreparedStatement, ids: number[]) =>
        selection === 'all' ? statement : statement.bind(JSON.stringify(ids));
      const pick = <K extends 'careerIds' | 'projectIds' | 'educationIds'>(key: K) =>
        selection === 'all' ? [] : selection[key];

      const [careers, projects, skills, educations] = await db.batch([
        bindIds(
          db.prepare(
            `SELECT c.id, o.name AS organization_name, o.name_masked AS organization_name_masked,
               c.role, c.is_masked, c.started_on, c.ended_on, c.description, c.url
             FROM career c JOIN organization o ON o.id = c.organization_id
             ${filter('c.id')} ORDER BY c.started_on DESC, c.id ASC`,
          ),
          pick('careerIds'),
        ),
        bindIds(
          db.prepare(
            `SELECT p.id, o.name AS organization_name, o.name_masked AS organization_name_masked,
               p.kind, p.title, p.title_masked, p.is_masked, p.started_on, p.ended_on,
               p.description, p.url
             FROM project p JOIN organization o ON o.id = p.organization_id
             ${filter('p.id')} ORDER BY p.started_on DESC, p.id ASC`,
          ),
          pick('projectIds'),
        ),
        bindIds(
          db.prepare(
            `SELECT ps.project_id, s.name, s.months_override
             FROM project_skill ps JOIN skill s ON s.id = ps.skill_id
             ${filter('ps.project_id')} ORDER BY s.name`,
          ),
          pick('projectIds'),
        ),
        bindIds(
          db.prepare(
            `SELECT id, school, department, started_on, ended_on, remarks FROM education
             ${filter('id')} ORDER BY started_on DESC, id ASC`,
          ),
          pick('educationIds'),
        ),
      ]);

      const skillsByProject = new Map<number, ResumeSourceProject['skills']>();
      for (const row of skills.results as SourceProjectSkillRow[]) {
        const list = skillsByProject.get(row.project_id) ?? [];
        list.push({ name: row.name, monthsOverride: row.months_override });
        skillsByProject.set(row.project_id, list);
      }
      return {
        careers: (careers.results as SourceCareerRow[]).map((row) => ({
          id: row.id,
          organizationName: row.organization_name,
          organizationNameMasked: row.organization_name_masked,
          role: row.role,
          isMasked: row.is_masked === 1,
          period: periodOf(row),
          description: row.description,
          url: row.url,
        })),
        projects: (projects.results as SourceProjectRow[]).map((row) => ({
          id: row.id,
          organizationName: row.organization_name,
          organizationNameMasked: row.organization_name_masked,
          kind: kindOf(row.kind),
          title: row.title,
          titleMasked: row.title_masked,
          isMasked: row.is_masked === 1,
          period: periodOf(row),
          description: row.description,
          url: row.url,
          skills: skillsByProject.get(row.id) ?? [],
        })),
        educations: (educations.results as SourceEducationRow[]).map((row) => ({
          id: row.id,
          school: row.school,
          department: row.department,
          period: periodOf(row),
          remarks: row.remarks,
        })),
      };
    },

    create: async ({ slug, title, audience, limitedExpiresAt, content }) => {
      const results = await db.batch<{ id: number; uid: string; updated_at: string }>([
        db
          .prepare(
            `INSERT INTO resume (slug, title, audience, limited_expires_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(slug, title, audience, limitedExpiresAt),
        ...contentStatements(content, { sql: RESUME_ID_BY_SLUG, binds: [slug] }, ALWAYS),
        db.prepare('SELECT id, uid, updated_at FROM resume WHERE slug = ?').bind(slug),
      ]);
      const row = results.at(-1)?.results[0];
      if (row === undefined) throw new Error('作った職務経歴書を読めなかった');
      return { id: row.id, uid: row.uid, updatedAt: row.updated_at };
    },

    addRows: (id, content, times) =>
      runLocked(
        id,
        times,
        contentStatements(
          content,
          { sql: '?', binds: [id] },
          { sql: LOCKED, binds: [id, times.now] },
        ),
      ),

    list: async () => {
      const { results } = await db
        .prepare(`SELECT ${RESUME_COLUMNS} FROM resume ORDER BY created_at DESC, id DESC`)
        .all<ResumeRow>();
      return results.map(toResume);
    },

    findForEdit: async (id) => {
      const row = await db
        .prepare(`SELECT ${RESUME_COLUMNS} FROM resume WHERE id = ?`)
        .bind(id)
        .first<ResumeRow>();
      return row ? { ...toResume(row), ...(await readContent(id)) } : null;
    },

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM resume WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,

    findRowIdByUid: async (id, kind, rowUid) =>
      (
        await db
          .prepare(`SELECT id FROM ${ROW_TABLES[kind]} WHERE uid = ? AND resume_id = ?`)
          .bind(rowUid, id)
          .first<{ id: number }>()
      )?.id ?? null,

    findLimitedIdForVisitor: async (slug, now) => {
      // 条件はすべて WHERE で弾く（research.md の R6）。`limited_expires_at` は CHECK が
      // `now` と同じ形に揃えるため、文字列の比較が日時の比較になる
      const row = await db
        .prepare(
          `SELECT id FROM resume
           WHERE slug = ? AND audience = 'limited' AND status = 'published'
             AND (limited_expires_at IS NULL OR limited_expires_at > ?)`,
        )
        .bind(slug, now)
        .first<{ id: number }>();
      return row?.id ?? null;
    },

    readContent,

    // `resume` の列は、楽観ロックと同じ 1 つの文で書く。2 つ目の文で `resume` を書くと、
    // 更新日時を変えない UPDATE としてトリガ `resume_updated_at` が更新日時を書き換える
    editSettings: async (id, { title, limitedExpiresAt }, { openedUpdatedAt, now }) => {
      // 公開用は期限を持たない（`resume` の CHECK）。限定公開用だけ期限を書く
      const result = await db
        .prepare(
          `UPDATE resume SET title = ?,
             limited_expires_at = CASE WHEN audience = 'limited' THEN ? ELSE NULL END,
             updated_at = ?
           WHERE id = ? AND updated_at = ?`,
        )
        .bind(title, limitedExpiresAt, now, id, openedUpdatedAt)
        .run();
      return result.meta.changes > 0 ? { ok: true } : failureOf(id);
    },

    changeStatus: async (id, status, { openedUpdatedAt, now }) => {
      const result = await db
        .prepare('UPDATE resume SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?')
        .bind(status, now, id, openedUpdatedAt)
        .run();
      return result.meta.changes > 0 ? { ok: true } : failureOf(id);
    },

    regenerateLimitedSlug: async (id, slug, { openedUpdatedAt, now }) => {
      const result = await db
        .prepare(
          `UPDATE resume SET slug = ?, updated_at = ?
           WHERE id = ? AND audience = 'limited' AND updated_at = ?`,
        )
        .bind(slug, now, id, openedUpdatedAt)
        .run();
      if (result.meta.changes > 0) return { ok: true };
      // 公開用の識別子は出し直さない（FR-037・FR-039）。無い id と同じに扱う
      const current = await db
        .prepare('SELECT audience FROM resume WHERE id = ?')
        .bind(id)
        .first<{ audience: string }>();
      return current?.audience === 'limited'
        ? { ok: false, reason: 'conflict' }
        : { ok: false, reason: 'not-found' };
    },

    editCareer: (id, rowId, content, times) =>
      runLocked(
        id,
        times,
        [
          db
            .prepare(
              `UPDATE resume_career SET organization_name = ?, role = ?, started_on = ?,
                 ended_on = ?, description = ?, url = ?
               WHERE id = ? AND resume_id = ? AND ${LOCKED}`,
            )
            .bind(
              content.organizationName,
              content.role,
              content.period.startedOn,
              content.period.endedOn,
              content.description,
              content.url,
              rowId,
              id,
              id,
              times.now,
            ),
        ],
        { kind: 'careers', rowId },
      ),

    editProject: (id, rowId, content, times) =>
      runLocked(
        id,
        times,
        [
          db
            .prepare(
              `UPDATE resume_project SET organization_name = ?, kind = ?, title = ?,
                 started_on = ?, ended_on = ?, description = ?, url = ?
               WHERE id = ? AND resume_id = ? AND ${LOCKED}`,
            )
            .bind(
              content.organizationName,
              content.kind,
              content.title,
              content.period.startedOn,
              content.period.endedOn,
              content.description,
              content.url,
              rowId,
              id,
              id,
              times.now,
            ),
          db
            .prepare(`DELETE FROM resume_project_skill WHERE resume_project_id = ? AND ${LOCKED}`)
            .bind(rowId, id, times.now),
          ...[...new Set(content.skills)].map((skill) =>
            db
              .prepare(
                `INSERT INTO resume_project_skill (resume_project_id, skill_name)
                 SELECT ?, ? WHERE ${LOCKED}`,
              )
              .bind(rowId, skill, id, times.now),
          ),
        ],
        { kind: 'projects', rowId },
      ),

    editEducation: (id, rowId, content, times) =>
      runLocked(
        id,
        times,
        [
          db
            .prepare(
              `UPDATE resume_education SET school = ?, department = ?, started_on = ?,
                 ended_on = ?, remarks = ?
               WHERE id = ? AND resume_id = ? AND ${LOCKED}`,
            )
            .bind(
              content.school,
              content.department,
              content.period.startedOn,
              content.period.endedOn,
              content.remarks,
              rowId,
              id,
              id,
              times.now,
            ),
        ],
        { kind: 'educations', rowId },
      ),

    editSkillOverrides: (id, overrides, times) =>
      runLocked(id, times, [
        db
          .prepare(`DELETE FROM resume_skill_override WHERE resume_id = ? AND ${LOCKED}`)
          .bind(id, id, times.now),
        ...overrides.map((override) =>
          db
            .prepare(
              `INSERT INTO resume_skill_override (resume_id, skill_name, months_override)
               SELECT ?, ?, ? WHERE ${LOCKED}`,
            )
            .bind(id, override.skillName, override.months, id, times.now),
        ),
      ]),

    delete: async (id) => {
      // 外部キーはすべて NO ACTION のため、子の行から消す（research.md の R9）
      const results = await db.batch([
        db
          .prepare(
            `DELETE FROM resume_project_skill
             WHERE resume_project_id IN (SELECT id FROM resume_project WHERE resume_id = ?)`,
          )
          .bind(id),
        db.prepare('DELETE FROM resume_project WHERE resume_id = ?').bind(id),
        db.prepare('DELETE FROM resume_career WHERE resume_id = ?').bind(id),
        db.prepare('DELETE FROM resume_education WHERE resume_id = ?').bind(id),
        db.prepare('DELETE FROM resume_skill_override WHERE resume_id = ?').bind(id),
        db.prepare('DELETE FROM resume WHERE id = ?').bind(id),
      ]);
      return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
    },

    hasId: async (id) =>
      (await db.prepare('SELECT 1 AS found FROM resume WHERE id = ?').bind(id).first()) !== null,
  };
};
