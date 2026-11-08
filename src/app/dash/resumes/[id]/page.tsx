import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResumeOverview } from '@/features/resume/components/resume-overview';
import { ResumeSettingsForm } from '@/features/resume/components/resume-settings-form';
import { ResumeStatusForm } from '@/features/resume/components/resume-status-form';
import { ResumeUrlForm } from '@/features/resume/components/resume-url-form';
import { formatExpires, isExpired, toExpiresInput } from '@/features/resume/domain/resume';
import {
  changeResumeStatus,
  editResumeSettings,
  regenerateResumeUrl,
} from '@/features/resume/server/actions';
import { getResumeForEdit, limitedResumeUrl } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書の設定 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[]; regenerated?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // 作り手でなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const { saved, regenerated } = await searchParams;
  const now = new Date();
  const isLimited = resume.audience === 'limited';
  const common = { resumeUid: resume.uid, updatedAt: resume.updatedAt };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-8">
      <p>
        <TextLink href="/dash/resumes">職務経歴書の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">{resume.title}</h1>
      {saved === '1' && <p role="status">保存しました</p>}
      {regenerated === '1' && <p role="status">URL を出し直しました</p>}
      <p className="text-sm text-muted-foreground">
        {isLimited ? '限定公開用' : '公開用'}
        {isLimited &&
          `・期限 ${formatExpires(resume.limitedExpiresAt)}${
            isExpired(resume.limitedExpiresAt, now)
              ? '（過ぎています。訪問者には中身を返しません）'
              : ''
          }`}
      </p>
      {isLimited && (
        <ResumeUrlForm
          key={`url-${resume.updatedAt}`}
          action={regenerateResumeUrl}
          url={await limitedResumeUrl(resume.slug)}
          {...common}
        />
      )}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <ResumeStatusForm
        key={`status-${resume.updatedAt}`}
        action={changeResumeStatus}
        status={resume.status}
        {...common}
      />
      <ResumeSettingsForm
        key={`settings-${resume.updatedAt}`}
        action={editResumeSettings}
        initialValues={{ title: resume.title, expires: toExpiresInput(resume.limitedExpiresAt) }}
        slug={resume.slug}
        isLimited={isLimited}
        {...common}
      />
      <p>
        <TextLink href={`/dash/resumes/${resume.uid}/preview`}>
          訪問者に見せたときの見た目を見る
        </TextLink>
      </p>
      <ResumeOverview resume={resume} now={now} />
      <p>
        <TextLink href={`/dash/resumes/${resume.uid}/delete`}>この職務経歴書を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
