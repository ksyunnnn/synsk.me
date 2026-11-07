import type { Metadata } from 'next';
import { SkillForm } from '@/features/skill/components/skill-form';
import { toSkillFormValues } from '@/features/skill/domain/skill';
import { registerSkill } from '@/features/skill/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（作り手の確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'スキルを登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/skills">スキルの一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">スキルを登録する</h1>
      <SkillForm action={registerSkill} initialValues={toSkillFormValues()} />
    </main>
  );
};

export default Page;
