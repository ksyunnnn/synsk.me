import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
import { FormSection } from '@/shared/components/form-section';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書の設定 | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[]; regenerated?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  if (!resume) notFound();
  const { saved, regenerated } = await searchParams;
  const now = new Date();
  const isLimited = resume.audience === 'limited';
  const common = { resumeUid: resume.uid, updatedAt: resume.updatedAt };

  return (
    <main className="flex flex-col gap-8 rounded-3xl bg-background px-6 py-8 md:px-12">
      <h2 className="sr-only">設定</h2>
      {saved === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      {regenerated === '1' && (
        <SavedNotice key={resume.updatedAt} flags={['regenerated']}>
          URL を出し直しました
        </SavedNotice>
      )}
      <p className="text-sm text-muted-foreground">
        {isLimited ? '限定公開用' : '公開用'}
        {isLimited &&
          `・${resume.limitedExpiresAt === null ? '' : '期限 '}${formatExpires(resume.limitedExpiresAt)}${
            isExpired(resume.limitedExpiresAt, now)
              ? '（過ぎています。訪問者には中身を返しません）'
              : ''
          }`}
      </p>
      {isLimited && (
        <FormSection>
          <ResumeUrlForm
            key={`url-${resume.updatedAt}`}
            action={regenerateResumeUrl}
            url={await limitedResumeUrl(resume.slug)}
            {...common}
          />
        </FormSection>
      )}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <FormSection>
        <ResumeStatusForm
          key={`status-${resume.updatedAt}`}
          action={changeResumeStatus}
          status={resume.status}
          {...common}
        />
      </FormSection>
      <FormSection>
        <ResumeSettingsForm
          key={`settings-${resume.updatedAt}`}
          action={editResumeSettings}
          initialValues={{ title: resume.title, expires: toExpiresInput(resume.limitedExpiresAt) }}
          slug={resume.slug}
          isLimited={isLimited}
          {...common}
        />
      </FormSection>
      <FormSection>
        <p>
          <TextLink href={routes.dash.resumes.delete(resume.uid)}>
            この職務経歴書を削除する
          </TextLink>
        </p>
      </FormSection>
    </main>
  );
};

export default Page;
