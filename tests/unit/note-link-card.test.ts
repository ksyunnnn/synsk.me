import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VisitorNoteView } from '@/features/note/components/visitor-note';
import type { VisitorNote } from '@/features/note/domain/note';

/**
 * URL カード（specs/003-note の FR-027・FR-030、research.md の R13）。参照先の題を持つ URL は
 * カードで、持たない URL はリンクで出す
 */

const note = (body: string, linkPreviews: VisitorNote['linkPreviews']): VisitorNote => ({
  slug: 'sample-note',
  title: '作り物の題',
  description: null,
  summary: null,
  body,
  publishedAt: '2026-11-05T00:00:00.000Z',
  cardImage: { kind: 'generated' },
  media: [],
  linkPreviews,
});

/** React が `<img>` ごとに足す `<link rel="preload">` は、この部品の出力でないため除く */
const render = (value: VisitorNote) =>
  renderToStaticMarkup(createElement(VisitorNoteView, { note: value })).replace(
    /<link rel="preload"[^>]*\/>/g,
    '',
  );

describe('VisitorNoteView の URL カード', () => {
  it('題を持つ URL は、題・ホスト名・画像を添えたカードのリンクで出す', () => {
    const html = render(
      note('https://example.com/articles/1', [
        {
          url: 'https://example.com/articles/1',
          title: '参照先の題',
          imageUrl: 'https://cdn.example.com/og.png',
        },
      ]),
    );
    expect(html).toContain('href="https://example.com/articles/1"');
    expect(html).toContain('参照先の題');
    expect(html).toContain('example.com');
    // 画像は参照先の URL のまま出し、保管しない（FR-030）。参照元を送らない
    expect(html).toMatch(
      /<img[^>]*src="https:\/\/cdn\.example\.com\/og\.png"[^>]*alt=""[^>]*loading="lazy"[^>]*referrerPolicy="no-referrer"/,
    );
  });

  it('画像を持たないカードは画像を出さない', () => {
    const html = render(
      note('https://example.com/a', [
        { url: 'https://example.com/a', title: '題だけ', imageUrl: null },
      ]),
    );
    expect(html).toContain('題だけ');
    expect(html).not.toContain('<img');
  });

  it('参照先の情報が無い URL と、題が無い URL は、URL の文字列のリンクで出す', () => {
    const html = render(
      note('https://example.com/unknown\n\nhttps://example.com/untitled', [
        { url: 'https://example.com/untitled', title: null, imageUrl: 'https://example.com/i.png' },
      ]),
    );
    expect(html).toContain(
      '<p><a href="https://example.com/unknown">https://example.com/unknown</a></p>',
    );
    expect(html).toContain(
      '<p><a href="https://example.com/untitled">https://example.com/untitled</a></p>',
    );
    expect(html).not.toContain('<img');
  });

  it('見た目の確認が渡した操作を、URL だけの段落ごとにその URL で添える。訪問者の表示は添えない', () => {
    const value = note('https://example.com/a\n\n本文\n\nhttps://example.com/b', [
      { url: 'https://example.com/a', title: '題', imageUrl: null },
    ]);
    const withAction = renderToStaticMarkup(
      createElement(VisitorNoteView, {
        note: value,
        renderUrlLineAction: (url: string) => createElement('button', null, `取り直す ${url}`),
      }),
    );
    expect(withAction).toContain('<button>取り直す https://example.com/a</button>');
    expect(withAction).toContain('<button>取り直す https://example.com/b</button>');
    expect(render(value)).not.toContain('<button');
  });
});
