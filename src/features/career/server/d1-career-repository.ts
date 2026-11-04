import 'server-only';

import type { Career, CareerContent } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { CalendarDate } from '@/shared/domain/period';
import { findOrCreateOrganizationStatements } from '@/shared/server/organization-repository';

/**
 * `CareerRepository` の D1 の実装。行の型はこのファイルの中だけに置く（research.md の R3）。
 * 複数の文は 1 つの `batch()`（1 つのトランザクション）で送る（R2）
 */

type CareerRow = {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_name_masked: string | null;
  role: string;
  is_masked: 0 | 1;
  started_on: string;
  ended_on: string | null;
  description: string | null;
  url: string | null;
  updated_at: string;
};

const toPeriod = (row: { started_on: string; ended_on: string | null }) => ({
  startedOn: row.started_on as CalendarDate,
  endedOn: row.ended_on as CalendarDate | null,
});

const toCareer = (row: CareerRow): Career => ({
  id: row.id,
  organization: {
    id: row.organization_id,
    name: row.organization_name,
    nameMasked: row.organization_name_masked,
  },
  role: row.role,
  isMasked: row.is_masked === 1,
  period: toPeriod(row),
  description: row.description,
  url: row.url,
  updatedAt: row.updated_at,
});

const ORGANIZATION_ID_BY_NAME = '(SELECT id FROM organization WHERE name = ?)';

/** 秘匿化する職歴が、秘匿化した組織名を持つ組織を指すときだけ真になる条件（FR-001） */
const MASKING_ALLOWED =
  '(? = 0 OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))';

export const createD1CareerRepository = (db: D1Database): CareerRepository => {
  const organizationStatements = (content: CareerContent) =>
    findOrCreateOrganizationStatements(
      db,
      content.organizationName,
      content.organizationNameMasked,
    );

  const contentValues = (content: CareerContent) => [
    content.role,
    content.isMasked ? 1 : 0,
    content.period.startedOn,
    content.period.endedOn,
    content.description,
    content.url,
  ];
  const maskingValues = (content: CareerContent) => [
    content.isMasked ? 1 : 0,
    content.organizationName,
  ];

  return {
    findForEdit: async (id) => {
      const row = await db
        .prepare(
          `SELECT c.id, c.organization_id, o.name AS organization_name,
             o.name_masked AS organization_name_masked, c.role, c.is_masked, c.started_on,
             c.ended_on, c.description, c.url, c.updated_at
           FROM career c JOIN organization o ON o.id = c.organization_id WHERE c.id = ?`,
        )
        .bind(id)
        .first<CareerRow>();
      return row ? toCareer(row) : null;
    },

    list: async () => {
      const { results } = await db
        .prepare(
          `SELECT c.id, c.role, c.is_masked, c.started_on, c.ended_on,
             o.name AS organization_name
           FROM career c JOIN organization o ON o.id = c.organization_id
           ORDER BY c.started_on DESC, c.id DESC`,
        )
        .all<
          Pick<CareerRow, 'id' | 'role' | 'is_masked' | 'started_on' | 'ended_on'> & {
            organization_name: string;
          }
        >();
      return results.map((row) => ({
        id: row.id,
        role: row.role,
        isMasked: row.is_masked === 1,
        period: toPeriod(row),
        organizationName: row.organization_name,
      }));
    },

    register: async (content) => {
      const insert = db
        .prepare(
          `INSERT INTO career (organization_id, role, is_masked, started_on, ended_on,
             description, url)
           SELECT ${ORGANIZATION_ID_BY_NAME}, ?, ?, ?, ?, ?, ?
           WHERE ${MASKING_ALLOWED}
           RETURNING id`,
        )
        .bind(content.organizationName, ...contentValues(content), ...maskingValues(content));
      const results = await db.batch<{ id: number }>([...organizationStatements(content), insert]);
      const id = results.at(-1)?.results[0]?.id;
      return id === undefined ? { ok: false, reason: 'masked-name-required' } : { ok: true, id };
    },

    edit: async (id, content, { openedUpdatedAt, now }) => {
      const update = db
        .prepare(
          `UPDATE career SET organization_id = ${ORGANIZATION_ID_BY_NAME}, role = ?,
             is_masked = ?, started_on = ?, ended_on = ?, description = ?, url = ?,
             updated_at = ?
           WHERE id = ? AND updated_at = ? AND ${MASKING_ALLOWED}`,
        )
        .bind(
          content.organizationName,
          ...contentValues(content),
          now,
          id,
          openedUpdatedAt,
          ...maskingValues(content),
        );
      const results = await db.batch([...organizationStatements(content), update]);
      if ((results.at(-1)?.meta.changes ?? 0) > 0) return { ok: true };

      // 当たらなかった理由を見分ける。更新日時が違えば、先に書き換えられていた
      const current = await db
        .prepare('SELECT updated_at FROM career WHERE id = ?')
        .bind(id)
        .first<{ updated_at: string }>();
      return current?.updated_at === openedUpdatedAt
        ? { ok: false, reason: 'masked-name-required' }
        : { ok: false, reason: 'conflict' };
    },

    delete: async (id) => {
      // 写した職務経歴書の行は残し、指す id を空にする（research.md の R8）。
      // R2 の画像は、画像を扱うまで無い（plan.md の U5）
      const results = await db.batch([
        db.prepare('UPDATE resume_career SET career_id = NULL WHERE career_id = ?').bind(id),
        db.prepare('DELETE FROM media WHERE career_id = ?').bind(id),
        db.prepare('DELETE FROM career WHERE id = ?').bind(id),
      ]);
      return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
    },

    hasId: async (id) =>
      (await db.prepare('SELECT 1 AS found FROM career WHERE id = ?').bind(id).first()) !== null,
  };
};
