import type { Metadata } from 'next';
import { ResumeCreateForm } from '@/features/resume/components/resume-create-form';
import { createResume } from '@/features/resume/server/actions';
import { listResumeSources } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';
import type { Period } from '@/shared/domain/period';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書を作る | synsk.me' };

const periodText = (period: Period) => `${period.startedOn} 〜 ${period.endedOn ?? ''}`;

const Page = async () => {
  // 作り手でなければ、読む前に 403 になる
  const sources = await listResumeSources();

  // フォームには選択肢の名前だけを渡す。本文や関連 URL をクライアントの部品に渡さない
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/resumes">職務経歴書の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">職務経歴書を作る</h1>
      <ResumeCreateForm
        action={createResume}
        careers={sources.careers.map((c) => ({
          id: c.id,
          label: `${c.organizationName}・${c.role}`,
          detail: periodText(c.period),
        }))}
        projects={sources.projects.map((p) => ({
          id: p.id,
          label: p.title,
          detail: `${p.organizationName}・${periodText(p.period)}`,
        }))}
        educations={sources.educations.map((e) => ({
          id: e.id,
          label: e.school,
          detail: periodText(e.period),
        }))}
      />
    </main>
  );
};

export default Page;
