import type { Metadata } from 'next';
import { listSkills } from '@/features/skill/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { toYearsAndMonths } from '@/shared/domain/period';
import { DraftSavedNotice } from '@/shared/components/draft-retention';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキル | synsk.me' };

/** 経験年数を年と月で表す（FR-033。例: 5 年 11 か月） */
const formatMonths = (months: number) => {
  const { years, months: rest } = toYearsAndMonths(months);
  return `${years} 年 ${rest} か月`;
};

type Props = { searchParams: Promise<{ saved?: string | string[]; deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const skills = await listSkills();
  const { saved, deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.index}>管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">スキル</h1>
      {saved === '1' && (
        <DraftSavedNotice
          storageKeys={['skill:new', ...skills.map((skill) => `skill:${skill.uid}`)]}
        />
      )}
      {deleted === '1' && <p role="status">スキルを削除しました</p>}
      <p>
        <TextLink href={routes.dash.skills.new}>スキルを登録する</TextLink>
      </p>
      {skills.length === 0 ? (
        <p>登録したスキルはありません</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2">
                名前
              </th>
              <th scope="col" className="py-2">
                経験年数
              </th>
              <th scope="col" className="py-2">
                実績の期間から求めた値
              </th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill.id} className="border-b">
                <td className="py-2">
                  <TextLink href={routes.dash.skills.row(skill.uid)}>{skill.name}</TextLink>
                </td>
                <td className="py-2">
                  {formatMonths(skill.experienceMonths)}
                  {skill.monthsOverride !== null && (
                    <span className="text-sm text-muted-foreground">（上書き）</span>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">{formatMonths(skill.computedMonths)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default Page;
