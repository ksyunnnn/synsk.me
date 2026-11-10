import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { tabTo, typeDate } from './support/dash';

/**
 * life event の画面（specs/004-external-activity/spec.md の User Story 5、FR-023〜FR-026・FR-035、
 * constitution V）。テストは同じ手元の D1 を並行して使う。値はほかのテストと重ならないものにする
 */

test('life event を作り、訪問者のページで見られ、書き換えて消せる', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events/new');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E の出来事');
  await page.getByRole('textbox', { name: '起きた日', exact: true }).fill('2020-04-01');
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill('e2e-life-event');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await page.goto('/life-events/e2e-life-event');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E の出来事');

  await page.goto('/dash/life-events');
  await page.getByRole('link', { name: 'E2E の出来事', exact: true }).click();
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill('e2e-life-event-renamed');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  expect((await page.goto('/life-events/e2e-life-event'))?.status()).toBe(404);
  expect((await page.goto('/life-events/e2e-life-event-renamed'))?.status()).toBe(200);

  await page.goto('/dash/life-events');
  await page.getByRole('link', { name: 'E2E の出来事', exact: true }).click();
  await page.getByRole('link', { name: 'この life event を削除する' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('life event を削除しました');
  expect((await page.goto('/life-events/e2e-life-event-renamed'))?.status()).toBe(404);
});

test('起きた日の無い life event は作れず、入力が残る（FR-025）', async ({ page, context }) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events/new');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 起きた日の無い出来事');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('起きた日を入力してください')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E 起きた日の無い出来事',
  );
});

test('題の無い life event は作れず、題を消した保存もできない（FR-024）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events/new');
  const title = page.getByRole('textbox', { name: '題', exact: true });
  await title.fill('   ');
  await page.getByRole('textbox', { name: '起きた日', exact: true }).fill('2017-05-01');
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill('e2e-life-event-untitled');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('alert')).toHaveText('入力を確かめてください');
  await expect(page.getByText('題を入力してください')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '起きた日', exact: true })).toHaveValue(
    '2017-05-01',
  );
  expect((await page.goto('/life-events/e2e-life-event-untitled'))?.status()).toBe(404);

  await page.goto('/dash/life-events/new');
  await title.fill('E2E 題を消す出来事');
  await page.getByRole('textbox', { name: '起きた日', exact: true }).fill('2017-05-02');
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill('e2e-life-event-retitle');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await title.fill('');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('題を入力してください')).toBeVisible();
  const editPath = new URL(page.url()).pathname;

  await page.goto('/life-events/e2e-life-event-retitle');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E 題を消す出来事');

  await page.goto(`${editPath}/delete`);
  await page.getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('status')).toHaveText('life event を削除しました');
});

test('オーナーはキーボードだけで life event を作り・書き換え・消せる（constitution V）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events');

  await tabTo(page, page.getByRole('link', { name: 'life event を作る' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dash\/life-events\/new$/);
  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.type('E2E キーボードの出来事');
  const happenedOn = page.getByRole('textbox', { name: '起きた日', exact: true });
  await tabTo(page, happenedOn);
  await typeDate(page, happenedOn, '2019-09-13');
  await tabTo(page, page.getByRole('button', { name: '作る' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');

  await tabTo(page, page.getByRole('textbox', { name: '題', exact: true }));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('E2E キーボードの出来事（直した）');
  await tabTo(page, page.getByRole('button', { name: '保存する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await expect(page.getByRole('textbox', { name: '題', exact: true })).toHaveValue(
    'E2E キーボードの出来事（直した）',
  );

  await tabTo(page, page.getByRole('link', { name: 'この life event を削除する' }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: '削除する' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('life event を削除しました');
});

/** 作り物の 1×1 の PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('代表画像を登録して訪問者のページに出し、形式の違うファイルを拒み、外せる（FR-028・FR-029）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash/life-events/new');
  await page.getByRole('textbox', { name: '題', exact: true }).fill('E2E 画像の出来事');
  await page.getByRole('textbox', { name: '起きた日', exact: true }).fill('2018-01-01');
  await page.getByRole('textbox', { name: '識別子', exact: true }).fill('e2e-life-event-image');
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');

  const file = page.getByLabel('画像のファイル');
  await file.setInputFiles({
    name: 'fake.txt',
    mimeType: 'image/png',
    buffer: Buffer.from('作り物'),
  });
  await page.getByRole('button', { name: '画像を登録する' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    '画像は JPEG・PNG・WebP・GIF のどれかにしてください',
  );

  await file.setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await page.getByRole('button', { name: '画像を登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('代表画像を登録しました');
  const src = await page.getByRole('img', { name: '今の代表画像' }).getAttribute('src');
  expect(src).toMatch(/^\/life-events\/e2e-life-event-image\/media\/[0-9a-f-]{36}$/);
  const image = await page.request.get(src!);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');

  await page.goto('/life-events/e2e-life-event-image');
  await expect(page.locator(`img[src="${src}"]`)).toBeVisible();

  await page.goBack();
  await page.getByRole('button', { name: '代表画像を外す' }).click();
  await expect(page.getByRole('status')).toHaveText('代表画像を外しました');
  expect((await page.request.get(src!)).status()).toBe(404);
});
