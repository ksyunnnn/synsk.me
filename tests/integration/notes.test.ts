import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_NOTES, startNoteTestServer, type NoteTestServer } from './support/d1';

/**
 * 訪問者が note を読む経路 `/notes/{slug}`（specs/005-note-write-and-read/contracts/routes.md）。
 *
 * 状態コードと応答の中身を確かめる。画面に出る文言と操作の連なりは E2E が持つ。
 */

const { published, publishedWithChanges, draft, deleted } = SEEDED_NOTES;

describe('D1 から読める', () => {
  let ctx: NoteTestServer;

  beforeAll(async () => {
    ctx = await startNoteTestServer();
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  describe('公開済みの note', () => {
    it('200 で、題・公開日・本文を返す', async () => {
      const res = await ctx.server.fetch(`/notes/${published.slug}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^text\/html/);

      const html = await res.text();
      expect(html).toMatch(new RegExp(`<title>${published.title}[^<]*</title>`));
      expect(html).toContain(`<h1>${published.title}</h1>`);
      // 2026-09-16T15:30:00.000Z は日本時間で 2026-09-17
      expect(html).toContain('<time dateTime="2026-09-17">2026-09-17</time>');
    });

    it('本文の改行を保つ', async () => {
      const html = await (await ctx.server.fetch(`/notes/${published.slug}`)).text();
      // 改行の文字をそのまま出し、`white-space: pre-wrap` で改行の位置で改行する
      expect(html).toMatch(/<div style="white-space:pre-wrap">1行目の本文\n2行目の本文\n/);
    });

    it('本文の HTML の文字列を、要素にせず文字のまま出す', async () => {
      const html = await (await ctx.server.fetch(`/notes/${published.slug}`)).text();
      expect(html).not.toContain('<script>alert("note")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;note&quot;)&lt;/script&gt;');
    });

    it('公開し直していない書き換えは出さない', async () => {
      const res = await ctx.server.fetch(`/notes/${publishedWithChanges.slug}`);
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain(publishedWithChanges.title);
      expect(html).toContain(publishedWithChanges.body);
      expect(html).not.toContain(publishedWithChanges.draftTitle);
      expect(html).not.toContain(publishedWithChanges.draftBody);
    });
  });

  describe('下書き・削除した note・存在しない slug', () => {
    const MISSING_SLUG = 'missing-note';
    const SLUGS = [draft.slug, deleted.slug, MISSING_SLUG];

    it.each(SLUGS)('/notes/%s は 404 を返す', async (slug) => {
      expect((await ctx.server.fetch(`/notes/${slug}`)).status).toBe(404);
    });

    it('表示から三者を区別できない', async () => {
      // 要求した slug は応答に入る（経路の情報）。slug を伏せると同じ中身になる
      const normalize = async (slug: string) =>
        (await (await ctx.server.fetch(`/notes/${slug}`)).text()).replaceAll(slug, '<slug>');
      const missing = await normalize(MISSING_SLUG);
      expect(await normalize(draft.slug)).toBe(missing);
      expect(await normalize(deleted.slug)).toBe(missing);
    });

    it('応答のヘッダから三者を区別できない', async () => {
      // ヘッダの名前と値を比べる。値は slug を伏せる。note の状態によらず変わる値
      // （slug の長さで変わる content-length、要求の時刻で変わる date）は除く
      const readHeaders = async (slug: string) => {
        const res = await ctx.server.fetch(`/notes/${slug}`);
        await res.arrayBuffer();
        return [...res.headers]
          .filter(([name]) => name !== 'content-length' && name !== 'date')
          .map(([name, value]) => [name, value.replaceAll(slug, '<slug>')])
          .sort(([a], [b]) => a.localeCompare(b));
      };
      const missing = await readHeaders(MISSING_SLUG);
      // 比べる対象が空になっていないこと
      expect(missing.map(([name]) => name)).toContain('content-type');
      expect(await readHeaders(draft.slug)).toEqual(missing);
      expect(await readHeaders(deleted.slug)).toEqual(missing);
    });

    it('削除した note の題と本文を、本文にもメタデータにも含めない', async () => {
      const html = await (await ctx.server.fetch(`/notes/${deleted.slug}`)).text();
      expect(html).not.toContain(deleted.title);
      expect(html).not.toContain(deleted.body);
    });

    it('下書きの題と本文を、本文にもメタデータにも含めない', async () => {
      const html = await (await ctx.server.fetch(`/notes/${draft.slug}`)).text();
      expect(html).not.toContain(draft.title);
      expect(html).not.toContain(draft.body);
    });
  });
});

describe('D1 から読めない', () => {
  let ctx: NoteTestServer;

  beforeAll(async () => {
    ctx = await startNoteTestServer();
    // 表を消し、訪問者の要求が D1 から読み出せない状態を作る
    await ctx.db.batch([
      ctx.db.prepare('DROP TABLE note_publication'),
      ctx.db.prepare('DROP TABLE note'),
    ]);
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it('500 を返し、note の題と本文を含めない', async () => {
    const res = await ctx.server.fetch(`/notes/${published.slug}`);
    expect(res.status).toBe(500);

    const html = await res.text();
    expect(html).toContain('ページを読み出せませんでした');
    for (const note of [published, publishedWithChanges, draft, deleted]) {
      expect(html).not.toContain(note.title);
    }
    expect(html).not.toContain('1行目の本文');
  });
});
