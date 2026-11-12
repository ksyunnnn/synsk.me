import type { Metadata } from 'next';
import { listEducations } from '@/features/education/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

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
    <DashPage back={{ href: routes.dash.index, label: '管理画面へ戻る' }} title="学歴">
      {saved === '1' && <SavedNotice flags={['saved']}>保存しました</SavedNotice>}
      {deleted === '1' && <SavedNotice flags={['deleted']}>学歴を削除しました</SavedNotice>}
      <p>学歴は、職務経歴書を通してだけ訪問者に出ます。</p>
      <p>
        <TextLink href={routes.dash.educations.new}>学歴を登録する</TextLink>
      </p>
      {educations.length === 0 ? (
        <p>登録した学歴はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {educations.map((education) => (
            <li key={education.id} className="flex flex-col">
              <TextLink href={routes.dash.educations.row(education.uid)}>
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
    </DashPage>
  );
};

export default Page;
