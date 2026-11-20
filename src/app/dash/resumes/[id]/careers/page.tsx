import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeCareerForm } from '@/features/resume/components/resume-row-forms';
import type { ResumeCareer } from '@/features/resume/domain/resume';
import { toResumeCareerFormValues } from '@/features/resume/domain/resume-forms';
import { editResumeCareer } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
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
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した職歴 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const periodText = (row: ResumeCareer) =>
  `${formatPeriod(row.period)}${row.period.endedOn === null ? '（継続中）' : ''}`;

/** 職務経歴書に写した職歴の Split view。一覧は実績と同じ形にする（#366 の決定） */
const Page = async ({ params, searchParams }: Props) => {
  const raw = await searchParams;
  const query = { view: first(raw.view), selected: first(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const base = routes.dash.resumes.entries(resume.uid, 'careers');
  const link = (changes: Record<string, string | null>) => withParam(base, query, changes);
  const rows = resume.careers;
  const view = query.view === 'timeline' ? 'timeline' : 'table';
  const selected = query.selected ?? null;

  const collection = (
    <>
      <CollectionToolbar
        title="写した職歴"
        summary={`${rows.length} 件`}
        action={{
          href: routes.dash.resumes.entryNew(resume.uid, 'careers'),
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
      {rows.length === 0 ? (
        <CollectionEmpty>写した職歴はありません</CollectionEmpty>
      ) : view === 'timeline' ? (
        <PeriodTimeline
          today={new Date().toISOString().slice(0, 10)}
          selectedKey={selected}
          items={rows.map((row) => ({
            key: row.uid,
            href: link({ selected: row.uid }),
            title: `${row.organizationName}・${row.role}`,
            meta: row.isMasked ? '秘匿化' : '実際の値',
            period: row.period,
            periodText: periodText(row),
            draftKey: `resume-career:${row.uid}`,
          }))}
        />
      ) : (
        <CollectionTable
          rows={rows}
          rowKey={(row) => row.uid}
          rowHref={(row) => link({ selected: row.uid })}
          selectedKey={selected}
          draftKey={(row) => `resume-career:${row.uid}`}
          columns={[
            { header: '組織', cell: (row) => row.organizationName },
            { header: '肩書', cell: (row) => row.role },
            { header: '期間', cell: periodText, nowrap: true, muted: true },
          ]}
        />
      )}
    </>
  );

  const row = selected === null ? undefined : rows.find((c) => c.uid === selected);
  const detail = row ? (
    <div className="flex flex-col gap-6">
      <DetailHeading
        title={`${row.organizationName}・${row.role}`}
        draftKey={`resume-career:${row.uid}`}
      >
        <DetailFacts
          facts={[
            {
              label: '効く範囲',
              value: `この職務経歴書（${resume.title}）だけ。元の職歴は変わりません`,
            },
          ]}
        />
      </DetailHeading>
      {first(raw.saved) === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <ResumeCareerForm
        key={`${row.uid}-${resume.updatedAt}`}
        action={editResumeCareer}
        initialValues={toResumeCareerFormValues(row)}
        target={{ resumeUid: resume.uid, rowUid: row.uid, updatedAt: resume.updatedAt }}
      />
    </div>
  ) : (
    <p className="py-12 text-center text-muted-foreground">この職歴はありません</p>
  );

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ写した職歴"
      detail={detail}
    />
  );
};

export default Page;
