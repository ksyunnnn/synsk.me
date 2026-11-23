import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { NO_PROJECT_FILTER } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { listResumes } from '@/features/resume/server/queries';
import { DashGroup, DashTile } from '@/shared/components/dash-entry';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '管理画面 | synsk.me' };

/**
 * 管理画面の入口。オブジェクトを 3 つのまとまり（職務経歴書・経歴・サイトの発信）に分ける。
 * 更新の多い職務経歴書を先頭に置き、写した実績の中身へ 1 回で入れる（#366 の明文化の「入口」）
 */
const Page = async () => {
  // `src/proxy.ts` も確かめるが、ページは proxy に頼らずに確かめる（ADR-0036）
  await requireAuthor();
  const [resumes, { projects }, careers] = await Promise.all([
    listResumes(),
    listProjects(NO_PROJECT_FILTER),
    listCareers(),
  ]);
  const ongoing = projects.filter((project) => project.period.endedOn === null).length;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">管理画面</h1>
      <DashGroup title="職務経歴書">
        {resumes.map((resume) => (
          <DashTile
            key={resume.uid}
            href={routes.dash.resumes.entries(resume.uid, 'projects')}
            label={resume.title}
            note={`写した実績 ${resume.projectCount} 件・写した職歴 ${resume.careerCount} 件`}
          />
        ))}
        <DashTile href={routes.dash.resumes.new} label="職務経歴書を作る" />
      </DashGroup>
      <DashGroup title="経歴">
        <DashTile
          href={routes.dash.projects.list}
          label="実績"
          note={`${projects.length} 件・継続中 ${ongoing} 件`}
        />
        <DashTile href={routes.dash.careers.list} label="職歴" note={`${careers.length} 件`} />
        <DashTile href={routes.dash.organizations.list} label="組織" />
        <DashTile href={routes.dash.educations.list} label="学歴" />
        <DashTile href={routes.dash.skills.list} label="スキル" />
      </DashGroup>
      <DashGroup title="サイトの発信">
        <DashTile href={routes.dash.notes.list} label="note" />
        <DashTile href={routes.dash.lifeEvents.list} label="life event" />
        <DashTile href={routes.dash.activities.list} label="外部の activity" />
      </DashGroup>
    </main>
  );
};

export default Page;
