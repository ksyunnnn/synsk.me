import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mediaMarkOf } from '@/features/note/domain/note';
import { MarkdownBody } from '@/shared/components/markdown-body';
import { readMarkdown } from '@/shared/domain/markdown';

/**
 * 本文の Markdown の読み方（src/shared/domain/markdown.ts）と描き方
 * （src/shared/components/markdown-body.tsx）。U4 の決定と specs/003-note/research.md の R11
 */

const KEY_A = '0b6f3c1e-1111-4222-8333-444455556666';
const KEY_B = '9a8b7c6d-2222-4333-8444-555566667777';

describe('readMarkdown', () => {
  it('画像の印のキーを、現れた順に重ねずに読む。参照の記法とリストの中の印も読む', () => {
    const body = [
      `![一枚目](media:${KEY_A} "ホバーの文")`,
      '',
      `- 文の中の ![二枚目][b] と ![一枚目](media:${KEY_A})`,
      '',
      `[b]: media:${KEY_B}`,
    ].join('\n');
    expect(readMarkdown(body).mediaKeys).toEqual([KEY_A, KEY_B]);
  });

  it('コードの中に書いた印、形の違うキー、ほかの URL の画像は読まない', () => {
    const body = [
      '```',
      `![コード](media:${KEY_A})`,
      '```',
      '',
      `\`![インライン](media:${KEY_B})\``,
      '',
      '![形が違う](media:1)',
      '',
      '![外](https://example.com/a.png)',
    ].join('\n');
    expect(readMarkdown(body).mediaKeys).toEqual([]);
  });

  it('URL だけの段落の URL を読み、文と並べた URL と http(s) でない URL は読まない', () => {
    const body = [
      'https://example.com/a',
      '',
      '前に文がある https://example.com/b',
      '',
      'ftp://example.com/c',
      '',
      '<https://example.com/d>',
      '',
      'https://example.com/a',
      '',
      '> https://example.com/e',
    ].join('\n');
    expect(readMarkdown(body).urlLines).toEqual(['https://example.com/a', 'https://example.com/e']);
  });

  it('URL だけの段落の URL を URL の形に揃え、表記の違う同じ URL を重ねない', () => {
    expect(readMarkdown('https://EXAMPLE.com/a\n\nhttps://example.com/a').urlLines).toEqual([
      'https://example.com/a',
    ]);
  });

  it('最初の文字列を持つ段落を、改行を空白にし、画像の代替テキストを除いて読む', () => {
    const body = ['# 見出し', '', `![代替](media:${KEY_A})`, '', '一行目\n二行目 **強調**'].join(
      '\n',
    );
    expect(readMarkdown(body).firstParagraph).toBe('一行目 二行目 強調');
    expect(readMarkdown('# 見出しだけ').firstParagraph).toBeNull();
  });

  it('画像のすぐ下の行のキャプションは、最初の段落として読まない', () => {
    const body = [`![代替](media:${KEY_A})`, '*キャプション*', '', '本文の一行目'].join('\n');
    expect(readMarkdown(body).firstParagraph).toBe('本文の一行目');
    expect(readMarkdown(body).mediaKeys).toEqual([KEY_A]);
  });

  it('空行を挟んだ強調の行と、画像と同じ行の強調は、キャプションでなく段落として読む', () => {
    expect(readMarkdown(`![代替](media:${KEY_A})\n\n*斜体の段落*`).firstParagraph).toBe(
      '斜体の段落',
    );
    expect(readMarkdown(`![代替](media:${KEY_A}) *同じ行*`).firstParagraph).toBe('同じ行');
  });
});

/**
 * 描いた HTML。React が `<img>` ごとに足す `<link rel="preload">` は、この部品の出力でないため除く
 */
const render = (body: string, renderUrlLine?: (url: string) => ReactNode) =>
  renderToStaticMarkup(
    createElement(MarkdownBody, {
      body,
      mediaSrc: (key) => (key === KEY_B ? null : `/notes/n/media/${key}`),
      renderUrlLine,
    }),
  ).replace(/<link rel="preload" as="image" href="[^"]*"\/>/g, '');

describe('MarkdownBody', () => {
  it('画像だけの段落を figure で出す。題の欄は title にし、キャプションにしない', () => {
    expect(render(`![代替](media:${KEY_A} "ホバーの文")`)).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替" title="ホバーの文"/></figure>`,
    );
  });

  it('画像のすぐ下の行の強調を figcaption にする。題の欄と並べて書ける', () => {
    expect(render(`![代替](media:${KEY_A})\n*キャプション*`)).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替"/><figcaption>キャプション</figcaption></figure>`,
    );
    expect(render(`![代替](media:${KEY_A} "ホバーの文")\n_キャプション_`)).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替" title="ホバーの文"/><figcaption>キャプション</figcaption></figure>`,
    );
  });

  it('強制改行の後のキャプションと、キャプションの中の書式も描く', () => {
    expect(render(`![代替](media:${KEY_A})  \n*[出典](https://example.com/) の図*`)).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替"/><figcaption><a href="https://example.com/">出典</a> の図</figcaption></figure>`,
    );
  });

  it('空行を挟んだ強調・画像と同じ行の強調・強調でない行は、キャプションにしない', () => {
    expect(render(`![代替](media:${KEY_A})\n\n*斜体*`)).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替"/></figure>\n<p><em>斜体</em></p>`,
    );
    expect(render(`![代替](media:${KEY_A}) *同じ行*`)).toBe(
      `<p><img src="/notes/n/media/${KEY_A}" alt="代替"/> <em>同じ行</em></p>`,
    );
    expect(render(`![代替](media:${KEY_A})\n**太字**`)).toBe(
      `<p><img src="/notes/n/media/${KEY_A}" alt="代替"/>\n<strong>太字</strong></p>`,
    );
    expect(render(`![代替](media:${KEY_A})\n*強調* と文`)).toBe(
      `<p><img src="/notes/n/media/${KEY_A}" alt="代替"/>\n<em>強調</em> と文</p>`,
    );
  });

  it('note の編集の画面が示す印は、ホバーの文とキャプションの両方を持つ画像になる', () => {
    expect(render(mediaMarkOf(KEY_A))).toBe(
      `<figure><img src="/notes/n/media/${KEY_A}" alt="代替テキスト" title="ホバーで出す文"/><figcaption>キャプション</figcaption></figure>`,
    );
  });

  it('出さない画像は、キャプションごと描かない', () => {
    expect(render(`![代替](media:${KEY_B} "ホバーの文")\n*キャプション*`)).toBe('');
    expect(render(`前 ![代替](media:${KEY_B}) 後`)).toBe('<p>前  後</p>');
  });

  it('文の中の画像はキャプションを持たない img で出し、題の欄は title にする。ほかの URL の画像は代替テキストで出す', () => {
    expect(render(`前 ![代替](media:${KEY_A} "ホバーの文") 後`)).toBe(
      `<p>前 <img src="/notes/n/media/${KEY_A}" alt="代替" title="ホバーの文"/> 後</p>`,
    );
    expect(render('![外の画像](https://example.com/a.png)')).toBe('<p>外の画像</p>');
  });

  it('生の HTML を要素にせず、文字列で出す', () => {
    const html = render('<script>alert(1)</script>\n\n文の中の <b>太字</b>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('リンクの危ないスキームを空にする', () => {
    expect(render('[押す](javascript:alert(1))')).toBe('<p><a href="">押す</a></p>');
  });

  it('URL だけの段落を renderUrlLine で描き、渡さなければ文字列で出す', () => {
    const card = (url: string) => createElement('aside', null, `カード ${url}`);
    expect(render('https://example.com/a', card)).toBe(
      '<aside>カード https://example.com/a</aside>',
    );
    expect(render('https://example.com/a')).toBe('<p>https://example.com/a</p>');
    expect(render('文と https://example.com/a', card)).toBe('<p>文と https://example.com/a</p>');
  });

  it('リストと引用の中の URL だけの段落と画像だけの段落も、読む側と同じに描く。詰めたリストを含む', () => {
    const card = (url: string) => createElement('aside', null, `カード ${url}`);
    expect(render('- https://example.com/a', card)).toBe(
      '<ul>\n<li>\n<aside>カード https://example.com/a</aside>\n</li>\n</ul>',
    );
    expect(render('> https://example.com/a', card)).toBe(
      '<blockquote>\n<aside>カード https://example.com/a</aside>\n</blockquote>',
    );
    expect(render(`- ![代替](media:${KEY_A})\n  *キャプション*`)).toBe(
      `<ul>\n<li>\n<figure><img src="/notes/n/media/${KEY_A}" alt="代替"/><figcaption>キャプション</figcaption></figure>\n</li>\n</ul>`,
    );
    expect(render('- 文と https://example.com/a', card)).toBe(
      '<ul>\n<li>文と https://example.com/a</li>\n</ul>',
    );
    expect(render('- https://example.com/a\n  - 下の項目', card)).toBe(
      '<ul>\n<li>\n<aside>カード https://example.com/a</aside>\n<ul>\n<li>下の項目</li>\n</ul>\n</li>\n</ul>',
    );
    expect(render(`- ![代替](media:${KEY_A})\n  *キャプション*\n  - 下の項目`)).toContain(
      '<figcaption>キャプション</figcaption>',
    );
    expect(readMarkdown('- https://example.com/a\n  - 下の項目').urlLines).toEqual([
      'https://example.com/a',
    ]);
  });

  it('出さない画像だけの項目は、項目ごと描かない', () => {
    expect(render(`- ![代替](media:${KEY_B})\n- 残る`)).toBe('<ul>\n\n<li>残る</li>\n</ul>');
  });

  it('autolink だけの段落はカードにせず、リンクで出す。形の違う印は代替テキストで出す', () => {
    const card = (url: string) => createElement('aside', null, `カード ${url}`);
    expect(render('<https://example.com/a>', card)).toBe(
      '<p><a href="https://example.com/a">https://example.com/a</a></p>',
    );
    expect(render('![形が違う](media:1)')).toBe('<p>形が違う</p>');
  });
});
