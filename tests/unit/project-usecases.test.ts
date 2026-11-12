import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDeps } from '@/features/project/application/deps';
import { deleteProject } from '@/features/project/application/delete-project';
import { editProject } from '@/features/project/application/edit-project';
import {
  addProjectMedia,
  changeProjectCardImage,
  ownerProjectMediaAccess,
  visitorProjectMediaAccess,
} from '@/features/project/application/project-media';
import { registerProject } from '@/features/project/application/register-project';
import {
  toProjectFormValues,
  type Project,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import type { ProjectRepository } from '@/features/project/domain/project-repository';
import { isSlug } from '@/shared/domain/slug';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';
import type { Organization } from '@/shared/domain/organization';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 実績のユースケース（FR-011・FR-013・FR-040・FR-042）。Repository は作り物の実装を渡す
 * （docs/SOFTWARE_DESIGN.md の Dependency Injection）。D1 の上での動きは
 * tests/workers/project-repository.test.ts が持つ。
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const OPENED_AT = '2026-11-01T00:00:00.000Z';
const NOW = '2026-11-04T00:00:00.000Z';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  uid: '0123456789abcdef0123456789abcdef',
  slug: '0b6f3c1e-1111-4222-8333-444455556666',
  organization: { id: 1, name: '作り物株式会社', nameMasked: 'ある会社' },
  kind: 'develop',
  title: '作り物の受託開発',
  titleMasked: '業務システムの開発',
  isMasked: true,
  status: 'draft',
  period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
  description: null,
  url: null,
  skillIds: [],
  mediaStorageKeys: [],
  cardMediaKey: null,
  updatedAt: OPENED_AT,
  ...overrides,
});

const values = (overrides: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  ...toProjectFormValues(project()),
  ...overrides,
});

const fakeProjects = (current: Project | null) =>
  ({
    findVisitorBySlug: vi.fn(),
    findForEdit: vi.fn(async () => current),
    list: vi.fn(),
    findIdByUid: vi.fn(),
    register: vi.fn(async () => ({
      ok: true as const,
      id: 7,
      uid: 'fedcba9876543210fedcba9876543210',
    })),
    edit: vi.fn(async () => ({ ok: true as const })),
    delete: vi.fn<ProjectRepository['delete']>(async () => ({ ok: true, storageKeys: [] })),
    hasSlug: vi.fn(),
    listSkillOptions: vi.fn(async () => []),
    addMedia: vi.fn(async () => ({ ok: true })),
    changeCardImage: vi.fn<ProjectRepository['changeCardImage']>(async () => ({ ok: true })),
  }) satisfies ProjectRepository;

const MEDIA_KEY = '11111111-1111-4111-8111-111111111111';

const fakeMedia = () => ({
  save: vi.fn<MediaStorage['save']>(async () => ({
    ok: true,
    media: { storageKey: MEDIA_KEY, type: 'image/png', size: 3 },
  })),
  read: vi.fn(),
  remove: vi.fn(async () => {}),
});

let projects: ReturnType<typeof fakeProjects>;
let organization: Organization | null;
let deps: ProjectDeps;
let media: ReturnType<typeof fakeMedia>;

beforeEach(() => {
  projects = fakeProjects(project());
  organization = {
    id: 1,
    uid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: '作り物株式会社',
    nameMasked: 'ある会社',
    updatedAt: OPENED_AT,
  };
  media = fakeMedia();
  deps = { projects, organizations: { findByName: vi.fn(async () => organization) }, media };
});

describe('オーナーでない呼び出しを拒む（FR-040）', () => {
  it('登録は何も書かず、入力した値を返さない', async () => {
    expect(await registerProject(deps, null, values())).toEqual({ status: 'forbidden' });
    expect(projects.register).not.toHaveBeenCalled();
  });

  it('編集は読まずに、何も書かない', async () => {
    expect(
      await editProject(deps, null, 1, values(), { openedUpdatedAt: OPENED_AT, now: NOW }),
    ).toEqual({
      status: 'forbidden',
    });
    expect(projects.findForEdit).not.toHaveBeenCalled();
    expect(projects.edit).not.toHaveBeenCalled();
  });

  it('削除は何も書かない', async () => {
    expect(await deleteProject(deps, null, 1)).toEqual({ status: 'forbidden' });
    expect(projects.delete).not.toHaveBeenCalled();
  });
});

describe('registerProject', () => {
  it('uid の識別子で登録する（FR-013）', async () => {
    expect(await registerProject(deps, OWNER, values({ slug: 'ignored' }))).toEqual({
      status: 'registered',
      id: 7,
      uid: 'fedcba9876543210fedcba9876543210',
    });
    const [saved] = projects.register.mock.calls[0] as unknown as [{ slug: string }];
    expect(saved.slug).not.toBe('ignored');
    expect(isSlug(saved.slug)).toBe(true);
  });

  it('秘匿化するかを送らなければ、秘匿化して登録する（FR-015）', async () => {
    await registerProject(deps, OWNER, values({ isMasked: '' }));
    expect(projects.register).toHaveBeenCalledWith(expect.objectContaining({ isMasked: true }));
  });

  it('項目の不備は、書かずに項目ごとの理由と送られた値を返す', async () => {
    const sent = values({ title: '' });
    expect(await registerProject(deps, OWNER, sent)).toEqual({
      status: 'invalid',
      errors: { title: 'missing' },
      values: sent,
    });
    expect(projects.register).not.toHaveBeenCalled();
  });

  it('識別子が重なれば、識別子の誤りを返す', async () => {
    projects.register.mockResolvedValue({ ok: false, reason: 'slug-taken' } as never);
    expect(await registerProject(deps, OWNER, values())).toMatchObject({
      status: 'invalid',
      errors: { slug: 'slug-taken' },
    });
  });
});

describe('editProject', () => {
  const times = { openedUpdatedAt: OPENED_AT, now: NOW };

  it('開いたときの更新日時と新しい更新日時を渡して書く（FR-042）', async () => {
    expect(await editProject(deps, OWNER, 1, values(), times)).toEqual({ status: 'saved' });
    expect(projects.edit).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: '作り物の受託開発' }),
      times,
    );
  });

  it('無い id なら書かない', async () => {
    deps.projects = projects = fakeProjects(null);
    expect(await editProject(deps, OWNER, 9, values(), times)).toEqual({ status: 'not-found' });
    expect(projects.edit).not.toHaveBeenCalled();
  });

  it('読んだ後に書く前に消されていたら not-found を返す', async () => {
    projects.edit.mockResolvedValue({ ok: false, reason: 'not-found' } as never);
    expect(await editProject(deps, OWNER, 1, values(), times)).toEqual({ status: 'not-found' });
  });

  it('先に書き換えられていたら、送られた値を残して知らせる（FR-042）', async () => {
    projects.edit.mockResolvedValue({ ok: false, reason: 'conflict' } as never);
    const sent = values({ title: '手元で直した題' });
    expect(await editProject(deps, OWNER, 1, sent, times)).toEqual({
      status: 'conflict',
      values: sent,
    });
  });
});

describe('deleteProject', () => {
  it('ある実績を消し、その実績の画像を置き場から消す', async () => {
    projects.delete.mockResolvedValue({ ok: true, storageKeys: [MEDIA_KEY] });
    expect(await deleteProject(deps, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(projects.delete).toHaveBeenCalledWith(1);
    expect(media.remove).toHaveBeenCalledWith([MEDIA_KEY]);
  });

  it('画像が無ければ置き場を触らない', async () => {
    expect(await deleteProject(deps, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(media.remove).not.toHaveBeenCalled();
  });

  it('無い実績なら not-found', async () => {
    projects.delete.mockResolvedValue({ ok: false });
    expect(await deleteProject(deps, OWNER, 9)).toEqual({ status: 'not-found' });
  });

  it('オーナーでなければ何も消さない（FR-040）', async () => {
    expect(await deleteProject(deps, null, 1)).toEqual({ status: 'forbidden' });
    expect(projects.delete).not.toHaveBeenCalled();
  });
});

describe('addProjectMedia（FR-027・FR-028）', () => {
  const file = new Blob([new Uint8Array([1, 2, 3])]);

  it('置き場に置いてから、大きさとともに記録する', async () => {
    expect(await addProjectMedia(deps, OWNER, 1, file, { asCardImage: true })).toEqual({
      status: 'added',
      storageKey: MEDIA_KEY,
    });
    expect(projects.addMedia).toHaveBeenCalledWith(
      1,
      { storageKey: MEDIA_KEY, size: 3 },
      { asCardImage: true },
    );
  });

  it.each(['empty', 'too-large', 'unsupported-type', 'storage-full'] as const)(
    '置き場が %s で拒んだ画像は記録しない',
    async (reason) => {
      media.save.mockResolvedValue({ ok: false, reason });
      expect(await addProjectMedia(deps, OWNER, 1, file, { asCardImage: false })).toEqual({
        status: 'invalid',
        error: reason,
      });
      expect(projects.addMedia).not.toHaveBeenCalled();
    },
  );

  it('ファイルが無ければ置き場を触らない', async () => {
    expect(await addProjectMedia(deps, OWNER, 1, null, { asCardImage: false })).toEqual({
      status: 'invalid',
      error: 'empty',
    });
    expect(media.save).not.toHaveBeenCalled();
  });

  it('記録の前に実績が消えていたら、置いた画像を消して not-found', async () => {
    projects.addMedia.mockResolvedValue({ ok: false });
    expect(await addProjectMedia(deps, OWNER, 1, file, { asCardImage: false })).toEqual({
      status: 'not-found',
    });
    expect(media.remove).toHaveBeenCalledWith([MEDIA_KEY]);
  });

  it('記録が例外で失敗したら、置いた画像を消してから投げ直す', async () => {
    projects.addMedia.mockRejectedValue(new Error('D1 が落ちた'));
    await expect(addProjectMedia(deps, OWNER, 1, file, { asCardImage: false })).rejects.toThrow();
    expect(media.remove).toHaveBeenCalledWith([MEDIA_KEY]);
  });

  it('オーナーでなければ置き場を触らない（FR-040）', async () => {
    expect(await addProjectMedia(deps, null, 1, file, { asCardImage: false })).toEqual({
      status: 'forbidden',
    });
    expect(media.save).not.toHaveBeenCalled();
  });
});

describe('changeProjectCardImage（FR-028）', () => {
  it('その実績の画像を代表画像にする', async () => {
    expect(await changeProjectCardImage(projects, OWNER, 1, MEDIA_KEY)).toEqual({
      status: 'changed',
    });
    expect(projects.changeCardImage).toHaveBeenCalledWith(1, MEDIA_KEY);
  });

  it('ほかの持ち主の画像は選べない', async () => {
    projects.changeCardImage.mockResolvedValue({ ok: false, reason: 'media-not-owned' });
    expect(await changeProjectCardImage(projects, OWNER, 1, MEDIA_KEY)).toEqual({
      status: 'invalid',
      error: 'media-not-owned',
    });
  });

  it('オーナーでなければ何も書かない', async () => {
    expect(await changeProjectCardImage(projects, null, 1, null)).toEqual({ status: 'forbidden' });
    expect(projects.changeCardImage).not.toHaveBeenCalled();
  });
});

describe('visitorProjectMediaAccess（FR-030）', () => {
  const CARD = '22222222-2222-4222-8222-222222222222';
  const unmasked = {
    isMasked: false as const,
    slug: 'a',
    kind: 'develop' as const,
    title: '題',
    organizationName: '組織',
    period: { startedOn: '2021-04-01' as CalendarDate, endedOn: null },
    skills: [],
    body: null,
    url: null,
    media: [MEDIA_KEY],
    cardImageKey: CARD,
  };

  it('本文が指す画像と代表画像は public、ほかは hidden', () => {
    expect(visitorProjectMediaAccess(unmasked, MEDIA_KEY)).toBe('public');
    expect(visitorProjectMediaAccess(unmasked, CARD)).toBe('public');
    expect(visitorProjectMediaAccess(unmasked, '33333333-3333-4333-8333-333333333333')).toBe(
      'hidden',
    );
  });

  it('秘匿化した実績と、訪問者に出さない実績の画像は hidden', () => {
    const masked = {
      isMasked: true as const,
      slug: unmasked.slug,
      kind: unmasked.kind,
      title: unmasked.title,
      organizationName: unmasked.organizationName,
      period: unmasked.period,
      skills: [],
    };
    expect(visitorProjectMediaAccess(masked, MEDIA_KEY)).toBe('hidden');
    expect(visitorProjectMediaAccess(null, MEDIA_KEY)).toBe('hidden');
  });
});

describe('ownerProjectMediaAccess（issue #330）', () => {
  it('オーナーには、その実績の画像を、キャッシュに残さない形で返す', () => {
    expect(ownerProjectMediaAccess(OWNER, { mediaStorageKeys: [MEDIA_KEY] }, MEDIA_KEY)).toBe(
      'restricted',
    );
  });

  it('オーナーでないとき・ほかの実績の画像・無い実績では返さない', () => {
    const other = '33333333-3333-4333-8333-333333333333';
    expect(ownerProjectMediaAccess(null, { mediaStorageKeys: [MEDIA_KEY] }, MEDIA_KEY)).toBe(
      'hidden',
    );
    expect(ownerProjectMediaAccess(OWNER, { mediaStorageKeys: [MEDIA_KEY] }, other)).toBe('hidden');
    expect(ownerProjectMediaAccess(OWNER, null, MEDIA_KEY)).toBe('hidden');
  });
});
