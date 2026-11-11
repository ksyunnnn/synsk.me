import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CareerContent } from '@/features/career/domain/career';
import { createD1CareerRepository } from '@/features/career/server/d1-career-repository';
import type { CalendarDate } from '@/shared/domain/period';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertOrganization,
} from '../support/career-and-project-rows';

/**
 * `CareerRepository` の D1 の実装（specs/001-career-and-project/spec.md の FR-001・FR-007・
 * FR-008・FR-010・FR-042、research.md の R7・R8）。
 */

const careers = createD1CareerRepository(env.DB);

const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';

const content = (overrides: Partial<CareerContent> = {}): CareerContent => ({
  organizationName: '作り物株式会社',
  organizationNameMasked: 'ある会社',
  role: '作り物の肩書',
  isMasked: true,
  status: 'draft',
  period: { startedOn: '2020-04-01' as CalendarDate, endedOn: null },
  description: null,
  url: null,
  ...overrides,
});

const register = async (overrides: Partial<CareerContent> = {}) => {
  const result = await careers.register(content(overrides));
  if (!result.ok) throw new Error(result.reason);
  return result.id;
};

const setUpdatedAt = (id: number, updatedAt: string) =>
  env.DB.prepare('UPDATE career SET updated_at = ? WHERE id = ?').bind(updatedAt, id).run();

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM resume_career'),
    env.DB.prepare('DELETE FROM resume_project'),
    env.DB.prepare('DELETE FROM resume'),
  ]);
  await deleteCareerAndProjectRows(env.DB);
});

describe('register', () => {
  it('uid を返し、uid から id を引ける。無い uid なら null（管理画面の URL、migrations/0011）', async () => {
    const result = await careers.register(content());
    if (!result.ok) throw new Error(result.reason);
    expect(result.uid).toMatch(/^[0-9a-f]{32}$/);
    expect((await careers.findForEdit(result.id))?.uid).toBe(result.uid);
    expect(await careers.findIdByUid(result.uid)).toBe(result.id);
    expect(await careers.findIdByUid('0'.repeat(32))).toBeNull();
  });

  it('終わりの日が空の職歴を、続いている職歴として保存する（FR-008）', async () => {
    const id = await register();
    expect(await careers.findForEdit(id)).toMatchObject({
      role: '作り物の肩書',
      isMasked: true,
      period: { startedOn: '2020-04-01', endedOn: null },
      organization: { name: '作り物株式会社', nameMasked: 'ある会社' },
    });
  });

  it('秘匿化を指定せずに入れた職歴は、秘匿化する（FR-010）', async () => {
    const id = await insertCareer(env.DB, { organizationId: await insertOrganization(env.DB) });
    expect((await careers.findForEdit(id))?.isMasked).toBe(true);
  });

  it('秘匿化した組織名の無い組織で、秘匿化しない（FR-001）', async () => {
    await insertOrganization(env.DB, { name: '作り物株式会社', nameMasked: null });
    expect(await careers.register(content({ organizationNameMasked: null }))).toEqual({
      ok: false,
      reason: 'masked-name-required',
    });
  });

  it('秘匿化しない職歴は、秘匿化した組織名の無い組織を指せる', async () => {
    const id = await register({ isMasked: false, organizationNameMasked: null });
    expect((await careers.findForEdit(id))?.organization.nameMasked).toBeNull();
  });
});

describe('サイトに載せるか（FR-044）', () => {
  it('サイトに載せるかを指定せずに入れた職歴は、サイトに載せない', async () => {
    const id = await insertCareer(env.DB, { organizationId: await insertOrganization(env.DB) });
    expect((await careers.findForEdit(id))?.status).toBe('draft');
  });

  it('登録と編集で保存し、一覧にも出す', async () => {
    const id = await register({ status: 'published' });
    expect(await careers.findForEdit(id)).toMatchObject({ status: 'published' });
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await careers.edit(id, content({ status: 'draft' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: true });
    expect((await careers.list()).find((c) => c.id === id)).toMatchObject({ status: 'draft' });
  });
});

describe('edit', () => {
  it('開いたときの更新日時が今と同じなら書く', async () => {
    const id = await register();
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await careers.edit(id, content({ role: '直した肩書' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: true });
    expect(await careers.findForEdit(id)).toMatchObject({ role: '直した肩書', updatedAt: NOW });
  });

  it('先に書き換えられていたら、何も書かない（FR-042）', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    expect(
      await careers.edit(id, content({ role: '後から保存した肩書' }), {
        openedUpdatedAt: OPENED_AT,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect((await careers.findForEdit(id))?.role).toBe('作り物の肩書');
  });
});

describe('拒まれた登録はどの表にも書かない（docs/SOFTWARE_DESIGN.md の設計原則 1）', () => {
  it('秘匿化した組織名が要るとして拒んだら、新しい組織を作らない（FR-001）', async () => {
    expect(
      await careers.register(
        content({ organizationName: '新しい組織', organizationNameMasked: null }),
      ),
    ).toEqual({ ok: false, reason: 'masked-name-required' });
    expect(
      await env.DB.prepare('SELECT 1 FROM organization WHERE name = ?').bind('新しい組織').first(),
    ).toBeNull();
  });
});

describe('拒まれた編集はどの表にも書かない（docs/SOFTWARE_DESIGN.md の設計原則 1）', () => {
  const readOrganization = (name: string) =>
    env.DB.prepare('SELECT name, name_masked FROM organization WHERE name = ?').bind(name).first();

  it('先に書き換えられていたら、新しい組織を作らない', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    expect(
      await careers.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });

  it('先に書き換えられていたら、既にある組織に秘匿化した組織名を入れない', async () => {
    const id = await register();
    await setUpdatedAt(id, '2026-11-02T00:00:00.000Z');
    await insertOrganization(env.DB, { name: '名前の無い組織', nameMasked: null });
    expect(
      await careers.edit(
        id,
        content({ organizationName: '名前の無い組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'conflict' });
    expect(await readOrganization('名前の無い組織')).toEqual({
      name: '名前の無い組織',
      name_masked: null,
    });
  });

  it('秘匿化した組織名が要るとして拒んだら、新しい組織を作らない（FR-001）', async () => {
    const id = await register();
    await setUpdatedAt(id, OPENED_AT);
    expect(
      await careers.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: null }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'masked-name-required' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });

  it('開いた後に消されていたら not-found を返し、組織を作らない', async () => {
    const id = await register();
    await careers.delete(id);
    expect(
      await careers.edit(
        id,
        content({ organizationName: '新しい組織', organizationNameMasked: '新しい秘匿名' }),
        { openedUpdatedAt: OPENED_AT, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'not-found' });
    expect(await readOrganization('新しい組織')).toBeNull();
  });
});

describe('delete', () => {
  it('写した職務経歴書の行を残し、指す id を空にしてから消す（R8）', async () => {
    const id = await register();
    const resume = await env.DB.prepare(
      "INSERT INTO resume (slug, title) VALUES ('fake-resume', '作り物の職務経歴書') RETURNING id",
    ).first<{ id: number }>();
    await env.DB.prepare(
      `INSERT INTO resume_career (resume_id, career_id, organization_name, role, started_on)
       VALUES (?, ?, '写した組織名', '写した肩書', '2020-04-01')`,
    )
      .bind(resume?.id, id)
      .run();

    expect(await careers.delete(id)).toEqual({ ok: true, storageKeys: [] });
    expect(await careers.findForEdit(id)).toBeNull();
    expect(await env.DB.prepare('SELECT career_id, role FROM resume_career').first()).toEqual({
      career_id: null,
      role: '写した肩書',
    });
  });

  it('無い id なら ok: false', async () => {
    expect(await careers.delete(999)).toEqual({ ok: false });
  });

  it('画像を大きさとともに記録し、削除のときに行を消してキーを返す（FR-027）', async () => {
    const id = await register();
    const key = crypto.randomUUID();
    expect(await careers.addMedia(id, { storageKey: key, size: 64 })).toEqual({ ok: true });
    expect((await careers.findForEdit(id))?.mediaStorageKeys).toEqual([key]);
    expect(
      await env.DB.prepare('SELECT size FROM media WHERE storage_key = ?').bind(key).first(),
    ).toEqual({ size: 64 });
    expect(await careers.addMedia(999, { storageKey: crypto.randomUUID(), size: 64 })).toEqual({
      ok: false,
    });

    expect(await careers.delete(id)).toEqual({ ok: true, storageKeys: [key] });
    expect(
      await env.DB.prepare('SELECT 1 FROM media WHERE storage_key = ?').bind(key).first(),
    ).toBeNull();
  });
});
