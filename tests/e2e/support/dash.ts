import { expect, type Browser, type Page } from '@playwright/test';

/**
 * E2E で作り手が管理画面で行う操作と、訪問者として確かめる操作。
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
  kind?: 'アプリ' | '登壇' | 'イベント' | 'その他';
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
export const VISITOR_PAGES = ['/', '/about', '/contact', '/resume'] as const;

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

/** 入力を省いた項目は、いまの値のまま触らない */
const fillIfGiven = async (page: Page, name: string, value: string | undefined) => {
  if (value !== undefined) await textbox(page, name).fill(value);
};

/** 秘匿化するか・サイトに載せるかのラジオボタンを選ぶ。省いたものは触らない */
export const chooseSiteOptions = async (page: Page, { isMasked, onSite }: SiteOptions) => {
  if (isMasked !== undefined) {
    const name = isMasked ? '秘匿化する' : '秘匿化しない（実際の値で出す）';
    await page.getByRole('radio', { name, exact: true }).check();
  }
  if (onSite !== undefined) {
    const name = onSite ? 'サイトに載せる' : 'サイトに載せない';
    await page.getByRole('radio', { name, exact: true }).check();
  }
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
  return page.url().replace(/\?.*$/, '');
};

/** 実績の登録の画面か編集の画面で、入力を埋める */
export const fillProject = async (page: Page, input: Partial<ProjectInput>) => {
  await fillIfGiven(page, '組織名', input.organizationName);
  await fillIfGiven(page, '秘匿化した組織名', input.organizationNameMasked);
  if (input.kind) await page.getByRole('combobox', { name: '種類' }).selectOption(input.kind);
  await fillIfGiven(page, '題', input.title);
  await fillIfGiven(page, '秘匿化した題', input.titleMasked);
  await fillIfGiven(page, '始まりの日', input.startedOn);
  await fillIfGiven(page, '終わりの日', input.endedOn);
  await fillIfGiven(page, '本文', input.description);
  await fillIfGiven(page, '関連 URL', input.url);
  for (const skill of input.skills ?? []) {
    await page.getByRole('checkbox', { name: skill, exact: true }).check();
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
  return { editUrl: page.url().replace(/\?.*$/, ''), path: await readProjectPath(page) };
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

/** 学歴を登録する */
export const registerEducation = async (page: Page, school: string) => {
  await page.goto('/dash/educations/new');
  await textbox(page, '学校').fill(school);
  await textbox(page, '始まりの日').fill('2014-04-01');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
};

/** スキルを登録する */
export const registerSkill = async (page: Page, name: string) => {
  await page.goto('/dash/skills/new');
  await textbox(page, '名前').fill(name);
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByRole('status')).toHaveText('保存しました');
};

/**
 * 職務経歴書の作成の画面で、名前が `keep` に合わない職歴・実績・学歴の選択を外す。
 * 職歴の名前は「組織名・肩書」、実績は題、学歴は学校
 */
export const keepOnlySources = async (page: Page, keep: RegExp) => {
  const all = page.getByRole('checkbox');
  const kept = page.getByRole('checkbox', { name: keep });
  const count = await all.count();
  for (let i = 0; i < count; i += 1) await all.nth(i).uncheck();
  const keptCount = await kept.count();
  expect(keptCount, `${keep} に合う選択肢が無い`).toBeGreaterThan(0);
  for (let i = 0; i < keptCount; i += 1) await kept.nth(i).check();
};

export type LimitedResume = {
  /** 作成の画面にだけ示された、鍵を含む URL */
  url: string;
  /** 設定の画面の URL */
  settingsUrl: string;
};

export type LimitedResumeInput = { title: string; keep: RegExp; expires?: string };

/**
 * 限定公開用の職務経歴書を、名前が `keep` に合う職歴・実績・学歴だけを選んで作り、作成の画面に
 * 留まる。作成の画面にだけ示された、鍵を含む URL を返す。`expires` は期限の入力（日本時間の
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
  await expect(page.getByRole('status')).toHaveText('職務経歴書を作りました。状態は非公開です');
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
 * 作り手の JWT を持たない訪問者のページを開く。作り手の context とは別の context にする。
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
