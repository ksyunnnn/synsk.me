import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './support/d1';
import { readRows, sendForm } from './support/send';
import { insertOrganization, insertProject, uidOf } from '../support/career-and-project-rows';

/**
 * 組織の編集と削除（specs/001-career-and-project/spec.md の FR-004・FR-040・SC-003）。
 */

const PROJECT_SLUG = 'fake-org-app';

let ctx: TestServer;
let organizationUid: string;
let unusedUid: string;

beforeAll(async () => {
  ctx = await startTestServer({
    seed: async (db) => {
      const organizationId = await insertOrganization(db, { name: '直す前の作り物の組織' });
      const unusedId = await insertOrganization(db, { name: 'どこからも指されない作り物の組織' });
      organizationUid = await uidOf(db, 'organization', organizationId);
      unusedUid = await uidOf(db, 'organization', unusedId);
      await insertProject(db, {
        organizationId,
        slug: PROJECT_SLUG,
        isMasked: false,
        status: 'published',
      });
    },
  });
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe('オーナーの JWT がない書き込み（FR-040）', () => {
  const OUTSIDE_DASH = `/projects/${PROJECT_SLUG}`;

  describe.each(['submit', 'call'] as const)('%s', (how) => {
    it('編集は D1 を変えない', async () => {
      const before = await readRows(ctx, 'organization');
      const res = await sendForm(ctx, {
        how,
        formPath: `/dash/organizations/${organizationUid}`,
        to: OUTSIDE_DASH,
        values: { organizationUid, name: 'JWT なしで直した組織名', nameMasked: '' },
        asAuthor: false,
      });
      await res.arrayBuffer();
      expect(await readRows(ctx, 'organization')).toEqual(before);
    });

    it('削除は D1 を変えない', async () => {
      const before = await readRows(ctx, 'organization');
      const res = await sendForm(ctx, {
        how,
        formPath: `/dash/organizations/${unusedUid}/delete`,
        to: OUTSIDE_DASH,
        values: { organizationUid: unusedUid },
        asAuthor: false,
      });
      await res.arrayBuffer();
      expect(await readRows(ctx, 'organization')).toEqual(before);
    });
  });
});

it('オーナーの JWT がない組織の画面は 403', async () => {
  for (const path of [
    '/dash/organizations',
    `/dash/organizations/${organizationUid}`,
    `/dash/organizations/${organizationUid}/delete`,
  ]) {
    const res = await ctx.server.fetch(path);
    expect(res.status, path).toBe(403);
    expect(await res.text()).not.toContain('直す前の作り物の組織');
  }
});

it('組織名を直した直後に、実績のページが直した組織名を出す（FR-004・SC-003）', async () => {
  const res = await sendForm(ctx, {
    how: 'submit',
    formPath: `/dash/organizations/${organizationUid}`,
    values: { organizationUid, name: '直した後の作り物の組織', nameMasked: 'ある会社' },
    asAuthor: true,
  });
  await res.arrayBuffer();
  expect(res.status).toBe(303);

  const page = await ctx.server.fetch(`/projects/${PROJECT_SLUG}`);
  const text = await page.text();
  expect(text).toContain('直した後の作り物の組織');
  expect(text).not.toContain('直す前の作り物の組織');
});
