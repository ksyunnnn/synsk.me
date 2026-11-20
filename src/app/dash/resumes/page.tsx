import type { Metadata } from 'next';
import { formatExpires, isExpired } from '@/features/resume/domain/resume';
import { getResumeForEdit, listResumes } from '@/features/resume/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
} from '@/shared/components/split-view';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職務経歴書 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

/**
 * 職務経歴書のコレクション。1 件を選ぶと、更新が最も多い写した実績の中身へ 1 回で入る
 * （#366 の明文化の「入口」）
 */
const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const resumes = await listResumes();
  const contents = await Promise.all(resumes.map((resume) => getResumeForEdit(resume.uid)));
  const { deleted } = await searchParams;
  const now = new Date();
  const rows = resumes.map((resume, index) => ({ resume, content: contents[index] }));

  return (
    <main className="relative rounded-3xl bg-background pb-4">
      <CollectionToolbar
        title="職務経歴書"
        summary={`${resumes.length} 件`}
        action={{ href: routes.dash.resumes.new, label: '作る' }}
      />
      {deleted === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          職務経歴書を削除しました
        </SavedNotice>
      )}
      {resumes.length === 0 ? (
        <CollectionEmpty>作った職務経歴書はありません</CollectionEmpty>
      ) : (
        <CollectionTable
          rows={rows}
          rowKey={({ resume }) => resume.uid}
          rowHref={({ resume }) => routes.dash.resumes.entries(resume.uid, 'projects')}
          selectedKey={null}
          columns={[
            { header: '題', cell: ({ resume }) => resume.title },
            {
              header: '種類と状態',
              cell: ({ resume }) =>
                `${resume.audience === 'limited' ? '限定公開用' : '公開用'}・${resume.status === 'draft' ? '非公開' : '公開中'}${
                  resume.audience === 'limited'
                    ? `・${resume.limitedExpiresAt === null ? '' : '期限 '}${formatExpires(resume.limitedExpiresAt)}${isExpired(resume.limitedExpiresAt, now) ? '（過ぎています）' : ''}`
                    : ''
                }`,
              muted: true,
            },
            {
              header: '写した実績',
              cell: ({ content }) => `${content?.projects.length ?? 0} 件`,
              nowrap: true,
            },
            {
              header: '写した職歴',
              cell: ({ content }) => `${content?.careers.length ?? 0} 件`,
              nowrap: true,
            },
          ]}
        />
      )}
    </main>
  );
};

export default Page;
