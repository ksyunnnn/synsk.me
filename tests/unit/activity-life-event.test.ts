import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLifeEvent } from '@/features/activity/application/delete-life-event';
import { editLifeEvent } from '@/features/activity/application/edit-life-event';
import { registerLifeEvent } from '@/features/activity/application/register-life-event';
import type { LifeEvent, LifeEventFormValues } from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { CalendarDate } from '@/shared/domain/period';
import { isSlug } from '@/shared/domain/slug';

/**
 * life event のユースケース（specs/004-external-activity/spec.md の FR-023〜FR-025・FR-031・FR-035、
 * User Story 5 の Acceptance 1〜3・8）。Repository は作り物の実装を渡す。値はすべて作り物
 */

const OWNER: Author = { email: 'owner@synsk.test' };

const lifeEvent = (overrides: Partial<LifeEvent> = {}): LifeEvent => ({
  id: 1,
  uid: '0123456789abcdef0123456789abcdef',
  slug: 'fake-life-event',
  title: '作り物の出来事',
  description: null,
  happenedOn: '2020-04-01' as CalendarDate,
  cardImageUrl: null,
  ...overrides,
});

const values = (overrides: Partial<LifeEventFormValues> = {}): LifeEventFormValues => ({
  title: '作り物の出来事',
  description: '',
  happenedOn: '2020-04-01',
  slug: '',
  ...overrides,
});

const fakeLifeEvents = (current: LifeEvent | null) =>
  ({
    findVisitorBySlug: vi.fn(),
    hasSlug: vi.fn(),
    findForEdit: vi.fn(async () => current),
    findIdByUid: vi.fn(),
    list: vi.fn(),
    register: vi.fn<LifeEventRepository['register']>(async () => ({
      ok: true as const,
      id: 7,
      uid: 'fedcba9876543210fedcba9876543210',
    })),
    edit: vi.fn<LifeEventRepository['edit']>(async () => ({
      ok: true as const,
    })),
    delete: vi.fn<LifeEventRepository['delete']>(async () => ({ ok: true, removedKeys: [] })),
    replaceCardImage: vi.fn(),
    removeCardImage: vi.fn(),
    isCardImage: vi.fn(),
  }) satisfies LifeEventRepository;

let lifeEvents: ReturnType<typeof fakeLifeEvents>;

beforeEach(() => {
  lifeEvents = fakeLifeEvents(lifeEvent());
});

describe('registerLifeEvent', () => {
  it('識別子が空なら、推測できない値を入れて登録する（FR-035）', async () => {
    const outcome = await registerLifeEvent(lifeEvents, OWNER, values());

    expect(outcome).toEqual({
      status: 'registered',
      id: 7,
      uid: 'fedcba9876543210fedcba9876543210',
    });
    const [saved] = lifeEvents.register.mock.calls[0] ?? [];
    expect(saved).toMatchObject({ title: '作り物の出来事', happenedOn: '2020-04-01' });
    expect(isSlug(saved?.slug ?? '')).toBe(true);
    expect(saved?.slug).not.toContain('2020');
  });

  it('起きた日の無い登録を拒み、何も書かない（FR-025）', async () => {
    const outcome = await registerLifeEvent(lifeEvents, OWNER, values({ happenedOn: '' }));

    expect(outcome).toMatchObject({ status: 'invalid', errors: { happenedOn: 'missing' } });
    expect(lifeEvents.register).not.toHaveBeenCalled();
  });

  it('形の違う起きた日を拒む', async () => {
    const outcome = await registerLifeEvent(
      lifeEvents,
      OWNER,
      values({ happenedOn: '2020-13-01' }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { happenedOn: 'invalid' } });
  });

  it('形の違う識別子を拒む（FR-035）', async () => {
    const outcome = await registerLifeEvent(lifeEvents, OWNER, values({ slug: 'Fake Slug' }));

    expect(outcome).toMatchObject({ status: 'invalid', errors: { slug: 'invalid' } });
    expect(lifeEvents.register).not.toHaveBeenCalled();
  });

  it('入れた識別子で登録する。重なれば理由を返す', async () => {
    lifeEvents.register.mockResolvedValueOnce({ ok: false, reason: 'slug-taken' } as never);

    const outcome = await registerLifeEvent(lifeEvents, OWNER, values({ slug: 'fake-taken' }));

    expect(lifeEvents.register.mock.calls[0]?.[0]).toMatchObject({ slug: 'fake-taken' });
    expect(outcome).toMatchObject({ status: 'invalid', errors: { slug: 'slug-taken' } });
  });

  it('オーナーでなければ何も書かず、入力した値を返さない（FR-031）', async () => {
    const outcome = await registerLifeEvent(lifeEvents, null, values());

    expect(outcome).toEqual({ status: 'forbidden' });
    expect(lifeEvents.register).not.toHaveBeenCalled();
  });
});

describe('editLifeEvent', () => {
  it('識別子を書き換えられる（FR-035）', async () => {
    const outcome = await editLifeEvent(lifeEvents, OWNER, 1, values({ slug: 'fake-renamed' }));

    expect(outcome).toEqual({ status: 'saved' });
    expect(lifeEvents.edit).toHaveBeenCalledWith(1, {
      title: '作り物の出来事',
      description: null,
      happenedOn: '2020-04-01',
      slug: 'fake-renamed',
    });
  });

  it('識別子が空なら、今の識別子のまま保存する', async () => {
    await editLifeEvent(lifeEvents, OWNER, 1, values({ slug: '' }));

    expect(lifeEvents.edit.mock.calls[0]?.[1]).toMatchObject({ slug: 'fake-life-event' });
  });

  it('起きた日を消した保存を拒む（FR-025）', async () => {
    const outcome = await editLifeEvent(lifeEvents, OWNER, 1, values({ happenedOn: '' }));

    expect(outcome).toMatchObject({ status: 'invalid', errors: { happenedOn: 'missing' } });
    expect(lifeEvents.edit).not.toHaveBeenCalled();
  });

  it('無い life event なら not-found', async () => {
    lifeEvents = fakeLifeEvents(null);

    expect(await editLifeEvent(lifeEvents, OWNER, 9, values())).toEqual({ status: 'not-found' });
  });

  it('オーナーでなければ何も書かない', async () => {
    expect(await editLifeEvent(lifeEvents, null, 1, values())).toEqual({ status: 'forbidden' });
    expect(lifeEvents.edit).not.toHaveBeenCalled();
  });
});

describe('deleteLifeEvent', () => {
  const storage = { save: vi.fn(), read: vi.fn(), remove: vi.fn(async () => {}) };

  it('life event を消す（FR-023）', async () => {
    expect(await deleteLifeEvent(lifeEvents, storage, OWNER, 1)).toEqual({ status: 'deleted' });
    expect(lifeEvents.delete).toHaveBeenCalledWith(1);
  });

  it('オーナーでなければ何も消さない', async () => {
    expect(await deleteLifeEvent(lifeEvents, storage, null, 1)).toEqual({ status: 'forbidden' });
    expect(lifeEvents.delete).not.toHaveBeenCalled();
  });
});
