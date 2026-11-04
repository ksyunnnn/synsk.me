import { describe, expect, it } from 'vitest';
import { decideProjectSlug, isProjectSlug } from '@/features/project/domain/project';
import { canSaveWithOrganization } from '@/shared/domain/organization';

/**
 * 実績の秘匿化の決まり（specs/001-career-and-project/spec.md の FR-001・FR-013）。
 * 訪問者への応答に隠す値が無いことは tests/integration/project-masking.test.ts が持つ。
 */

const UID = '0b6f3c1e-1111-4222-8333-444455556666';

describe('decideProjectSlug（FR-013）', () => {
  it('秘匿化した実績の識別子の書き換えを拒む', () => {
    expect(
      decideProjectSlug({ slug: UID, isMasked: true }, { isMasked: true, requestedSlug: 'my-app' }),
    ).toEqual({ ok: false, error: 'masked-slug-locked' });
  });

  it('秘匿化した実績は、同じ識別子のまま保存する', () => {
    expect(
      decideProjectSlug({ slug: UID, isMasked: true }, { isMasked: true, requestedSlug: UID }),
    ).toEqual({ ok: true, slug: UID });
  });

  it('秘匿化を外す保存では、識別子を変えない', () => {
    expect(
      decideProjectSlug(
        { slug: UID, isMasked: true },
        { isMasked: false, requestedSlug: 'my-app' },
      ),
    ).toEqual({ ok: false, error: 'masked-slug-locked' });
    expect(
      decideProjectSlug({ slug: UID, isMasked: true }, { isMasked: false, requestedSlug: UID }),
    ).toEqual({ ok: true, slug: UID });
  });

  it('秘匿化に切り替えると、送られた識別子によらず新しい uid にする', () => {
    const decided = decideProjectSlug(
      { slug: 'my-app', isMasked: false },
      { isMasked: true, requestedSlug: 'my-app' },
    );
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.slug).not.toBe('my-app');
    expect(decided.slug).toMatch(/^[0-9a-f-]{36}$/);
    expect(isProjectSlug(decided.slug)).toBe(true);
  });

  it('秘匿化しない実績は、識別子を書き換えられる', () => {
    expect(
      decideProjectSlug(
        { slug: 'my-app', isMasked: false },
        { isMasked: false, requestedSlug: 'renamed' },
      ),
    ).toEqual({ ok: true, slug: 'renamed' });
  });

  it.each([
    ['', 'missing'],
    ['Not_Valid', 'invalid'],
  ])('秘匿化しない実績の識別子 %j は %s で拒む', (requestedSlug, error) => {
    expect(
      decideProjectSlug({ slug: 'my-app', isMasked: false }, { isMasked: false, requestedSlug }),
    ).toEqual({ ok: false, error });
  });
});

describe('canSaveWithOrganization（FR-001）', () => {
  it('秘匿化した組織名の無い組織で、秘匿化しない', () => {
    expect(
      canSaveWithOrganization(
        { nameMasked: null },
        { isMasked: true, organizationNameMasked: null },
      ),
    ).toBe(false);
  });

  it('組織が秘匿化した組織名を持たなければ、入力した値で秘匿化できる', () => {
    expect(
      canSaveWithOrganization(
        { nameMasked: null },
        { isMasked: true, organizationNameMasked: 'ある会社' },
      ),
    ).toBe(true);
  });

  it('組織が無ければ、作るときの秘匿化した組織名で判定する', () => {
    expect(canSaveWithOrganization(null, { isMasked: true, organizationNameMasked: null })).toBe(
      false,
    );
    expect(
      canSaveWithOrganization(null, { isMasked: true, organizationNameMasked: 'ある会社' }),
    ).toBe(true);
  });

  it('秘匿化しない実績は、秘匿化した組織名によらず保存できる', () => {
    expect(canSaveWithOrganization(null, { isMasked: false, organizationNameMasked: null })).toBe(
      true,
    );
  });
});
