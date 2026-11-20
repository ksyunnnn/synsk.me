import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeEducationForm } from '@/features/resume/components/resume-row-forms';
import { toResumeEducationFormValues } from '@/features/resume/domain/resume-forms';
import { editResumeEducation } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  DetailHeading,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { formatPeriod } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '写した学歴 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 職務経歴書に写した学歴の Split view（#366 の明文化） */
const Page = async ({ params, searchParams }: Props) => {
  const raw = await searchParams;
  const query = { selected: first(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const base = routes.dash.resumes.entries(resume.uid, 'educations');
  const link = (changes: Record<string, string | null>) => withParam(base, query, changes);
  const rows = resume.educations;
  const selected = query.selected ?? null;

  const collection = (
    <>
      <CollectionToolbar
        title="写した学歴"
        summary={`${rows.length} 件`}
        action={{ href: routes.dash.resumes.entryNew(resume.uid, 'educations'), label: '経歴から写す' }}
      />
      {rows.length === 0 ? (
        <CollectionEmpty>写した学歴はありません</CollectionEmpty>
      ) : (
        <CollectionTable
          rows={rows}
          rowKey={(row) => row.uid}
          rowHref={(row) => link({ selected: row.uid })}
          selectedKey={selected}
          draftKey={(row) => `resume-education:${row.uid}`}
          columns={[
            { header: '学校', cell: (row) => row.school },
            { header: '学部', cell: (row) => row.department ?? '' },
            { header: '期間', cell: (row) => formatPeriod(row.period), nowrap: true, muted: true },
          ]}
        />
      )}
    </>
  );

  const row = selected === null ? undefined : rows.find((e) => e.uid === selected);
  const detail = row ? (
    <div className="flex flex-col gap-6">
      <DetailHeading
        title={`${row.school}${row.department ? `・${row.department}` : ''}`}
        draftKey={`resume-education:${row.uid}`}
      />
      {first(raw.saved) === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      <ResumeEducationForm
        key={`${row.uid}-${resume.updatedAt}`}
        action={editResumeEducation}
        initialValues={toResumeEducationFormValues(row)}
        target={{ resumeUid: resume.uid, rowUid: row.uid, updatedAt: resume.updatedAt }}
      />
    </div>
  ) : (
    <p className="py-12 text-center text-muted-foreground">この学歴はありません</p>
  );

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ写した学歴"
      detail={detail}
    />
  );
};

export default Page;
