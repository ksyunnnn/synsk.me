import { describe, expect, it } from 'vitest';
import {
  NOTE_BODY_MAX,
  NOTE_TITLE_MAX,
  parseNoteForm,
  parseRevisionNumber,
  toCardDescription,
} from '@/features/note/domain/note';

/**
 * note の入力の読み方と、版の番号・カードの説明の決まり（specs/003-note/spec.md の FR-002・
 * FR-005、research.md の R4、docs/CRAWLING.md）
 */

const values = (
  overrides: Partial<Record<'slug' | 'title' | 'description' | 'body', string>> = {},
) => ({
  slug: 'fake-note',
  title: '作り物の題',
  description: '',
  body: '作り物の本文',
  ...overrides,
});

describe('parseNoteForm', () => {
  it('識別子は 1〜100 文字の英小文字・数字・ハイフン（FR-002）', () => {
    expect(parseNoteForm(values({ slug: '' }))).toEqual({ ok: false, errors: { slug: 'missing' } });
    expect(parseNoteForm(values({ slug: 'Fake_Note' }))).toEqual({
      ok: false,
      errors: { slug: 'invalid' },
    });
    expect(parseNoteForm(values({ slug: 'a'.repeat(101) }))).toMatchObject({ ok: false });
    expect(parseNoteForm(values({ slug: 'a'.repeat(100) }))).toMatchObject({ ok: true });
  });

  it('題は空でも保存でき、200 文字を超えると拒む（FR-005、spec の Edge Cases）', () => {
    expect(parseNoteForm(values({ title: '' }))).toMatchObject({
      ok: true,
      content: { title: '' },
    });
    expect(parseNoteForm(values({ title: 'あ'.repeat(NOTE_TITLE_MAX) }))).toMatchObject({
      ok: true,
    });
    expect(parseNoteForm(values({ title: 'あ'.repeat(NOTE_TITLE_MAX + 1) }))).toEqual({
      ok: false,
      errors: { title: 'too-long' },
    });
  });

  it('文字数はコードポイントで数える。D1 の length() と同じ', () => {
    // 絵文字 1 つは UTF-16 で 2 つの単位だが、1 文字と数える
    expect(parseNoteForm(values({ title: '😀'.repeat(NOTE_TITLE_MAX) }))).toMatchObject({
      ok: true,
    });
  });

  it('本文は 100,000 文字を超えると拒み、改行を \\n に揃える', () => {
    expect(parseNoteForm(values({ body: 'a'.repeat(NOTE_BODY_MAX + 1) }))).toEqual({
      ok: false,
      errors: { body: 'too-long' },
    });
    expect(parseNoteForm(values({ body: '1 行目\r\n2 行目' }))).toMatchObject({
      content: { body: '1 行目\n2 行目' },
    });
  });

  it('説明文は空なら null', () => {
    expect(parseNoteForm(values({ description: '  ' }))).toMatchObject({
      content: { description: null },
    });
    expect(parseNoteForm(values({ description: '作り物の説明' }))).toMatchObject({
      content: { description: '作り物の説明' },
    });
  });
});

describe('parseRevisionNumber', () => {
  it('正の整数だけを読む', () => {
    expect(parseRevisionNumber('3')).toBe(3);
    expect(parseRevisionNumber('0')).toBeNull();
    expect(parseRevisionNumber('-1')).toBeNull();
    expect(parseRevisionNumber('1.5')).toBeNull();
    expect(parseRevisionNumber('')).toBeNull();
  });
});

describe('toCardDescription', () => {
  it('説明文があればそれを使う', () => {
    expect(toCardDescription({ description: '作り物の説明', body: '本文' })).toBe('作り物の説明');
  });

  it('説明文が無ければ、本文の冒頭から Markdown の記号と画像を落とした文を使う', () => {
    expect(
      toCardDescription({
        description: null,
        body: '# 見出し\n\n![図](media:x.png)\n\n[リンク](https://example.com)の文',
      }),
    ).toBe('見出し リンクの文');
  });

  it('並びの印と強調の記号を落とし、URL の中のハイフンは残す', () => {
    expect(
      toCardDescription({
        description: null,
        body: '- **強調** の項目\n\nhttps://example.com/fake-page-name',
      }),
    ).toBe('強調 の項目 https://example.com/fake-page-name');
  });

  it('120 文字を超える本文は切り、本文も空なら null', () => {
    expect(toCardDescription({ description: null, body: 'あ'.repeat(200) })).toBe(
      `${'あ'.repeat(120)}…`,
    );
    expect(toCardDescription({ description: null, body: '' })).toBeNull();
  });
});
