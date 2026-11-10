import { describe, expect, it } from 'vitest';
import {
  NOTE_CARD_IMAGES,
  NOTE_STATUSES,
  checkPublishable,
  checkSlugChange,
  isVisibleToVisitors,
  parseNoteInput,
  toNoteFormValues,
  type NoteFormValues,
} from '@/features/note/domain/note';

/**
 * note の domain の決まり（specs/003-note/spec.md の FR-002・FR-003・FR-005・FR-010・FR-011）。
 * 識別子の形そのものは tests/unit/slug.test.ts が持つ
 */

const values = (overrides: Partial<NoteFormValues> = {}): NoteFormValues => ({
  slug: 'sample-note',
  title: '作り物の題',
  description: '',
  body: '作り物の本文',
  ...overrides,
});

describe('値の並び', () => {
  it('状態は下書きと公開（FR-010）', () => {
    expect(NOTE_STATUSES).toEqual(['draft', 'published']);
  });

  it('代表画像の出どころは 3 つ（FR-024）', () => {
    expect(NOTE_CARD_IMAGES).toEqual(['generated', 'media', 'site']);
  });
});

describe('parseNoteInput', () => {
  it('題の前後の空白を除き、説明文の空を null にし、本文の改行を揃える', () => {
    expect(
      parseNoteInput(values({ title: '  作り物の題 ', description: ' ', body: '1行目\r\n2行目' })),
    ).toEqual({
      ok: true,
      input: { slug: 'sample-note', title: '作り物の題', description: null, body: '1行目\n2行目' },
    });
  });

  it('題が空でも保存できる（公開は checkPublishable が止める）', () => {
    expect(parseNoteInput(values({ title: '' })).ok).toBe(true);
  });

  it('200 文字の題を通し、201 文字の題を拒む（FR-005）', () => {
    expect(parseNoteInput(values({ title: 'あ'.repeat(200) })).ok).toBe(true);
    expect(parseNoteInput(values({ title: 'あ'.repeat(201) }))).toEqual({
      ok: false,
      errors: { title: 'too-long' },
    });
  });

  it('題の長さは SQLite と同じく文字の数で数える', () => {
    expect(parseNoteInput(values({ title: '😀'.repeat(200) })).ok).toBe(true);
  });

  it('100,000 文字の本文を通し、100,001 文字の本文を拒む（FR-005）', () => {
    expect(parseNoteInput(values({ body: 'a'.repeat(100_000) })).ok).toBe(true);
    expect(parseNoteInput(values({ body: 'a'.repeat(100_001) }))).toEqual({
      ok: false,
      errors: { body: 'too-long' },
    });
  });

  it.each([
    ['空', '', 'missing'],
    ['101 文字', 'a'.repeat(101), 'invalid'],
    ['大文字', 'Sample-Note', 'invalid'],
    ['空白', 'sample note', 'invalid'],
  ])('識別子が%sなら拒む（FR-002）', (_label, slug, error) => {
    expect(parseNoteInput(values({ slug }))).toEqual({ ok: false, errors: { slug: error } });
  });
});

describe('checkSlugChange（FR-003）', () => {
  it('一度も公開していない note の識別子は変えられる', () => {
    expect(checkSlugChange({ slug: 'before', publishedAt: null }, 'after')).toBeNull();
  });

  it('公開したことのある note の識別子の書き換えを拒む', () => {
    expect(
      checkSlugChange({ slug: 'before', publishedAt: '2026-11-01T00:00:00.000Z' }, 'after'),
    ).toBe('slug-locked');
  });

  it('公開したことのある note でも、同じ識別子なら通す', () => {
    expect(
      checkSlugChange({ slug: 'before', publishedAt: '2026-11-01T00:00:00.000Z' }, 'before'),
    ).toBeNull();
  });
});

describe('checkPublishable（FR-011）', () => {
  it.each(['', '   '])('題が「%s」の版を公開しない', (title) => {
    expect(checkPublishable({ title })).toEqual({ title: 'missing' });
  });

  it('題があれば公開できる', () => {
    expect(checkPublishable({ title: '作り物の題' })).toEqual({});
  });
});

describe('toNoteFormValues', () => {
  it('作成の画面は空', () => {
    expect(toNoteFormValues()).toEqual({ slug: '', title: '', description: '', body: '' });
  });

  it('編集の画面は最も新しい版から始まる（FR-007）', () => {
    expect(
      toNoteFormValues({
        slug: 'sample-note',
        latestRevision: {
          uid: '0'.repeat(32),
          title: '新しい題',
          description: null,
          body: '新しい本文',
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      }),
    ).toEqual({ slug: 'sample-note', title: '新しい題', description: '', body: '新しい本文' });
  });
});

describe('isVisibleToVisitors（FR-014〜FR-016）', () => {
  it('公開で削除していない note は訪問者に見える', () => {
    expect(isVisibleToVisitors({ status: 'published', deletedAt: null })).toBe(true);
  });

  it('下書きの note は訪問者に見えない', () => {
    expect(isVisibleToVisitors({ status: 'draft', deletedAt: null })).toBe(false);
  });

  it.each(['published', 'draft'] as const)(
    '削除した note は、状態が「%s」のままでも訪問者に見えない',
    (status) => {
      expect(isVisibleToVisitors({ status, deletedAt: '2026-11-10T00:00:00.000Z' })).toBe(false);
    },
  );
});
