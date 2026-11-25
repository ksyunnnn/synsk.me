import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { actAsAuthor, D1_PERSIST_DIR } from './support/author';
import { registerCareer, registerProject, registerSkill, saveEdit } from './support/dash';
import { waitForHydration } from './support/note';

/**
 * 管理画面の一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が、後に選んだ 1 件の
 * URL を直接開いたときの値になること（issue #395）。
 *
 * 手元の D1 では、更新日時が同じ 2 件の組で、詳細の入力欄に前の 1 件の値が残った
 * （issue #395 の 2026-11-24 の報告）。更新日時は画面から決められないため、登録した後に
 * テスト用の D1 へ直接書く。
 *
 * テストは同じ手元の D1 を並行して使う。名前は、ほかのテストと重ならない値にする。
 */

const CONFIG = 'dist/server/wrangler.json';

/** テスト用の D1 で、表 `table` の `uids` の行の更新日時を `updatedAt` にする */
const setUpdatedAt = (
  table: 'project' | 'career' | 'organization',
  uids: string[],
  updatedAt: string,
) => {
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
      `UPDATE ${table} SET updated_at = '${updatedAt}' WHERE uid IN (${list})`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
};

const uidOf = (url: string) => new URL(url).searchParams.get('selected') as string;

/**
 * 詳細のすべての欄の値と、知らせ（role=status・role=alert）の文言。Server Action の隠し入力
 * （`$ACTION_`）は除く。画像の選択の入力は、選んだファイルの数で読む。スキルは「{名前}を外す」
 * ボタンの名前で読む
 */
const readDetail = (page: Page, region: string) =>
  page.getByRole('region', { name: region }).evaluate((element) => {
    const heading = element.querySelector('h2')?.textContent?.trim() ?? null;
    const fields = [...element.querySelectorAll('input, textarea, select')]
      .map((field) => field as HTMLInputElement)
      .filter((input) => !input.name.startsWith('$ACTION_'))
      .map((input) =>
        input.type === 'file'
          ? `${input.name}=files:${input.files?.length ?? 0}`
          : input.type === 'checkbox' || input.type === 'radio'
            ? `${input.name}=${input.value}:${input.checked}`
            : `${input.name}=${input.value}`,
      );
    const skills = [...element.querySelectorAll('button')]
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => label.endsWith('を外す'));
    const notices = [...element.querySelectorAll('[role="status"], [role="alert"]')].map(
      (notice) => `${notice.getAttribute('role')}:${notice.textContent?.trim() ?? ''}`,
    );
    return { heading, fields, skills, notices };
  });

type Detail = Awaited<ReturnType<typeof readDetail>>;

/** 1 件。`url` は、その 1 件を選んだ一覧の URL */
type Row = { uid: string; heading: string; url: string };

type List = { path: string; region: string };

const PROJECTS: List = { path: '/dash/projects', region: '選んだ実績' };
const CAREERS: List = { path: '/dash/careers', region: '選んだ職歴' };
const ORGANIZATIONS: List = { path: '/dash/organizations', region: '選んだ組織' };

/** 一覧の中の、`uid` の 1 件を選ぶリンクを押し、詳細がその 1 件になるまで待つ */
const selectInList = async (page: Page, list: List, row: Row) => {
  const detail = page.getByRole('region', { name: list.region });
  await page.getByRole('main').locator(`a[href*="selected=${row.uid}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`[?&]selected=${row.uid}(&|$)`));
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(row.heading);
  await waitForHydration(detail.locator('input:not([type="hidden"])').first());
};

/**
 * `row` の URL を直接開いたときの詳細の値。`updatedAt` を渡したら、それが画面の開いたときの
 * 更新日時に出ていることも確かめる
 */
const readOpened = async (page: Page, list: List, row: Row, updatedAt?: string) => {
  const detail = page.getByRole('region', { name: list.region });
  await page.goto(row.url);
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(row.heading);
  await waitForHydration(detail.locator('input:not([type="hidden"])').first());
  const opened = await readDetail(page, list.region);
  // D1 へ直接書いた更新日時が出ていること。組織の画面は楽観ロックの値を持たない
  if (updatedAt !== undefined && list !== ORGANIZATIONS)
    expect(opened.fields).toContain(`openedUpdatedAt=${updatedAt}`);
  return opened;
};

/** 一覧を開き、A、B の順に一覧の行を押して選ぶ。`onA` は A を選んだ後、B を選ぶ前に行う */
const reselect = async (
  page: Page,
  list: List,
  a: Row,
  b: Row,
  onA: () => Promise<void> = async () => {},
) => {
  await page.goto(list.path);
  await selectInList(page, list, a);
  await onA();
  await selectInList(page, list, b);
};

/** 1 画素の PNG。画像の選択の入力に入れる作り物 */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * 選んだ 1 件の「画像を足す」を、ファイルを選ばずに押し、画像を足せなかった知らせを出す。その後に
 * ファイルを選び、送らずに残す
 */
const leaveMediaResult = async (page: Page, list: List) => {
  const detail = page.getByRole('region', { name: list.region });
  await detail.getByRole('button', { name: '画像を足す', exact: true }).click();
  await expect(detail.getByRole('alert')).toHaveText('画像のファイルを選んでください');
  await detail
    .locator('input[type="file"][name="mediaFile"]')
    .setInputFiles({ name: 'e2e-pixel.png', mimeType: 'image/png', buffer: PIXEL_PNG });
};

/** 保存の後に変わる値（楽観ロックの更新日時）を除く */
const withoutSaveStamp = (detail: Detail) => ({
  ...detail,
  fields: detail.fields.filter((field) => !field.startsWith('openedUpdatedAt=')),
});

const registerProjectPair = async (page: Page, label: string) => {
  const id = crypto.randomUUID().slice(0, 8);
  const skillA = `E2E-Skill-選び直し-A-${id}`;
  const skillB = `E2E-Skill-選び直し-B-${id}`;
  await registerSkill(page, skillA);
  await registerSkill(page, skillB);
  const register = async (side: 'A' | 'B', skill: string, input: object): Promise<Row> => {
    const title = `E2E 選び直し ${label} ${side} ${id}`;
    const { editUrl } = await registerProject(page, {
      organizationName: `E2E 選び直しの組織 ${side} ${id}`,
      organizationNameMasked: `E2E 選び直しの秘匿化した組織 ${side} ${id}`,
      title,
      titleMasked: `E2E 選び直しの秘匿化した題 ${side} ${id}`,
      description: `E2E 選び直しの本文 ${side} ${id}`,
      url: `https://example.com/e2e-reselect-${side.toLowerCase()}-${id}`,
      skills: [skill],
      ...input,
    });
    return { uid: uidOf(editUrl), heading: title, url: editUrl };
  };
  const a = await register('A', skillA, {
    kind: '開発',
    startedOn: '2021-04-01',
    endedOn: '2022-03-31',
  });
  const b = await register('B', skillB, {
    kind: '登壇',
    startedOn: '2023-04-01',
    endedOn: '2024-03-31',
  });
  return { a, b };
};

const registerCareerPair = async (page: Page) => {
  const id = crypto.randomUUID().slice(0, 8);
  const register = async (side: 'A' | 'B', input: object): Promise<Row> => {
    const organizationName = `E2E 選び直しの職歴の組織 ${side} ${id}`;
    const role = `E2E 選び直しの肩書 ${side} ${id}`;
    const url = await registerCareer(page, {
      organizationName,
      organizationNameMasked: `E2E 選び直しの職歴の秘匿化した組織 ${side} ${id}`,
      role,
      description: `E2E 選び直しの職歴の本文 ${side} ${id}`,
      url: `https://example.com/e2e-reselect-career-${side.toLowerCase()}-${id}`,
      ...input,
    });
    return { uid: uidOf(url), heading: `${organizationName}・${role}`, url };
  };
  const a = await register('A', { startedOn: '2019-04-01', endedOn: '2020-03-31' });
  const b = await register('B', { startedOn: '2020-04-01', endedOn: '2021-03-31' });
  return { a, b };
};

const registerOrganizationPair = async (page: Page) => {
  const id = crypto.randomUUID().slice(0, 8);
  const register = async (side: 'A' | 'B'): Promise<Row> => {
    const name = `E2E 選び直しの組織だけ ${side} ${id}`;
    await registerProject(page, {
      organizationName: name,
      organizationNameMasked: `E2E 選び直しの組織だけの秘匿化した組織 ${side} ${id}`,
      title: `E2E 選び直しの組織だけの実績 ${side} ${id}`,
    });
    await page.goto(ORGANIZATIONS.path);
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(/[?&]selected=[0-9a-f]{32}(&|$)/);
    return { uid: uidOf(page.url()), heading: name, url: page.url() };
  };
  return { a: await register('A'), b: await register('B') };
};

const SAME = '2026-01-01T00:00:00.000Z';
const LATER = '2026-01-02T00:00:00.000Z';

test.describe('実績', () => {
  test('更新日時が同じ 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ実績の値になる', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerProjectPair(page, '同じ更新日時');
    setUpdatedAt('project', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, PROJECTS, b, SAME);
    await reselect(page, PROJECTS, a, b);
    await expect.poll(() => readDetail(page, PROJECTS.region)).toEqual(expected);
  });

  test('更新日時が違う 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ実績の値になる', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerProjectPair(page, '違う更新日時');
    setUpdatedAt('project', [a.uid], SAME);
    setUpdatedAt('project', [b.uid], LATER);
    const expected = await readOpened(page, PROJECTS, b, LATER);
    await reselect(page, PROJECTS, a, b);
    await expect.poll(() => readDetail(page, PROJECTS.region)).toEqual(expected);
  });

  test('更新日時が同じ 2 件で、選び直した後にそのまま保存しても、後に選んだ実績は前の実績の値にならない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerProjectPair(page, '保存');
    setUpdatedAt('project', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, PROJECTS, b, SAME);
    await reselect(page, PROJECTS, a, b);
    await saveEdit(page);
    const saved = await readOpened(page, PROJECTS, b);
    expect(withoutSaveStamp(saved)).toEqual(withoutSaveStamp(expected));
  });

  test('更新日時が同じ 2 件で、画像を足せなかった知らせと選んだファイルを残して別の 1 件を選ぶと、後に選んだ実績には残らない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerProjectPair(page, '画像');
    setUpdatedAt('project', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, PROJECTS, b, SAME);
    await reselect(page, PROJECTS, a, b, () => leaveMediaResult(page, PROJECTS));
    await expect.poll(() => readDetail(page, PROJECTS.region)).toEqual(expected);
  });
});

test.describe('職歴', () => {
  test('更新日時が同じ 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ職歴の値になる', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerCareerPair(page);
    setUpdatedAt('career', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, CAREERS, b, SAME);
    await reselect(page, CAREERS, a, b);
    await expect.poll(() => readDetail(page, CAREERS.region)).toEqual(expected);
  });

  test('更新日時が同じ 2 件で、選び直した後にそのまま保存しても、後に選んだ職歴は前の職歴の値にならない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerCareerPair(page);
    setUpdatedAt('career', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, CAREERS, b, SAME);
    await reselect(page, CAREERS, a, b);
    await saveEdit(page);
    const saved = await readOpened(page, CAREERS, b);
    expect(withoutSaveStamp(saved)).toEqual(withoutSaveStamp(expected));
  });

  test('画像を足せなかった知らせと選んだファイルを残して別の 1 件を選ぶと、後に選んだ職歴には残らない', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerCareerPair(page);
    const expected = await readOpened(page, CAREERS, b);
    await reselect(page, CAREERS, a, b, () => leaveMediaResult(page, CAREERS));
    await expect.poll(() => readDetail(page, CAREERS.region)).toEqual(expected);
  });
});

test.describe('組織', () => {
  test('更新日時が同じ 2 件で、一覧で 1 件を選んでから別の 1 件を選ぶと、詳細のすべての欄が後に選んだ組織の値になる', async ({
    page,
    context,
  }) => {
    await actAsAuthor(context);
    const { a, b } = await registerOrganizationPair(page);
    setUpdatedAt('organization', [a.uid, b.uid], SAME);
    const expected = await readOpened(page, ORGANIZATIONS, b, SAME);
    await reselect(page, ORGANIZATIONS, a, b);
    await expect.poll(() => readDetail(page, ORGANIZATIONS.region)).toEqual(expected);
  });
});
