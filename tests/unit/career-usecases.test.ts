import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerDeps } from '@/features/career/application/deps';
import { addCareerImage } from '@/features/career/application/add-career-image';
import { deleteCareer } from '@/features/career/application/delete-career';
import { editCareer } from '@/features/career/application/edit-career';
import type { CareerFormValues } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';
import type { ImageStorage } from '@/shared/domain/media-image';
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
    delete: vi.fn(async (): Promise<{ ok: true; storageKeys: string[] } | { ok: false }> => ({
      ok: true,
      storageKeys: ['careers/a.png'],
    })),
    listProjectsOfOrganization: vi.fn(async () => []),
    addImage: vi.fn(
      async (): Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'too-many-images' }> => ({
        ok: true,
      }),
    ),
    findOwnerImage: vi.fn(),
  }) satisfies CareerRepository;

const fakeImages = () => ({
  put: vi.fn<ImageStorage['put']>(async () => {}),
  delete: vi.fn<ImageStorage['delete']>(async () => {}),
});

let careers: ReturnType<typeof fakeCareers>;
let organization: Organization | null;
let images: ReturnType<typeof fakeImages>;
let deps: CareerDeps;

beforeEach(() => {
  careers = fakeCareers();
  images = fakeImages();
  organization = {
    id: 1,
    uid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: '作り物株式会社',
    nameMasked: 'ある会社',
    updatedAt: OPENED_AT,
  };
  deps = {
    careers,
    organizations: { findByName: vi.fn(async () => organization) },
    images,
  };
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

describe('deleteCareer', () => {
  it('オーナーでなければ何も書かない（FR-040）', async () => {
    expect(await deleteCareer(deps, null, 1)).toEqual({ status: 'forbidden' });
    expect(careers.delete).not.toHaveBeenCalled();
  });

  it('職歴を消し、その職歴の画像を置き場から消す', async () => {
    expect(await deleteCareer(deps, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(images.delete).toHaveBeenCalledWith(['careers/a.png']);
  });

  it('無い職歴なら not-found で、置き場に触れない', async () => {
    careers.delete.mockResolvedValue({ ok: false });
    expect(await deleteCareer(deps, OWNER, 9)).toEqual({ status: 'not-found' });
    expect(images.delete).not.toHaveBeenCalled();
  });
});

describe('addCareerImage（FR-027）', () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const upload = { size: PNG.byteLength, read: async () => PNG.slice().buffer };

  it('オーナーでなければ何も書かない（FR-040）', async () => {
    expect(await addCareerImage(deps, null, 1, upload)).toEqual({ status: 'forbidden' });
    expect(images.put).not.toHaveBeenCalled();
  });

  it('置き場の careers/ に書いてから行を足す', async () => {
    expect(await addCareerImage(deps, OWNER, 1, upload)).toMatchObject({ status: 'added' });
    const key = images.put.mock.calls[0]?.[0] as unknown as string;
    expect(key).toMatch(/^careers\/[0-9a-f-]{36}\.png$/);
    expect(careers.addImage).toHaveBeenCalledWith(1, key);
  });

  it('行を足せなければ、書いた物を消す', async () => {
    careers.addImage.mockResolvedValue({ ok: false, reason: 'not-found' });
    expect(await addCareerImage(deps, OWNER, 1, upload)).toEqual({ status: 'not-found' });
    expect(images.delete).toHaveBeenCalledWith([images.put.mock.calls[0]?.[0]]);
  });
});
