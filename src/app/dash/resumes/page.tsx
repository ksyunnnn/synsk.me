import type { Metadata } from 'next';
import { formatExpires, isExpired } from '@/features/resume/domain/resume';
import { listResumes } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // 作り手でなければ、読む前に 403 になる
  const resumes = await listResumes();
  const { deleted } = await searchParams;
  const now = new Date();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">職務経歴書</h1>
      {deleted === '1' && <p role="status">職務経歴書を削除しました</p>}
      <p>
        <TextLink href="/dash/resumes/new">職務経歴書を作る</TextLink>
      </p>
      {resumes.length === 0 ? (
        <p>作った職務経歴書はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumes.map((resume) => (
            <li key={resume.id} className="flex flex-col">
              <TextLink href={`/dash/resumes/${resume.uid}`}>{resume.title}</TextLink>
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
    </main>
  );
};

export default Page;
