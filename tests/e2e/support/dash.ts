import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from './note';

/**
 * E2E でオーナーが管理画面で行う操作と、訪問者として確かめる操作。
 *
 * 入力は `getByRole` で探す。画面を移った後も、前の画面が隠れて DOM に残ることがあり、
 * `getByLabel` は隠れた画面の同じ名前の入力も拾う（tests/e2e/career-and-education.spec.ts）。
 *
 * テストは同じ手元の D1 を並行して使う。値には呼び手がテストごとに重ならない文字列を入れる。
 * 職務経歴書を作るときは、そのテストが登録した行だけを選ぶ。ほかのテストが並行して消す行を
 * 選んだまま送ると、「開いた後に消えたもの」として作成が止まる。
 */

/** 職歴・実績で共通の入力 */
type SiteOptions = {
  /** 既定は画面の既定（秘匿化する）のまま触らない */
  isMasked?: boolean;
  /** 既定は画面の既定（サイトに載せない）のまま触らない */
  onSite?: boolean;
};

export type CareerInput = SiteOptions & {
  organizationName: string;
  organizationNameMasked?: string;
  role: string;
  startedOn?: string;
  endedOn?: string;
  description?: string;
  url?: string;
};

export type ProjectInput = SiteOptions & {
  organizationName: string;
  organizationNameMasked?: string;
  kind?: '開発' | '主催' | '登壇' | 'その他';
  title: string;
  titleMasked?: string;
  startedOn?: string;
  endedOn?: string;
  description?: string;
  url?: string;
  /** つなぐスキルの名前。スキルの画面で登録済みのもの */
  skills?: string[];
};

/** 訪問者に開かせる、職務経歴書の外の画面。実績の個別のページは別に確かめる */
const VISITOR_PAGES = ['/', '/about', '/contact', '/resume'] as const;

/** ラベルの名前と同じ名前の文字の入力 */
export const textbox = (page: Page, name: string) =>
  page.getByRole('textbox', { name, exact: true });

/**
 * 職歴・実績の組織名の入力。選択肢（`<datalist>`）を持つ文字の入力は、role が combobox になる
 * （https://www.w3.org/TR/html-aam-1.0/#el-input-textetc-autocomplete ）
 */
export const organizationInput = (page: Page) =>
  page.getByRole('combobox', { name: '組織名', exact: true });

/** 入力を省いた項目は、いまの値のまま触らない */
const fillIfGiven = async (page: Page, name: string, value: string | undefined) => {
  if (value === undefined) return;
  const input = name === '組織名' ? organizationInput(page) : textbox(page, name);
  await input.fill(value);
};

const isFocused = (target: Locator) => target.evaluate((el) => el === document.activeElement);

/**
 * Tab のキーだけで `target` にフォーカスを移す。`focus()` で直接移さないのは、キーボードで
 * たどり着けることを確かめるため。`maxTabs` 回押しても届かなければ失敗にする
 */
export const tabTo = async (page: Page, target: Locator, maxTabs = 200) => {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    if (await isFocused(target)) return;
  }
  throw new Error(`Tab を ${maxTabs} 回押しても ${target} にフォーカスが移らない`);
};

/** 日付の入力の年・月・日の欄の並び。並びはブラウザが OS の言語の設定で決め、`locale` に従わない */
const DATE_FIELD_ORDERS = [
  ['year', 'month', 'day'],
  ['month', 'day', 'year'],
  ['day', 'month', 'year'],
] as const;

/**
 * フォーカスのある日付の入力 `field` に、キーボードだけで `iso`（`YYYY-MM-DD`）を打つ。
 * 欄の並びは手元の macOS（年・月・日）と CI の Linux（月・日・年）で違うため、並びを順に試し、
 * 値が `iso` になった並びで止める。月と日は 2 桁で次の欄へ進む。年は 6 桁まで打てて進まないので、
 * 右の矢印のキーで次の欄へ移る
 */
export const typeDate = async (page: Page, field: Locator, iso: string) => {
  const [year, month, day] = iso.split('-');
  const parts = { year, month, day };
  for (const order of DATE_FIELD_ORDERS) {
    // Shift+Tab で入力の外へ出てから Tab で戻り、先頭の欄に入る
    for (let i = 0; i < 4 && (await isFocused(field)); i += 1) {
      await page.keyboard.press('Shift+Tab');
    }
    await tabTo(page, field, 1);
    for (const [i, part] of order.entries()) {
      await page.keyboard.type(parts[part]);
      if (part === 'year' && i < order.length - 1) await page.keyboard.press('ArrowRight');
    }
    if ((await field.inputValue()) === iso) return;
  }
  throw new Error(`${field} に ${iso} を打てなかった。値は ${await field.inputValue()}`);
};

/** 職歴・実績の入力の Switch。オンが「秘匿化する」「サイトに載せる」 */
export const siteSwitch = (page: Page, name: '秘匿化する' | 'サイトに載せる') =>
  page.getByRole('switch', { name, exact: true });

/** 秘匿化するか・サイトに載せるかの Switch を切り替える。省いたものは触らない */
export const chooseSiteOptions = async (page: Page, { isMasked, onSite }: SiteOptions) => {
  if (isMasked !== undefined) await siteSwitch(page, '秘匿化する').setChecked(isMasked);
  if (onSite !== undefined) await siteSwitch(page, 'サイトに載せる').setChecked(onSite);
};

/**
 * 1 件を選んだ一覧の URL から、知らせの値（saved など）を外す。編集の画面は、その 1 件を選んだ
 * 一覧（`/dash/{collection}?selected={uid}`）にある
 */
export const selectedUrl = (page: Page) => {
  const url = new URL(page.url());
  for (const flag of ['saved', 'mediaAdded', 'cardImageChanged']) url.searchParams.delete(flag);
  expect(url.searchParams.get('selected'), `${url} は 1 件を選んでいない`).toMatch(
    /^[0-9a-f]{32}$/,
  );
  return url.toString();
};

/** 職歴の登録の画面か編集の画面で、入力を埋める */
export const fillCareer = async (page: Page, input: Partial<CareerInput>) => {
  await fillIfGiven(page, '組織名', input.organizationName);
  await fillIfGiven(page, '秘匿化した組織名', input.organizationNameMasked);
  await fillIfGiven(page, '肩書', input.role);
  await fillIfGiven(page, '始まりの日', input.startedOn);
  await fillIfGiven(page, '終わりの日', input.endedOn);
  await fillIfGiven(page, '本文', input.description);
  await fillIfGiven(page, '関連 URL', input.url);
  await chooseSiteOptions(page, input);
};

/** 職歴を登録し、編集の画面に移ったことを確かめる。編集の画面の URL を返す */
export const registerCareer = async (page: Page, input: CareerInput) => {
  await page.goto('/dash/careers/new');
  await fillCareer(page, { startedOn: '2020-04-01', ...input });
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  return selectedUrl(page);
};

/**
 * 見えない入力（`sr-only`）のラジオボタンかチェックボックスを、包むラベルを押して選ぶ。種類と
 * スキルは、押す先が札の形のラベルで、入力そのものは押せる位置に無い
 */
const checkByLabel = async (
  page: Page,
  scope: Page | Locator,
  role: 'radio' | 'checkbox',
  name: string,
) => {
  const input = scope.getByRole(role, { name, exact: true });
  if (!(await input.isChecked())) {
    // `has` はラベルの中から探すので、page から作る
    const inLabel = page.getByRole(role, { name, exact: true });
    await scope.locator('label').filter({ has: inLabel }).click();
  }
  await expect(input).toBeChecked();
};

/**
 * トークンの欄（src/shared/components/token-field.tsx）で、名前を打って出た候補を選ぶ。選んだ値は
 * トークンになり、トークンには「{名前}を外す」ボタンが付く。選び済みなら触らない。欄の文字は
 * 部品の状態が持つので、hydration の前に打った文字は hydration で空に戻る。hydration を待ってから打つ
 */
const chooseToken = async (page: Page, label: string, name: string) => {
  const remove = page.getByRole('button', { name: `${name}を外す`, exact: true });
  if ((await remove.count()) > 0) return;
  const input = page.getByRole('combobox', { name: label, exact: true });
  await waitForHydration(input);
  await input.fill(name);
  await page.getByRole('option', { name, exact: true }).click();
  await expect(remove).toBeVisible();
};

/** 実績の登録の画面か編集の画面で、入力を埋める */
export const fillProject = async (page: Page, input: Partial<ProjectInput>) => {
  await fillIfGiven(page, '組織名', input.organizationName);
  await fillIfGiven(page, '秘匿化した組織名', input.organizationNameMasked);
  if (input.kind) {
    await checkByLabel(page, page.getByRole('group', { name: '種類' }), 'radio', input.kind);
  }
  await fillIfGiven(page, '題', input.title);
  await fillIfGiven(page, '秘匿化した題', input.titleMasked);
  await fillIfGiven(page, '始まりの日', input.startedOn);
  await fillIfGiven(page, '終わりの日', input.endedOn);
  await fillIfGiven(page, '本文', input.description);
  await fillIfGiven(page, '関連 URL', input.url);
  for (const skill of input.skills ?? []) {
    await chooseToken(page, '使ったスキル', skill);
  }
  await chooseSiteOptions(page, input);
};

/**
 * 実績の編集の画面から、訪問者に見せるページの経路を読む。保存した後の画面は、Server Action の
 * 応答より遅れて描き直される。`expected` に保存した後の経路を渡し、その経路になるまで待つ
 */
export const readProjectPath = async (
  page: Page,
  expected: string | RegExp = /^\/projects\/[a-z0-9-]+$/,
) => {
  const link = page.getByRole('link', { name: '訪問者に見せるページを開く' });
  await expect(link).toHaveAttribute('href', expected);
  return (await link.getAttribute('href')) as string;
};

/**
 * 実績を登録し、編集の画面に移ったことを確かめる。編集の画面の URL と、訪問者に見せる
 * ページの経路を返す
 */
export const registerProject = async (page: Page, input: ProjectInput) => {
  await page.goto('/dash/projects/new');
  // 秘匿化した題は、秘匿化しない実績でも要る
  await fillProject(page, { startedOn: '2021-04-01', titleMasked: 'E2E の秘匿化した題', ...input });
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
  return { editUrl: selectedUrl(page), path: await readProjectPath(page) };
};

/**
 * ボタンを押し、送った Server Action の応答を待つ。応答を待ってから D1 の状態を訪問者として
 * 確かめる。「保存しました」は前の保存から画面に残っていることがあり、待つ目印にならない
 */
export const submitAndWait = async (page: Page, button: string) => {
  await Promise.all([
    page.waitForResponse((res) => res.request().method() === 'POST'),
    page.getByRole('button', { name: button }).click(),
  ]);
};

/**
 * 編集の画面で保存し、保存できたことを確かめる。戻ったときには画面がまだ描き直されていない
 * ことがある。保存した値を画面から読むときは、その値になるまで待つ assertion で読む
 */
export const saveEdit = async (page: Page) => {
  await submitAndWait(page, '保存する');
  await expect(page.getByRole('status')).toHaveText('保存しました');
};

/**
 * 学歴を登録し、一覧に移ったことを確かめる。登録の知らせは、登録した学歴の検査
 * （tests/e2e/career-and-education.spec.ts）が確かめる
 */
export const registerEducation = async (page: Page, school: string) => {
  await page.goto('/dash/educations/new');
  await textbox(page, '学校').fill(school);
  await textbox(page, '始まりの日').fill('2014-04-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/dash\/educations(\?|$)/);
  await expect(page.getByRole('link', { name: school, exact: true })).toBeVisible();
};

/**
 * スキルを登録し、一覧に移ったことを確かめる。登録の知らせは、スキルの検査
 * （tests/e2e/skill.spec.ts）が確かめる
 */
export const registerSkill = async (page: Page, name: string) => {
  await page.goto('/dash/skills/new');
  await textbox(page, '名前').fill(name);
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/dash\/skills(\?|$)/);
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
};

/**
 * 職務経歴書の作成の画面で、名前が `keep` に合わない職歴・実績・学歴の選択を外す。
 * 職歴の名前は「組織名・肩書」、実績は題、学歴は学校
 */
const keepOnlySources = async (page: Page, keep: RegExp) => {
  const all = page.getByRole('checkbox');
  const kept = page.getByRole('checkbox', { name: keep });
  const count = await all.count();
  for (let i = 0; i < count; i += 1) await all.nth(i).uncheck();
  const keptCount = await kept.count();
  expect(keptCount, `${keep} に合う選択肢が無い`).toBeGreaterThan(0);
  for (let i = 0; i < keptCount; i += 1) await kept.nth(i).check();
};

export type LimitedResume = {
  /** 作成の画面に示された、限定公開用の URL（`/resume/{uid}`） */
  url: string;
  /** 設定の画面の URL */
  settingsUrl: string;
};

export type LimitedResumeInput = { title: string; keep: RegExp; expires?: string };

/**
 * 限定公開用の職務経歴書を、名前が `keep` に合う職歴・実績・学歴だけを選んで作り、作成の画面に
 * 留まる。作成の画面に示された、限定公開用の URL を返す。`expires` は期限の入力（日本時間の
 * `YYYY-MM-DDTHH:mm`）
 */
export const submitLimitedResume = async (
  page: Page,
  { title, keep, expires }: LimitedResumeInput,
) => {
  await page.goto('/dash/resumes/new');
  await textbox(page, '題').fill(title);
  if (expires !== undefined) await textbox(page, '期限').fill(expires);
  await keepOnlySources(page, keep);
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '限定公開用の職務経歴書を作りました。非公開です',
  );
  return textbox(page, '限定公開用の URL').inputValue();
};

/** `submitLimitedResume` で作り、設定の画面へ移る */
export const createLimitedResume = async (
  page: Page,
  input: LimitedResumeInput,
): Promise<LimitedResume> => {
  const { title } = input;
  const url = await submitLimitedResume(page, input);
  await page.getByRole('link', { name: '設定の画面へ' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  return { url, settingsUrl: page.url().replace(/\?.*$/, '') };
};

/**
 * 職歴・実績・学歴を 1 件も選ばずに限定公開用の職務経歴書を作り、設定の画面へ移る。設定の画面の
 * URL を返す
 */
export const createEmptyLimitedResume = async (page: Page, title: string) => {
  await page.goto('/dash/resumes/new');
  await textbox(page, '題').fill(title);
  const all = page.getByRole('checkbox');
  const count = await all.count();
  for (let i = 0; i < count; i += 1) await all.nth(i).uncheck();
  await page.getByRole('button', { name: '作る' }).click();
  await expect(page.getByRole('status')).toHaveText(
    '限定公開用の職務経歴書を作りました。非公開です',
  );
  await page.getByRole('link', { name: '設定の画面へ' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  return page.url().replace(/\?.*$/, '');
};

/** 職務経歴書の中身のタブの名前 */
type ResumeTabName = '写した実績' | '写した職歴' | '写した学歴' | 'スキル' | 'プレビュー' | '設定';

/** 職務経歴書の中身のタブ */
const resumeTab = (page: Page, name: ResumeTabName) =>
  page
    .getByRole('navigation', { name: '職務経歴書の中身' })
    .getByRole('link', { name, exact: true });

/**
 * 職務経歴書の中身のタブを開き、開いたタブになるまで待つ。前のタブの中身は、隠れて DOM に
 * 残ることがある（tests/e2e/career-and-education.spec.ts）
 */
export const openResumeTab = async (page: Page, name: ResumeTabName) => {
  await resumeTab(page, name).click();
  await expect(resumeTab(page, name)).toHaveAttribute('aria-current', 'page');
};

const RESUME_ROW_PATHS = { 職歴: 'careers', 実績: 'projects', 学歴: 'educations' } as const;

/**
 * 職務経歴書の写した行のタブから、作ったあとに職歴・実績・学歴を足す（FR-041）。`kind` は
 * タブの名前の種類、`option` は足す画面のチェックボックスの名前（職歴は「組織名・肩書」、実績は題、
 * 学歴は学校）。足した後は、その種類のタブに戻る
 */
export const addResumeRow = async (
  page: Page,
  kind: keyof typeof RESUME_ROW_PATHS,
  option: string | RegExp,
) => {
  const path = RESUME_ROW_PATHS[kind];
  await openResumeTab(page, `写した${kind}`);
  const add = page.getByRole('link', { name: '経歴から写す' });
  await expect(add).toHaveAttribute('href', new RegExp(`/${path}/new$`));
  await add.click();
  await expect(page.getByRole('heading', { name: `${kind}を足す` })).toBeVisible();
  await page.getByRole('checkbox', { name: option }).check();
  await submitAndWait(page, '足す');
  // 知らせを出した後に、知らせの印（`?saved=1`）は URL から外れる
  await expect(page).toHaveURL(new RegExp(`/dash/resumes/[0-9a-f]{32}/${path}$`));
  await expect(page.getByRole('status')).toHaveText('保存しました');
};

/**
 * 設定の画面か作成の画面で、公開と非公開を切り替える。作成の画面から移ると、
 * 作成の画面の状態の表示が隠れて DOM に残るため、見えているものだけを調べる
 */
export const setResumeVisible = async (page: Page, visible: boolean) => {
  await submitAndWait(page, visible ? '公開する' : '非公開にする');
  await expect(
    page.getByText(visible ? '公開中' : '非公開', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
};

/** 設定の画面で期限を入れて保存する。空なら期限なし */
export const setResumeExpires = async (page: Page, expires: string) => {
  await textbox(page, '期限').fill(expires);
  await saveEdit(page);
};

/**
 * オーナーの JWT を持たない訪問者のページを開く。オーナーの context とは別の context にする。
 * 呼び手が閉じる。`browser.newPage()` の context は、ページを閉じると閉じる
 */
export const openVisitor = (browser: Browser) => browser.newPage();

/** 訪問者として開き、状態コードを返す */
export const visit = async (visitor: Page, path: string) => (await visitor.goto(path))?.status();

/**
 * 訪問者が開ける職務経歴書の外の画面のどれにも、`values` が含まれないことを確かめる。
 * 調べるのは HTML の全体で、画面に出ない RSC のペイロードとメタデータを含む
 */
export const expectAbsentFromVisitorPages = async (
  visitor: Page,
  values: string[],
  extraPaths: string[] = [],
) => {
  for (const path of [...VISITOR_PAGES, ...extraPaths]) {
    await visitor.goto(path);
    const html = await visitor.content();
    for (const value of values) {
      expect(html, `${path} に「${value}」が含まれる`).not.toContain(value);
    }
  }
};
