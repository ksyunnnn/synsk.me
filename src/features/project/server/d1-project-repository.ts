import 'server-only';

import type {
  MaskedVisitorProject,
  Project,
  ProjectContent,
  ProjectKind,
  ProjectSummary,
  UnmaskedVisitorProject,
} from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import type { CalendarDate } from '@/shared/domain/period';
import { findOrCreateOrganizationStatements } from '@/shared/server/organization-repository';

/**
 * `ProjectRepository` の D1 の実装。行の型はこのファイルの中だけに置き、domain の型に
 * 詰め替える（specs/001-career-and-project/research.md の R3）。列と CHECK の正本は
 * migrations/ にある。複数の文は 1 つの `batch()`（1 つのトランザクション）で送る（R2）
 */

type ProjectRow = {
  id: number;
  slug: string;
  organization_id: number;
  organization_name: string;
  organization_name_masked: string | null;
  kind: ProjectKind;
  title: string;
  title_masked: string;
  is_masked: 0 | 1;
  started_on: string;
  ended_on: string | null;
  description: string | null;
  url: string | null;
  updated_at: string;
};

/** 秘匿化しない実績の訪問者向けの列 */
type UnmaskedVisitorRow = {
  slug: string;
  kind: ProjectKind;
  title: string;
  organization_name: string;
  started_on: string;
  ended_on: string | null;
  description: string | null;
  url: string | null;
};

/**
 * 秘匿化した実績の訪問者向けの列。`project.title`・`organization.name`・`project.description`・
 * `project.url`・`project.card_media_id` を持たない（contracts/visitor-project.md）
 */
type MaskedVisitorRow = {
  slug: string;
  kind: ProjectKind;
  title_masked: string;
  organization_name_masked: string | null;
  started_on: string;
  ended_on: string | null;
};

const toPeriod = (row: { started_on: string; ended_on: string | null }) => ({
  startedOn: row.started_on as CalendarDate,
  endedOn: row.ended_on as CalendarDate | null,
});

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  slug: row.slug,
  organization: {
    id: row.organization_id,
    name: row.organization_name,
    nameMasked: row.organization_name_masked,
  },
  kind: row.kind,
  title: row.title,
  titleMasked: row.title_masked,
  isMasked: row.is_masked === 1,
  period: toPeriod(row),
  description: row.description,
  url: row.url,
  updatedAt: row.updated_at,
});

const EDIT_COLUMNS = `
  p.id, p.slug, p.organization_id, o.name AS organization_name,
  o.name_masked AS organization_name_masked, p.kind, p.title, p.title_masked, p.is_masked,
  p.started_on, p.ended_on, p.description, p.url, p.updated_at`;

/** 組織名から組織の id を読む部分。組織の行は同じ batch の先の文が作る */
const ORGANIZATION_ID_BY_NAME = '(SELECT id FROM organization WHERE name = ?)';

/**
 * 秘匿化する実績が、秘匿化した組織名を持つ組織を指すときだけ真になる条件（FR-001）。
 * 秘匿化しない実績では常に真。束ねる値は、秘匿化するか（0 か 1）と組織名
 */
const MASKING_ALLOWED =
  '(? = 0 OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))';

const isSlugTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: project.slug');

export const createD1ProjectRepository = (db: D1Database): ProjectRepository => {
  const organizationStatements = (content: ProjectContent) =>
    findOrCreateOrganizationStatements(
      db,
      content.organizationName,
      content.organizationNameMasked,
    );

  const contentValues = (content: ProjectContent & { slug: string }) => [
    content.kind,
    content.slug,
    content.title,
    content.titleMasked,
    content.isMasked ? 1 : 0,
    content.period.startedOn,
    content.period.endedOn,
    content.description,
    content.url,
  ];

  return {
    findVisitorBySlug: async (slug) => {
      // 秘匿化するかで、読む列を分ける。どちらか一方だけが行を返す（research.md の R5）
      const [unmasked, masked, skills] = await db.batch<
        UnmaskedVisitorRow | MaskedVisitorRow | { name: string }
      >([
        db
          .prepare(
            `SELECT p.slug, p.kind, p.title, o.name AS organization_name, p.started_on,
               p.ended_on, p.description, p.url
             FROM project p JOIN organization o ON o.id = p.organization_id
             WHERE p.slug = ? AND p.is_masked = 0`,
          )
          .bind(slug),
        db
          .prepare(
            `SELECT p.slug, p.kind, p.title_masked, o.name_masked AS organization_name_masked,
               p.started_on, p.ended_on
             FROM project p JOIN organization o ON o.id = p.organization_id
             WHERE p.slug = ? AND p.is_masked = 1`,
          )
          .bind(slug),
        db
          .prepare(
            `SELECT s.name FROM project_skill ps
             JOIN skill s ON s.id = ps.skill_id
             JOIN project p ON p.id = ps.project_id
             WHERE p.slug = ? ORDER BY s.name`,
          )
          .bind(slug),
      ]);
      const skillNames = (skills.results as { name: string }[]).map((row) => row.name);

      const unmaskedRow = unmasked.results[0] as UnmaskedVisitorRow | undefined;
      if (unmaskedRow) {
        const dto: UnmaskedVisitorProject = {
          isMasked: false,
          slug: unmaskedRow.slug,
          kind: unmaskedRow.kind,
          title: unmaskedRow.title,
          organizationName: unmaskedRow.organization_name,
          period: toPeriod(unmaskedRow),
          skills: skillNames,
          body: unmaskedRow.description,
          url: unmaskedRow.url,
        };
        return dto;
      }
      const maskedRow = masked.results[0] as MaskedVisitorRow | undefined;
      if (maskedRow) {
        const dto: MaskedVisitorProject = {
          isMasked: true,
          slug: maskedRow.slug,
          kind: maskedRow.kind,
          title: maskedRow.title_masked,
          organizationName: maskedRow.organization_name_masked,
          period: toPeriod(maskedRow),
          skills: skillNames,
        };
        return dto;
      }
      return null;
    },

    findForEdit: async (id) => {
      const row = await db
        .prepare(
          `SELECT ${EDIT_COLUMNS} FROM project p JOIN organization o ON o.id = p.organization_id
           WHERE p.id = ?`,
        )
        .bind(id)
        .first<ProjectRow>();
      return row ? toProject(row) : null;
    },

    list: async () => {
      const { results } = await db
        .prepare(
          `SELECT p.id, p.slug, p.kind, p.title, p.is_masked, p.started_on, p.ended_on,
             o.name AS organization_name
           FROM project p JOIN organization o ON o.id = p.organization_id
           ORDER BY p.started_on DESC, p.id DESC`,
        )
        .all<
          Pick<
            ProjectRow,
            'id' | 'slug' | 'kind' | 'title' | 'is_masked' | 'started_on' | 'ended_on'
          > & {
            organization_name: string;
          }
        >();
      return results.map((row): ProjectSummary => ({
        id: row.id,
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        isMasked: row.is_masked === 1,
        period: toPeriod(row),
        organizationName: row.organization_name,
      }));
    },

    register: async (content) => {
      const insert = db
        .prepare(
          `INSERT INTO project (organization_id, kind, slug, title, title_masked, is_masked,
             started_on, ended_on, description, url)
           SELECT ${ORGANIZATION_ID_BY_NAME}, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE ${MASKING_ALLOWED}
           RETURNING id`,
        )
        .bind(
          content.organizationName,
          ...contentValues(content),
          content.isMasked ? 1 : 0,
          content.organizationName,
        );
      try {
        const results = await db.batch<{ id: number }>([
          ...organizationStatements(content),
          insert,
        ]);
        const id = results.at(-1)?.results[0]?.id;
        return id === undefined ? { ok: false, reason: 'masked-name-required' } : { ok: true, id };
      } catch (error) {
        if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
        throw error;
      }
    },

    edit: async (id, content, { openedUpdatedAt, now }) => {
      const update = db
        .prepare(
          `UPDATE project SET organization_id = ${ORGANIZATION_ID_BY_NAME}, kind = ?, slug = ?,
             title = ?, title_masked = ?, is_masked = ?, started_on = ?, ended_on = ?,
             description = ?, url = ?, updated_at = ?
           WHERE id = ? AND updated_at = ? AND ${MASKING_ALLOWED}`,
        )
        .bind(
          content.organizationName,
          ...contentValues(content),
          now,
          id,
          openedUpdatedAt,
          content.isMasked ? 1 : 0,
          content.organizationName,
        );
      let changes: number;
      try {
        const results = await db.batch([...organizationStatements(content), update]);
        changes = results.at(-1)?.meta.changes ?? 0;
      } catch (error) {
        if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
        throw error;
      }
      if (changes > 0) return { ok: true };

      // 当たらなかった理由を見分ける。更新日時が違えば、先に書き換えられていた
      const current = await db
        .prepare('SELECT updated_at FROM project WHERE id = ?')
        .bind(id)
        .first<{ updated_at: string }>();
      return current?.updated_at === openedUpdatedAt
        ? { ok: false, reason: 'masked-name-required' }
        : { ok: false, reason: 'conflict' };
    },

    delete: async (id) => {
      // 外部キーは NO ACTION のため、子の行を先に空にするか消す（research.md の R8）。
      // 写した職務経歴書の行は残す。R2 の画像は、画像を扱うまで無い（plan.md の U5）
      const results = await db.batch([
        db.prepare('UPDATE resume_project SET project_id = NULL WHERE project_id = ?').bind(id),
        db.prepare('UPDATE project SET card_media_id = NULL WHERE id = ?').bind(id),
        db.prepare('DELETE FROM project_skill WHERE project_id = ?').bind(id),
        db.prepare('DELETE FROM media WHERE project_id = ?').bind(id),
        db.prepare('DELETE FROM project WHERE id = ?').bind(id),
      ]);
      return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
    },

    hasSlug: async (slug) =>
      (await db.prepare('SELECT 1 AS found FROM project WHERE slug = ?').bind(slug).first()) !==
      null,

    hasId: async (id) =>
      (await db.prepare('SELECT 1 AS found FROM project WHERE id = ?').bind(id).first()) !== null,
  };
};
