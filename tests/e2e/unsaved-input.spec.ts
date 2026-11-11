import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { registerCareer, registerProject, textbox } from './support/dash';
import { waitForHydration } from './support/note';

/**
 * note 以外の管理画面の入力は、保存していない入力を持たない。再読み込みすると、D1 に保存した
 * 値を出す。保存していない入力を端末に残すのは note だけの要件（specs/003-note/spec.md の
 * FR-018、Clarifications の Session 2026-11-11）。
 *
 * 入力は、フォームが hydration し終えてから打つ。hydration の前の入力は、ブラウザがそのまま
 * 持つことがあり、この検査の対象ではない。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const openForm = async (page: Page, url: string) => {
  await page.goto(url);
  await waitForHydration(page.locator('main form').first());
};

test('実績の編集の画面で、サイトに載せるかを選び直して保存せずに再読み込みすると、保存した値が出る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const { editUrl } = await registerProject(page, {
    organizationName: 'E2E 保存しない実績の組織',
    organizationNameMasked: 'E2E 保存しない実績の秘匿化した組織名',
    title: `E2E 保存しない実績 ${crypto.randomUUID()}`,
    onSite: false,
  });
  await openForm(page, editUrl);
  await page.getByRole('radio', { name: 'サイトに載せる', exact: true }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();
  expect(
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft')),
    ),
  ).toEqual([]);
});

test('実績の編集の画面で、本文を書き換えて保存せずに再読み込みすると、保存した本文が出る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const { editUrl } = await registerProject(page, {
    organizationName: 'E2E 保存しない本文の組織',
    organizationNameMasked: 'E2E 保存しない本文の秘匿化した組織名',
    title: `E2E 保存しない本文 ${crypto.randomUUID()}`,
    description: 'E2E 保存した本文',
  });
  await openForm(page, editUrl);
  await textbox(page, '本文').fill('E2E 保存していない本文');
  await page.reload();
  await waitForHydration(textbox(page, '本文'));
  await expect(textbox(page, '本文')).toHaveValue('E2E 保存した本文');
});

test('職歴の編集の画面で、肩書を書き換えて保存せずに再読み込みすると、保存した肩書が出る', async ({
  page,
  context,
}) => {
  const role = `E2E 保存した肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 保存しない職歴の組織',
    organizationNameMasked: 'E2E 保存しない職歴の秘匿化した組織名',
    role,
  });
  await openForm(page, editUrl);
  await textbox(page, '肩書').fill('E2E 保存していない肩書');
  await page.reload();
  await expect(textbox(page, '肩書')).toHaveValue(role);
});

test('組織の編集の画面で、秘匿化した組織名を書き換えて保存せずに再読み込みすると、保存した値が出る', async ({
  page,
  context,
}) => {
  const name = `E2E 保存しない組織 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: name,
    organizationNameMasked: 'E2E 保存した秘匿化した組織名',
    role: 'E2E 保存しない組織の肩書',
  });
  await page.goto('/dash/organizations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('組織を編集する');
  await waitForHydration(page.locator('main form').first());
  await textbox(page, '秘匿化した組織名').fill('E2E 保存していない秘匿化した組織名');
  await page.reload();
  await expect(textbox(page, '秘匿化した組織名')).toHaveValue('E2E 保存した秘匿化した組織名');
});

for (const { screen, url, label } of [
  { screen: '学歴', url: '/dash/educations/new', label: '学校' },
  { screen: 'スキル', url: '/dash/skills/new', label: '名前' },
  { screen: 'life event', url: '/dash/life-events/new', label: '題' },
  { screen: '外部の activity', url: '/dash/activities/new', label: '題' },
]) {
  test(`${screen}の登録の画面で、入力して保存せずに再読み込みすると、入力が空に戻る`, async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    await openForm(page, url);
    await textbox(page, label).fill(`E2E 保存していない${label}`);
    await page.reload();
    await expect(textbox(page, label)).toHaveValue('');
  });
}
