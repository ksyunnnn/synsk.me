import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerDeps } from '@/features/career/application/deps';
import { editCareer } from '@/features/career/application/edit-career';
import type { CareerFormValues } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';
import type { Organization } from '@/shared/domain/organization';

/**
 * 職歴の編集のユースケース（FR-007・FR-040・FR-042）。Repository は作り物の実装を渡す
 * （docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での動きは
 * tests/workers/career-repository.test.ts が持つ。
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';
const times = { openedUpdatedAt: OPENED_AT, now: NOW };

const values = (overrides: Partial<CareerFormValues> = {}): CareerFormValues => ({
  organizationName: '作り物株式会社',
  organizationNameMasked: 'ある会社',
  role: '作り物の肩書',
  isMasked: '1',
  status: 'draft',
  startedOn: '2021-04-01',
  endedOn: '',
  description: '',
  url: '',
  ...overrides,
});

const fakeCareers = () =>
  ({
    findForEdit: vi.fn(),
    findIdByUid: vi.fn(),
    list: vi.fn(),
    register: vi.fn(),
    edit: vi.fn(async () => ({ ok: true as const })),
    delete: vi.fn(),
  }) satisfies CareerRepository;

let careers: ReturnType<typeof fakeCareers>;
let organization: Organization | null;
let deps: CareerDeps;

beforeEach(() => {
  careers = fakeCareers();
  organization = {
    id: 1,
    uid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: '作り物株式会社',
    nameMasked: 'ある会社',
    updatedAt: OPENED_AT,
  };
  deps = { careers, organizations: { findByName: vi.fn(async () => organization) } };
});

describe('editCareer', () => {
  it('オーナーでなければ何も書かない（FR-040）', async () => {
    expect(await editCareer(deps, null, 1, values(), times)).toEqual({ status: 'forbidden' });
    expect(careers.edit).not.toHaveBeenCalled();
  });

  it('開いたときの更新日時と新しい更新日時を渡して書く（FR-042）', async () => {
    expect(await editCareer(deps, OWNER, 1, values(), times)).toEqual({ status: 'saved' });
    expect(careers.edit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ role: '作り物の肩書' }),
      times,
    );
  });

  it('書く前に消されていたら not-found を返す', async () => {
    careers.edit.mockResolvedValue({ ok: false, reason: 'not-found' } as never);
    expect(await editCareer(deps, OWNER, 9, values(), times)).toEqual({ status: 'not-found' });
  });

  it('先に書き換えられていたら、送られた値を残して知らせる（FR-042）', async () => {
    careers.edit.mockResolvedValue({ ok: false, reason: 'conflict' } as never);
    const sent = values({ role: '手元で直した肩書' });
    expect(await editCareer(deps, OWNER, 1, sent, times)).toEqual({
      status: 'conflict',
      values: sent,
    });
  });

  it('項目の不備は、書かずに項目ごとの理由と送られた値を返す', async () => {
    const sent = values({ role: '' });
    expect(await editCareer(deps, OWNER, 1, sent, times)).toEqual({
      status: 'invalid',
      errors: { role: 'missing' },
      values: sent,
    });
    expect(careers.edit).not.toHaveBeenCalled();
  });
});
