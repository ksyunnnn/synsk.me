import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import {
  deleteCareerAndProjectRows,
  insertCareer,
  insertEducation,
  insertOrganization,
  insertProject,
} from '../support/career-and-project-rows';
import {
  deleteNoteRow,
  deleteNoteRows,
  insertNote,
  insertNoteRevision,
  publishNoteRow,
} from '../support/note-rows';
import { deleteActivityRows, insertActivity } from '../support/activity-rows';

/**
 * 訪問者に見せる一覧の画面（開発中の `/` の置き場 `/top-draft`）の、本番ビルドの HTML と RSC の
 * 応答（specs/005-feed/tasks.md の T065。T012・T022・T033・T043 の内容を含む）。
 *
 * - 秘匿化した職歴と実績の実際の値・本文・関連 URL・画像を含めない（SC-001、FR-013）
 * - サイトに載せない職歴と実績、学歴を含めない（FR-001・FR-004）
 * - 下書きと削除した note、公開した後に保存した版の題を含めない（SC-002、FR-005・FR-006）
 * - 外部の activity は取得元の URL へリンクする（FR-020）
 * - ページ送りは番号のページ（`?page=n`）の `<a>` で、リンクに主キーを含めない（FR-010、ADR-0048）
 * - 実績・note・life event の行は個別のページへリンクし、職歴は個別のページを持たないのでリンク
 *   しない（plan.md の U4 の決定）。秘匿化した実績も個別のページを持つのでリンクする（001 の spec の
 *   Edge Cases）
 *
 * 値はすべて作り物で、ほかの値と重ならない
 */

const PATH = '/top-draft';

/** 秘匿化した職歴と実績の、訪問者に出してはいけない値 */
const HIDDEN = {
  organizationName: '一覧で隠す作り物の会社',
  projectTitle: '一覧で隠す作り物の題',
  careerDescription: '一覧で隠す職歴の本文',
  projectDescription: '一覧で隠す実績の本文',
  careerUrl: 'https://hidden.example.com/feed-career',
  projectUrl: 'https://hidden.example.com/feed-project',
  storageKey: 'feed-hidden-media-key.png',
};

/** 秘匿化した行が出す値 */
const SHOWN = { organizationName: '一覧で見せる作り物の会社', projectTitle: '一覧で見せる題' };

/** 秘匿化しない実績。組織名を直した直後の要求で、直した名前で出る */
const UNMASKED = {
  organizationName: '一覧の公開する作り物の組織',
  renamed: '一覧の名前を直した作り物の組織',
  title: '一覧の公開する作り物のアプリ',
};

/** サイトに載せない行と学歴。秘匿化するかに関わらず出さない */
const NOT_ON_SITE = {
  career: '一覧に載せない作り物の肩書',
  maskedCareer: '一覧に載せない秘匿化した肩書',
  project: '一覧に載せない作り物の実績',
  school: '一覧に出さない作り物大学',
};

const NOTE = {
  published: '一覧の公開した note の題',
  laterRevision: '一覧の公開した後に保存した版の題',
  draft: '一覧の下書きの note の題',
  deleted: '一覧の削除した note の題',
};

const EXTERNAL = { title: '一覧の外部の作り物の記事', url: 'https://example.com/feed-zenn-1' };

/** 個別のページを持つ行の識別子。秘匿化した実績の識別子は uid の形（001 の spec の FR-013） */
const SLUG = {
  maskedProject: 'feedaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  unmaskedProject: 'feed-unmasked-project',
  note: 'feed-published-note',
};

/**
 * ほかの項目より古い life event の件数。並ぶ項目は合わせて 30 件になり、1 ページ目にほかの 5 件と
 * 新しい 15 件（25〜11 番）、2 ページ目に残りの 10 件（10〜1 番）が並ぶ
 */
const FILLER_COUNT = 25;
const FILLER_TITLE = (n: number) => `一覧の埋める作り物の出来事 ${n} 番`;

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '_rsc' };

let ctx: TestServer;
let unmaskedOrgId: number;

const fetchFeed = async (as: typeof AS_HTML, page?: string) => {
  const params = [page === undefined ? null : `page=${page}`, as.query || null].filter(Boolean);
  const url = params.length === 0 ? PATH : `${PATH}?${params.join('&')}`;
  const res = await ctx.server.fetch(url, { headers: as.headers, redirect: 'manual' });
  return { status: res.status, text: await res.text() };
};

/**
 * 応答の中の、一覧のページ送りのリンクの行き先。HTML の `<a>` の属性と、RSC の `"a"` の要素の
 * props の両方から読む。ページ送りは `<a>` で作る（feed.tsx）。RSC の応答は、404 と 403 の画面
 * （src/app/not-found.tsx・src/app/forbidden.tsx）を境界の代わりの中身として毎回含み、その
 * 「トップへ戻る」も同じ経路を指す。こちらは `next/link` の部品なので、`"a"` の要素に限って除く
 */
const feedHrefs = (text: string) =>
  [...text.matchAll(/(?:<a href=|\["\$","a",null,\{"href":)"(\/top-draft[^"]*)"/g)].map(
    (match) => match[1],
  );

/** 応答の中の、個別のページへのリンクの行き先。読み方は `feedHrefs` と同じ */
const detailHrefs = (text: string) =>
  [
    ...text.matchAll(
      /(?:<a href=|\["\$","a",null,\{"href":)"(\/(?:projects|notes|life-events)\/[^"]*)"/g,
    ),
  ].map((match) => match[1]);

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const hiddenOrg = await insertOrganization(db, {
        name: HIDDEN.organizationName,
        nameMasked: SHOWN.organizationName,
      });
      await insertCareer(db, {
        organizationId: hiddenOrg,
        role: '一覧の秘匿化した職歴の肩書',
        startedOn: '2019-04-01',
        description: HIDDEN.careerDescription,
        url: HIDDEN.careerUrl,
        isMasked: true,
        status: 'published',
      });
      const maskedProject = await insertProject(db, {
        organizationId: hiddenOrg,
        slug: SLUG.maskedProject,
        title: HIDDEN.projectTitle,
        titleMasked: SHOWN.projectTitle,
        startedOn: '2020-04-01',
        description: HIDDEN.projectDescription,
        url: HIDDEN.projectUrl,
        isMasked: true,
        status: 'published',
      });
      const media = await db
        .prepare('INSERT INTO media (project_id, storage_key) VALUES (?, ?) RETURNING id')
        .bind(maskedProject, HIDDEN.storageKey)
        .first<{ id: number }>();
      await db
        .prepare('UPDATE project SET card_media_id = ? WHERE id = ?')
        .bind(media?.id, maskedProject)
        .run();

      unmaskedOrgId = await insertOrganization(db, {
        name: UNMASKED.organizationName,
        nameMasked: '個人',
      });
      await insertProject(db, {
        organizationId: unmaskedOrgId,
        slug: SLUG.unmaskedProject,
        title: UNMASKED.title,
        startedOn: '2021-04-01',
        isMasked: false,
        status: 'published',
      });

      await insertCareer(db, {
        organizationId: unmaskedOrgId,
        role: NOT_ON_SITE.career,
        isMasked: false,
        status: 'draft',
      });
      await insertCareer(db, {
        organizationId: hiddenOrg,
        role: NOT_ON_SITE.maskedCareer,
        isMasked: true,
        status: 'draft',
      });
      await insertProject(db, {
        organizationId: unmaskedOrgId,
        title: NOT_ON_SITE.project,
        isMasked: false,
        status: 'draft',
      });
      await insertEducation(db, { school: NOT_ON_SITE.school });

      const published = await insertNote(db, { slug: SLUG.note, title: NOTE.published });
      await publishNoteRow(db, published.id);
      await insertNoteRevision(db, published.id, { title: NOTE.laterRevision });
      await insertNote(db, { title: NOTE.draft });
      const deleted = await insertNote(db, { title: NOTE.deleted });
      await publishNoteRow(db, deleted.id);
      await deleteNoteRow(db, deleted.id);

      await insertActivity(db, {
        source: 'zenn',
        externalId: 'feed-zenn-1',
        url: EXTERNAL.url,
        title: EXTERNAL.title,
        publishedAt: '2026-10-01T00:00:00.000Z',
      });

      for (let n = 1; n <= FILLER_COUNT; n++) {
        await insertActivity(db, {
          source: 'life_event',
          title: FILLER_TITLE(n),
          happenedOn: `2000-01-${String(n).padStart(2, '0')}`,
          slug: `feed-filler-${n}`,
        });
      }
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
])('一覧の応答（%s）', (_, as) => {
  it('秘匿化した職歴と実績は秘匿化した値で並び、本文の場所に「非公開」を出し、隠す値を含めない（SC-001・FR-013）', async () => {
    const { status, text } = await fetchFeed(as);
    expect(status).toBe(200);
    expect(text).toContain(SHOWN.projectTitle);
    expect(text).toContain(SHOWN.organizationName);
    expect(text).toContain('非公開');
    for (const [name, value] of Object.entries(HIDDEN)) {
      expect(text, `${name} が応答に含まれる`).not.toContain(value);
    }
  });

  it('秘匿化しない実績は実際の題と実際の組織名で並ぶ（FR-014）', async () => {
    const { text } = await fetchFeed(as);
    expect(text).toContain(UNMASKED.title);
    expect(text).toContain(UNMASKED.organizationName);
  });

  it('サイトに載せない職歴と実績、学歴を含めない（FR-001・FR-004）', async () => {
    const { text } = await fetchFeed(as);
    for (const [name, value] of Object.entries(NOT_ON_SITE)) {
      expect(text, `${name} が応答に含まれる`).not.toContain(value);
    }
  });

  it('公開した note は公開した版の題で並び、下書き・削除した note と後で保存した版の題を含めない（SC-002）', async () => {
    const { text } = await fetchFeed(as);
    expect(text).toContain(NOTE.published);
    expect(text).not.toContain(NOTE.laterRevision);
    expect(text).not.toContain(NOTE.draft);
    expect(text).not.toContain(NOTE.deleted);
  });

  it('外部の activity は取得元の URL へリンクする（FR-020）', async () => {
    const { text } = await fetchFeed(as);
    expect(text).toContain(EXTERNAL.title);
    expect(text).toMatch(new RegExp(`"?href"?[=:]"${EXTERNAL.url}"`));
  });

  it('実績・note・life event の行は個別のページへリンクし、秘匿化した実績もリンクする。職歴はリンクしない（U4）', async () => {
    const { text } = await fetchFeed(as);
    const fillers = Array.from(
      { length: FILLER_COUNT - 10 },
      (_, i) => `/life-events/feed-filler-${FILLER_COUNT - i}`,
    );
    expect(detailHrefs(text).toSorted()).toEqual(
      [
        `/projects/${SLUG.maskedProject}`,
        `/projects/${SLUG.unmaskedProject}`,
        `/notes/${SLUG.note}`,
        ...fillers,
      ].toSorted(),
    );
  });

  it('1 ページ目は 20 件を並べ、次のページへのリンクを番号だけで持つ（FR-010・ADR-0048）', async () => {
    const { text } = await fetchFeed(as);
    expect(text).toContain(FILLER_TITLE(FILLER_COUNT));
    expect(text).toContain(FILLER_TITLE(11));
    expect(text).not.toContain(FILLER_TITLE(10));
    expect(feedHrefs(text)).toEqual([`${PATH}?page=2`]);
  });

  it('2 ページ目は続きを並べ、最後のページなので次のページへのリンクを持たない', async () => {
    const { status, text } = await fetchFeed(as, '2');
    expect(status).toBe(200);
    expect(text).toContain(FILLER_TITLE(10));
    expect(text).toContain(FILLER_TITLE(1));
    expect(text).not.toContain(FILLER_TITLE(11));
    expect(feedHrefs(text)).toEqual([]);
  });

  it.each(['abc', '0', '-1', '1.5'])('page=%s は 1 ページ目として読む（T033）', async (page) => {
    const { status, text } = await fetchFeed(as, page);
    expect(status).toBe(200);
    expect(text).toContain(FILLER_TITLE(FILLER_COUNT));
    expect(feedHrefs(text)).toEqual([`${PATH}?page=2`]);
  });

  it.each(['3', '99999999999999999999'])(
    '最後のページの先（page=%s）は 200 で項目を並べず、「まだ何もない」でなく 1 ページ目へのリンクを出す（R8）',
    async (page) => {
      const { status, text } = await fetchFeed(as, page);
      expect(status).toBe(200);
      expect(text).not.toContain('一覧の埋める作り物の出来事');
      expect(text).not.toContain('まだ何もない');
      expect(feedHrefs(text)).toEqual([PATH]);
    },
  );
});

describe('データを変えた直後の要求', () => {
  it('組織名を直した直後の要求で、秘匿化しない実績が直した組織名で並ぶ（FR-021）', async () => {
    await ctx.db
      .prepare('UPDATE organization SET name = ? WHERE id = ?')
      .bind(UNMASKED.renamed, unmaskedOrgId)
      .run();
    for (const as of [AS_HTML, AS_RSC]) {
      const { text } = await fetchFeed(as);
      expect(text).toContain(UNMASKED.renamed);
      expect(text).not.toContain(UNMASKED.organizationName);
    }
  });

  it('並ぶ項目が 0 件のとき、200 で「まだ何もない」を出す（NFR-02）', async () => {
    await deleteCareerAndProjectRows(ctx.db);
    await deleteNoteRows(ctx.db);
    await deleteActivityRows(ctx.db);
    for (const as of [AS_HTML, AS_RSC]) {
      const { status, text } = await fetchFeed(as);
      expect(status).toBe(200);
      expect(text).toContain('まだ何もない');
      expect(feedHrefs(text)).toEqual([]);
    }
  });
});
