import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeSkillOverridesForm } from '@/features/resume/components/resume-row-forms';
import { listResumeSkills } from '@/features/resume/domain/resume-skills';
import { editResumeSkillOverrides } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { toYearsAndMonths } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '経験年数の上書きを直す | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const overrides = new Map(resume.skillOverrides.map((o) => [o.skillName, o.months]));
  // 写したスキルの名前ごとに 1 行。上書きの無いスキルは空で始まる
  const rows = listResumeSkills(resume.projects, [], new Date()).map(({ name }) => {
    const months = overrides.get(name);
    if (months === undefined) return { name, years: '', months: '' };
    const split = toYearsAndMonths(months);
    return { name, years: String(split.years), months: String(split.months) };
  });

  return (
    <DashPage
      back={{ href: routes.dash.resumes.row(resume.uid), label: '設定の画面へ戻る' }}
      title="経験年数の上書きを直す"
    >
      <p className="text-sm text-muted-foreground">
        空のスキルは、写した実績の期間から求めます。直した値はこの職務経歴書にだけ効きます
      </p>
      <ResumeSkillOverridesForm
        key={resume.updatedAt}
        action={editResumeSkillOverrides}
        initialRows={rows}
        target={{ resumeUid: resume.uid, updatedAt: resume.updatedAt }}
      />
    </DashPage>
  );
};

export default Page;
