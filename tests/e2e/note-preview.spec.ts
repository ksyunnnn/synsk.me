import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { openVisitor, saveEdit, submitAndWait, textbox } from './support/dash';
import { createNote, uniqueNoteSlug, waitForHydration } from './support/note';

/**
 * 見た目の確認の画面で、公開していない版の本文が指す画像が出る（docs/REQUIREMENTS.md の FR-13、
 * specs/003-note/research.md の R15）。訪問者には、公開するまでその画像を返さない（spec の FR-026）
 */

/** 1×1 の PNG（作り物） */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('下書きの note の見た目の確認で、本文に置いた画像が出る', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const slug = uniqueNoteSlug('preview-media');
  const editUrl = await createNote(page, { slug, title: `E2E 見た目の確認の題 ${slug}` });

  await page.getByLabel('画像のファイル').setInputFiles({
    name: 'e2e.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await submitAndWait(page, '画像を足す');
  await expect(page.getByRole('status')).toHaveText('画像を足しました');
  const mark =
    (await page.locator('code').filter({ hasText: 'media:' }).first().textContent()) ?? '';
  const key = mark.match(/media:([0-9a-f-]{36})/)?.[1];
  expect(key).toBeDefined();

  await waitForHydration(textbox(page, '本文'));
  await textbox(page, '本文').fill(
    `![E2E の画像の代替テキスト](media:${key} "E2E の画像のホバーの文")\n*E2E の画像のキャプション*`,
  );
  await saveEdit(page);

  await page.goto(`${editUrl}/preview`);
  const image = page.getByRole('img', { name: 'E2E の画像の代替テキスト' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(1);
  await expect(image).toHaveAttribute('title', 'E2E の画像のホバーの文');
  await expect(page.locator('figcaption')).toHaveText('E2E の画像のキャプション');

  // 公開していないため、訪問者の経路では返さない
  const visitor = await openVisitor(browser);
  const res = await visitor.request.get(`/notes/${slug}/media/${key}`);
  expect(res.status()).toBe(404);
  await visitor.close();
});

/**
 * URL カードの「取り直す」（spec の User Story 6 の 3、FR-029）。取得はサーバの中で走り、ブラウザの
 * 経路の差し替えでは作り物にできない。`.invalid`（RFC 6761）の URL は取得の部品が要求を出さずに
 * 失敗にするため、外へ出ずに失敗の知らせを確かめる。取れたときの書き換えは単体と D1 の検査が持つ
 */
test('見た目の確認で URL カードを取り直し、取れなければ理由を出す', async ({ page, context }) => {
  await actAsAuthor(context);
  const slug = uniqueNoteSlug('preview-refetch');
  const url = `https://${slug}.invalid/a`;
  const editUrl = await createNote(page, { slug, title: `E2E 取り直しの題 ${slug}` });
  await waitForHydration(textbox(page, '本文'));
  await textbox(page, '本文').fill(url);
  await saveEdit(page);

  await page.goto(`${editUrl}/preview`);
  await expect(page.getByRole('link', { name: url })).toBeVisible();
  const button = page.getByRole('button', { name: '取り直す' });
  await waitForHydration(button);
  await button.click();
  await expect(page.getByRole('alert')).toContainText('取り直せませんでした');
  await expect(page.getByRole('link', { name: url })).toBeVisible();
});
