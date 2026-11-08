import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  chooseSiteOptions,
  expectAbsentFromVisitorPages,
  openVisitor,
  registerCareer,
  registerProject,
  saveEdit,
  visit,
} from './support/dash';

/**
 * サイトに載せない職歴・実績を、訪問者のどの画面にも出さないこと（specs/001-career-and-project/
 * spec.md の User Story 1 の 5・6、FR-014・FR-043・FR-044・FR-045・SC-006）。
 * 管理画面で登録・切り替えた結果が、訪問者の画面に届くまでを通しで確かめる。
 *
 * 訪問者の画面は、職務経歴書の外のページ（tests/e2e/support/dash.ts の VISITOR_PAGES）と実績の
 * 個別のページである。HTML の全体を調べる。限定公開用の職務経歴書にはサイトに載せない職歴・実績も
 * 載る。それは tests/e2e/resume-limited.spec.ts が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

test('既定のまま登録した実績は、秘匿化するかに関わらず、訪問者のページが 404 で、訪問者のどの画面にも値が出ない', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const masked = await registerProject(page, {
    organizationName: 'E2E 載せない組織 既定',
    organizationNameMasked: 'E2E 載せない秘匿化した組織 既定',
    title: 'E2E 載せない秘匿化する題 既定',
    titleMasked: 'E2E 載せない秘匿化した題 既定',
    description: 'E2E 載せない本文 既定',
  });
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();
  const unmasked = await registerProject(page, {
    organizationName: 'E2E 載せない組織 既定',
    title: 'E2E 載せない実名の題 既定',
    description: 'E2E 載せない本文 既定',
    isMasked: false,
  });

  const visitor = await openVisitor(browser);
  for (const { path } of [masked, unmasked]) {
    expect(await visit(visitor, path), path).toBe(404);
  }
  await expectAbsentFromVisitorPages(visitor, [
    'E2E 載せない組織 既定',
    'E2E 載せない秘匿化した組織 既定',
    'E2E 載せない秘匿化する題 既定',
    'E2E 載せない秘匿化した題 既定',
    'E2E 載せない実名の題 既定',
    'E2E 載せない本文 既定',
  ]);
  await visitor.close();
});

test('実績をサイトに載せると直後から訪問者のページに出て、載せないに戻すと直後から 404 になる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const { path } = await registerProject(page, {
    organizationName: 'E2E 切り替える組織 載せる',
    title: 'E2E 切り替える題 載せる',
    isMasked: false,
  });
  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(404);

  await chooseSiteOptions(page, { onSite: true });
  await saveEdit(page);
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 切り替える題 載せる');

  await chooseSiteOptions(page, { onSite: false });
  await saveEdit(page);
  expect(await visit(visitor, path)).toBe(404);
  expect(await visitor.content()).not.toContain('E2E 切り替える題 載せる');
  await visitor.close();
});

test('サイトに載せない職歴の値は、同じ組織のサイトに載せる実績のページを含め、訪問者のどの画面にも出ない', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E 載せない職歴の組織',
    organizationNameMasked: 'E2E 載せない職歴の秘匿化した組織',
    role: 'E2E 載せない職歴の肩書',
    description: 'E2E 載せない職歴の本文',
    url: 'https://example.com/e2e-draft-career',
    isMasked: false,
  });
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();
  const { path } = await registerProject(page, {
    organizationName: 'E2E 載せない職歴の組織',
    title: 'E2E 載せない職歴と同じ組織の実績',
    isMasked: false,
    onSite: true,
  });

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);
  await expectAbsentFromVisitorPages(
    visitor,
    ['E2E 載せない職歴の肩書', 'E2E 載せない職歴の本文', 'https://example.com/e2e-draft-career'],
    [path],
  );
  await visitor.close();
});
