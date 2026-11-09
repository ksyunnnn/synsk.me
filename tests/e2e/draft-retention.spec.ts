import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  fillCareer,
  fillProject,
  registerCareer,
  registerSkill,
  saveEdit,
  textbox,
} from './support/dash';

/**
 * 保存操作をしていない入力が、再読み込みしても残ること（docs/REQUIREMENTS.md の FR-14、
 * specs/001-career-and-project/research.md の R16）。書きかけはブラウザの `localStorage` に持ち、
 * テストごとの context は別の保存先を持つ。
 *
 * 書きかけは、画面の JavaScript が動き始めた後の入力だけを持つ（src/shared/components/draft-retention.tsx）。
 * 入力は、書きかけが書き込まれるまで入れ直す。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

/** 書きかけの名前の一覧。名前は `synsk:draft:<scope>:...` */
const draftKeys = (page: Page) =>
  page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft:')),
  );

/**
 * `fill` で入力し、`scope`（`career`・`project` など）の画面の書きかけが書き込まれるまで入れ直す。
 * JavaScript が動く前の入力は、書きかけに書き込まれない
 */
const fillUntilDrafted = (page: Page, scope: string, fill: () => Promise<void>) =>
  expect
    .poll(async () => {
      await fill();
      return (await draftKeys(page)).some((key) => key.startsWith(`synsk:draft:${scope}:`));
    })
    .toBe(true);

test('職歴の登録の画面で、保存せずに再読み込みしても入力が残り、登録すると消える', async ({
  page,
  context,
}) => {
  const role = `E2E 書きかけの肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, {
      organizationName: 'E2E 書きかけの組織',
      organizationNameMasked: 'E2E 書きかけの秘匿化した組織名',
      role,
      startedOn: '2020-04-01',
      description: '1 行目\n2 行目',
      isMasked: false,
      onSite: true,
    }),
  );
  await page.reload();

  await expect(textbox(page, '組織名')).toHaveValue('E2E 書きかけの組織');
  await expect(textbox(page, '肩書')).toHaveValue(role);
  await expect(textbox(page, '始まりの日')).toHaveValue('2020-04-01');
  await expect(textbox(page, '本文')).toHaveValue('1 行目\n2 行目');
  await expect(
    page.getByRole('radio', { name: '秘匿化しない（実際の値で出す）', exact: true }),
  ).toBeChecked();
  await expect(page.getByRole('radio', { name: 'サイトに載せる', exact: true })).toBeChecked();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect.poll(() => draftKeys(page)).toEqual([]);
  await page.goto('/dash/careers/new');
  await expect(textbox(page, '肩書')).toHaveValue('');
});

test('職歴の登録で項目の不備があっても、再読み込みすると送った入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  // 組織名を空のまま送ると、項目の不備で止まる
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, { role: 'E2E 不備のある書きかけ', startedOn: '2020-04-01' }),
  );
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '入力を確かめてください' })).toBeVisible();
  await expect.poll(() => draftKeys(page)).toEqual(['synsk:draft:career:new']);
  await page.reload();
  await expect(textbox(page, '肩書')).toHaveValue('E2E 不備のある書きかけ');
});

test('職歴の登録の送信が応答を返さずに失敗しても、再読み込みすると入力が残る', async ({
  page,
  context,
}) => {
  const role = `E2E 送れなかった肩書 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await page.goto('/dash/careers/new');
  await fillUntilDrafted(page, 'career', () =>
    fillCareer(page, {
      organizationName: 'E2E 送れなかった組織',
      organizationNameMasked: 'E2E 送れなかった秘匿化した組織名',
      role,
      startedOn: '2020-04-01',
    }),
  );
  // Server Action の送信を切る。失敗の結果は来ない
  await page.route('**/dash/careers/new', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  const aborted = page.waitForEvent('requestfailed', (req) => req.method() === 'POST');
  await page.getByRole('button', { name: '登録する' }).click();
  await aborted;
  await page.unroute('**/dash/careers/new');
  await page.goto('/dash/careers/new');
  await expect(textbox(page, '肩書')).toHaveValue(role);
});

test('職歴の編集の画面で、保存せずに再読み込みしても入力が残り、保存すると消える', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await registerCareer(page, {
    organizationName: 'E2E 書きかけの編集の組織',
    organizationNameMasked: 'E2E 書きかけの編集の秘匿化した組織名',
    role: 'E2E 保存した肩書',
  });
  await page.goto(editUrl);
  await fillUntilDrafted(page, 'career', () =>
    textbox(page, '肩書').fill('E2E 保存していない肩書'),
  );
  await page.reload();
  await expect(textbox(page, '肩書')).toHaveValue('E2E 保存していない肩書');

  const openedUpdatedAt = page.locator('input[name="openedUpdatedAt"]');
  const updatedAtBeforeSave = await openedUpdatedAt.inputValue();
  await saveEdit(page);
  await expect(openedUpdatedAt).not.toHaveValue(updatedAtBeforeSave);
  await expect.poll(() => draftKeys(page)).toEqual([]);
  await page.goto(editUrl);
  await expect(textbox(page, '肩書')).toHaveValue('E2E 保存していない肩書');
});

test('実績の登録の画面で、選んだスキルと種類が再読み込みしても残る', async ({ page, context }) => {
  const skill = `E2E 書きかけのスキル ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerSkill(page, skill);
  await page.goto('/dash/projects/new');
  await fillUntilDrafted(page, 'project', () =>
    fillProject(page, {
      organizationName: 'E2E 書きかけの実績の組織',
      kind: '登壇',
      title: 'E2E 書きかけの実績',
      skills: [skill],
    }),
  );
  await page.reload();
  await expect(textbox(page, '題')).toHaveValue('E2E 書きかけの実績');
  await expect(page.getByRole('combobox', { name: '種類' })).toHaveValue('talk');
  await expect(page.getByRole('checkbox', { name: skill, exact: true })).toBeChecked();
});

test('学歴とスキルの登録の画面で、保存せずに再読み込みしても入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/educations/new');
  await fillUntilDrafted(page, 'education', () => textbox(page, '学校').fill('E2E 書きかけの学校'));
  await page.reload();
  await expect(textbox(page, '学校')).toHaveValue('E2E 書きかけの学校');

  await page.goto('/dash/skills/new');
  await fillUntilDrafted(page, 'skill', () =>
    textbox(page, '名前').fill('E2E 書きかけのスキルの名前'),
  );
  await page.reload();
  await expect(textbox(page, '名前')).toHaveValue('E2E 書きかけのスキルの名前');
});

test('組織の編集の画面で、保存せずに再読み込みしても入力が残る', async ({ page, context }) => {
  const name = `E2E 書きかけの組織の画面 ${crypto.randomUUID()}`;
  await actAsAuthor(context);
  await registerCareer(page, {
    organizationName: name,
    organizationNameMasked: 'E2E 書きかけの組織の画面の秘匿化した組織名',
    role: 'E2E 書きかけの組織の画面の肩書',
  });
  await page.goto('/dash/organizations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('組織を編集する');
  await fillUntilDrafted(page, 'organization', () =>
    textbox(page, '秘匿化した組織名').fill('E2E 保存していない秘匿化した組織名'),
  );
  await page.reload();
  await expect(textbox(page, '秘匿化した組織名')).toHaveValue('E2E 保存していない秘匿化した組織名');
});
