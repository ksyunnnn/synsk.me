import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import {
  fillProject,
  organizationInput,
  openVisitor,
  readProjectPath,
  registerProject,
  registerSkill,
  saveEdit,
  tabTo,
  typeDate,
  visit,
} from './support/dash';

/**
 * オーナーとしての実績の登録・編集・削除と、訪問者の個別のページ（specs/001-career-and-project/
 * spec.md の User Story 1、FR-011・FR-013・FR-014・FR-023・FR-039・FR-042）。
 * 秘匿化は tests/e2e/masking.spec.ts、サイトに載せるかは tests/e2e/site-status.spec.ts が持つ。
 * HTTP の状態コードと D1 の行は結合の検査が持つ。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

test('実績を登録・編集・削除でき、削除した実績の訪問者のページは 404 になる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const { path } = await registerProject(page, {
    organizationName: 'E2E 実績の組織 削除',
    organizationNameMasked: 'E2E 実績の秘匿化した組織 削除',
    title: 'E2E 実績の題 削除',
    titleMasked: 'E2E 実績の秘匿化した題 削除',
  });
  // 既定は、秘匿化する・サイトに載せない（FR-015・FR-044）
  await expect(page.getByRole('radio', { name: '秘匿化する', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'サイトに載せない', exact: true })).toBeChecked();

  await fillProject(page, { title: 'E2E 実績の直した題 削除', kind: '登壇', onSite: true });
  await saveEdit(page);
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 実績の直した題 削除',
  );
  await expect(page.getByRole('combobox', { name: '種類' })).toHaveValue('talk');

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);

  await page.getByRole('link', { name: 'この実績を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('実績を削除しました');
  await expect(page.getByRole('link', { name: 'E2E 実績の直した題 削除' })).toHaveCount(0);
  expect(await visit(visitor, path)).toBe(404);
  await visitor.close();
});

test('サイトに載せる、秘匿化しない実績は、訪問者のページに実際の題・組織名・種類・期間・スキル・関連 URL で出る', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await registerSkill(page, 'E2E-Skill-実名');
  const { path } = await registerProject(page, {
    organizationName: 'E2E 実績の組織 実名',
    kind: '開発',
    title: 'E2E 実績の題 実名',
    titleMasked: 'E2E 実績の秘匿化した題 実名',
    startedOn: '2022-04-01',
    endedOn: '2023-03-31',
    url: 'https://example.com/e2e-real',
    skills: ['E2E-Skill-実名'],
    isMasked: false,
    onSite: true,
  });

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);
  await expect(visitor).toHaveTitle('E2E 実績の題 実名 | synsk.me');
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 実績の題 実名');
  await expect(visitor.getByText('E2E 実績の組織 実名')).toBeVisible();
  await expect(visitor.getByText('開発', { exact: true })).toBeVisible();
  await expect(visitor.getByText('2022-04-01 〜 2023-03-31')).toBeVisible();
  await expect(visitor.getByText('E2E-Skill-実名')).toBeVisible();
  await expect(visitor.getByRole('link', { name: '関連するページ' })).toHaveAttribute(
    'href',
    'https://example.com/e2e-real',
  );
  await expect(visitor.getByText('非公開')).toHaveCount(0);
  await visitor.close();
});

test('秘匿化しない実績の識別子を書き換えると、新しい URL で開け、古い URL は 404 になる', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const { path: oldPath } = await registerProject(page, {
    organizationName: 'E2E 実績の組織 識別子',
    title: 'E2E 実績の題 識別子',
    titleMasked: 'E2E 実績の秘匿化した題 識別子',
    isMasked: false,
    onSite: true,
  });
  // 登録したときの識別子は、題や組織名から推測できない uid（FR-013）
  expect(oldPath).toMatch(
    /^\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  await page.getByRole('textbox', { name: '識別子' }).fill('e2e-renamed-slug');
  await saveEdit(page);
  await readProjectPath(page, '/projects/e2e-renamed-slug');

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, '/projects/e2e-renamed-slug')).toBe(200);
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('E2E 実績の題 識別子');
  expect(await visit(visitor, oldPath)).toBe(404);
  await visitor.close();
});

test('ほかの実績と同じ識別子には保存できず、入力が残る', async ({ page, context }) => {
  await actAsAuthor(context);
  await registerProject(page, {
    organizationName: 'E2E 実績の組織 重複',
    title: 'E2E 実績の題 重複 1',
    isMasked: false,
  });
  await page.getByRole('textbox', { name: '識別子' }).fill('e2e-taken-slug');
  await saveEdit(page);

  await registerProject(page, {
    organizationName: 'E2E 実績の組織 重複',
    title: 'E2E 実績の題 重複 2',
    isMasked: false,
  });
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 実績の直した題 重複 2');
  await page.getByRole('textbox', { name: '識別子' }).fill('e2e-taken-slug');
  await page.getByRole('button', { name: '保存する' }).click();

  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('この識別子はほかの実績が使っています')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 実績の直した題 重複 2',
  );
});

test('入力の誤りは項目ごとに示して保存せず、入力が残る', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects/new');
  await fillProject(page, {
    organizationName: 'E2E 実績の組織 誤り',
    title: '',
    startedOn: '2022-04-01',
    endedOn: '2022-03-31',
    url: 'ftp://example.com',
    isMasked: false,
  });
  await page.getByRole('button', { name: '登録する' }).click();

  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('題を入力してください', { exact: true })).toBeVisible();
  await expect(page.getByText('終わりの日は始まりの日より前にできません')).toBeVisible();
  await expect(
    page.getByText('関連 URL は http か https で始まる URL にしてください'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dash\/projects\/new$/);
  await expect(organizationInput(page)).toHaveValue('E2E 実績の組織 誤り');
});

test('同じ実績を 2 つのタブで開くと、後から保存した側は止まり、入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const { editUrl } = await registerProject(page, {
    organizationName: 'E2E 実績の組織 同時',
    title: 'E2E 実績の題 同時',
    isMasked: false,
  });
  const other = await context.newPage();
  await other.goto(editUrl);

  await page.getByRole('textbox', { name: '題', exact: true }).fill('先に保存した実績の題');
  await saveEdit(page);

  await other.getByRole('textbox', { name: '題', exact: true }).fill('後から保存した実績の題');
  await other.getByRole('button', { name: '保存する' }).click();
  await expect(other.getByRole('alert')).toContainText('別の画面で書き換えられていました');
  await expect(other.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    '後から保存した実績の題',
  );

  await other.goto(editUrl);
  await expect(other.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    '先に保存した実績の題',
  );
});

test('オーナーはキーボードだけで実績を登録・編集・削除できる（constitution V）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/projects');

  await tabTo(page, page.getByRole('link', { name: '実績を登録する' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dash\/projects\/new$/);

  await tabTo(page, organizationInput(page));
  await page.keyboard.type('E2E 実績の組織 キーボード');
  // 秘匿化する実績の新しい組織は、秘匿化した組織名が要る
  await tabTo(page, page.getByRole('textbox', { name: '秘匿化した組織名', exact: true }));
  await page.keyboard.type('E2E 実績の秘匿化した組織 キーボード');
  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.type('E2E 実績の題 キーボード');
  await tabTo(page, page.getByRole('textbox', { name: '秘匿化した題', exact: true }));
  await page.keyboard.type('E2E 実績の秘匿化した題 キーボード');
  const startedOn = page.getByRole('textbox', { name: '始まりの日', exact: true });
  await tabTo(page, startedOn);
  await typeDate(page, startedOn, '2021-04-01');
  await tabTo(page, page.getByRole('button', { name: '登録する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');

  // ラジオボタンは、組の中で選ばれたものに Tab で入り、矢印のキーで選び直す
  await tabTo(page, page.getByRole('radio', { name: 'サイトに載せない', exact: true }));
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'サイトに載せる', exact: true })).toBeChecked();
  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('E2E 実績の直した題 キーボード');
  await tabTo(page, page.getByRole('button', { name: '保存する' }));
  // 登録の後の「保存しました」が画面に残っているため、送った Server Action の応答を待つ
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 実績の直した題 キーボード',
  );
  const path = await readProjectPath(page);

  const visitor = await openVisitor(browser);
  expect(await visit(visitor, path)).toBe(200);

  await tabTo(page, page.getByRole('link', { name: 'この実績を削除する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('実績を削除する');
  await tabTo(page, page.getByRole('button', { name: '削除する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('実績を削除しました');
  await expect(page.getByRole('link', { name: 'E2E 実績の直した題 キーボード' })).toHaveCount(0);
  expect(await visit(visitor, path)).toBe(404);
  await visitor.close();
});

test('一覧を組織で絞り込み、種類と組み合わせられる（issue #330）', async ({ page, context }) => {
  await actAsAuthor(context);
  const organization = {
    organizationName: 'E2E 実績の組織 絞り込み',
    organizationNameMasked: 'E2E 実績の秘匿化した組織 絞り込み',
  };
  await registerProject(page, { ...organization, title: 'E2E 実績の題 絞り込み 開発' });
  await registerProject(page, {
    ...organization,
    title: 'E2E 実績の題 絞り込み 登壇',
    kind: '登壇',
  });

  await page.goto('/dash/projects');
  const select = page.getByRole('combobox', { name: '組織で絞り込む' });
  await select.selectOption({ label: organization.organizationName });
  await page.getByRole('button', { name: '絞り込む' }).click();
  await expect(page).toHaveURL(/[?&]org=[0-9a-f]{32}/);
  await expect(page.getByText('2 件', { exact: true })).toBeVisible();

  // 種類のリンクは、選んだ組織を保つ。select も選んだ組織を出し続ける
  await page
    .getByRole('navigation', { name: '種類で絞り込む' })
    .getByRole('link', { name: '登壇' })
    .click();
  await expect(page).toHaveURL(/kind=talk&org=[0-9a-f]{32}/);
  await expect(page.getByText('1 件', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'E2E 実績の題 絞り込み 登壇' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'E2E 実績の題 絞り込み 開発' })).toHaveCount(0);
  await expect(select.locator('option:checked')).toHaveText(organization.organizationName);

  // 形の違う組織の値では、組織で絞らない
  await page.goto('/dash/projects?kind=talk&org=1');
  await expect(select).toHaveValue('');
});
