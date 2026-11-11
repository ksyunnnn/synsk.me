import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { tabTo } from './support/dash';

/**
 * 管理画面のすべての画面が、上にサイトのトップへのリンクを持つ（`src/app/dash/layout.tsx`）。
 * キーボードでたどり着け、フォーカスが見える（design/guidelines.md の Inputs）
 */

const topLink = (page: Page) => page.getByRole('link', { name: 'サイトのトップへ', exact: true });

for (const path of ['/dash', '/dash/projects/new']) {
  test(`${path} から、キーボードでサイトのトップへ移れる`, async ({ page, context }) => {
    await actAsAuthor(context);
    await page.goto(path);

    const link = topLink(page);
    await tabTo(page, link);
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/top-draft');
  });
}
