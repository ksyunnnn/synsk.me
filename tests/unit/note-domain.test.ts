import { describe, expect, it } from 'vitest';
import {
  parseNoteId,
  toNoteSummaryDto,
  toEditableNoteDto,
  toPublishedDate,
  toPublishedNoteDto,
  validateDraft,
  validatePublication,
} from '@/features/note/domain/note';

/**
 * note の規則（specs/005-note-write-and-read/data-model.md）。
 *
 * 同じ規則はデータベースの制約も持つ。境界の値がデータベースと食い違わないことは
 * `tests/workers/d1-note-repository.test.ts` が確かめる。
 */

const valid = { slug: 'hello-world-1', title: '題', body: '本文' };

describe('保存できる入力', () => {
  it('規則に合う入力は通る', () => {
    expect(validateDraft(valid)).toEqual({ ok: true, content: valid });
  });

  it('題と本文は空でよい', () => {
    expect(validateDraft({ ...valid, title: '', body: '' }).ok).toBe(true);
  });

  describe('slug', () => {
    it('空なら足りない', () => {
      expect(validateDraft({ ...valid, slug: '' })).toEqual({
        ok: false,
        errors: { slug: 'missing' },
      });
    });

    it('100文字は通り、101文字は使えない', () => {
      expect(validateDraft({ ...valid, slug: 'a'.repeat(100) }).ok).toBe(true);
      expect(validateDraft({ ...valid, slug: 'a'.repeat(101) })).toEqual({
        ok: false,
        errors: { slug: 'invalid' },
      });
    });

    it.each(['Hello', 'hello_world', 'hello world', 'ハロー', 'note😀', 'é'])(
      '%s は使えない',
      (slug) => {
        expect(validateDraft({ ...valid, slug })).toEqual({
          ok: false,
          errors: { slug: 'invalid' },
        });
      },
    );
  });

  describe('題', () => {
    it('200文字は通り、201文字は長すぎる', () => {
      expect(validateDraft({ ...valid, title: 'あ'.repeat(200) }).ok).toBe(true);
      expect(validateDraft({ ...valid, title: 'あ'.repeat(201) })).toEqual({
        ok: false,
        errors: { title: 'too-long' },
      });
    });

    it('絵文字を1文字と数える', () => {
      // '😀' は UTF-16 では2つのコード単位。`length` で数えると 400 になる
      expect(validateDraft({ ...valid, title: '😀'.repeat(200) }).ok).toBe(true);
      expect(validateDraft({ ...valid, title: '😀'.repeat(201) }).ok).toBe(false);
    });
  });

  describe('本文', () => {
    it('100,000文字は通り、100,001文字は長すぎる', () => {
      expect(validateDraft({ ...valid, body: 'a'.repeat(100_000) }).ok).toBe(true);
      expect(validateDraft({ ...valid, body: 'a'.repeat(100_001) })).toEqual({
        ok: false,
        errors: { body: 'too-long' },
      });
    });

    it('絵文字を1文字と数える', () => {
      expect(validateDraft({ ...valid, body: '😀'.repeat(100_000) }).ok).toBe(true);
      expect(validateDraft({ ...valid, body: '😀'.repeat(100_001) }).ok).toBe(false);
    });
  });

  it('誤りを項目ごとにすべて返す', () => {
    expect(validateDraft({ slug: '', title: 'あ'.repeat(201), body: 'a'.repeat(100_001) })).toEqual(
      { ok: false, errors: { slug: 'missing', title: 'too-long', body: 'too-long' } },
    );
  });
});

describe('公開できる入力', () => {
  it('規則に合い、題がある入力は通る', () => {
    expect(validatePublication(valid)).toEqual({ ok: true, content: valid });
  });

  it('題が空なら足りない', () => {
    expect(validatePublication({ ...valid, title: '' })).toEqual({
      ok: false,
      errors: { title: 'missing' },
    });
  });

  it('保存の規則にも従う', () => {
    expect(validatePublication({ ...valid, slug: 'A', body: 'a'.repeat(100_001) })).toEqual({
      ok: false,
      errors: { slug: 'invalid', body: 'too-long' },
    });
  });
});

describe('公開日', () => {
  it('日本時間の日付にする', () => {
    expect(toPublishedDate('2026-09-16T15:30:00.000Z')).toBe('2026-09-17');
  });

  it('日本時間で日付が変わる直前は前の日のまま', () => {
    expect(toPublishedDate('2026-09-16T14:59:59.999Z')).toBe('2026-09-16');
  });
});

describe('画面に渡す形', () => {
  // 取り出した値に、画面へ出さない値が混ざっていても落とす。出す項目を列挙する
  // 許可リスト方式（constitution の Allowlist Visibility）
  it('公開済みの note は、公開している値と公開日だけを持つ', () => {
    const note = {
      slug: 'a',
      title: '題',
      body: '本文',
      firstPublishedAt: '2026-09-16T15:30:00.000Z',
      draftTitle: '下書きの題',
    };
    expect(toPublishedNoteDto(note)).toEqual({
      slug: 'a',
      title: '題',
      body: '本文',
      publishedOn: '2026-09-17',
    });
  });

  it('一覧の1件は、slug・題・状態・公開し直していない書き換えの有無と id だけを持つ', () => {
    const summary = {
      id: 1,
      slug: 'a',
      title: '題',
      status: 'published' as const,
      hasUnpublishedChanges: true,
      body: '本文',
    };
    expect(toNoteSummaryDto(summary)).toEqual({
      id: 1,
      slug: 'a',
      title: '題',
      status: 'published',
      hasUnpublishedChanges: true,
    });
  });

  it('編集する note は、書き換えている値と状態だけを持つ', () => {
    const note = {
      id: 1,
      slug: 'a',
      title: '題',
      body: '本文',
      status: 'draft' as const,
      firstPublishedAt: null,
    };
    expect(toEditableNoteDto(note)).toEqual({
      id: 1,
      slug: 'a',
      title: '題',
      body: '本文',
      status: 'draft',
    });
  });
});

describe('note の id', () => {
  it('正の整数の文字列を id にする', () => {
    expect(parseNoteId('1')).toBe(1);
    expect(parseNoteId('9007199254740991')).toBe(9007199254740991);
  });

  it.each(['', '0', '-1', '01', '1.5', '1e3', 'abc', ' 1', '9007199254740992'])(
    '%j は id でない',
    (value) => {
      expect(parseNoteId(value)).toBeNull();
    },
  );
});
