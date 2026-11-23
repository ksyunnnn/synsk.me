import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeProjectForm } from '@/features/resume/components/resume-row-forms';
import { toResumeProjectFormValues } from '@/features/resume/domain/resume-forms';
import { editResumeProject } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { FilterMenu } from '@/shared/components/filter-menu';
import { PeriodTimeline } from '@/shared/components/period-timeline';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  DetailHeading,
  PeriodLines,
  SplitView,
  ViewSwitch,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriodWithOngoing } from '@/shared/domain/period';
import { isProjectKind, PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { firstParam } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した実績 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 職務経歴書に写した実績の Split view。一覧は実績と同じ形（表と縦の時系列）にし、シングルの形と
 * 操作も元の実績にそろえる。写しは元と切り離すので、元との差も関連付けも出さない（#366 の明文化）
 */
const Page = async ({ params, searchParams }: Props) => {
  const raw = await searchParams;
  const kind = firstParam(raw.kind);
  const query = {
    orgName: firstParam(raw.orgName),
    // 種類でない値では絞らない（実績の一覧の parseProjectListFilter と同じ）
    kind: kind !== undefined && isProjectKind(kind) ? kind : undefined,
    view: firstParam(raw.view),
    selected: firstParam(raw.selected),
  };
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const base = routes.dash.resumes.entries(resume.uid, 'projects');
  const link = (changes: Record<string, string | null>) => withParam(base, query, changes);
  const organizations = [...new Set(resume.projects.map((row) => row.organizationName))].sort();
  const rows = resume.projects.filter(
    (row) =>
      (!query.orgName || row.organizationName === query.orgName) &&
      (!query.kind || row.kind === query.kind),
  );
  const view = query.view === 'timeline' ? 'timeline' : 'table';
  const selected = query.selected ?? null;
  const conditions = [query.orgName, query.kind && PROJECT_KIND_LABELS[query.kind]].filter(Boolean);

  const collection = (
    <>
      <CollectionToolbar
        headingLevel={2}
        titleHidden
        title="写した実績"
        summary={[`${rows.length} 件`, ...conditions].join('・')}
        action={{
          href: routes.dash.resumes.entryNew(resume.uid, 'projects'),
          label: '経歴から写す',
        }}
      >
        <ViewSwitch
          options={[
            { label: '表', href: link({ view: null }), current: view === 'table' },
            { label: '時系列', href: link({ view: 'timeline' }), current: view === 'timeline' },
          ]}
        />
      </CollectionToolbar>
      {/* 足した後は、何も選ばない一覧へ戻る。知らせは一覧の側に出す */}
      {selected === null && firstParam(raw.saved) === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['saved']} className="px-5 pb-2">
          保存しました
        </SavedNotice>
      )}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <FilterMenu
          label="組織"
          options={[
            { label: 'すべて', href: link({ orgName: null }), current: !query.orgName },
            ...organizations.map((name) => ({
              label: name,
              href: link({ orgName: name }),
              current: query.orgName === name,
            })),
          ]}
        />
        <FilterMenu
          label="種類"
          options={[
            { label: 'すべて', href: link({ kind: null }), current: !query.kind },
            ...PROJECT_KINDS.map((kind) => ({
              label: PROJECT_KIND_LABELS[kind],
              href: link({ kind }),
              current: query.kind === kind,
            })),
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <CollectionEmpty>
          {conditions.length > 0 ? '条件に合う実績はありません' : '写した実績はありません'}
        </CollectionEmpty>
      ) : view === 'timeline' ? (
        <PeriodTimeline
          today={new Date().toISOString().slice(0, 10)}
          selectedKey={selected}
          items={rows.map((row) => ({
            key: row.uid,
            href: link({ selected: row.uid }),
            title: row.title,
            meta: `${row.organizationName}・${PROJECT_KIND_LABELS[row.kind]}`,
            period: row.period,
            periodText: formatPeriodWithOngoing(row.period),
            draftKey: `resume-project:${row.uid}`,
          }))}
        />
      ) : (
        <CollectionTable
          rows={rows}
          rowKey={(row) => row.uid}
          rowHref={(row) => link({ selected: row.uid })}
          selectedKey={selected}
          draftKey={(row) => `resume-project:${row.uid}`}
          subtitle={(row) => (
            <>
              {row.organizationName}・{PROJECT_KIND_LABELS[row.kind]}
              <span className="md:hidden">・{formatPeriodWithOngoing(row.period)}</span>
            </>
          )}
          columns={[
            { header: '題', cell: (row) => row.title },
            {
              header: '期間',
              cell: (row) => <PeriodLines period={row.period} />,
              nowrap: true,
              muted: true,
              wide: true,
            },
          ]}
        />
      )}
    </>
  );

  const row = selected === null ? undefined : resume.projects.find((p) => p.uid === selected);
  const detail = row ? (
    <div className="flex flex-col gap-6">
      <DetailHeading title={row.title} draftKey={`resume-project:${row.uid}`}>
        <DetailFacts
          facts={[
            {
              label: '効く範囲',
              value: `この職務経歴書（${resume.title}）だけ。元の実績は変わりません`,
            },
          ]}
        />
      </DetailHeading>
      {firstParam(raw.saved) === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <ResumeProjectForm
        key={`${row.uid}-${resume.updatedAt}`}
        action={editResumeProject}
        initialValues={toResumeProjectFormValues(row)}
        target={{ resumeUid: resume.uid, rowUid: row.uid, updatedAt: resume.updatedAt }}
      />
    </div>
  ) : (
    <p className="py-12 text-center text-muted-foreground">この実績はありません</p>
  );

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ写した実績"
      detail={detail}
    />
  );
};

export default Page;
