import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeSkillOverridesForm } from '@/features/resume/components/resume-row-forms';
import { listResumeSkills } from '@/features/resume/domain/resume-skills';
import { editResumeSkillOverrides } from '@/features/resume/server/actions';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { toYearsAndMonths } from '@/shared/domain/period';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '経験年数の上書きを直す | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、読む前に 403 になる
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
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={`/dash/resumes/${resume.id}`}>設定の画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">経験年数の上書きを直す</h1>
      <p className="text-sm text-muted-foreground">
        空のスキルは、写した実績の期間から求めます。直した値はこの職務経歴書にだけ効きます
      </p>
      <ResumeSkillOverridesForm
        key={resume.updatedAt}
        action={editResumeSkillOverrides}
        initialRows={rows}
        target={{ resumeId: resume.id, updatedAt: resume.updatedAt }}
      />
    </main>
  );
};

export default Page;
