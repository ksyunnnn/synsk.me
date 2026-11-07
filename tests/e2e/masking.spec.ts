import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  chooseSiteOptions,
  fillProject,
  openVisitor,
  readProjectPath,
  registerProject,
  saveEdit,
  visit,
} from './support/dash';

/**
 * 秘匿化した実績の訪問者への見え方と、秘匿化の切り替え（specs/001-career-and-project/spec.md の
 * User Story 2、FR-001・FR-013・FR-019・FR-021・FR-022・FR-026・FR-043）。
 *
 * 訪問者のページの HTML の全体を調べる。画面に出ない RSC のペイロードとメタデータにも、
 * 隠す値を含めない。秘匿化した職歴は、職務経歴書の外で訪問者に見せる画面がまだ無い
 * （一覧は specs/005-feed が持つ）ため、ここでは確かめない。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 秘匿化した実績で、訪問者への応答に 0 件含まれるべき値 */
const HIDDEN = {
  organizationName: 'E2E 秘匿の実際の組織',
  title: 'E2E 秘匿の実際の題',
  description: 'E2E 秘匿の本文',
  url: 'https://example.com/e2e-masked-secret',
};

test('秘匿化した実績は、秘匿化した題と組織名で出し、本文を「非公開」にし、実際の値・本文・関連 URL を応答に含めない', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const { path } = await registerProject(page, {
    ...HIDDEN,
    organizationNameMasked: 'E2E 秘匿の秘匿化した組織',
    titleMasked: 'E2E 秘匿の秘匿化した題',
    startedOn: '2019-04-01',
    endedOn: '2020-03-31',
    onSite: true,
  });
  // 識別子は uid のままで、実際の題や組織名を含まない（Edge Cases）
  expect(path).toMatch(/^\/projects\/[0-9a-f-]{36}$/);

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor).toHaveTitle('E2E 秘匿の秘匿化した題 | synsk.me');
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 秘匿の秘匿化した題');
  await expect(visitor.getByText('E2E 秘匿の秘匿化した組織')).toBeVisible();
  await expect(visitor.getByText('2019-04-01 〜 2020-03-31')).toBeVisible();
  await expect(
    visitor.getByRole('region', { name: '本文' }).getByText('非公開', { exact: true }),
  ).toBeVisible();
  await expect(visitor.getByRole('link', { name: '関連するページ' })).toHaveCount(0);

  const html = await visitor.content();
  for (const [name, value] of Object.entries(HIDDEN)) {
    expect(html, `${name} が応答に含まれる`).not.toContain(value);
  }
  await visitor.close();
});

test('秘匿化に切り替えると識別子が新しい uid になって古い URL は 404 になり、識別子を書き換えられない。秘匿化を外すと同じ URL で実際の値が出る', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 切替の実際の組織',
    organizationNameMasked: 'E2E 切替の秘匿化した組織',
    title: 'E2E 切替の実際の題',
    titleMasked: 'E2E 切替の秘匿化した題',
    isMasked: false,
    onSite: true,
  });
  await page.getByRole('textbox', { name: '識別子' }).fill('e2e-masking-switch');
  await saveEdit(page);
  const visitor = await openVisitor(browser);
  expect(await visit(visitor, '/projects/e2e-masking-switch')).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 切替の実際の題');

  await chooseSiteOptions(page, { isMasked: true });
  await saveEdit(page);
  const maskedPath = await readProjectPath(page);
  expect(maskedPath).toMatch(/^\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: '識別子' })).toHaveAttribute('readonly', '');
  expect(await visit(visitor, '/projects/e2e-masking-switch')).toBe(404);
  expect(await visit(visitor, maskedPath)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 切替の秘匿化した題');
  expect(await visitor.content()).not.toContain('E2E 切替の実際の題');

  await chooseSiteOptions(page, { isMasked: false });
  await saveEdit(page);
  expect(await readProjectPath(page)).toBe(maskedPath);
  expect(await visit(visitor, maskedPath)).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 切替の実際の題');
  await expect(visitor.getByText('E2E 切替の実際の組織')).toBeVisible();
  await visitor.close();
});

test('秘匿化した組織名の無い組織で秘匿化して登録すると止まり、入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects/new');
  await fillProject(page, {
    organizationName: 'E2E 秘匿化した組織名の無い組織',
    title: 'E2E 秘匿化した組織名の無い実績',
    titleMasked: 'E2E 秘匿化した組織名の無い実績の秘匿化した題',
    startedOn: '2021-04-01',
  });
  await page.getByRole('button', { name: '登録する' }).click();

  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(
    page.getByText(
      '秘匿化するには、組織の秘匿化した組織名が要ります。秘匿化した組織名を入力してください',
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dash\/projects\/new$/);
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 秘匿化した組織名の無い実績',
  );
});
