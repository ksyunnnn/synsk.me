import type { CareerSummary } from '@/features/career/domain/career';
import { OrganizationForm } from '@/features/organization/components/organization-form';
import { editOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit } from '@/features/organization/server/queries';
import type { ProjectSummary } from '@/features/project/domain/project';
import { DetailFacts } from '@/shared/components/detail-facts';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailBody } from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { formatPeriod, projectsOfCareer } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

/**
 * 組織のシングル。職歴と、職歴に入る実績の件数と、実績の一覧への導線を出す（#366 の明文化）。
 * `careers` と `projects` は、一覧の画面が読んだすべての職歴と実績を受け取る。`filterUid` は、
 * 実績の一覧をこの組織で絞るときの組織の uid。実績が無ければ undefined
 */
export const OrganizationDetail = async ({
  uid,
  careers,
  projects,
  filterUid,
  flags,
}: {
  uid: string;
  careers: readonly CareerSummary[];
  projects: readonly ProjectSummary[];
  filterUid: string | undefined;
  flags: Record<string, string | undefined>;
}) => {
  const found = await getOrganizationForEdit(uid);
  if (!found)
    return <p className="py-12 text-center text-muted-foreground">この組織はありません</p>;
  const { organization, references } = found;
  const own = careers
    .filter((c) => c.organizationName === organization.name)
    .sort((a, b) => b.period.startedOn.localeCompare(a.period.startedOn));
  const ownProjects = projects.filter((p) => p.organizationName === organization.name);
  return (
    <DetailBody
      title={organization.name}
      draftKey={`organization:${organization.uid}`}
      notice={
        flags.saved === '1' && (
          <SavedNotice key={`saved-${organization.updatedAt}`} flags={['saved']}>
            保存しました
          </SavedNotice>
        )
      }
      form={
        // 選んだ 1 件と、保存のたびに変わる更新日時で見分ける。更新日時だけでは、同じ更新日時の
        // 1 件を選び直しても前の 1 件の入力が残る（issue #395）
        <OrganizationForm
          key={`${organization.uid}:${organization.updatedAt}`}
          action={editOrganization}
          organizationUid={organization.uid}
          initialValues={{ name: organization.name, nameMasked: organization.nameMasked ?? '' }}
          isReferencedByMasked={references.isReferencedByMasked}
        />
      }
      relations={
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
                        <TextLink href={routes.dash.careers.selected(career.uid)}>
                          {career.role}
                        </TextLink>
                        <span className="text-muted-foreground">
                          {' '}
                          {formatPeriod(career.period)}・実績{' '}
                          {projectsOfCareer(career, ownProjects).length} 件
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              label: '実績',
              value: filterUid ? (
                <TextLink
                  href={routes.dash.projects.listBy({ kind: null, organizationUid: filterUid })}
                >
                  この組織の実績 {ownProjects.length} 件を見る
                </TextLink>
              ) : (
                'なし'
              ),
            },
          ]}
        />
      }
      deletion={
        references.isReferenced
          ? undefined
          : {
              href: routes.dash.organizations.delete(organization.uid),
              label: 'この組織を削除する',
            }
      }
    />
  );
};
