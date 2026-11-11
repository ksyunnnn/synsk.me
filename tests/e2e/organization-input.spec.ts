import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { organizationInput, registerCareer, registerProject, tabTo } from './support/dash';

/**
 * 職歴・実績の組織名の入力は、登録した組織の名前を選択肢に出す（specs/001-career-and-project/
 * spec.md の FR-002）。部品はネイティブの `<datalist>`（plan.md の U3）。
 *
 * 選択肢の一覧はブラウザが DOM の外に描き、Playwright の Chromium（headless）は一覧を開かない
 * （2026-11-10 に矢印のキーと Enter で選べないことを確かめた）。そのため、入力が combobox として
 * 選択肢の `<datalist>` を指すことと、Tab のキーで入力に移って打てることを確かめる。一覧の中を
 * キーボードで選ぶ操作はブラウザが持つ
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const ORGANIZATION = 'E2E 組織名の選択肢の組織';

/** 組織名の入力が指す `<datalist>` の選択肢の値 */
const optionsOf = (page: Page) =>
  organizationInput(page).evaluate((input) =>
    Array.from((input as HTMLInputElement).list?.options ?? [], (option) => option.value),
  );

/** Tab のキーだけで組織名に移り、名前を打つ */
const typeByKeyboard = async (page: Page, name: string) => {
  const input = organizationInput(page);
  await tabTo(page, input);
  await page.keyboard.type(name);
  return input;
};

test.beforeEach(async ({ context }) => {
  await actAsAuthor(context);
});

test('実績の組織名は、登録した組織を選択肢に出し、キーボードで入力できる', async ({ page }) => {
  await registerCareer(page, {
    organizationName: ORGANIZATION,
    organizationNameMasked: 'E2E 組織名の選択肢の秘匿化した職歴の組織',
    role: 'E2E 選択肢の肩書',
  });

  await page.goto('/dash/projects/new');
  expect(await optionsOf(page)).toContain(ORGANIZATION);
  const input = await typeByKeyboard(page, ORGANIZATION);
  await expect(input).toHaveValue(ORGANIZATION);
});

test('職歴の組織名も、登録した組織を選択肢に出し、選択肢に無い名前も書ける', async ({ page }) => {
  await registerProject(page, {
    organizationName: `${ORGANIZATION} 実績`,
    organizationNameMasked: 'E2E 組織名の選択肢の秘匿化した組織',
    title: 'E2E 組織名の選択肢の実績',
  });

  await page.goto('/dash/careers/new');
  expect(await optionsOf(page)).toContain(`${ORGANIZATION} 実績`);
  const input = await typeByKeyboard(page, 'E2E 選択肢に無い新しい組織');
  await expect(input).toHaveValue('E2E 選択肢に無い新しい組織');
});
