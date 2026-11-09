import type { Metadata } from 'next';
import { listEducations } from '@/features/education/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod } from '@/shared/domain/period';
import { DraftSavedNotice } from '@/shared/components/draft-retention';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴 | synsk.me' };

type Props = { searchParams: Promise<{ saved?: string | string[]; deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const educations = await listEducations();
  const { saved, deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">学歴</h1>
      {saved === '1' && (
        <DraftSavedNotice
          storageKeys={[
            'education:new',
            ...educations.map((education) => `education:${education.uid}`),
          ]}
        />
      )}
      {deleted === '1' && <p role="status">学歴を削除しました</p>}
      <p>学歴は、職務経歴書を通してだけ訪問者に出ます。</p>
      <p>
        <TextLink href="/dash/educations/new">学歴を登録する</TextLink>
      </p>
      {educations.length === 0 ? (
        <p>登録した学歴はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {educations.map((education) => (
            <li key={education.id} className="flex flex-col">
              <TextLink href={`/dash/educations/${education.uid}`}>
                {education.school}
                {education.department && `・${education.department}`}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                {formatPeriod(education.period)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
