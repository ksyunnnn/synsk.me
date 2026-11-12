import type { Metadata } from 'next';
import { formatExpires, isExpired } from '@/features/resume/domain/resume';
import { listResumes } from '@/features/resume/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resumes = await listResumes();
  const { deleted } = await searchParams;
  const now = new Date();

  return (
    <DashPage back={{ href: routes.dash.index, label: '管理画面へ戻る' }} title="職務経歴書">
      {deleted === '1' && <SavedNotice flags={['deleted']}>職務経歴書を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.resumes.new}>職務経歴書を作る</TextLink>
      </p>
      {resumes.length === 0 ? (
        <p>作った職務経歴書はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumes.map((resume) => (
            <li key={resume.id} className="flex flex-col">
              <TextLink href={routes.dash.resumes.row(resume.uid)}>{resume.title}</TextLink>
              <span className="text-sm text-muted-foreground">
                {resume.audience === 'limited' ? '限定公開用' : '公開用'}・
                {resume.status === 'draft' ? '非公開' : '公開中'}
                {resume.audience === 'limited' &&
                  `・期限 ${formatExpires(resume.limitedExpiresAt)}${
                    isExpired(resume.limitedExpiresAt, now) ? '（過ぎています）' : ''
                  }`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashPage>
  );
};

export default Page;
