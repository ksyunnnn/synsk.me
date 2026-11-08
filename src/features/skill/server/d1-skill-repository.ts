import 'server-only';

import type { SkillRepository } from '@/features/skill/domain/skill-repository';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * `SkillRepository` の D1 の実装。行の型はこのファイルの中だけに置く（research.md の R3）
 */

type SkillRow = { id: number; uid: string; name: string; months_override: number | null };

const isNameTaken = (error: unknown) =>
  error instanceof Error && error.message.includes('UNIQUE constraint failed: skill.name');

export const createD1SkillRepository = (db: D1Database): SkillRepository => ({
  listWithPeriods: async (projects) => {
    const [skills, periods] = await db.batch<
      SkillRow | { skill_id: number; started_on: string; ended_on: string | null }
    >([
      db.prepare('SELECT id, uid, name, months_override FROM skill ORDER BY name'),
      db
        .prepare(
          `SELECT ps.skill_id, p.started_on, p.ended_on
           FROM project_skill ps JOIN project p ON p.id = ps.project_id
           WHERE ? = 'all' OR p.status = 'published'`,
        )
        .bind(projects),
    ]);
    const periodRows = periods.results as {
      skill_id: number;
      started_on: string;
      ended_on: string | null;
    }[];
    return (skills.results as SkillRow[]).map((row) => ({
      id: row.id,
      uid: row.uid,
      name: row.name,
      monthsOverride: row.months_override,
      periods: periodRows
        .filter((period) => period.skill_id === row.id)
        .map((period) => ({
          startedOn: period.started_on as CalendarDate,
          endedOn: period.ended_on as CalendarDate | null,
        })),
    }));
  },

  findById: async (id) => {
    const row = await db
      .prepare('SELECT id, uid, name, months_override FROM skill WHERE id = ?')
      .bind(id)
      .first<SkillRow>();
    return row
      ? { id: row.id, uid: row.uid, name: row.name, monthsOverride: row.months_override }
      : null;
  },

  findIdByUid: async (uid) =>
    (await db.prepare('SELECT id FROM skill WHERE uid = ?').bind(uid).first<{ id: number }>())
      ?.id ?? null,

  register: async ({ name, monthsOverride }) => {
    try {
      const row = await db
        .prepare('INSERT INTO skill (name, months_override) VALUES (?, ?) RETURNING id, uid')
        .bind(name, monthsOverride)
        .first<{ id: number; uid: string }>();
      if (!row) throw new Error('スキルを登録した後に id を読めなかった');
      return { ok: true, id: row.id, uid: row.uid };
    } catch (error) {
      if (isNameTaken(error)) return { ok: false, reason: 'name-taken' };
      throw error;
    }
  },

  edit: async (id, { name, monthsOverride }) => {
    try {
      const result = await db
        .prepare('UPDATE skill SET name = ?, months_override = ? WHERE id = ?')
        .bind(name, monthsOverride, id)
        .run();
      return result.meta.changes > 0 ? { ok: true } : { ok: false, reason: 'not-found' };
    } catch (error) {
      if (isNameTaken(error)) return { ok: false, reason: 'name-taken' };
      throw error;
    }
  },

  delete: async (id) => {
    // 写した職務経歴書の resume_project_skill と resume_skill_override は名前を写して
    // 持つため触らない（research.md の R8）
    const results = await db.batch([
      db.prepare('DELETE FROM project_skill WHERE skill_id = ?').bind(id),
      db.prepare('DELETE FROM skill WHERE id = ?').bind(id),
    ]);
    return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
  },

  hasId: async (id) =>
    (await db.prepare('SELECT 1 AS found FROM skill WHERE id = ?').bind(id).first()) !== null,
});
