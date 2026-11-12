import type { Metadata } from 'next';
import { toProjectCardPreview, type ProjectSummary } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { LinkPendingHint } from '@/shared/components/link-pending-hint';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod } from '@/shared/domain/period';
import { SITE_STATUS_LABELS } from '@/shared/domain/site-status';
import {
  PROJECT_KINDS,
  PROJECT_KIND_LABELS,
  isProjectKind,
  type ProjectKind,
} from '@/shared/domain/project-kind';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績 | synsk.me' };

type Props = {
  searchParams: Promise<{ deleted?: string | string[]; kind?: string | string[] }>;
};

/** `?kind=` の値。種類の値でなければ、すべての種類 */
const parseKind = (value: string | string[] | undefined): ProjectKind | null =>
  typeof value === 'string' && isProjectKind(value) ? value : null;

const FILTERS: { kind: ProjectKind | null; label: string }[] = [
  { kind: null, label: 'すべて' },
  ...PROJECT_KINDS.map((kind) => ({ kind, label: PROJECT_KIND_LABELS[kind] })),
];

/**
 * 種類で絞り込むリンク。選んでいるリンクは `aria-current` を持ち、下線を外して下に線を引く。
 * 太さは変えない。幅が変わり、隣のリンクの位置がずれるため（design/guidelines.md の Loading）。
 * 押してから移動が終わるまで、リンクの中の点が合図を出す
 */
const KindFilter = ({ current }: { current: ProjectKind | null }) => (
  <nav aria-label="種類で絞り込む">
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {FILTERS.map(({ kind, label }) => (
        <li key={kind ?? 'all'}>
          <TextLink
            href={routes.dash.projects.listByKind(kind)}
            aria-current={kind === current ? 'page' : undefined}
            className="inline-flex items-center gap-2 border-b-2 border-transparent pb-1 aria-[current=page]:border-foreground aria-[current=page]:no-underline"
          >
            {label}
            <LinkPendingHint />
          </TextLink>
        </li>
      ))}
    </ul>
  </nav>
);

const ProjectCard = ({ project }: { project: ProjectSummary }) => {
  const { excerpt, imageKey } = toProjectCardPreview(project);
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      {/* 画像の枠の高さを先に決め、読み込みの後に要素の位置をずらさない（design/guidelines.md の
          Loading）。画像は飾りとして出し、中身の説明は題と本文が持つ */}
      <div className="aspect-video bg-muted">
        {imageKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={routes.dash.projects.media(project.uid, imageKey)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-muted-foreground">
          {PROJECT_KIND_LABELS[project.kind]}・{formatPeriod(project.period)}
        </p>
        <h2 className="font-bold">
          <TextLink href={routes.dash.projects.row(project.uid)}>{project.title}</TextLink>
        </h2>
        <p className="text-sm text-muted-foreground">{project.organizationName}</p>
        {excerpt && <p className="line-clamp-3 text-sm">{excerpt}</p>}
        <p className="text-sm text-muted-foreground">
          {SITE_STATUS_LABELS[project.status]}・{project.isMasked ? '秘匿化する' : '秘匿化しない'}
        </p>
      </div>
    </li>
  );
};

const Page = async ({ searchParams }: Props) => {
  const { deleted, kind: kindParam } = await searchParams;
  const kind = parseKind(kindParam);
  // オーナーでなければ、読む前に 403 になる
  const projects = await listProjects(kind);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.index}>管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績</h1>
      {deleted === '1' && <SavedNotice flags={['deleted']}>実績を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.projects.new}>実績を登録する</TextLink>
      </p>
      <KindFilter current={kind} />
      {/* 絞り込みを変えたとき、読み上げにも件数の変化を伝える */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {projects.length} 件
      </p>
      {projects.length === 0 ? (
        <p>{kind === null ? '登録した実績はありません' : 'この種類の実績はありません'}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
