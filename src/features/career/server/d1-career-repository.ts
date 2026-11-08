import 'server-only';

import type { Career, CareerContent } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { CalendarDate } from '@/shared/domain/period';
import type { SiteStatus } from '@/shared/domain/site-status';
import { findOrCreateOrganizationStatements } from '@/shared/server/organization-repository';

/**
 * `CareerRepository` の D1 の実装。行の型はこのファイルの中だけに置く（research.md の R3）。
 * 複数の文は 1 つの `batch()`（1 つのトランザクション）で送る（R2）
 */

type CareerRow = {
  id: number;
  uid: string;
  organization_id: number;
  organization_name: string;
  organization_name_masked: string | null;
  role: string;
  is_masked: 0 | 1;
  status: SiteStatus;
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
  uid: row.uid,
  organization: {
    id: row.organization_id,
    name: row.organization_name,
    nameMasked: row.organization_name_masked,
  },
  role: row.role,
  isMasked: row.is_masked === 1,
  status: row.status,
  period: toPeriod(row),
  description: row.description,
  url: row.url,
  updatedAt: row.updated_at,
});

const ORGANIZATION_ID_BY_NAME = '(SELECT id FROM organization WHERE name = ?)';

/** 秘匿化する職歴が、秘匿化した組織名を持つ組織を指すときだけ真になる条件（FR-001） */
const MASKING_ALLOWED =
  '(? = 0 OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))';

/**
 * 登録の INSERT が当たるときだけ真になる条件。組織を探して作る文に渡し、拒まれる登録では組織も
 * 書かない（docs/SOFTWARE_DESIGN.md の設計原則 1）。秘匿化した組織名を渡す保存は、組織を探して
 * 作る文がその組織名を入れるため、`MASKING_ALLOWED` を満たす
 */
const registerGuard = (content: CareerContent) => ({
  sql: `(? = 0 OR ? IS NOT NULL
    OR EXISTS (SELECT 1 FROM organization WHERE name = ? AND name_masked IS NOT NULL))`,
  values: [content.isMasked ? 1 : 0, content.organizationNameMasked, content.organizationName],
});

/**
 * 編集の UPDATE が当たるときだけ真になる条件。行があり、更新日時が開いたときと同じで、
 * `registerGuard` を満たす
 */
const editGuard = (id: number, openedUpdatedAt: string, content: CareerContent) => {
  const masking = registerGuard(content);
  return {
    sql: `(EXISTS (SELECT 1 FROM career WHERE id = ? AND updated_at = ?) AND ${masking.sql})`,
    values: [id, openedUpdatedAt, ...masking.values],
  };
};

export const createD1CareerRepository = (db: D1Database): CareerRepository => {
  const organizationStatements = (
    content: CareerContent,
    guard?: Parameters<typeof findOrCreateOrganizationStatements>[3],
  ) =>
    findOrCreateOrganizationStatements(
      db,
      content.organizationName,
      content.organizationNameMasked,
      guard,
    );

  const contentValues = (content: CareerContent) => [
    content.role,
    content.isMasked ? 1 : 0,
    content.status,
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
          `SELECT c.id, c.uid, c.organization_id, o.name AS organization_name,
             o.name_masked AS organization_name_masked, c.role, c.is_masked, c.status, c.started_on,
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
          `SELECT c.id, c.uid, c.role, c.is_masked, c.status, c.started_on, c.ended_on,
             o.name AS organization_name
           FROM career c JOIN organization o ON o.id = c.organization_id
           ORDER BY c.started_on DESC, c.id DESC`,
        )
        .all<
          Pick<
            CareerRow,
            'id' | 'uid' | 'role' | 'is_masked' | 'status' | 'started_on' | 'ended_on'
          > & {
            organization_name: string;
          }
        >();
      return results.map((row) => ({
        id: row.id,
        uid: row.uid,
        role: row.role,
        isMasked: row.is_masked === 1,
        status: row.status,
        period: toPeriod(row),
        organizationName: row.organization_name,
      }));
    },

    register: async (content) => {
      const insert = db
        .prepare(
          `INSERT INTO career (organization_id, role, is_masked, status, started_on, ended_on,
             description, url)
           SELECT ${ORGANIZATION_ID_BY_NAME}, ?, ?, ?, ?, ?, ?, ?
           WHERE ${MASKING_ALLOWED}
           RETURNING id, uid`,
        )
        .bind(content.organizationName, ...contentValues(content), ...maskingValues(content));
      const results = await db.batch<{ id: number; uid: string }>([
        ...organizationStatements(content, registerGuard(content)),
        insert,
      ]);
      const row = results.at(-1)?.results[0];
      return row === undefined
        ? { ok: false, reason: 'masked-name-required' }
        : { ok: true, id: row.id, uid: row.uid };
    },

    edit: async (id, content, { openedUpdatedAt, now }) => {
      const update = db
        .prepare(
          `UPDATE career SET organization_id = ${ORGANIZATION_ID_BY_NAME}, role = ?,
             is_masked = ?, status = ?, started_on = ?, ended_on = ?, description = ?, url = ?,
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
      const results = await db.batch([
        ...organizationStatements(content, editGuard(id, openedUpdatedAt, content)),
        update,
      ]);
      if ((results.at(-1)?.meta.changes ?? 0) > 0) return { ok: true };

      // 当たらなかった理由を見分ける。行が無ければ消されていた。更新日時が違えば、先に
      // 書き換えられていた
      const current = await db
        .prepare('SELECT updated_at FROM career WHERE id = ?')
        .bind(id)
        .first<{ updated_at: string }>();
      if (!current) return { ok: false, reason: 'not-found' };
      return current.updated_at === openedUpdatedAt
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

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM career WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,

    hasId: async (id) =>
      (await db.prepare('SELECT 1 AS found FROM career WHERE id = ?').bind(id).first()) !== null,
  };
};
