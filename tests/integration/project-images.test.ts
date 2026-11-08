import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import {
  insertCareer,
  insertOrganization,
  insertProject,
  uidOf,
} from '../support/career-and-project-rows';

/**
 * 実績・職歴の本文と画像の応答（specs/001-career-and-project/spec.md の FR-027・FR-028・FR-030、
 * plan.md の U4・U5）。秘匿化した実績の画像は、本文が指していても代表画像でも、訪問者の経路で
 * 返さず、ページの応答にも画像を指す値を含めない。
 *
 * 訪問者への応答は、HTML と、画面の間を移るときの RSC のペイロードの両方を調べる
 */

const FILE_IN_BODY = '00000000-0000-4000-8000-00000000a001.png';
const FILE_CARD = '00000000-0000-4000-8000-00000000a002.png';
const FILE_UNUSED = '00000000-0000-4000-8000-00000000a003.png';
const FILE_MASKED_BODY = '00000000-0000-4000-8000-00000000b001.png';
const FILE_MASKED_CARD = '00000000-0000-4000-8000-00000000b002.png';
const FILE_DRAFT = '00000000-0000-4000-8000-00000000c001.png';
const FILE_CAREER = '00000000-0000-4000-8000-00000000d001.png';

const OPEN_SLUG = 'fake-open-with-images';
const MASKED_SLUG = '7e1d2c3b-1111-4222-8333-444455556666';
const DRAFT_SLUG = 'fake-draft-with-images';
const CAPTION = '作り物の画面のキャプション';
const MASKED_BODY = '秘匿化した作り物の本文';

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let ctx: TestServer;
let openUid: string;
let careerUid: string;

const fetchText = async (path: string, headers: Record<string, string> = {}) => {
  const res = await ctx.server.fetch(path, { redirect: 'manual', headers });
  return { res, text: await res.text() };
};

const insertMedia = async (
  db: D1Database,
  owner: 'project_id' | 'career_id',
  id: number,
  file: string,
) =>
  (
    await db
      .prepare(`INSERT INTO media (${owner}, storage_key) VALUES (?, ?) RETURNING id`)
      .bind(id, `${owner === 'project_id' ? 'projects' : 'careers'}/${file}`)
      .first<{ id: number }>()
  )?.id as number;

const chooseCard = (db: D1Database, projectId: number, mediaId: number) =>
  db.prepare('UPDATE project SET card_media_id = ? WHERE id = ?').bind(mediaId, projectId).run();

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const org = await insertOrganization(db, {
        name: '画像を持つ作り物の組織',
        nameMasked: '画像を持つ作り物の会社',
      });

      const open = await insertProject(db, {
        organizationId: org,
        slug: OPEN_SLUG,
        title: '画像を持つ作り物のアプリ',
        description: `作り物の **本文**\n\n![画面](media:${FILE_IN_BODY} "${CAPTION}")`,
        isMasked: false,
        status: 'published',
      });
      openUid = await uidOf(db, 'project', open);
      await insertMedia(db, 'project_id', open, FILE_IN_BODY);
      await chooseCard(db, open, await insertMedia(db, 'project_id', open, FILE_CARD));
      await insertMedia(db, 'project_id', open, FILE_UNUSED);

      const masked = await insertProject(db, {
        organizationId: org,
        slug: MASKED_SLUG,
        title: '秘匿化した画像を持つ作り物の題',
        description: `${MASKED_BODY}\n\n![](media:${FILE_MASKED_BODY})`,
        isMasked: true,
        status: 'published',
      });
      await insertMedia(db, 'project_id', masked, FILE_MASKED_BODY);
      await chooseCard(db, masked, await insertMedia(db, 'project_id', masked, FILE_MASKED_CARD));

      const draft = await insertProject(db, {
        organizationId: org,
        slug: DRAFT_SLUG,
        description: `![](media:${FILE_DRAFT})`,
        isMasked: false,
        status: 'draft',
      });
      await insertMedia(db, 'project_id', draft, FILE_DRAFT);

      const career = await insertCareer(db, {
        organizationId: org,
        description: `![](media:${FILE_CAREER})`,
        isMasked: false,
        status: 'published',
      });
      careerUid = await uidOf(db, 'career', career);
      await insertMedia(db, 'career_id', career, FILE_CAREER);
    },
  });
  // R2 の物を入れる。画像の記録と同じキーに置く
  const { NOTE_IMAGES } = await ctx.server.getWorker<{ NOTE_IMAGES: R2Bucket }>().getEnv();
  const put = (key: string) =>
    NOTE_IMAGES.put(key, PNG, { httpMetadata: { contentType: 'image/png' } });
  for (const file of [
    FILE_IN_BODY,
    FILE_CARD,
    FILE_UNUSED,
    FILE_MASKED_BODY,
    FILE_MASKED_CARD,
    FILE_DRAFT,
  ]) {
    await put(`projects/${file}`);
  }
  await put(`careers/${FILE_CAREER}`);
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
] as const)('/projects/{slug} の %s', (_name, as) => {
  it('秘匿化しない実績は、本文を Markdown で描き、本文の画像を訪問者の経路で出す（FR-027・U4）', async () => {
    const { res, text } = await fetchText(`/projects/${OPEN_SLUG}${as.query}`, as.headers);
    expect(res.status).toBe(200);
    expect(text).toContain(`/projects/${OPEN_SLUG}/images/${FILE_IN_BODY}`);
    expect(text).toContain(CAPTION);
    expect(text).not.toContain('media:');
    expect(text).not.toContain(FILE_UNUSED);
  });

  it('秘匿化した実績は、本文も画像を指す値も含めない（FR-030）', async () => {
    const { res, text } = await fetchText(`/projects/${MASKED_SLUG}${as.query}`, as.headers);
    expect(res.status).toBe(200);
    expect(text).not.toContain(MASKED_BODY);
    for (const file of [FILE_MASKED_BODY, FILE_MASKED_CARD]) expect(text).not.toContain(file);
    expect(text).not.toContain('/images/');
  });
});

describe('/projects/{slug} の HTML の head', () => {
  it('画像だけの段落を figure にし、題を figcaption にする（U4）', async () => {
    const { text } = await fetchText(`/projects/${OPEN_SLUG}`);
    expect(text).toMatch(/<figure[^>]*><img[^>]*>.*<figcaption[^>]*>作り物の画面のキャプション/s);
    expect(text).toContain('<strong>本文</strong>');
  });

  it('代表画像を og:image にする（FR-028）', async () => {
    const { text } = await fetchText(`/projects/${OPEN_SLUG}`);
    expect(text).toMatch(
      new RegExp(
        `<meta property="og:image" content="[^"]*/projects/${OPEN_SLUG}/images/${FILE_CARD}"`,
      ),
    );
  });
});

describe('/projects/{slug}/images/{file}（FR-030）', () => {
  it.each([
    ['本文が指す画像', FILE_IN_BODY],
    ['代表画像', FILE_CARD],
  ])('秘匿化しない実績の%sは、どのキャッシュにも残さない形で返す', async (_label, file) => {
    const res = await ctx.server.fetch(`/projects/${OPEN_SLUG}/images/${file}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it.each([
    ['本文も代表画像も指さない画像', OPEN_SLUG, FILE_UNUSED],
    ['秘匿化した実績の、本文が指す画像', MASKED_SLUG, FILE_MASKED_BODY],
    ['秘匿化した実績の代表画像', MASKED_SLUG, FILE_MASKED_CARD],
    ['サイトに載せない実績の画像', DRAFT_SLUG, FILE_DRAFT],
    ['ほかの実績の画像', OPEN_SLUG, FILE_MASKED_BODY],
    ['ファイル名の形でない値', OPEN_SLUG, '..%2Fsecret.png'],
  ])('%sは 404', async (_label, slug, file) => {
    const res = await ctx.server.fetch(`/projects/${slug}/images/${file}`);
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });
});

describe('管理画面の画像（contracts/dash.md）', () => {
  it.each([
    ['実績', () => `/dash/projects/${openUid}/images/${FILE_UNUSED}`],
    ['職歴', () => `/dash/careers/${careerUid}/images/${FILE_CAREER}`],
  ])('オーナーでなければ%sの画像を返さない', async (_label, path) => {
    const res = await ctx.server.fetch(path(), { redirect: 'manual' });
    expect(res.status).toBe(403);
    await res.body?.cancel();
  });

  it.each([
    ['実績の、本文が指さない画像', () => `/dash/projects/${openUid}/images/${FILE_UNUSED}`],
    ['職歴の画像', () => `/dash/careers/${careerUid}/images/${FILE_CAREER}`],
  ])('オーナーには%sも返す', async (_label, path) => {
    const res = await ctx.server.fetch(path(), {
      headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    await res.body?.cancel();
  });

  it('オーナーにも、ほかの実績の画像は返さない', async () => {
    const res = await ctx.server.fetch(`/dash/projects/${openUid}/images/${FILE_MASKED_BODY}`, {
      headers: { 'cf-access-jwt-assertion': await ctx.signAuthorJwt() },
    });
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });
});
