import type { Metadata } from 'next';
import { listCareers } from '@/features/career/server/queries';
import { OrganizationForm } from '@/features/organization/components/organization-form';
import { editOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit, listOrganizations } from '@/features/organization/server/queries';
import { listProjects } from '@/features/project/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { SavedNotice } from '@/shared/components/saved-notice';
import {
  CollectionEmpty,
  CollectionTable,
  CollectionToolbar,
  DetailHeading,
  SplitView,
  withParam,
} from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod, periodsOverlap } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織 | synsk.me' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const NO_FILTER = { kind: null, organizationUid: null, status: null, isMasked: null };

/**
 * 組織の Split view。組織は主に実績と職歴を絞る手がかりなので、シングルには職歴と、職歴に入る
 * 実績の件数と、実績の一覧への導線を出す（#366 の明文化）
 */
const Page = async ({ searchParams }: Props) => {
  const raw = await searchParams;
  const params = { selected: first(raw.selected) };
  // オーナーでなければ、読む前に 403 になる
  const [organizations, careers, { projects, organizations: withProjects }] = await Promise.all([
    listOrganizations(),
    listCareers(),
    listProjects(NO_FILTER),
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
      {first(raw.deleted) === '1' && (
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

  const detail = async (uid: string) => {
    const found = await getOrganizationForEdit(uid);
    if (!found)
      return <p className="py-12 text-center text-muted-foreground">この組織はありません</p>;
    const { organization, references } = found;
    const own = careersOf(organization.name).sort((a, b) =>
      b.period.startedOn.localeCompare(a.period.startedOn),
    );
    const ownProjects = projectsOf(organization.name);
    const filterUid = withProjects.find((o) => o.name === organization.name)?.uid;
    return (
      <div className="flex flex-col gap-6">
        <DetailHeading title={organization.name} draftKey={`organization:${organization.uid}`}>
          <DetailFacts
            facts={[
              {
                label: '職歴',
                value:
                  own.length === 0 ? (
                    'なし'
                  ) : (
                    <ul className="flex flex-col">
                      {own.map((career) => (
                        <li key={career.uid}>
                          <TextLink href={`${routes.dash.careers.list}?selected=${career.uid}`}>
                            {career.role}
                          </TextLink>
                          <span className="text-muted-foreground">
                            {' '}
                            {formatPeriod(career.period)}・実績{' '}
                            {
                              ownProjects.filter((p) => periodsOverlap(career.period, p.period))
                                .length
                            }{' '}
                            件
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                label: '実績',
                value: filterUid ? (
                  <TextLink href={`${routes.dash.projects.list}?org=${filterUid}`}>
                    この組織の実績 {ownProjects.length} 件を見る
                  </TextLink>
                ) : (
                  'なし'
                ),
              },
            ]}
          />
        </DetailHeading>
        {first(raw.saved) === '1' && (
          <SavedNotice key={organization.updatedAt} flags={['saved']}>
            保存しました
          </SavedNotice>
        )}
        <OrganizationForm
          key={organization.updatedAt}
          action={editOrganization}
          organizationUid={organization.uid}
          initialValues={{ name: organization.name, nameMasked: organization.nameMasked ?? '' }}
          isReferencedByMasked={references.isReferencedByMasked}
        />
        {!references.isReferenced && (
          <p className="border-t border-border pt-6 text-small">
            <TextLink href={routes.dash.organizations.delete(organization.uid)}>
              この組織を削除する
            </TextLink>
          </p>
        )}
      </div>
    );
  };

  return (
    <SplitView
      collection={collection}
      selected={selected !== null}
      closeHref={link({ selected: null })}
      detailLabel="選んだ組織"
      detail={selected && (await detail(selected))}
    />
  );
};

export default Page;
