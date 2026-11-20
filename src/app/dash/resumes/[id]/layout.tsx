import type { ReactNode } from 'react';
import { ResumeTabs } from '@/features/resume/components/resume-tabs';
import { getResumeForEdit } from '@/features/resume/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

/**
 * 職務経歴書のシングル。上にパンくずと題、中身を切り替える Tab view を置き、下に選んだ中身を出す
 * （#366 の明文化の「職務経歴書」）。パンくずは W3C APG Breadcrumb の形にする
 */
const Layout = async ({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) => {
  // オーナーでなければ、読む前に 403 になる
  const resume = await getResumeForEdit((await params).id);
  // 無い職務経歴書（`missing` の画面など）は、ページに任せる
  if (!resume) return children;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 rounded-3xl bg-background px-6 pt-5 pb-4">
        <nav aria-label="パンくず" className="text-small text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            <li>
              <TextLink href={routes.dash.resumes.list}>職務経歴書</TextLink>
              <span aria-hidden> / </span>
            </li>
            <li>
              <span aria-current="page">{resume.title}</span>
            </li>
          </ol>
        </nav>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-heading-2 font-semibold tracking-heading">{resume.title}</h1>
          <p className="text-small text-muted-foreground">
            {resume.audience === 'limited' ? '限定公開用' : '公開用'}・
            {resume.status === 'draft' ? '非公開' : '公開中'}・写した実績 {resume.projects.length}{' '}
            件・写した職歴 {resume.careers.length} 件
          </p>
        </div>
        <ResumeTabs uid={resume.uid} />
      </header>
      {children}
    </div>
  );
};

export default Layout;
