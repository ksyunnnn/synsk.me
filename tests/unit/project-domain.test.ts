import { describe, expect, it } from 'vitest';
import {
  PROJECT_KINDS,
  isProjectSlug,
  newProjectSlug,
  parseProjectContent,
  parseProjectId,
  toProjectFormValues,
  type ProjectFormValues,
} from '@/features/project/domain/project';

/**
 * 実績の domain の決まり（specs/001-career-and-project/spec.md の FR-011〜FR-013・FR-015・
 * FR-038・FR-039・FR-044）。秘匿化の決まりは tests/unit/project-masking.test.ts が持つ。
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

describe('識別子（FR-013）', () => {
  it('登録の識別子は uid で、識別子の形を満たす', () => {
    const slug = newProjectSlug();
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(isProjectSlug(slug)).toBe(true);
  });

  it('呼ぶたびに別の識別子になる', () => {
    expect(newProjectSlug()).not.toBe(newProjectSlug());
  });

  it.each(['a', 'my-app-2', 'a'.repeat(100)])('%s を識別子として通す', (slug) => {
    expect(isProjectSlug(slug)).toBe(true);
  });

  it.each(['', 'A', 'my_app', 'my app', 'あ', 'a'.repeat(101)])('%j を識別子として拒む', (slug) => {
    expect(isProjectSlug(slug)).toBe(false);
  });
});

describe('種類（FR-012）', () => {
  it('4 つの値を持つ', () => {
    expect(PROJECT_KINDS).toEqual(['application', 'talk', 'event', 'other']);
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
        kind: 'application',
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
