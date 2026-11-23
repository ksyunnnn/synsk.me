import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { listOrganizations } from '@/features/organization/server/queries';
import { NO_PROJECT_FILTER } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { firstParam } from '@/shared/domain/search-param';
import { routes } from '@/shared/routes';
import { OrganizationDetail } from './_detail';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * 組織の Split view。組織は主に実績と職歴を絞る手がかりなので、シングルには職歴と、職歴に入る
 * 実績の件数と、実績の一覧への導線を出す（#366 の明文化）
 */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: firstParam(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const [organizations, careers, { projects, organizations: withProjects }] = await Promise.all([
    listOrganizations(),
    listCareers(),
    listProjects(NO_PROJECT_FILTER),
  ]);
  const selected = params.selected ?? null;
  const link = (changes: Record<string, string | null>) =>
    withParam(routes.dash.organizations.list, params, changes);
  const careersOf = (name: string) => careers.filter((c) => c.organizationName === name);
  const projectsOf = (name: string) => projects.filter((p) => p.organizationName === name);

  const collection = (
    <>
      <CollectionToolbar title="組織" summary={`${organizations.length} 件`} />
      <p className="px-5 pb-3 text-small text-muted-foreground">
        組織は、職歴と実績の組織名を入れると作られます
      </p>
      {firstParam(raw.deleted) === '1' && (
        <SavedNotice flags={['deleted']} className="px-5 pb-2">
          組織を削除しました
        </SavedNotice>
      )}
      {organizations.length === 0 ? (
        <CollectionEmpty>登録した組織はありません</CollectionEmpty>
      ) : (
        <CollectionTable
          rows={organizations}
          rowKey={(o) => o.uid}
          rowHref={(o) => link({ selected: o.uid })}
          selectedKey={selected}
          draftKey={(o) => `organization:${o.uid}`}
          columns={[
            { header: '組織名', cell: (o) => o.name },
            {
              header: '職歴',
              cell: (o) => `${careersOf(o.name).length} 件`,
              nowrap: true,
              muted: true,
            },
            {
              header: '実績',
              cell: (o) => `${projectsOf(o.name).length} 件`,
              nowrap: true,
              muted: true,
            },
          ]}
        />
      )}
    </>
  );

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ組織"
      detail={
        selected && (
          <OrganizationDetail
            uid={selected}
            careers={careers}
            projects={projects}
            filterUid={withProjects.find((o) => o.uid === selected)?.uid}
            flags={{ saved: firstParam(raw.saved) }}
          />
        )
      }
    />
  );
};

export default Page;
