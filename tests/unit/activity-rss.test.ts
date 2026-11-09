import { describe, expect, it } from 'vitest';
import { readRssItems } from '@/features/activity/server/sources/rss';

/**
 * RSS 2.0 の項目の読み方（specs/004-external-activity/research.md の R3）。workerd に
 * `DOMParser` が無いため、Zenn・Medium・Speaker Deck の 3 つが使う最小の読み手を持つ
 */

const feed = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>作り物</title>${items}</channel></rss>`;

describe('readRssItems', () => {
  it('CDATA と実体参照を解いて、子の要素の文字と属性を返す', () => {
    const items = readRssItems(
      feed(
        '<item><title><![CDATA[作り物 & <題>]]></title><link>https://example.com/a?x=1&amp;y=2</link>' +
          '<guid isPermaLink="true">https://example.com/a</guid><pubDate>Tue, 09 Sep 2025 08:02:10 GMT</pubDate>' +
          '<enclosure url="https://example.com/a.png?x=1&amp;y=2" length="0" type="image/png"/></item>',
      ),
    );

    expect(items).toMatchObject([
      {
        title: '作り物 & <題>',
        link: 'https://example.com/a?x=1&y=2',
        guid: 'https://example.com/a',
        pubDate: 'Tue, 09 Sep 2025 08:02:10 GMT',
        'enclosure@url': 'https://example.com/a.png?x=1&y=2',
      },
    ]);
  });

  it('数値の文字参照を解く', () => {
    const items = readRssItems(feed('<item><title>&#x4f5c;&#29289;&lt;</title></item>'));

    expect(items[0]?.title).toBe('作物<');
  });

  it('本文の CDATA の中にある要素を、項目の子の要素として読まない', () => {
    const items = readRssItems(
      feed(
        '<item><content:encoded><![CDATA[<title>本文の中</title><img src="https://example.com/1.png">]]></content:encoded>' +
          '<title>作り物の題</title></item>',
      ),
    );

    expect(items[0]?.title).toBe('作り物の題');
    expect(items[0]?.['content:encoded']).toContain('<img src="https://example.com/1.png">');
  });

  it('項目が 0 件の RSS は空の並びを返す', () => {
    expect(readRssItems(feed(''))).toEqual([]);
  });

  it('RSS の形でなければ失敗する（FR-020）', () => {
    expect(() => readRssItems('<html><body>作り物</body></html>')).toThrow(/RSS/);
  });
});
