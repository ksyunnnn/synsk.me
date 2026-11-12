import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod } from '@/shared/domain/period';
import { SITE_STATUS_LABELS } from '@/shared/domain/site-status';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const careers = await listCareers();
  const { deleted } = await searchParams;

  return (
    <DashPage back={{ href: routes.dash.index, label: '管理画面へ戻る' }} title="職歴">
      {deleted === '1' && <SavedNotice flags={['deleted']}>職歴を削除しました</SavedNotice>}
      <p>
        <TextLink href={routes.dash.careers.new}>職歴を登録する</TextLink>
      </p>
      {careers.length === 0 ? (
        <p>登録した職歴はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {careers.map((career) => (
            <li key={career.id} className="flex flex-col">
              <TextLink href={routes.dash.careers.row(career.uid)}>
                {career.organizationName}・{career.role}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                {formatPeriod(career.period)}・{SITE_STATUS_LABELS[career.status]}・
                {career.isMasked ? '秘匿化する' : '秘匿化しない'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashPage>
  );
};

export default Page;
