import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';

/**
 * リンクで画面を移るときの 403。RSC の要求の 403 は、状態コードでなく表示で伝わる
 * （ADR-0042）。`src/app/forbidden.tsx` がないと、画面全体が消える。
 */

test('作り手でなくなった後にリンクで移ると、開く権限がないことが出る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  await page.goto('/dash');
  await expect(page.getByRole('link', { name: '新しい note を作る' })).toBeVisible();

  await context.setExtraHTTPHeaders({});
  await page.getByRole('link', { name: '新しい note を作る' }).click();

  await expect(
    page.getByRole('heading', { name: 'このページを開く権限がありません' }),
  ).toBeVisible();
});
