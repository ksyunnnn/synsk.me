import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SKILL_UID_FIELD } from '@/features/skill/domain/skill';
import { deleteSkill } from '@/features/skill/server/actions';
import { getSkillForEdit } from '@/features/skill/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキルを削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、スキルを読む前に 403 になる
  const skill = await getSkillForEdit((await params).id);
  if (!skill) notFound();

  return (
    <DashPage title="スキルを削除する">
      <p>次のスキルを削除します。実績とのつながりも消えます。作った職務経歴書の中身は残ります。</p>
      <p>名前: {skill.name}</p>
      <DeleteForm
        action={deleteSkill}
        uidField={SKILL_UID_FIELD}
        uid={skill.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={routes.dash.skills.row(skill.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
