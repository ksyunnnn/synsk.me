import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeProjectForm } from '@/features/resume/components/resume-row-forms';
import type { ResumeProject } from '@/features/resume/domain/resume';
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
  SplitView,
  ViewSwitch,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriod } from '@/shared/domain/period';
import { PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した実績 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const periodText = (row: ResumeProject) =>
  `${formatPeriod(row.period)}${row.period.endedOn === null ? '（継続中）' : ''}`;

/**
 * 職務経歴書に写した実績の Split view。一覧は実績と同じ形（表と縦の時系列）にし、シングルの形と
 * 操作も元の実績にそろえる。写しは元と切り離すので、元との差も関連付けも出さない（#366 の明文化）
 */
const Page = async ({ params, searchParams }: Props) => {
  const raw = await searchParams;
  const query = {
    org: first(raw.org),
    kind: first(raw.kind),
    view: first(raw.view),
    selected: first(raw.selected),
  };
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const base = routes.dash.resumes.entries(resume.uid, 'projects');
  const link = (changes: Record<string, string | null>) => withParam(base, query, changes);
  const organizations = [...new Set(resume.projects.map((row) => row.organizationName))].sort();
  const rows = resume.projects.filter(
    (row) =>
      (!query.org || row.organizationName === query.org) &&
      (!query.kind || row.kind === query.kind),
  );
  const view = query.view === 'timeline' ? 'timeline' : 'table';
  const selected = query.selected ?? null;
  const conditions = [query.org, query.kind && PROJECT_KIND_LABELS[query.kind as never]].filter(
    Boolean,
  );

  const collection = (
    <>
      <CollectionToolbar
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
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <FilterMenu
          label="組織"
          options={[
            { label: 'すべて', href: link({ org: null }), current: !query.org },
            ...organizations.map((name) => ({
              label: name,
              href: link({ org: name }),
              current: query.org === name,
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
            periodText: periodText(row),
            draftKey: `resume-project:${row.uid}`,
          }))}
          // 写した職歴を、組織名が同じものだけ帯にする（写しは元と切り離されているので、写しどうしで求める）
          bands={resume.careers
            .filter((career) =>
              rows.some((row) => row.organizationName === career.organizationName),
            )
            .map((career) => ({
              key: career.uid,
              label: `${career.organizationName}・${career.role}`,
              period: career.period,
            }))}
        />
      ) : (
        <CollectionTable
          rows={rows}
          rowKey={(row) => row.uid}
          rowHref={(row) => link({ selected: row.uid })}
          selectedKey={selected}
          draftKey={(row) => `resume-project:${row.uid}`}
          columns={[
            { header: '題', cell: (row) => row.title },
            { header: '組織', cell: (row) => row.organizationName, wide: true },
            {
              header: '種類',
              cell: (row) => PROJECT_KIND_LABELS[row.kind],
              nowrap: true,
              wide: true,
            },
            { header: '期間', cell: periodText, nowrap: true, muted: true },
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
      {first(raw.saved) === '1' && (
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
