import 'server-only';

import type { Education } from '@/features/education/domain/education';
import type { EducationRepository } from '@/features/education/domain/education-repository';
import type { CalendarDate } from '@/shared/domain/period';

/** `EducationRepository` の D1 の実装。行の型はこのファイルの中だけに置く（research.md の R3） */

type EducationRow = {
  id: number;
  uid: string;
  school: string;
  department: string | null;
  started_on: string;
  ended_on: string | null;
  remarks: string | null;
};

const COLUMNS = 'id, uid, school, department, started_on, ended_on, remarks';

const toEducation = (row: EducationRow): Education => ({
  id: row.id,
  uid: row.uid,
  school: row.school,
  department: row.department,
  period: {
    startedOn: row.started_on as CalendarDate,
    endedOn: row.ended_on as CalendarDate | null,
  },
  remarks: row.remarks,
});

export const createD1EducationRepository = (db: D1Database): EducationRepository => ({
  findById: async (id) => {
    const row = await db
      .prepare(`SELECT ${COLUMNS} FROM education WHERE id = ?`)
      .bind(id)
      .first<EducationRow>();
    return row ? toEducation(row) : null;
  },

  findIdByUid: async (uid) =>
    (await db.prepare('SELECT id FROM education WHERE uid = ?').bind(uid).first<{ id: number }>())
      ?.id ?? null,

  list: async () => {
    const { results } = await db
      .prepare(`SELECT ${COLUMNS} FROM education ORDER BY started_on DESC, id DESC`)
      .all<EducationRow>();
    return results.map(toEducation);
  },

  register: async ({ school, department, period, remarks }) => {
    const row = await db
      .prepare(
        `INSERT INTO education (school, department, started_on, ended_on, remarks)
         VALUES (?, ?, ?, ?, ?) RETURNING id, uid`,
      )
      .bind(school, department, period.startedOn, period.endedOn, remarks)
      .first<{ id: number; uid: string }>();
    if (!row) throw new Error('学歴を登録した後に id を読めなかった');
    return { id: row.id, uid: row.uid };
  },

  edit: async (id, { school, department, period, remarks }) => {
    const result = await db
      .prepare(
        `UPDATE education SET school = ?, department = ?, started_on = ?, ended_on = ?,
           remarks = ?
         WHERE id = ?`,
      )
      .bind(school, department, period.startedOn, period.endedOn, remarks, id)
      .run();
    return { ok: result.meta.changes > 0 };
  },

  delete: async (id) => {
    const results = await db.batch([
      db.prepare('UPDATE resume_education SET education_id = NULL WHERE education_id = ?').bind(id),
      db.prepare('DELETE FROM education WHERE id = ?').bind(id),
    ]);
    return { ok: (results.at(-1)?.meta.changes ?? 0) > 0 };
  },
});
