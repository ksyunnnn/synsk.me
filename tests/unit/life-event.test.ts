import { describe, expect, it, vi } from 'vitest';
import {
  deleteLifeEvent,
  editLifeEvent,
  registerLifeEvent,
} from '@/features/activity/application/life-events';
import {
  LIFE_EVENT_FIELDS,
  isLifeEventSlug,
  newLifeEventSlug,
  paragraphsOf,
  parseLifeEventContent,
} from '@/features/activity/domain/life-event';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';

/**
 * life event の決まりとユースケース（specs/004-external-activity/spec.md の User Story 5、
 * FR-023〜FR-025・FR-031・FR-035、research.md の R10）。値はすべて作り物
 */

const OWNER = { email: 'owner@synsk.test' };
const UID = '0123456789abcdef0123456789abcdef';

const fakeLifeEvents = (overrides: Partial<LifeEventRepository> = {}): LifeEventRepository => ({
  findVisitorBySlug: vi.fn(),
  hasSlug: vi.fn(),
  findForEdit: vi.fn(),
  findIdByUid: vi.fn(),
  list: vi.fn(),
  register: vi.fn(async () => ({ ok: true as const, id: 1, uid: UID })),
  edit: vi.fn(async () => ({ ok: true as const })),
  delete: vi.fn(async () => ({ ok: true })),
  ...overrides,
});

const values = { title: '作り物の出来事', description: '', happenedOn: '2020-04-01', slug: '' };

describe('parseLifeEventContent', () => {
  it('題・説明・起きた日を読む（User Story 5 の 1）', () => {
    expect(parseLifeEventContent({ ...values, description: '一行目\r\n二行目' })).toEqual({
      ok: true,
      content: { title: '作り物の出来事', description: '一行目\n二行目', happenedOn: '2020-04-01' },
    });
  });

  it('起きた日が無ければ保存しない（User Story 5 の 2）', () => {
    expect(parseLifeEventContent({ ...values, happenedOn: '' })).toEqual({
      ok: false,
      errors: { happenedOn: 'missing' },
    });
  });

  it('実在しない日を拒む', () => {
    expect(parseLifeEventContent({ ...values, happenedOn: '2020-02-30' })).toEqual({
      ok: false,
      errors: { happenedOn: 'invalid' },
    });
  });

  it('題が無ければ保存しない（research.md の R10）', () => {
    expect(parseLifeEventContent({ ...values, title: ' ' })).toEqual({
      ok: false,
      errors: { title: 'missing' },
    });
  });

  it('リンク先の項目を持たない（User Story 5 の 7）', () => {
    expect(LIFE_EVENT_FIELDS).not.toContain('url');
  });
});

describe('識別子（FR-035）', () => {
  it('作るときの識別子は uid で、形を満たす', () => {
    const slug = newLifeEventSlug();
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(isLifeEventSlug(slug)).toBe(true);
  });

  it('作るときに、入れた識別子を使わず uid を入れる（User Story 5 の 8）', async () => {
    const lifeEvents = fakeLifeEvents();
    await registerLifeEvent(lifeEvents, OWNER, { ...values, slug: 'my-slug' });
    expect(lifeEvents.register).toHaveBeenCalledWith(
      expect.objectContaining({ slug: expect.not.stringMatching(/^my-slug$/) }),
    );
  });

  it('書き換えで形の違う識別子を拒む', async () => {
    const lifeEvents = fakeLifeEvents();
    expect(
      await editLifeEvent(lifeEvents, OWNER, 1, { ...values, slug: 'Bad_Slug' }),
    ).toMatchObject({
      status: 'invalid',
      errors: { slug: 'invalid' },
    });
    expect(lifeEvents.edit).not.toHaveBeenCalled();
  });

  it('ほかの life event と重なる識別子を拒む（User Story 5 の 10）', async () => {
    const lifeEvents = fakeLifeEvents({
      edit: vi.fn(async () => ({ ok: false as const, reason: 'slug-taken' as const })),
    });
    expect(
      await editLifeEvent(lifeEvents, OWNER, 1, { ...values, slug: 'taken-slug' }),
    ).toMatchObject({ status: 'invalid', errors: { slug: 'slug-taken' } });
  });
});

describe('オーナーでない呼び出し（FR-031）', () => {
  it('作成・書き換え・削除のどれも何も書かない', async () => {
    const lifeEvents = fakeLifeEvents();
    expect(await registerLifeEvent(lifeEvents, null, values)).toEqual({ status: 'forbidden' });
    expect(await editLifeEvent(lifeEvents, null, 1, values)).toEqual({ status: 'forbidden' });
    expect(await deleteLifeEvent(lifeEvents, null, 1)).toEqual({ status: 'forbidden' });
    expect(lifeEvents.register).not.toHaveBeenCalled();
    expect(lifeEvents.edit).not.toHaveBeenCalled();
    expect(lifeEvents.delete).not.toHaveBeenCalled();
  });
});

describe('paragraphsOf', () => {
  it('空行で段落に分け、空の説明は段落を持たない', () => {
    expect(paragraphsOf('一段落目\n続き\n\n二段落目\n \n')).toEqual(['一段落目\n続き', '二段落目']);
    expect(paragraphsOf(null)).toEqual([]);
  });
});
