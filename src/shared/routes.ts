import type { ProjectKind } from '@/shared/domain/project-kind';

/**
 * 画面の経路。`src/app/` のページの経路を 1 か所で持ち、リンク・`redirect()`・`src/proxy.ts` の
 * rewrite の行き先はここから取る。静的な経路は定数、識別子を含む経路は関数にする。
 *
 * 識別子は渡された文字列のまま埋める。符号化が要る呼び手は、符号化してから渡す。
 * `src/proxy.ts` の `config.matcher` は、Next.js がビルドの時に読む静的な値なので、ここから
 * 取らない（https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher）
 */

/** uid で開く行を持つ管理画面のコレクションの経路 */
const dashCollection = <const C extends string>(collection: C) => {
  const list = `/dash/${collection}` as const;
  return {
    list,
    new: `${list}/new` as const,
    row: (uid: string) => `${list}/${uid}`,
    delete: (uid: string) => `${list}/${uid}/delete`,
    missing: (uid: string) => `${list}/${uid}/missing`,
  };
};

/** 職務経歴書に写した行の種類（specs/002-resume/contracts/dash.md） */
type ResumeEntryKind = 'careers' | 'projects' | 'educations';

const resumes = dashCollection('resumes');
const notes = dashCollection('notes');
const projects = dashCollection('projects');

export const routes = {
  home: '/',
  // 新しいトップが `/` を置き換えたら `/` に移す（specs/005-feed の U1）
  top: '/top-draft',
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
  note: (slug: string) => `/notes/${slug}`,
  noteMissing: (slug: string) => `/notes/${slug}/missing`,
  /** note の画像の経路の前半。置き場のキーを `/` でつないで使う */
  noteMedia: (slug: string) => `/notes/${slug}/media`,

  dash: {
    index: '/dash',
    forbidden: '/dash/forbidden',
    /** `src/proxy.ts` が、コレクションの名前から行が無いときの画面を作る */
    rowMissing: (collection: string, uid: string) => `/dash/${collection}/${uid}/missing`,
    careers: dashCollection('careers'),
    projects: {
      ...projects,
      /** 一覧を種類で絞った経路。null ならすべての種類 */
      listByKind: (kind: ProjectKind | null) =>
        kind === null ? projects.list : `${projects.list}?kind=${kind}`,
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
