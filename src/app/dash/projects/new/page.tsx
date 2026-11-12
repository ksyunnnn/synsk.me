import type { Metadata } from 'next';
import { ProjectForm } from '@/features/project/components/project-form';
import { toProjectFormValues } from '@/features/project/domain/project';
import { registerProject } from '@/features/project/server/actions';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { listSkillOptions } from '@/features/project/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を登録する | synsk.me' };

const Page = async () => {
  // オーナーでなければ、読む前に 403 になる
  const [skillOptions, organizationNames] = await Promise.all([
    listSkillOptions(),
    listOrganizationNames(),
  ]);

  return (
    <DashPage
      back={{ href: routes.dash.projects.list, label: '実績の一覧へ戻る' }}
      title="実績を登録する"
    >
      <ProjectForm
        action={registerProject}
        initialValues={toProjectFormValues()}
        organizationNames={organizationNames}
        skillOptions={skillOptions}
      />
    </DashPage>
  );
};

export default Page;
