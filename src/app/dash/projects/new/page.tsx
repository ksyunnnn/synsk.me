import type { Metadata } from 'next';
import { ProjectForm } from '@/features/project/components/project-form';
import { toProjectFormValues } from '@/features/project/domain/project';
import { registerProject } from '@/features/project/server/actions';
import { listSkillOptions } from '@/features/project/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（作り手の確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を登録する | synsk.me' };

const Page = async () => {
  // 作り手でなければ、読む前に 403 になる
  const skillOptions = await listSkillOptions();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/projects">実績の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績を登録する</h1>
      <ProjectForm
        action={registerProject}
        initialValues={toProjectFormValues()}
        skillOptions={skillOptions}
      />
    </main>
  );
};

export default Page;
