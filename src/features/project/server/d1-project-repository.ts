import 'server-only';

import type {
  MaskedVisitorProject,
  Project,
  ProjectContent,
  ProjectSummary,
  UnmaskedVisitorProject,
} from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import { readMarkdown } from '@/shared/domain/markdown';
import type { CalendarDate } from '@/shared/domain/period';
import type { SiteStatus } from '@/shared/domain/site-status';
import {
  MASKING_ALLOWED,
  ORGANIZATION_ID_BY_NAME,
  editGuard,
  findOrCreateOrganizationStatements,
  registerGuard,
} from '@/shared/server/organization-repository';
import type { ProjectKind } from '@/shared/domain/project-kind';

/**
 * `ProjectRepository` の D1 の実装。行の型はこのファイルの中だけに置き、domain の型に
 * 詰め替える（specs/001-career-and-project/research.md の R3）。列と CHECK の正本は
 * migrations/ にある。複数の文は 1 つの `batch()`（1 つのトランザクション）で送る（R2）
 */

type ProjectRow = {
  id: number;
  uid: string;
  slug: string;
  organization_id: number;
  organization_name: string;
  organization_name_masked: string | null;
  kind: ProjectKind;
  title: string;
  title_masked: string;
  is_masked: 0 | 1;
  status: SiteStatus;
  started_on: string;
  ended_on: string | null;
  description: string | null;
  url: string | null;
  card_storage_key: string | null;
  updated_at: string;
};

/** オーナーの一覧の列 */
type ProjectListRow = Pick<
  ProjectRow,
  | 'id'
  | 'uid'
  | 'slug'
  | 'kind'
  | 'title'
  | 'is_masked'
  | 'status'
  | 'started_on'
  | 'ended_on'
  | 'description'
  | 'card_storage_key'
> & { organization_name: string };

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
  card_storage_key: string | null;
};

/**
 * 秘匿化した実績の訪問者向けの列。`project.title`・`organization.name`・`project.description`・
 * `project.url`・`project.card_media_id` を持たない（contracts/visitor-project.md）
 */
type MaskedVisitorRow = {
  slug: string;
  kind: ProjectKind;
  title_masked: string;
  /** 取り出しの条件で、NULL の行を読まない */
  organization_name_masked: string;
  started_on: string;
  ended_on: string | null;
};

const toPeriod = (row: { started_on: string; ended_on: string | null }) => ({
  startedOn: row.started_on as CalendarDate,
  endedOn: row.ended_on as CalendarDate | null,
});

const toProject = (row: ProjectRow, skillIds: number[], mediaStorageKeys: string[]): Project => ({
  id: row.id,
  uid: row.uid,
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
  status: row.status,
  period: toPeriod(row),
  description: row.description,
  url: row.url,
  skillIds,
  mediaStorageKeys,
  cardMediaKey: row.card_storage_key,
  updatedAt: row.updated_at,
});

const EDIT_COLUMNS = `
  p.id, p.uid, p.slug, p.organization_id, o.name AS organization_name,
  o.name_masked AS organization_name_masked, p.kind, p.title, p.title_masked, p.is_masked,
  p.status, p.started_on, p.ended_on, p.description, p.url, cm.storage_key AS card_storage_key,
  p.updated_at`;

/** 代表画像の行。`card_media_id` は複合の外部キーで、その実績の画像だけを指す */
const CARD_MEDIA_JOIN = 'LEFT JOIN media cm ON cm.id = p.card_media_id';

/**
 * 訪問者に出してよい実績の条件。サイトに載せる実績だけを出す（spec の FR-045）。秘匿化した
 * 実績は、組織が秘匿化した組織名を持つときだけ出す。持たなければ、実際の組織名を出す代わりに
 * 出さない（plan.md の U2 の決定、research.md の R5）。保存のときにも止めるが、DB のトリガは
 * 無いため、取り出すときにも条件にする
 */
const VISITOR_VISIBLE =
  "(p.status = 'published' AND (p.is_masked = 0 OR o.name_masked IS NOT NULL))";

const isSlugTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: project.slug');

export const createD1ProjectRepository = (db: D1Database): ProjectRepository => {
  const organizationStatements = (
    content: ProjectContent,
    guard?: Parameters<typeof findOrCreateOrganizationStatements>[3],
  ) =>
    findOrCreateOrganizationStatements(
      db,
      content.organizationName,
      content.organizationNameMasked,
      guard,
    );

  const contentValues = (content: ProjectContent & { slug: string }) => [
    content.kind,
    content.slug,
    content.title,
    content.titleMasked,
    content.isMasked ? 1 : 0,
    content.status,
    content.period.startedOn,
    content.period.endedOn,
    content.description,
    content.url,
  ];

  return {
    findVisitorBySlug: async (slug) => {
      // 秘匿化するかで、読む列を分ける。どちらか一方だけが行を返す（research.md の R5）。
      // サイトに載せない実績は、どちらも返さない（spec の FR-045）
      // 画像の行は秘匿化しない実績のものだけを読む。秘匿化した実績では、画像を指す値も読まない
      // （FR-030）
      const [unmasked, masked, skills, media] = await db.batch<
        UnmaskedVisitorRow | MaskedVisitorRow | { name: string } | { storage_key: string }
      >([
        db
          .prepare(
            `SELECT p.slug, p.kind, p.title, o.name AS organization_name, p.started_on,
               p.ended_on, p.description, p.url, cm.storage_key AS card_storage_key
             FROM project p JOIN organization o ON o.id = p.organization_id ${CARD_MEDIA_JOIN}
             WHERE p.slug = ? AND p.status = 'published' AND p.is_masked = 0`,
          )
          .bind(slug),
        db
          .prepare(
            `SELECT p.slug, p.kind, p.title_masked, o.name_masked AS organization_name_masked,
               p.started_on, p.ended_on
             FROM project p JOIN organization o ON o.id = p.organization_id
             WHERE p.slug = ? AND p.status = 'published' AND p.is_masked = 1
               AND o.name_masked IS NOT NULL`,
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
        db
          .prepare(
            `SELECT m.storage_key FROM media m JOIN project p ON p.id = m.project_id
             WHERE p.slug = ? AND p.status = 'published' AND p.is_masked = 0`,
          )
          .bind(slug),
      ]);
      const skillNames = (skills.results as { name: string }[]).map((row) => row.name);

      const unmaskedRow = unmasked.results[0] as UnmaskedVisitorRow | undefined;
      if (unmaskedRow) {
        // 本文が指す画像のうち、この実績の画像だけを出す。ほかの持ち主の画像のキーは出さない
        const owned = new Set(
          (media.results as { storage_key: string }[]).map((r) => r.storage_key),
        );
        const bodyKeys =
          unmaskedRow.description === null ? [] : readMarkdown(unmaskedRow.description).mediaKeys;
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
          media: bodyKeys.filter((key) => owned.has(key)),
          cardImageKey: unmaskedRow.card_storage_key,
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
      const [project, skills, media] = await db.batch<
        ProjectRow | { skill_id: number } | { storage_key: string }
      >([
        db
          .prepare(
            `SELECT ${EDIT_COLUMNS} FROM project p JOIN organization o ON o.id = p.organization_id
             ${CARD_MEDIA_JOIN} WHERE p.id = ?`,
          )
          .bind(id),
        db
          .prepare('SELECT skill_id FROM project_skill WHERE project_id = ? ORDER BY skill_id')
          .bind(id),
        db.prepare('SELECT storage_key FROM media WHERE project_id = ? ORDER BY id').bind(id),
      ]);
      const row = project.results[0] as ProjectRow | undefined;
      const skillIds = (skills.results as { skill_id: number }[]).map((r) => r.skill_id);
      const keys = (media.results as { storage_key: string }[]).map((r) => r.storage_key);
      return row ? toProject(row, skillIds, keys) : null;
    },

    listSkillOptions: async () => {
      const { results } = await db
        .prepare('SELECT id, name FROM skill ORDER BY name')
        .all<{ id: number; name: string }>();
      return results;
    },

    listOrganizationOptions: async () => {
      const { results } = await db
        .prepare(
          `SELECT o.uid, o.name FROM organization o
           WHERE EXISTS (SELECT 1 FROM project p WHERE p.organization_id = o.id)
           ORDER BY o.name, o.id`,
        )
        .all<{ uid: string; name: string }>();
      return results;
    },

    list: async (filter) => {
      // 絞るときは、実績と画像の両方を同じ条件で読む。`?` に NULL を渡すと、その条件では絞らない
      const kind = filter?.kind ?? null;
      const organizationUid = filter?.organizationUid ?? null;
      const where = '(?1 IS NULL OR p.kind = ?1) AND (?2 IS NULL OR o.uid = ?2)';
      const [projects, media] = await db.batch<
        ProjectListRow | { project_id: number; storage_key: string }
      >([
        db
          .prepare(
            `SELECT p.id, p.uid, p.slug, p.kind, p.title, p.is_masked, p.status, p.started_on,
               p.ended_on, p.description, cm.storage_key AS card_storage_key,
               o.name AS organization_name
             FROM project p JOIN organization o ON o.id = p.organization_id ${CARD_MEDIA_JOIN}
             WHERE ${where}
             ORDER BY p.started_on DESC, p.id DESC`,
          )
          .bind(kind, organizationUid),
        db
          .prepare(
            `SELECT m.project_id, m.storage_key FROM media m JOIN project p ON p.id = m.project_id
             JOIN organization o ON o.id = p.organization_id
             WHERE ${where}
             ORDER BY m.id`,
          )
          .bind(kind, organizationUid),
      ]);
      const keysByProject = new Map<number, string[]>();
      for (const row of media.results as { project_id: number; storage_key: string }[]) {
        const keys = keysByProject.get(row.project_id) ?? [];
        keys.push(row.storage_key);
        keysByProject.set(row.project_id, keys);
      }
      const rows = projects.results as ProjectListRow[];
      return rows.map((row): ProjectSummary => ({
        id: row.id,
        uid: row.uid,
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        isMasked: row.is_masked === 1,
        status: row.status,
        period: toPeriod(row),
        description: row.description,
        mediaStorageKeys: keysByProject.get(row.id) ?? [],
        cardMediaKey: row.card_storage_key,
        organizationName: row.organization_name,
      }));
    },

    register: async (content) => {
      const insert = db
        .prepare(
          `INSERT INTO project (organization_id, kind, slug, title, title_masked, is_masked,
             status, started_on, ended_on, description, url)
           SELECT ${ORGANIZATION_ID_BY_NAME}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE ${MASKING_ALLOWED}
           RETURNING id, uid`,
        )
        .bind(
          content.organizationName,
          ...contentValues(content),
          content.isMasked ? 1 : 0,
          content.organizationName,
        );
      // スキルのつながりは、実績の行が入ったときだけ入る。無い id のスキルはつながない
      const linkSkills = content.skillIds.map((skillId) =>
        db
          .prepare(
            `INSERT INTO project_skill (project_id, skill_id)
             SELECT p.id, s.id FROM project p, skill s WHERE p.slug = ? AND s.id = ?`,
          )
          .bind(content.slug, skillId),
      );
      const statements = [...organizationStatements(content, registerGuard(content)), insert];
      try {
        const results = await db.batch<{ id: number; uid: string }>([...statements, ...linkSkills]);
        const row = results[statements.length - 1]?.results[0];
        return row === undefined
          ? { ok: false, reason: 'masked-name-required' }
          : { ok: true, id: row.id, uid: row.uid };
      } catch (error) {
        if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
        throw error;
      }
    },

    edit: async (id, content, { openedUpdatedAt, now }) => {
      const update = db
        .prepare(
          `UPDATE project SET organization_id = ${ORGANIZATION_ID_BY_NAME}, kind = ?, slug = ?,
             title = ?, title_masked = ?, is_masked = ?, status = ?, started_on = ?, ended_on = ?,
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
      // スキルのつながりの入れ直しは、上の UPDATE が当たったときだけ働く（research.md の R7）。
      // UPDATE が当たると、更新日時が `now` になる
      const updated = 'EXISTS (SELECT 1 FROM project WHERE id = ? AND updated_at = ?)';
      const relinkSkills = [
        db
          .prepare(`DELETE FROM project_skill WHERE project_id = ? AND ${updated}`)
          .bind(id, id, now),
        ...content.skillIds.map((skillId) =>
          db
            .prepare(
              `INSERT INTO project_skill (project_id, skill_id)
               SELECT p.id, s.id FROM project p, skill s
               WHERE p.id = ? AND p.updated_at = ? AND s.id = ?`,
            )
            .bind(id, now, skillId),
        ),
      ];
      const statements = [
        ...organizationStatements(content, editGuard('project', id, openedUpdatedAt, content)),
        update,
      ];
      let changes: number;
      try {
        const results = await db.batch([...statements, ...relinkSkills]);
        changes = results[statements.length - 1]?.meta.changes ?? 0;
      } catch (error) {
        if (isSlugTaken(error)) return { ok: false, reason: 'slug-taken' };
        throw error;
      }
      if (changes > 0) return { ok: true };

      // 当たらなかった理由を見分ける。行が無ければ消されていた。更新日時が違えば、先に
      // 書き換えられていた
      const current = await db
        .prepare('SELECT updated_at FROM project WHERE id = ?')
        .bind(id)
        .first<{ updated_at: string }>();
      if (!current) return { ok: false, reason: 'not-found' };
      return current.updated_at === openedUpdatedAt
        ? { ok: false, reason: 'masked-name-required' }
        : { ok: false, reason: 'conflict' };
    },

    delete: async (id) => {
      // 外部キーは NO ACTION のため、子の行を先に空にするか消す（research.md の R8）。
      // 写した職務経歴書の行は残す。消す画像のキーは、同じ batch() の最初の文で読む
      const [media, ...results] = await db.batch<{ storage_key: string }>([
        db.prepare('SELECT storage_key FROM media WHERE project_id = ? ORDER BY id').bind(id),
        db.prepare('UPDATE resume_project SET project_id = NULL WHERE project_id = ?').bind(id),
        db.prepare('UPDATE project SET card_media_id = NULL WHERE id = ?').bind(id),
        db.prepare('DELETE FROM project_skill WHERE project_id = ?').bind(id),
        db.prepare('DELETE FROM media WHERE project_id = ?').bind(id),
        db.prepare('DELETE FROM project WHERE id = ?').bind(id),
      ]);
      if ((results.at(-1)?.meta.changes ?? 0) === 0) return { ok: false };
      return { ok: true, storageKeys: (media?.results ?? []).map((row) => row.storage_key) };
    },

    addMedia: async (id, { storageKey, size }, { asCardImage }) => {
      const insert = db
        .prepare(
          'INSERT INTO media (project_id, storage_key, size) SELECT id, ?, ? FROM project WHERE id = ?',
        )
        .bind(storageKey, size, id);
      const setCard = db
        .prepare(
          `UPDATE project SET card_media_id = (SELECT id FROM media WHERE project_id = ?1 AND storage_key = ?2)
           WHERE id = ?1`,
        )
        .bind(id, storageKey);
      const [result] = await db.batch(asCardImage ? [insert, setCard] : [insert]);
      return { ok: (result?.meta.changes ?? 0) > 0 };
    },

    changeCardImage: async (id, storageKey) => {
      const result =
        storageKey === null
          ? await db.prepare('UPDATE project SET card_media_id = NULL WHERE id = ?').bind(id).run()
          : await db
              .prepare(
                `UPDATE project SET card_media_id = m.id FROM media m
                 WHERE project.id = ?1 AND m.project_id = ?1 AND m.storage_key = ?2`,
              )
              .bind(id, storageKey)
              .run();
      if (result.meta.changes > 0) return { ok: true };
      const exists = await db.prepare('SELECT 1 FROM project WHERE id = ?').bind(id).first();
      return { ok: false, reason: exists === null ? 'not-found' : 'media-not-owned' };
    },

    hasSlug: async (slug) =>
      (await db
        .prepare(
          `SELECT 1 AS found FROM project p JOIN organization o ON o.id = p.organization_id
           WHERE p.slug = ? AND ${VISITOR_VISIBLE}`,
        )
        .bind(slug)
        .first()) !== null,

    findIdByUid: async (uid) =>
      (await db.prepare('SELECT id FROM project WHERE uid = ?').bind(uid).first<{ id: number }>())
        ?.id ?? null,
  };
};
