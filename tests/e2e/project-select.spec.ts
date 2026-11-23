import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor, D1_PERSIST_DIR } from './support/author';
import { registerProject, registerSkill } from './support/dash';
import { waitForHydration } from './support/note';

/**
 * 実績の一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が、後に選んだ実績の
 * URL を直接開いたときの値になること（issue #395）。
 *
 * 手元の D1 では、更新日時が同じ 2 件の組で、詳細の入力欄に前の実績の値が残った
 * （issue #395 の 2026-11-24 の報告）。更新日時は画面から決められないため、登録した後に
 * テスト用の D1 へ直接書く。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const CONFIG = 'dist/server/wrangler.json';

/** テスト用の D1 で、`uids` の実績の更新日時を `updatedAt` にする */
const setProjectUpdatedAt = (uids: string[], updatedAt: string) => {
  const list = uids.map((uid) => `'${uid}'`).join(', ');
  // `--local` を明示する。本番の D1 に当てない
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'synsk-me',
      '--local',
      '--config',
      CONFIG,
      '--persist-to',
      D1_PERSIST_DIR,
      '--command',
      `UPDATE project SET updated_at = '${updatedAt}' WHERE uid IN (${list})`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
};

const uidOf = (editUrl: string) => new URL(editUrl).searchParams.get('selected') as string;

/**
 * 詳細のすべての欄の値。Server Action の隠し入力（`$ACTION_`）と画像の選択の入力は除く。
 * スキルは「{名前}を外す」ボタンの名前で読む
 */
const readDetail = (page: Page) =>
  page.getByRole('region', { name: '選んだ実績' }).evaluate((region) => {
    const heading = region.querySelector('h2')?.textContent?.trim() ?? null;
    const fields = [...region.querySelectorAll('input, textarea, select')]
      .map((element) => element as HTMLInputElement)
      .filter((input) => !input.name.startsWith('$ACTION_') && input.type !== 'file')
      .map((input) =>
        input.type === 'checkbox' || input.type === 'radio'
          ? `${input.name}=${input.value}:${input.checked}`
          : `${input.name}=${input.value}`,
      );
    const skills = [...region.querySelectorAll('button')]
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => label.endsWith('を外す'));
    return { heading, fields, skills };
  });

const registerPair = async (page: Page, label: string) => {
  const id = crypto.randomUUID().slice(0, 8);
  const skillA = `E2E-Skill-選び直し-A-${id}`;
  const skillB = `E2E-Skill-選び直し-B-${id}`;
  await registerSkill(page, skillA);
  await registerSkill(page, skillB);
  const a = {
    title: `E2E 選び直し ${label} A ${id}`,
    ...(await registerProject(page, {
      organizationName: `E2E 選び直しの組織 A ${id}`,
      organizationNameMasked: `E2E 選び直しの秘匿化した組織 A ${id}`,
      kind: '開発',
      title: `E2E 選び直し ${label} A ${id}`,
      titleMasked: `E2E 選び直しの秘匿化した題 A ${id}`,
      startedOn: '2021-04-01',
      endedOn: '2022-03-31',
      description: `E2E 選び直しの本文 A ${id}`,
      url: `https://example.com/e2e-reselect-a-${id}`,
      skills: [skillA],
    })),
  };
  const b = {
    title: `E2E 選び直し ${label} B ${id}`,
    ...(await registerProject(page, {
      organizationName: `E2E 選び直しの組織 B ${id}`,
      organizationNameMasked: `E2E 選び直しの秘匿化した組織 B ${id}`,
      kind: '登壇',
      title: `E2E 選び直し ${label} B ${id}`,
      titleMasked: `E2E 選び直しの秘匿化した題 B ${id}`,
      startedOn: '2023-04-01',
      endedOn: '2024-03-31',
      description: `E2E 選び直しの本文 B ${id}`,
      url: `https://example.com/e2e-reselect-b-${id}`,
      skills: [skillB],
    })),
  };
  return { a, b };
};

/**
 * B の URL を直接開いたときの詳細の値を基準に読む。次に一覧を開き、A、B の順に一覧の行を
 * 押して選び、詳細の値が基準と同じになることを確かめる
 */
const expectReselectShowsB = async (
  page: Page,
  a: { title: string; editUrl: string },
  b: { title: string; editUrl: string; updatedAt: string },
) => {
  const detail = page.getByRole('region', { name: '選んだ実績' });
  const heading = detail.getByRole('heading', { level: 2 });

  await page.goto(b.editUrl);
  await expect(heading).toHaveText(b.title);
  await waitForHydration(detail.getByRole('textbox', { name: '題', exact: true }));
  const expected = await readDetail(page);
  // D1 へ直接書いた更新日時が、画面の開いたときの更新日時に出ていること
  expect(expected.fields).toContain(`openedUpdatedAt=${b.updatedAt}`);

  await page.goto('/dash/projects');
  await page.getByRole('link', { name: a.title, exact: true }).click();
  await expect(heading).toHaveText(a.title);
  await waitForHydration(detail.getByRole('textbox', { name: '題', exact: true }));
  await page.getByRole('link', { name: b.title, exact: true }).click();
  await expect(heading).toHaveText(b.title);
  await expect.poll(() => readDetail(page)).toEqual(expected);
};

test('更新日時が同じ 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ実績の値になる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const { a, b } = await registerPair(page, '同じ更新日時');
  const updatedAt = '2026-01-01T00:00:00.000Z';
  setProjectUpdatedAt([uidOf(a.editUrl), uidOf(b.editUrl)], updatedAt);
  await expectReselectShowsB(page, a, { ...b, updatedAt });
});

test('更新日時が違う 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ実績の値になる', async ({
  page,
  context,
}) => {
  await actAsAuthor(context);
  const { a, b } = await registerPair(page, '違う更新日時');
  setProjectUpdatedAt([uidOf(a.editUrl)], '2026-01-01T00:00:00.000Z');
  const updatedAt = '2026-01-02T00:00:00.000Z';
  setProjectUpdatedAt([uidOf(b.editUrl)], updatedAt);
  await expectReselectShowsB(page, a, { ...b, updatedAt });
});
