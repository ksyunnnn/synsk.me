import { describe, expect, it } from 'vitest';
import {
  parseProjectContent,
  parseProjectId,
  toProjectCardPreview,
  toProjectFormValues,
  type ProjectFormValues,
} from '@/features/project/domain/project';
import { PROJECT_KINDS } from '@/shared/domain/project-kind';

/**
 * 実績の domain の決まり（specs/001-career-and-project/spec.md の FR-011〜FR-013・FR-015・
 * FR-038・FR-039・FR-044）。秘匿化の決まりは tests/unit/project-masking.test.ts が、識別子の形と
 * 既定値は tests/unit/slug.test.ts が持つ。
 */

const values = (overrides: Partial<ProjectFormValues> = {}): ProjectFormValues => ({
  ...toProjectFormValues(),
  organizationName: '作り物株式会社',
  organizationNameMasked: 'ある会社',
  title: '作り物の受託開発',
  titleMasked: '業務システムの開発',
  startedOn: '2021-04-01',
  ...overrides,
});

describe('種類（FR-012）', () => {
  it('4 つの値を持つ', () => {
    expect(PROJECT_KINDS).toEqual(['develop', 'host', 'talk', 'other']);
  });

  it.each(PROJECT_KINDS)('%s を通す', (kind) => {
    expect(parseProjectContent(values({ kind })).ok).toBe(true);
  });

  it('ほかの値を拒む', () => {
    expect(parseProjectContent(values({ kind: 'blog' }))).toEqual({
      ok: false,
      errors: { kind: 'invalid' },
    });
  });
});

describe('parseProjectContent', () => {
  it('入力を保存する内容に読み替える', () => {
    expect(
      parseProjectContent(
        values({ endedOn: '', description: '1行目\r\n2行目', url: ' https://example.com/x ' }),
      ),
    ).toEqual({
      ok: true,
      content: {
        organizationName: '作り物株式会社',
        organizationNameMasked: 'ある会社',
        kind: 'develop',
        title: '作り物の受託開発',
        titleMasked: '業務システムの開発',
        isMasked: true,
        status: 'draft',
        period: { startedOn: '2021-04-01', endedOn: null },
        description: '1行目\n2行目',
        url: 'https://example.com/x',
        skillIds: [],
      },
    });
  });

  it('空にできる項目は null にする（FR-011）', () => {
    const parsed = parseProjectContent(
      values({ organizationNameMasked: '', description: '', url: '' }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      content: { organizationNameMasked: null, description: null, url: null },
    });
  });

  it.each([
    ['organizationName', { organizationName: ' ' }, 'missing'],
    ['title', { title: '' }, 'missing'],
    ['titleMasked', { titleMasked: '' }, 'missing'],
    ['startedOn', { startedOn: '' }, 'missing'],
    ['startedOn', { startedOn: '2021-02-30' }, 'invalid'],
    ['endedOn', { endedOn: '2021-03-31' }, 'ended-before-started'],
    ['url', { url: 'javascript:alert(1)' }, 'invalid'],
    ['url', { url: 'example.com' }, 'invalid'],
  ] as const)('%s の不備を項目ごとに返す', (field, overrides, error) => {
    expect(parseProjectContent(values(overrides))).toEqual({
      ok: false,
      errors: { [field]: error },
    });
  });
});

describe('サイトに載せるか（FR-044）', () => {
  it('登録の画面の初めの値は、サイトに載せない', () => {
    expect(toProjectFormValues().status).toBe('draft');
  });

  it('published を送ったときだけ、サイトに載せる', () => {
    expect(parseProjectContent(values({ status: 'published' }))).toMatchObject({
      ok: true,
      content: { status: 'published' },
    });
  });

  it.each(['', 'draft', 'public'])('%j を送ると、サイトに載せない', (status) => {
    expect(parseProjectContent(values({ status }))).toMatchObject({
      ok: true,
      content: { status: 'draft' },
    });
  });
});

describe('スキルのつなぎ（FR-032）', () => {
  it('カンマで区切った id を読み、重なりを除く', () => {
    expect(parseProjectContent(values({ skillIds: '3,1,3' }))).toMatchObject({
      ok: true,
      content: { skillIds: [3, 1] },
    });
  });

  it('空なら 0 個', () => {
    expect(parseProjectContent(values({ skillIds: '' }))).toMatchObject({
      ok: true,
      content: { skillIds: [] },
    });
  });

  it('読めない id を拒む', () => {
    expect(parseProjectContent(values({ skillIds: '1,x' }))).toEqual({
      ok: false,
      errors: { skillIds: 'invalid' },
    });
  });
});

describe('parseProjectId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['0', null],
    ['-1', null],
    ['1.5', null],
    ['new', null],
    ['', null],
  ])('%j は %j', (value, expected) => {
    expect(parseProjectId(value)).toBe(expected);
  });
});

describe('toProjectCardPreview（issue #330）', () => {
  const OWN = '11111111-1111-4111-8111-111111111111';
  const CARD = '22222222-2222-4222-8222-222222222222';
  const OTHER = '33333333-3333-4333-8333-333333333333';

  it('本文の最初の段落を要約にし、画像だけの段落は飛ばす', () => {
    const preview = toProjectCardPreview({
      description: `![図](media:${OWN})\n\n最初の段落\nの続き\n\n二つ目`,
      mediaStorageKeys: [OWN],
      cardMediaKey: null,
    });
    expect(preview).toEqual({ excerpt: '最初の段落 の続き', imageKey: OWN });
  });

  it('代表画像があれば、本文の画像より先に代表画像を出す', () => {
    const preview = toProjectCardPreview({
      description: `![図](media:${OWN})`,
      mediaStorageKeys: [OWN, CARD],
      cardMediaKey: CARD,
    });
    expect(preview.imageKey).toBe(CARD);
  });

  it('本文が指す画像のうち、その実績の画像だけを出す', () => {
    const preview = toProjectCardPreview({
      description: `![よその図](media:${OTHER})\n\n![図](media:${OWN})`,
      mediaStorageKeys: [OWN],
      cardMediaKey: null,
    });
    expect(preview.imageKey).toBe(OWN);
  });

  it('本文が無ければ、要約は null で、代表画像だけを出す', () => {
    expect(
      toProjectCardPreview({ description: null, mediaStorageKeys: [CARD], cardMediaKey: CARD }),
    ).toEqual({ excerpt: null, imageKey: CARD });
  });
});
