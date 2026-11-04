import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SKILL_ID_FIELD } from '@/features/skill/domain/skill';
import { deleteSkill } from '@/features/skill/server/actions';
import { getSkillForEdit } from '@/features/skill/server/queries';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（作り手の確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキルを削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // 作り手でなければ、スキルを読む前に 403 になる
  const skill = await getSkillForEdit((await params).id);
  if (!skill) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">スキルを削除する</h1>
      <p>次のスキルを削除します。実績とのつながりも消えます。作った職務経歴書の中身は残ります。</p>
      <p>名前: {skill.name}</p>
      <DeleteForm
        action={deleteSkill}
        idField={SKILL_ID_FIELD}
        id={skill.id}
        messages={{
          forbidden: '作り手であることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={`/dash/skills/${skill.id}`}>編集の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
