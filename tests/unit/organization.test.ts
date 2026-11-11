import { describe, expect, it } from 'vitest';
import {
  PERSONAL_ORGANIZATION_ID,
  canBeReferencedAs,
  canChangeMaskedName,
  isPersonalOrganization,
  parseOrganizationName,
} from '@/shared/domain/organization';

/**
 * 組織の決まり（specs/001-career-and-project/spec.md の FR-001・FR-041）。
 * 保存の検査は tests/workers/organization-repository.test.ts が持つ。
 */

describe('canBeReferencedAs（FR-001）', () => {
  it.each([
    ['秘匿化した組織名を持つ', 'ある会社', true],
    ['秘匿化した組織名を持たない', null, false],
    ['秘匿化した組織名が空白だけ', '  ', false],
  ])('%s組織を、秘匿化した職歴・実績が指せるか: %s', (_, nameMasked, expected) => {
    expect(canBeReferencedAs({ nameMasked }, { isMasked: true })).toBe(expected);
  });

  it.each(['ある会社', null])(
    '秘匿化しない職歴・実績は、秘匿化した組織名（%s）によらず指せる',
    (nameMasked) => {
      expect(canBeReferencedAs({ nameMasked }, { isMasked: false })).toBe(true);
    },
  );
});

describe('canChangeMaskedName（FR-001）', () => {
  it.each([null, ''])(
    '秘匿化した職歴・実績が指す組織の、秘匿化した組織名を空（%j）にできない',
    (nameMasked) => {
      expect(canChangeMaskedName(nameMasked, { isReferencedByMasked: true })).toBe(false);
    },
  );

  it('秘匿化した職歴・実績が指す組織の、秘匿化した組織名を別の値に変えられる', () => {
    expect(canChangeMaskedName('別の会社', { isReferencedByMasked: true })).toBe(true);
  });

  it('秘匿化した職歴・実績が指さない組織の、秘匿化した組織名を空にできる', () => {
    expect(canChangeMaskedName(null, { isReferencedByMasked: false })).toBe(true);
  });
});

describe('parseOrganizationName', () => {
  it('前後の空白を落とす', () => {
    expect(parseOrganizationName('  作り物株式会社 ')).toBe('作り物株式会社');
  });

  it.each(['', '   '])('空（%j）なら null', (value) => {
    expect(parseOrganizationName(value)).toBeNull();
  });
});

describe('個人の組織（FR-041）', () => {
  it('定数の id だけを個人の組織とみなす', () => {
    expect(isPersonalOrganization(PERSONAL_ORGANIZATION_ID)).toBe(true);
    expect(isPersonalOrganization(PERSONAL_ORGANIZATION_ID + 1)).toBe(false);
  });
});
