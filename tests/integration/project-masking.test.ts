import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { encodeForm, readActionFields } from './support/form';
import { insertOrganization, insertProject, uidOf } from '../support/career-and-project-rows';

/**
 * 秘匿化した実績の実際の値を、訪問者への応答に含めない（specs/001-career-and-project/spec.md の
 * SC-001・FR-019・FR-021・FR-022・FR-026・FR-030）。秘匿化しない実績は実際の値で出す（FR-023）。
 * 秘匿化を切り替えた直後の要求から新しい状態で出す（FR-043）。
 *
 * 応答は、HTML と、画面の間を移るときの RSC のペイロードの両方を調べる。`<title>` と OGP は
 * HTML の `<head>` に含まれる。
 */

/** 秘匿化した実績の、訪問者に出してはいけない値。どれも作り物で、ほかの値と重ならない */
const HIDDEN = {
  organizationName: '隠す作り物株式会社',
  title: '隠す作り物の受託開発',
  description: '隠す作り物の本文',
  url: 'https://hidden.example.com/fake-project',
  storageKey: 'hidden-fake-media-key.png',
};

/** 秘匿化した実績が訪問者に出す値 */
const SHOWN = { organizationName: '見せる作り物の会社', title: '見せる業務システムの開発' };

const MASKED_SLUG = '5d0e6c2a-7b1f-4c3d-9e8f-0a1b2c3d4e5f';

/** 秘匿化した組織名の無い組織を指す、秘匿化した実績。保存のときに止めるため、行を直に入れる */
const NO_MASKED_NAME = {
  slug: '9a8b7c6d-1111-4222-8333-444455556666',
  organizationName: '秘匿化した組織名の無い作り物の組織',
  title: '秘匿化した組織名の無い組織の題',
};
const UNMASKED = {
  slug: 'fake-open-app',
  organizationName: '公開する作り物の個人',
  title: '公開する作り物のアプリ',
};

const AS_HTML = { headers: {}, query: '' };
const AS_RSC = { headers: { rsc: '1' }, query: '?_rsc' };

let ctx: TestServer;
let maskedId: number;
let toggleId: number;

const fetchVisitor = async (slug: string, as: typeof AS_HTML) => {
  const res = await ctx.server.fetch(`/projects/${slug}${as.query}`, {
    headers: as.headers,
    redirect: 'manual',
  });
  return { status: res.status, text: await res.text() };
};

const expectNoHiddenValues = (text: string) => {
  for (const [name, value] of Object.entries(HIDDEN)) {
    expect(text, `${name} が応答に含まれる`).not.toContain(value);
  }
};

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const hiddenOrg = await insertOrganization(db, {
        name: HIDDEN.organizationName,
        nameMasked: SHOWN.organizationName,
      });
      maskedId = await insertProject(db, {
        organizationId: hiddenOrg,
        slug: MASKED_SLUG,
        title: HIDDEN.title,
        titleMasked: SHOWN.title,
        description: HIDDEN.description,
        url: HIDDEN.url,
        isMasked: true,
        status: 'published',
      });
      // 代表画像も持たせる。秘匿化した実績では、画像を指す値も応答に含めない（FR-030）
      const media = await db
        .prepare('INSERT INTO media (project_id, storage_key) VALUES (?, ?) RETURNING id')
        .bind(maskedId, HIDDEN.storageKey)
        .first<{ id: number }>();
      await db
        .prepare('UPDATE project SET card_media_id = ? WHERE id = ?')
        .bind(media?.id, maskedId)
        .run();

      const noMaskedNameOrg = await insertOrganization(db, {
        name: NO_MASKED_NAME.organizationName,
        nameMasked: null,
      });
      await insertProject(db, {
        organizationId: noMaskedNameOrg,
        slug: NO_MASKED_NAME.slug,
        title: NO_MASKED_NAME.title,
        isMasked: true,
        status: 'published',
      });

      const openOrg = await insertOrganization(db, {
        name: UNMASKED.organizationName,
        nameMasked: '個人',
      });
      await insertProject(db, {
        organizationId: openOrg,
        slug: UNMASKED.slug,
        title: UNMASKED.title,
        isMasked: false,
        status: 'published',
      });
      toggleId = await insertProject(db, {
        organizationId: openOrg,
        slug: 'fake-toggle-app',
        title: '切り替える作り物のアプリ',
        titleMasked: '切り替える秘匿化した題',
        isMasked: false,
        status: 'published',
      });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe.each([
  ['HTML', AS_HTML],
  ['RSC', AS_RSC],
])('訪問者への応答（%s）', (_, as) => {
  it('秘匿化した実績は、秘匿化した題と秘匿化した組織名で出し、隠す値を 0 件含む（SC-001）', async () => {
    const { status, text } = await fetchVisitor(MASKED_SLUG, as);
    expect(status).toBe(200);
    expect(text).toContain(SHOWN.title);
    expect(text).toContain(SHOWN.organizationName);
    expectNoHiddenValues(text);
  });

  it('秘匿化した実績は、本文の場所に「非公開」と出す（FR-021）', async () => {
    expect((await fetchVisitor(MASKED_SLUG, as)).text).toContain('非公開');
  });

  it('秘匿化した組織名の無い組織を指す秘匿化した実績は、出さずに 404（plan.md の U2）', async () => {
    const { status, text } = await fetchVisitor(NO_MASKED_NAME.slug, as);
    if (as === AS_RSC) {
      expect(text).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
    } else {
      expect(status).toBe(404);
    }
    expect(text).not.toContain(NO_MASKED_NAME.organizationName);
    expect(text).not.toContain(NO_MASKED_NAME.title);
  });

  it('秘匿化しない実績は、実際の題と組織名で出す（FR-023）', async () => {
    const { status, text } = await fetchVisitor(UNMASKED.slug, as);
    expect(status).toBe(200);
    expect(text).toContain(UNMASKED.title);
    expect(text).toContain(UNMASKED.organizationName);
    expect(text).not.toContain('非公開');
  });

  it.each(['/', '/dash/projects/{uid}'])(
    '訪問者が到達するほかの経路 %s も、隠す値を含まない',
    async (template) => {
      const path = template.replace('{uid}', await uidOf(ctx.db, 'project', maskedId));
      const res = await ctx.server.fetch(`${path}${as.query}`, {
        headers: as.headers,
        redirect: 'manual',
      });
      expectNoHiddenValues(await res.text());
    },
  );
});

it('秘匿化した実績のページの <title> と OGP は、秘匿化した題を使う', async () => {
  const { text } = await fetchVisitor(MASKED_SLUG, AS_HTML);
  expect(text).toMatch(new RegExp(`<title>${SHOWN.title}[^<]*</title>`));
  expect(text).toContain(`<meta property="og:title" content="${SHOWN.title}"`);
});

/** 1×1 の PNG（作り物）。共有の media-storage.ts が先頭のバイトで形式を見分ける */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

describe('実績の本文と画像（FR-021・FR-023・FR-027・FR-028・FR-030、SC-001）', () => {
  const OPEN_SLUG = 'fake-media-open';
  const MASKED_MEDIA_SLUG = '7c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5';
  const DRAFT_SLUG = 'fake-media-draft';
  const RAW_HTML = '<script>alert("作り物")</script>';
  const MASKED_BODY = '隠す作り物の画像つきの本文';

  const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

  /** オーナーとして、編集の画面の画像のフォームで画像を 1 枚足し、足した画像のキーを返す */
  const upload = async (projectId: number, extra: Record<string, string> = {}) => {
    const uid = await uidOf(ctx.db, 'project', projectId);
    const path = `/dash/projects/${uid}`;
    const page = await ctx.server.fetch(path, { headers: await authorHeaders() });
    const forms = (await page.text()).match(/<form\b[\s\S]*?<\/form>/g) ?? [];
    const form = forms.find((html) => html.includes('name="mediaFile"'));
    if (!form) throw new Error('画像のフォームが無い');
    const body = new FormData();
    for (const [name, value] of Object.entries(readActionFields(form))) body.append(name, value);
    body.append('projectUid', uid);
    for (const [name, value] of Object.entries(extra)) body.append(name, value);
    body.append('mediaFile', new Blob([PNG], { type: 'image/png' }));
    const encoded = new Response(body);
    const res = await ctx.server.fetch(path, {
      method: 'POST',
      body: await encoded.arrayBuffer(),
      headers: {
        ...(await authorHeaders()),
        'content-type': encoded.headers.get('content-type') ?? '',
      },
      redirect: 'manual',
    });
    expect(res.status).toBe(303);
    const row = await ctx.db
      .prepare('SELECT storage_key, size FROM media WHERE project_id = ? ORDER BY id DESC')
      .bind(projectId)
      .first<{ storage_key: string; size: number }>();
    if (!row) throw new Error('画像が記録されていない');
    expect(row.size).toBe(PNG.byteLength);
    return row.storage_key;
  };

  const setBody = (id: number, description: string) =>
    ctx.db.prepare('UPDATE project SET description = ? WHERE id = ?').bind(description, id).run();

  const fetchMedia = (slug: string, key: string) =>
    ctx.server.fetch(`/projects/${slug}/media/${key}`);

  const expectHidden = async (res: {
    status: number;
    headers: { get(name: string): string | null };
    arrayBuffer(): Promise<ArrayBuffer>;
  }) => {
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  };

  let openId: number;
  let maskedMediaId: number;
  let draftId: number;

  beforeAll(async () => {
    const org = await insertOrganization(ctx.db, {
      name: '画像の作り物の組織',
      nameMasked: '画像の作り物の秘匿化した組織',
    });
    openId = await insertProject(ctx.db, {
      organizationId: org,
      slug: OPEN_SLUG,
      title: '画像つきの作り物の実績',
      isMasked: false,
      status: 'published',
    });
    maskedMediaId = await insertProject(ctx.db, {
      organizationId: org,
      slug: MASKED_MEDIA_SLUG,
      title: '画像つきの隠す作り物の実績',
      titleMasked: '画像つきの秘匿化した題',
      isMasked: true,
      status: 'published',
    });
    draftId = await insertProject(ctx.db, {
      organizationId: org,
      slug: DRAFT_SLUG,
      title: 'サイトに載せない作り物の実績',
      isMasked: false,
      status: 'draft',
    });
  });

  it.each([
    ['HTML', AS_HTML],
    ['RSC', AS_RSC],
  ])('秘匿化しない実績の本文を Markdown で出し、生の HTML を通さない（%s）', async (_, as) => {
    await setBody(openId, `**強調した作り物の本文**\n\n${RAW_HTML}`);
    const { status, text } = await fetchVisitor(OPEN_SLUG, as);
    expect(status).toBe(200);
    expect(text).toContain('強調した作り物の本文');
    expect(text).not.toContain(RAW_HTML);
    if (as === AS_HTML) {
      expect(text).toContain('<strong>強調した作り物の本文</strong>');
      expect(text).toContain('&lt;script&gt;');
    }
  });

  it('本文が指す画像と代表画像は 200 で原本を返し、本文が指さない画像は 404', async () => {
    const bodyKey = await upload(openId);
    const cardKey = await upload(openId, { asCardImage: '1' });
    const unusedKey = await upload(openId);
    await setBody(openId, `![作り物の図](media:${bodyKey})\n*作り物のキャプション*`);

    const html = (await fetchVisitor(OPEN_SLUG, AS_HTML)).text;
    expect(html).toContain(`<img src="/projects/${OPEN_SLUG}/media/${bodyKey}" alt="作り物の図"/>`);
    expect(html).toContain(`src="/projects/${OPEN_SLUG}/media/${cardKey}"`);
    expect(html).not.toContain(unusedKey);

    for (const key of [bodyKey, cardKey]) {
      const res = await fetchMedia(OPEN_SLUG, key);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    }
    await expectHidden(await fetchMedia(OPEN_SLUG, unusedKey));
    // ほかの実績の識別子からは、同じ画像を返さない
    await expectHidden(await fetchMedia(DRAFT_SLUG, bodyKey));
  });

  it('秘匿化した実績の画像は、本文が指し代表画像でも 404 で、本文も画像のキーも応答に含めない', async () => {
    const key = await upload(maskedMediaId, { asCardImage: '1' });
    await setBody(maskedMediaId, `${MASKED_BODY}\n\n![隠す図](media:${key})`);

    await expectHidden(await fetchMedia(MASKED_MEDIA_SLUG, key));
    for (const as of [AS_HTML, AS_RSC]) {
      const { status, text } = await fetchVisitor(MASKED_MEDIA_SLUG, as);
      expect(status).toBe(200);
      expect(text).not.toContain(MASKED_BODY);
      expect(text).not.toContain(key);
    }
  });

  it('サイトに載せない実績の画像は 404', async () => {
    const key = await upload(draftId, { asCardImage: '1' });
    await setBody(draftId, `![図](media:${key})`);
    await expectHidden(await fetchMedia(DRAFT_SLUG, key));
  });

  it('形の違うキーは 404', async () => {
    await expectHidden(await fetchMedia(OPEN_SLUG, 'not-a-uuid'));
  });
});

describe('秘匿化を切り替えた直後の要求（FR-043）', () => {
  const authorHeaders = async () => ({ 'cf-access-jwt-assertion': await ctx.signAuthorJwt() });

  /** オーナーとして、JavaScript なしのブラウザと同じ形で編集のフォームを送る */
  const submitEdit = async (id: number, values: Record<string, string>) => {
    const uid = await uidOf(ctx.db, 'project', id);
    const path = `/dash/projects/${uid}`;
    const page = await ctx.server.fetch(path, { headers: await authorHeaders() });
    expect(page.status).toBe(200);
    const row = await ctx.db
      .prepare(
        `SELECT p.*, o.name AS organization_name, o.name_masked AS organization_name_masked
         FROM project p JOIN organization o ON o.id = p.organization_id WHERE p.id = ?`,
      )
      .bind(id)
      .first<Record<string, string | null>>();
    const { body, contentType } = await encodeForm(readActionFields(await page.text()), {
      projectUid: uid,
      openedUpdatedAt: row?.updated_at ?? '',
      organizationName: row?.organization_name ?? '',
      organizationNameMasked: row?.organization_name_masked ?? '',
      kind: row?.kind ?? '',
      title: row?.title ?? '',
      titleMasked: row?.title_masked ?? '',
      startedOn: row?.started_on ?? '',
      endedOn: row?.ended_on ?? '',
      description: row?.description ?? '',
      url: row?.url ?? '',
      slug: row?.slug ?? '',
      status: row?.status ?? '',
      ...values,
    });
    const res = await ctx.server.fetch(path, {
      method: 'POST',
      body,
      headers: { ...(await authorHeaders()), 'content-type': contentType },
      redirect: 'manual',
    });
    await res.arrayBuffer();
    expect(res.status).toBe(303);
  };

  const slugOf = async (id: number) =>
    (
      await ctx.db
        .prepare('SELECT slug FROM project WHERE id = ?')
        .bind(id)
        .first<{ slug: string }>()
    )?.slug ?? '';

  it('秘匿化に切り替えると、古い識別子は 404 になり、新しい識別子は秘匿化した値で出る', async () => {
    const oldSlug = await slugOf(toggleId);
    await submitEdit(toggleId, { isMasked: '1' });
    const newSlug = await slugOf(toggleId);
    expect(newSlug).not.toBe(oldSlug);

    expect((await fetchVisitor(oldSlug, AS_HTML)).status).toBe(404);
    const { status, text } = await fetchVisitor(newSlug, AS_HTML);
    expect(status).toBe(200);
    expect(text).toContain('切り替える秘匿化した題');
    expect(text).not.toContain('切り替える作り物のアプリ');
    expect(text).not.toContain(UNMASKED.organizationName);
  });

  // このファイルの最後に置く。秘匿化した実績を、秘匿化しない実績に変える
  it('秘匿化を外すと、同じ識別子で実際の値が出る', async () => {
    await submitEdit(maskedId, { isMasked: '0' });
    expect(await slugOf(maskedId)).toBe(MASKED_SLUG);
    const { text } = await fetchVisitor(MASKED_SLUG, AS_HTML);
    expect(text).toContain(HIDDEN.title);
    expect(text).toContain(HIDDEN.organizationName);
  });
});
