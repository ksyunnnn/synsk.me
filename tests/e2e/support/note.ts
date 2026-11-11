import { expect, type Locator, type Page } from '@playwright/test';
import { textbox } from './dash';

/**
 * E2E でオーナーが note の管理画面で行う操作。テストは同じ手元の D1 を並行して使うため、識別子は
 * テストごとに重ならない値にする
 */

/** ほかのテストと重ならない識別子 */
export const uniqueNoteSlug = (label: string) => `e2e-${label}-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 入力の要素を React が hydration し終えるまで待つ。react-dom 19.3.1 は hydration のときに
 * `<textarea>` の値をサーバが描いた初めの値に戻す（`prepareToHydrateHostInstance` が
 * `initTextarea` を呼び、`element.value = textContent` とする）。そのため hydration の前に打った
 * 文字は消え、その後の保存は初めの値を送る。hydration は、値を戻す同じ処理の中で要素に
 * `__reactFiber$` で始まるキーを付けるため、このキーが付いた後に打った文字は残る
 */
export const waitForHydration = (target: Locator) =>
  expect
    .poll(() =>
      target.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith('__reactFiber$')),
      ),
    )
    .toBe(true);

/** 編集の画面を開き、本文の入力が hydration し終えるまで待つ */
export const openNoteEditor = async (page: Page, editUrl: string) => {
  await page.goto(editUrl);
  await waitForHydration(textbox(page, '本文'));
};

/**
 * note を作り、編集の画面に移ったことを確かめる。編集の画面の本文の入力が hydration し終える
 * まで待ってから、編集の画面の URL を返す
 */
export const createNote = async (
  page: Page,
  { slug, title, body = 'E2E の本文' }: { slug: string; title: string; body?: string },
) => {
  await page.goto('/dash/notes/new');
  await waitForHydration(textbox(page, '本文'));
  await textbox(page, '識別子').fill(slug);
  await textbox(page, '題').fill(title);
  await textbox(page, '本文').fill(body);
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  await waitForHydration(textbox(page, '本文'));
  return page.url().replace(/\?.*$/, '');
};
