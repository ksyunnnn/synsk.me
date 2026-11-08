import 'server-only';

import type { Career, CareerContent } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import { IMAGE_MAX_COUNT, toImageFile } from '@/shared/domain/media-image';
import type { CalendarDate } from '@/shared/domain/period';
import type { SiteStatus } from '@/shared/domain/site-status';
import {
  MASKING_ALLOWED,
  ORGANIZATION_ID_BY_NAME,
  editGuard,
  findOrCreateOrganizationStatements,
  registerGuard,
} from '@/shared/server/organization-repository';

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

const toCareer = (row: CareerRow, images: string[]): Career => ({
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
  images: images.map(toImageFile),
  updatedAt: row.updated_at,
});

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
    listProjectsOfOrganization: async (organizationId, scope) => {
      // 職歴は project を import せず、要る列だけを SQL で読む（ADR-0026）
      const published = scope === 'published' ? "AND p.status = 'published'" : '';
      const [projects, skills] = await db.batch([
        db
          .prepare(
            `SELECT p.id, p.organization_id, p.title, p.started_on, p.ended_on FROM project p
             WHERE p.organization_id = ? ${published}
             ORDER BY p.started_on DESC, p.id DESC`,
          )
          .bind(organizationId),
        db
          .prepare(
            `SELECT ps.project_id, s.name FROM project_skill ps
             JOIN skill s ON s.id = ps.skill_id
             JOIN project p ON p.id = ps.project_id
             WHERE p.organization_id = ? ${published}`,
          )
          .bind(organizationId),
      ]);
      const skillsByProject = new Map<number, string[]>();
      for (const row of skills.results as { project_id: number; name: string }[]) {
        skillsByProject.set(row.project_id, [
          ...(skillsByProject.get(row.project_id) ?? []),
          row.name,
        ]);
      }
      return (
        projects.results as {
          id: number;
          organization_id: number;
          title: string;
          started_on: string;
          ended_on: string | null;
        }[]
      ).map((row) => ({
        organizationId: row.organization_id,
        title: row.title,
        period: toPeriod(row),
        skills: skillsByProject.get(row.id) ?? [],
      }));
    },

    findForEdit: async (id) => {
      const [career, media] = await db.batch<CareerRow | { storage_key: string }>([
        db
          .prepare(
            `SELECT c.id, c.uid, c.organization_id, o.name AS organization_name,
               o.name_masked AS organization_name_masked, c.role, c.is_masked, c.status,
               c.started_on, c.ended_on, c.description, c.url, c.updated_at
             FROM career c JOIN organization o ON o.id = c.organization_id WHERE c.id = ?`,
          )
          .bind(id),
        db.prepare('SELECT storage_key FROM media WHERE career_id = ? ORDER BY id').bind(id),
      ]);
      const row = career.results[0] as CareerRow | undefined;
      const keys = (media.results as { storage_key: string }[]).map((r) => r.storage_key);
      return row ? toCareer(row, keys) : null;
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
        ...organizationStatements(content, editGuard('career', id, openedUpdatedAt, content)),
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
      // 消す画像の R2 のキーを、同じトランザクションの初めに読む
      const results = await db.batch<{ storage_key: string }>([
        db.prepare('SELECT storage_key FROM media WHERE career_id = ?').bind(id),
        db.prepare('UPDATE resume_career SET career_id = NULL WHERE career_id = ?').bind(id),
        db.prepare('DELETE FROM media WHERE career_id = ?').bind(id),
        db.prepare('DELETE FROM career WHERE id = ?').bind(id),
      ]);
      if ((results.at(-1)?.meta.changes ?? 0) === 0) return { ok: false };
      return { ok: true, storageKeys: results[0].results.map((row) => row.storage_key) };
    },

    addImage: async (id, storageKey) => {
      const result = await db
        .prepare(
          `INSERT INTO media (career_id, storage_key) SELECT ?, ?
           WHERE EXISTS (SELECT 1 FROM career WHERE id = ?)
             AND (SELECT count(*) FROM media WHERE career_id = ?) < ?`,
        )
        .bind(id, storageKey, id, id, IMAGE_MAX_COUNT)
        .run();
      if (result.meta.changes > 0) return { ok: true };
      const exists = await db.prepare('SELECT 1 FROM career WHERE id = ?').bind(id).first();
      return { ok: false, reason: exists ? 'too-many-images' : 'not-found' };
    },

    findOwnerImage: async (id, storageKey) =>
      (
        await db
          .prepare('SELECT storage_key FROM media WHERE career_id = ? AND storage_key = ?')
          .bind(id, storageKey)
          .first<{ storage_key: string }>()
      )?.storage_key ?? null,

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM career WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,
  };
};
