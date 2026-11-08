import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SkillForm } from '@/features/skill/components/skill-form';
import { toSkillFormValues } from '@/features/skill/domain/skill';
import { editSkill } from '@/features/skill/server/actions';
import { getSkillForEdit } from '@/features/skill/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキルを編集する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、スキルを読む前に 403 になる
  const skill = await getSkillForEdit((await params).id);
  if (!skill) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/skills">スキルの一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">スキルを編集する</h1>
      <SkillForm action={editSkill} initialValues={toSkillFormValues(skill)} skillUid={skill.uid} />
      <p>
        <TextLink href={`/dash/skills/${skill.uid}/delete`}>このスキルを削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
