import type { ProjectKind } from '@/shared/domain/project-kind';
import type { SiteStatus } from '@/shared/domain/site-status';

/**
 * 画面の経路。`src/app/` のページの経路を 1 か所で持ち、リンク・`redirect()`・`src/proxy.ts` の
 * rewrite の行き先はここから取る。静的な経路は定数、識別子を含む経路は関数にする。
 *
 * 識別子は渡された文字列のまま埋める。符号化が要る呼び手は、符号化してから渡す。
 * `src/proxy.ts` の `config.matcher` は、Next.js がビルドの時に読む静的な値なので、ここから
 * 取らない（https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher）
 */

/**
 * 保存の後に移る経路に、`from`（送った時点の一覧の検索の値）のうち `keys` に挙げた名前だけを、
 * 最初の値で足す。フォームから届く値は書き換えられうるため、知らせの印（`saved` など）や知らない
 * 名前を持ち越さない。経路は呼び手が決め、`from` からは検索の値だけを取る
 */
const appendKept = (path: string, from: string, keys: readonly string[]) => {
  const source = new URLSearchParams(from);
  const kept = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value) kept.set(key, value);
  }
  return kept.size === 0 ? path : `${path}&${kept}`;
};

/**
 * uid で開く行を持つ管理画面のコレクションの経路。`viewKeys` は一覧の見せ方を決める検索の値の
 * 名前で、保存の後も引き継ぐ
 */
const dashCollection = <const C extends string>(
  collection: C,
  viewKeys: readonly string[] = [],
) => {
  const list = `/dash/${collection}` as const;
  return {
    list,
    new: `${list}/new` as const,
    row: (uid: string) => `${list}/${uid}`,
    /**
     * その 1 件を選んだ一覧。シングルは一覧の右に出す（#366 の明文化）。`flag` は保存の知らせなど。
     * 保存の後はここへ直接移り、1 件の経路を経ない。`value` は印の値で、既定は `1`。`from` は
     * 送った時点の一覧の検索の値で、`viewKeys` に挙げた名前だけを引き継ぐ
     */
    selected: (uid: string, flag?: string, value = '1', from = '') =>
      appendKept(`${list}?selected=${uid}${flag ? `&${flag}=${value}` : ''}`, from, viewKeys),
    delete: (uid: string) => `${list}/${uid}/delete`,
    missing: (uid: string) => `${list}/${uid}/missing`,
  };
};

/**
 * 経路に印（保存の知らせなど）を足す。経路が既に検索の値を持てば、それを残して足す。`value` は
 * 印の値で、既定は `1`
 */
export const withFlag = (path: string, flag: string, value = '1') => {
  const [pathname = '', search = ''] = path.split('?');
  const query = new URLSearchParams(search);
  query.set(flag, value);
  return `${pathname}?${query}`;
};

/** 職務経歴書に写した行の種類（specs/002-resume/contracts/dash.md） */
type ResumeEntryKind = 'careers' | 'projects' | 'educations';

/** 写した行の一覧の見せ方を決める検索の値の名前。保存の後も引き継ぐ */
const RESUME_ENTRY_VIEW_KEYS: Record<ResumeEntryKind, readonly string[]> = {
  careers: ['view'],
  projects: ['orgName', 'kind', 'view'],
  educations: [],
};

const resumes = dashCollection('resumes');
const notes = dashCollection('notes');
const projects = dashCollection('projects', ['kind', 'org', 'status', 'masked', 'skill', 'view']);

export const routes = {
  home: '/',
  // 「トップへ戻る」などのリンクの行き先。新しいトップの下書きは `routes.topDraft` に置く（specs/005-feed の U1）
  top: '/',
  topDraft: '/top-draft',
  about: '/about',
  contact: '/contact',
  resumes: '/resume',
  lab: '/lab',
  labPage: (...segments: string[]) => ['/lab', ...segments].join('/'),

  project: (slug: string) => `/projects/${slug}`,
  projectMissing: (slug: string) => `/projects/${slug}/missing`,
  projectMedia: (slug: string, key: string) => `/projects/${slug}/media/${key}`,
  lifeEvent: (slug: string) => `/life-events/${slug}`,
  lifeEventMissing: (slug: string) => `/life-events/${slug}/missing`,
  lifeEventMedia: (slug: string, key: string) => `/life-events/${slug}/media/${key}`,
  resume: (slug: string) => `/resume/${slug}`,
  resumeMissing: (slug: string) => `/resume/${slug}/missing`,
  resumeMedia: (slug: string, key: string) => `/resume/${slug}/media/${key}`,
  note: (slug: string) => `/notes/${slug}`,
  noteMissing: (slug: string) => `/notes/${slug}/missing`,
  /** note の画像の経路の前半。置き場のキーを `/` でつないで使う */
  noteMedia: (slug: string) => `/notes/${slug}/media`,

  dash: {
    index: '/dash',
    forbidden: '/dash/forbidden',
    /** `src/proxy.ts` が、コレクションの名前から行が無いときの画面を作る */
    rowMissing: (collection: string, uid: string) => `/dash/${collection}/${uid}/missing`,
    careers: dashCollection('careers', ['view']),
    projects: {
      ...projects,
      /**
       * 一覧を種類・組織・サイトに載せるか・秘匿化するか・スキルで絞った経路（issue #330）。null の
       * 条件はクエリに出さない。組織とスキルは uid で指し、数字の id を出さない（ADR-0051）。
       * `selected` は選んだ 1 件、`view` は一覧の見せ方
       */
      listBy: ({
        kind,
        organizationUid,
        status = null,
        isMasked = null,
        skillUid = null,
        view = null,
        selected = null,
      }: {
        kind: ProjectKind | null;
        organizationUid: string | null;
        status?: SiteStatus | null;
        isMasked?: boolean | null;
        skillUid?: string | null;
        view?: 'timeline' | null;
        selected?: string | null;
      }) => {
        const query = new URLSearchParams();
        if (selected !== null) query.set('selected', selected);
        if (kind !== null) query.set('kind', kind);
        if (organizationUid !== null) query.set('org', organizationUid);
        if (status !== null) query.set('status', status);
        if (isMasked !== null) query.set('masked', String(isMasked));
        if (skillUid !== null) query.set('skill', skillUid);
        if (view !== null) query.set('view', view);
        return query.size === 0 ? projects.list : `${projects.list}?${query}`;
      },
      /** 一覧が描く画像を、オーナーにだけ返す経路（issue #330） */
      media: (uid: string, key: string) => `${projects.row(uid)}/media/${key}`,
    },
    educations: dashCollection('educations'),
    skills: dashCollection('skills'),
    organizations: dashCollection('organizations'),
    resumes: {
      ...resumes,
      preview: (uid: string) => `${resumes.row(uid)}/preview`,
      skills: (uid: string) => `${resumes.row(uid)}/skills`,
      /** 写した行の一覧。職務経歴書の中身を切り替えるタブの 1 つ（#366 の明文化） */
      entries: (uid: string, kind: ResumeEntryKind) => `${resumes.row(uid)}/${kind}`,
      /**
       * 写した行を 1 件選んだ一覧。写した行のシングルは一覧の右に出す（#366 の明文化）。`from` は
       * 送った時点の一覧の検索の値で、見せ方の名前だけを引き継ぐ
       */
      entrySelected: (uid: string, kind: ResumeEntryKind, rowUid: string, from = '') =>
        appendKept(
          `${resumes.row(uid)}/${kind}?selected=${rowUid}`,
          from,
          RESUME_ENTRY_VIEW_KEYS[kind],
        ),
      entryNew: (uid: string, kind: ResumeEntryKind) => `${resumes.row(uid)}/${kind}/new`,
      entry: (uid: string, kind: ResumeEntryKind, rowUid: string) =>
        `${resumes.row(uid)}/${kind}/${rowUid}`,
      entryMissing: (uid: string, kind: ResumeEntryKind, rowUid: string) =>
        `${resumes.row(uid)}/${kind}/${rowUid}/missing`,
    },
    notes: {
      ...notes,
      preview: (uid: string) => `${notes.row(uid)}/preview`,
      /** 見た目の確認の画面の画像の経路の前半。置き場のキーを `/` でつないで使う */
      previewMedia: (uid: string) => `${notes.row(uid)}/preview/media`,
      revisions: (uid: string) => `${notes.row(uid)}/revisions`,
      revision: (uid: string, revisionUid: string) => `${notes.row(uid)}/revisions/${revisionUid}`,
      revisionMissing: (uid: string, revisionUid: string) =>
        `${notes.row(uid)}/revisions/${revisionUid}/missing`,
    },
    lifeEvents: dashCollection('life-events'),
    activities: dashCollection('activities'),
  },
} as const;
