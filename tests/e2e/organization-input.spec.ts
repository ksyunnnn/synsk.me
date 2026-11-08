import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { organizationNameInput, registerCareer, registerProject } from './support/dash';

/**
 * 組織名の入力に、登録した組織名を選択肢として出す（specs/001-career-and-project/spec.md の
 * User Story 3 の 1、FR-002）。入力はネイティブの `<input list>` と `<datalist>` で、選択肢の
 * 開閉と選ぶ操作はブラウザが持つ（plan.md の U3 の既定）。ブラウザが描く選択肢の一覧は DOM に
 * 無いため、ここでは入力と選択肢のつながりと、キーボードだけで登録できることを確かめる。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const NAME = 'E2E 選択肢に出る組織';

test('職歴で登録した組織名が、実績と職歴の組織名の選択肢に出る', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: NAME,
    organizationNameMasked: 'E2E 選択肢の秘匿化した組織名',
    role: 'E2E 選択肢の肩書',
  });

  for (const path of ['/dash/projects/new', '/dash/careers/new']) {
    await page.goto(path);
    const input = organizationNameInput(page);
    const listId = await input.getAttribute('list');
    expect(listId, path).toBeTruthy();
    await expect(
      page.locator(`datalist[id="${listId}"] option[value="${NAME}"]`),
      path,
    ).toHaveCount(1);
  }
});

test('選択肢に無い組織名も入力でき、キーボードだけで実績を登録できる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects/new');
  // 入力へは Tab で移る。組織名は選択肢に無い新しい名前
  await organizationNameInput(page).focus();
  await page.keyboard.type('E2E キーボードで入れた組織');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: '秘匿化した組織名', exact: true })).toBeFocused();
  await page.keyboard.type('E2E キーボードの秘匿化した組織名');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E キーボードの実績');
  await page
    .getByRole('textbox', { name: '秘匿化した題', exact: true })
    .fill('E2E キーボードの秘匿化した題');
  await page.getByRole('textbox', { name: '始まりの日', exact: true }).fill('2021-04-01');
  await page.getByRole('button', { name: '登録する' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(organizationNameInput(page)).toHaveValue('E2E キーボードで入れた組織');

  // 登録した組織名は、次の入力の選択肢に出る
  await registerProject(page, {
    organizationName: 'E2E キーボードで入れた組織',
    title: 'E2E 同じ組織の 2 つ目の実績',
    isMasked: false,
  });
  await page.goto('/dash/organizations');
  await expect(
    page.getByRole('link', { name: 'E2E キーボードで入れた組織', exact: true }),
  ).toHaveCount(1);
});
