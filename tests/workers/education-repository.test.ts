import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  parseEducationContent,
  toEducationFormValues,
} from '@/features/education/domain/education';
import { createD1EducationRepository } from '@/features/education/server/d1-education-repository';
import type { CalendarDate } from '@/shared/domain/period';
import { deleteCareerAndProjectRows } from '../support/career-and-project-rows';

/**
 * `EducationRepository` の D1 の実装（specs/001-career-and-project/spec.md の FR-036・FR-039）。
 */

const educations = createD1EducationRepository(env.DB);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM resume_education'),
    env.DB.prepare('DELETE FROM resume_project'),
    env.DB.prepare('DELETE FROM resume_career'),
    env.DB.prepare('DELETE FROM resume'),
  ]);
  await deleteCareerAndProjectRows(env.DB);
});

it('学部・終わりの日・備考を空にして登録できる（FR-036）', async () => {
  const id = await educations.register({
    school: '作り物大学',
    department: null,
    period: { startedOn: '2014-04-01' as CalendarDate, endedOn: null },
    remarks: null,
  });
  expect(await educations.findById(id)).toEqual({
    id,
    school: '作り物大学',
    department: null,
    period: { startedOn: '2014-04-01', endedOn: null },
    remarks: null,
  });
});

it('終わりの日が始まりの日より前の学歴は、入力でも D1 でも拒む（FR-039）', async () => {
  const values = { ...toEducationFormValues(), school: '作り物大学', startedOn: '2018-04-01' };
  expect(parseEducationContent({ ...values, endedOn: '2018-03-31' })).toEqual({
    ok: false,
    errors: { endedOn: 'ended-before-started' },
  });
  await expect(
    educations.register({
      school: '作り物大学',
      department: null,
      period: {
        startedOn: '2018-04-01' as CalendarDate,
        endedOn: '2018-03-31' as CalendarDate,
      },
      remarks: null,
    }),
  ).rejects.toThrow();
});

it('写した職務経歴書の行を残し、指す id を空にしてから消す（R8）', async () => {
  const id = await educations.register({
    school: '作り物大学',
    department: '作り物学部',
    period: { startedOn: '2014-04-01' as CalendarDate, endedOn: '2018-03-31' as CalendarDate },
    remarks: null,
  });
  const resume = await env.DB.prepare(
    "INSERT INTO resume (slug, title) VALUES ('fake-resume', '作り物の職務経歴書') RETURNING id",
  ).first<{ id: number }>();
  await env.DB.prepare(
    `INSERT INTO resume_education (resume_id, education_id, school, started_on)
     VALUES (?, ?, '写した学校', '2014-04-01')`,
  )
    .bind(resume?.id, id)
    .run();

  expect(await educations.delete(id)).toEqual({ ok: true });
  expect(await educations.findById(id)).toBeNull();
  expect(await env.DB.prepare('SELECT education_id, school FROM resume_education').first()).toEqual(
    { education_id: null, school: '写した学校' },
  );
});

describe('edit', () => {
  it('無い id なら ok: false', async () => {
    expect(
      await educations.edit(999, {
        school: 'x',
        department: null,
        period: { startedOn: '2014-04-01' as CalendarDate, endedOn: null },
        remarks: null,
      }),
    ).toEqual({ ok: false });
  });
});
