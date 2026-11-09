import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { saveEdit, textbox } from './support/dash';
import { createNote, uniqueNoteSlug } from './support/note';

/**
 * 書きかけの note の保持（specs/003-note/spec.md の FR-018・FR-019、User Story 4 の 1・2、
 * research.md の R10）。書きかけは共有担当の `DraftRetainingForm` がブラウザの `localStorage` に
 * 持ち、テストごとの context は別の保存先を持つ。書きかけは画面の JavaScript が動き始めた後の
 * 入力だけを持つため、書き込まれるまで入れ直す
 */

const noteDraftKeys = (page: Page) =>
  page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('synsk:draft:note:')),
  );

const fillUntilDrafted = (page: Page, value: string) =>
  expect
    .poll(async () => {
      await textbox(page, '本文').fill(value);
      return (await noteDraftKeys(page)).length > 0;
    })
    .toBe(true);

test('本文を書きかけて保存せずに再読み込みすると、書きかけが残る（User Story 4 の 1）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, { slug: uniqueNoteSlug('draft'), title: 'E2E 書きかけ' });
  await page.goto(editUrl);
  await fillUntilDrafted(page, 'E2E 保存していない本文');
  await page.reload();
  await expect(textbox(page, '本文')).toHaveValue('E2E 保存していない本文');
});

test('別のブラウザの文脈で開くと、書きかけは出ず、最後に保存した版が出る（User Story 4 の 2）', async ({
  page,
  context,
  browser,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('device'),
    title: 'E2E 別の端末',
    body: 'E2E 最後に保存した本文',
  });
  await page.goto(editUrl);
  await fillUntilDrafted(page, 'E2E この端末だけの書きかけ');

  // 別の context は別の localStorage を持つ。別の端末にあたる
  const otherContext = await browser.newContext();
  await actAsAuthor(otherContext);
  const other = await otherContext.newPage();
  await other.goto(editUrl);
  await expect(textbox(other, '本文')).toHaveValue('E2E 最後に保存した本文');
  await otherContext.close();
});

test('保存を止められたとき、書きかけが消えない（spec の Edge Cases）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('conflict-draft'),
    title: 'E2E 止められた書きかけ',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);
  await textbox(other, '本文').fill('先に保存した本文');
  await saveEdit(other);
  await other.close();

  await fillUntilDrafted(page, 'E2E 止められる前の書きかけ');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('alert')).toContainText('別の画面で保存されていました');

  // 書きかけは、開いたときの版の名前のまま持ち続ける。開き直しても自動では戻さない（R10）
  await page.reload();
  const drafts = await page.evaluate(() =>
    Object.entries(window.localStorage)
      .filter(([key]) => key.startsWith('synsk:draft:note:'))
      .map(([, value]) => value),
  );
  expect(drafts.some((value) => value.includes('E2E 止められる前の書きかけ'))).toBe(true);
  await expect(textbox(page, '本文')).toHaveValue('先に保存した本文');
});
