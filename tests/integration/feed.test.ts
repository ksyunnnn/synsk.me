import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { insertExternalActivity, insertLifeEvent } from '../support/activity-rows';
import {
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
} from '../support/career-and-project-rows';
import { insertNote } from '../support/note-rows';

/**
 * 訪問者の一覧 `/timeline`（specs/005-feed/contracts/visitor-feed.md）。応答に出してはいけない
 * 値が含まれないこと（SC-001・SC-002・SC-005）と、キャッシュに残らないこと（NFR-09）。
 * 並びと出す条件の細部は tests/workers/feed-repository.test.ts が確かめる。値はすべて作り物
 */

const REAL = {
  organization: '作り物の取引先株式会社',
  title: '作り物の受託開発の実名',
  description: '作り物の秘密の本文',
  url: 'https://example.com/fake-secret',
};
const DRAFT_NOTE_TITLE = '作り物の下書きの題';
const EDUCATION = '作り物の学校';
const SHOWN = {
  note: '作り物の公開した note',
  external: '作り物の外部の記事',
  lifeEvent: '作り物の出来事',
  maskedTitle: '業務システムの開発',
  maskedOrganization: 'ある会社',
};

/** 画面の間を移るときの RSC の要求（`tests/integration/private-responses.test.ts` と同じ形） */
const AS = [
  ['HTML', { headers: {}, query: '' }],
  ['RSC', { headers: { rsc: '1' }, query: '?_rsc' }],
] as const;

let ctx: TestServer;

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organizationId = await insertOrganization(db, {
        name: REAL.organization,
        nameMasked: SHOWN.maskedOrganization,
      });
      await insertProject(db, {
        organizationId,
        title: REAL.title,
        titleMasked: SHOWN.maskedTitle,
        description: REAL.description,
        url: REAL.url,
        isMasked: true,
        status: 'published',
      });
      await insertCareer(db, {
        organizationId,
        description: REAL.description,
        url: REAL.url,
        isMasked: true,
        status: 'published',
      });
      await insertNote(db, {
        slug: 'fake-published',
        revisions: [{ title: SHOWN.note, body: '作り物の本文' }],
        publishedRevision: 1,
      });
      await insertNote(db, {
        slug: 'fake-draft',
        revisions: [{ title: DRAFT_NOTE_TITLE, body: '作り物の本文' }],
      });
      await insertExternalActivity(db, { title: SHOWN.external });
      await insertLifeEvent(db, { title: SHOWN.lifeEvent });
      await insertEducation(db, { school: EDUCATION });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each(AS)('/timeline の %s', (_name, as) => {
  const fetchText = async (query = '') => {
    const res = await ctx.server.fetch(`/timeline${query}${as.query}`, { headers: as.headers });
    return { res, text: await res.text() };
  };

  it('5 種類を出し、秘匿化した実績は秘匿化した値で出る', async () => {
    const { res, text } = await fetchText();
    expect(res.status).toBe(200);
    for (const value of Object.values(SHOWN)) expect(text).toContain(value);
  });

  it('秘匿化した実績と職歴の実際の値・下書きの note・学歴を含まない（SC-001・SC-002・SC-005）', async () => {
    const { text } = await fetchText();
    for (const value of [...Object.values(REAL), DRAFT_NOTE_TITLE, EDUCATION])
      expect(text).not.toContain(value);
  });

  it('キャッシュに残らない（NFR-09）', async () => {
    const { res } = await fetchText();
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('/timeline のページ送り（NFR-02、research.md の R7・R12）', () => {
  it('1 件も無いページは 0 件の画面と最初のページへのリンクを出す', async () => {
    const res = await ctx.server.fetch('/timeline?page=1000');
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('まだ何もありません');
    expect(text).toContain('href="/timeline"');
  });

  it('読めないページの番号は 1 ページ目として読む', async () => {
    const text = await (await ctx.server.fetch('/timeline?page=abc')).text();
    expect(text).toContain(SHOWN.note);
  });
});
