import type { Metadata } from 'next';
import { SkillForm } from '@/features/skill/components/skill-form';
import { toSkillFormValues } from '@/features/skill/domain/skill';
import { registerSkill } from '@/features/skill/server/actions';
import { DashPage } from '@/shared/components/dash-page';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキルを登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <DashPage
      back={{ href: routes.dash.skills.list, label: 'スキルの一覧へ戻る' }}
      title="スキルを登録する"
    >
      <SkillForm action={registerSkill} initialValues={toSkillFormValues()} />
    </DashPage>
  );
};

export default Page;
