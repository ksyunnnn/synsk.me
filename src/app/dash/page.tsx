import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { listCareers } from '@/features/career/server/queries';
import { listProjects } from '@/features/project/server/queries';
import { getResumeForEdit, listResumes } from '@/features/resume/server/queries';
import { requireAuthor } from '@/shared/server/author';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '管理画面 | synsk.me' };

const NO_FILTER = { kind: null, organizationUid: null, status: null, isMasked: null };

const Tile = ({ href, label, note }: { href: string; label: string; note?: string }) => (
  <li>
    <Link
      href={href}
      className="flex h-full flex-col gap-1 rounded-2xl bg-muted/60 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <span className="font-medium">{label}</span>
      {note && <span className="text-small text-muted-foreground">{note}</span>}
    </Link>
  </li>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-3xl bg-background p-6">
    <h2 className="text-caption font-medium text-muted-foreground">{title}</h2>
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
  </section>
);

/**
 * 管理画面の入口。オブジェクトを 3 つのまとまり（職務経歴書・経歴・サイトの発信）に分ける。
 * 更新の多い職務経歴書を先頭に置き、写した実績の中身へ 1 回で入れる（#366 の明文化の「入口」）
 */
const Page = async () => {
  // `src/proxy.ts` も確かめるが、ページは proxy に頼らずに確かめる（ADR-0036）
  await requireAuthor();
  const [resumes, { projects }, careers] = await Promise.all([
    listResumes(),
    listProjects(NO_FILTER),
    listCareers(),
  ]);
  const contents = await Promise.all(resumes.map((resume) => getResumeForEdit(resume.uid)));
  const ongoing = projects.filter((project) => project.period.endedOn === null).length;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">管理画面</h1>
      <Group title="職務経歴書">
        {resumes.map((resume, index) => (
          <Tile
            key={resume.uid}
            href={routes.dash.resumes.entries(resume.uid, 'projects')}
            label={resume.title}
            note={`写した実績 ${contents[index]?.projects.length ?? 0} 件・写した職歴 ${contents[index]?.careers.length ?? 0} 件`}
          />
        ))}
        <Tile href={routes.dash.resumes.new} label="職務経歴書を作る" />
      </Group>
      <Group title="経歴">
        <Tile
          href={routes.dash.projects.list}
          label="実績"
          note={`${projects.length} 件・継続中 ${ongoing} 件`}
        />
        <Tile href={routes.dash.careers.list} label="職歴" note={`${careers.length} 件`} />
        <Tile href={routes.dash.organizations.list} label="組織" />
        <Tile href={routes.dash.educations.list} label="学歴" />
        <Tile href={routes.dash.skills.list} label="スキル" />
      </Group>
      <Group title="サイトの発信">
        <Tile href={routes.dash.notes.list} label="note" />
        <Tile href={routes.dash.lifeEvents.list} label="life event" />
        <Tile href={routes.dash.activities.list} label="外部の activity" />
      </Group>
    </main>
  );
};

export default Page;
