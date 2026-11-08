import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  createLimitedResume,
  organizationNameInput,
  registerCareer,
  registerProject,
} from './support/dash';

/**
 * 保存せずに再読み込みしても、入力中の内容が残る（docs/REQUIREMENTS.md の FR-14、
 * specs/001-career-and-project/tasks.md の T072、specs/002-resume/tasks.md の T061）。
 * 入力中の内容はブラウザの `localStorage` に持つ（src/shared/components/draft-retention.tsx）。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 * `localStorage` はテストごとの新しいブラウザのコンテキストにあり、ほかのテストと重ならない。
 */

const restoredNotice = (page: import('@playwright/test').Page) =>
  page.getByRole('status').filter({ hasText: '保存していない入力を戻しました' });

test('実績の登録の画面で、再読み込みしても入力が残り、登録すると消える', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects/new');
  await organizationNameInput(page).fill('E2E 残す入力の組織');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 残す入力の題');
  await page.getByRole('radio', { name: '秘匿化しない（実際の値で出す）', exact: true }).check();

  await page.reload();
  await expect(restoredNotice(page)).toBeVisible();
  await expect(organizationNameInput(page)).toHaveValue('E2E 残す入力の組織');
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 残す入力の題',
  );
  await expect(
    page.getByRole('radio', { name: '秘匿化しない（実際の値で出す）', exact: true }),
  ).toBeChecked();

  await page
    .getByRole('textbox', { name: '秘匿化した題', exact: true })
    .fill('E2E 残す入力の秘匿化した題');
  await page.getByRole('textbox', { name: '始まりの日', exact: true }).fill('2021-04-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  // 登録に成功した後は、登録の画面に入力が戻らない
  await page.goto('/dash/projects/new');
  await expect(restoredNotice(page)).toBeHidden();
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue('');
});

test('保存に失敗して戻った入力も、再読み込みで残る', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects/new');
  // JavaScript が動き出す前に送ると、JavaScript なしの送信になり、保持の部品が動かない
  await page.waitForLoadState('networkidle');
  // 題が空で、保存に失敗する
  await organizationNameInput(page).fill('E2E 失敗の後に残す組織');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');

  await page.reload();
  await expect(organizationNameInput(page)).toHaveValue('E2E 失敗の後に残す組織');
});

test('職歴の編集の画面で、再読み込みしても入力が残り、捨てると元に戻る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: 'E2E 残す職歴の組織',
    organizationNameMasked: 'E2E 残す職歴の秘匿化した組織名',
    role: 'E2E 残す前の肩書',
  });
  const role = page.getByRole('textbox', { name: '肩書', exact: true });
  await role.fill('E2E 保存していない肩書');

  await page.reload();
  await expect(role).toHaveValue('E2E 保存していない肩書');

  await page.getByRole('button', { name: '戻した入力を捨てる' }).click();
  await expect(role).toHaveValue('E2E 残す前の肩書');
  await page.reload();
  await expect(role).toHaveValue('E2E 残す前の肩書');
});

test('職務経歴書の写した行の編集の画面で、再読み込みしても入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 写した行を残す組織',
    organizationNameMasked: 'E2E 写した行を残す秘匿化した組織名',
    title: 'E2E 写した行を残す実績',
  });
  await createLimitedResume(page, {
    title: 'E2E 写した行を残す職務経歴書',
    keep: /^E2E 写した行を残す実績/,
  });
  await page.getByRole('link', { name: /E2E 写した行を残す実績/ }).click();
  // 設定の画面も「題」の入力を持つ。移り終えてから入力する
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('写した実績を直す');
  const title = page.getByRole('textbox', { name: '題', exact: true });
  await title.fill('E2E 保存していない写した題');

  await page.reload();
  await expect(restoredNotice(page)).toBeVisible();
  await expect(title).toHaveValue('E2E 保存していない写した題');
});
