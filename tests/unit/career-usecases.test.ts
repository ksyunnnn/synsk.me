import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerDeps } from '@/features/career/application/deps';
import { addCareerMedia } from '@/features/career/application/add-career-media';
import { deleteCareer } from '@/features/career/application/delete-career';
import { editCareer } from '@/features/career/application/edit-career';
import type { CareerFormValues } from '@/features/career/domain/career';
import type { CareerRepository } from '@/features/career/domain/career-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';
import type { Organization } from '@/shared/domain/organization';

/**
 * 職歴の編集・削除・画像の追加のユースケース（FR-007・FR-027・FR-040・FR-042）。Repository は作り物の実装を渡す
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
    delete: vi.fn<CareerRepository['delete']>(async () => ({ ok: true, storageKeys: [] })),
    addMedia: vi.fn<CareerRepository['addMedia']>(async () => ({ ok: true })),
  }) satisfies CareerRepository;

const MEDIA_KEY = '11111111-1111-4111-8111-111111111111';

const fakeMedia = () => ({
  save: vi.fn<MediaStorage['save']>(async () => ({
    ok: true,
    media: { storageKey: MEDIA_KEY, type: 'image/png', size: 3 },
  })),
  read: vi.fn(),
  remove: vi.fn(async () => {}),
});

let careers: ReturnType<typeof fakeCareers>;
let organization: Organization | null;
let deps: CareerDeps;
let media: ReturnType<typeof fakeMedia>;

beforeEach(() => {
  careers = fakeCareers();
  organization = {
    id: 1,
    uid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: '作り物株式会社',
    nameMasked: 'ある会社',
    updatedAt: OPENED_AT,
  };
  media = fakeMedia();
  deps = { careers, organizations: { findByName: vi.fn(async () => organization) }, media };
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
  it('職歴を消し、その職歴の画像を置き場から消す', async () => {
    careers.delete.mockResolvedValue({ ok: true, storageKeys: [MEDIA_KEY] });
    expect(await deleteCareer(deps, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(media.remove).toHaveBeenCalledWith([MEDIA_KEY]);
  });

  it('無い職歴なら not-found。オーナーでなければ何も消さない', async () => {
    careers.delete.mockResolvedValue({ ok: false });
    expect(await deleteCareer(deps, OWNER, 9)).toEqual({ status: 'not-found' });
    expect(await deleteCareer(deps, null, 9)).toEqual({ status: 'forbidden' });
    expect(careers.delete).toHaveBeenCalledTimes(1);
  });
});

describe('addCareerMedia（FR-027）', () => {
  const file = new Blob([new Uint8Array([1, 2, 3])]);

  it('置き場に置いてから、大きさとともに記録する', async () => {
    expect(await addCareerMedia(deps, OWNER, 1, file)).toEqual({
      status: 'added',
      storageKey: MEDIA_KEY,
    });
    expect(careers.addMedia).toHaveBeenCalledWith(1, { storageKey: MEDIA_KEY, size: 3 });
  });

  it('置き場の総量の上限を超える画像は記録しない', async () => {
    media.save.mockResolvedValue({ ok: false, reason: 'storage-full' });
    expect(await addCareerMedia(deps, OWNER, 1, file)).toEqual({
      status: 'invalid',
      error: 'storage-full',
    });
    expect(careers.addMedia).not.toHaveBeenCalled();
  });

  it('記録の前に職歴が消えていたら、置いた画像を消して not-found', async () => {
    careers.addMedia.mockResolvedValue({ ok: false });
    expect(await addCareerMedia(deps, OWNER, 1, file)).toEqual({ status: 'not-found' });
    expect(media.remove).toHaveBeenCalledWith([MEDIA_KEY]);
  });

  it('オーナーでなければ置き場を触らない', async () => {
    expect(await addCareerMedia(deps, null, 1, file)).toEqual({ status: 'forbidden' });
    expect(media.save).not.toHaveBeenCalled();
  });
});
