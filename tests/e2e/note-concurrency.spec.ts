import { expect, test } from '@playwright/test';
import { actAsAuthor } from './support/author';
import { saveEdit, textbox } from './support/dash';
import { createNote, uniqueNoteSlug } from './support/note';

/**
 * 同じ note を 2 つの画面で開いたときの保存（specs/003-note/spec.md の FR-020・FR-021・SC-002、
 * User Story 4 の 3・4）。比べる値は開いたときの最も新しい版（research.md の R4）。
 * 作った後の `?saved=1` の画面のまま打つと、保存した本文が画面に出ないことがあった（2026-11-09 の
 * E2E で 4 回に 1 回）。編集の画面を開き直してから打つ
 */

test('2 つのタブで同じ note を開くと、後から保存した側は止まり、知らせが出て、入力が残る', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('concurrency'),
    title: 'E2E 同時の題',
  });
  await page.goto(editUrl);
  const other = await context.newPage();
  await other.goto(editUrl);

  await textbox(page, '本文').fill('画面 A で先に保存した本文');
  await saveEdit(page);

  await textbox(other, '本文').fill('画面 B で後から書いた本文');
  await other.getByRole('button', { name: '保存する' }).click();
  await expect(other.getByRole('alert')).toContainText('別の画面で保存されていました');
  await expect(textbox(other, '本文')).toHaveValue('画面 B で後から書いた本文');

  await other.goto(editUrl);
  await expect(textbox(other, '本文')).toHaveValue('画面 A で先に保存した本文');
});

test('1 つのタブで続けて 2 回保存すると、2 回とも保存される（FR-021）', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const editUrl = await createNote(page, {
    slug: uniqueNoteSlug('twice'),
    title: 'E2E 続けての題',
  });
  await page.goto(editUrl);

  await textbox(page, '本文').fill('1 回目の本文');
  await saveEdit(page);
  await expect(textbox(page, '本文')).toHaveValue('1 回目の本文');

  await textbox(page, '本文').fill('2 回目の本文');
  await saveEdit(page);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.goto(`${editUrl}/revisions`);
  await expect(page.getByRole('listitem')).toHaveCount(3);
});
