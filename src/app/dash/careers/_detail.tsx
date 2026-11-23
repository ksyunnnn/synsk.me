import { CareerForm } from '@/features/career/components/career-form';
import { CAREER_UID_FIELD, toCareerFormValues } from '@/features/career/domain/career';
import { addCareerMedia, editCareer } from '@/features/career/server/actions';
import { getCareerForEdit } from '@/features/career/server/queries';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { NO_PROJECT_FILTER } from '@/features/project/domain/project';
import { listProjects } from '@/features/project/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { MediaUploadForm } from '@/shared/components/media-upload-form';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailHeading } from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { projectsOfCareer } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

/**
 * 職歴のシングル。期間の重なりで入る実績は、計算で決まるので表示だけにする
 * （#366 の明文化、ADR-0046）
 */
export const CareerDetail = async ({
  uid,
  flags,
}: {
  uid: string;
  flags: Record<string, string | undefined>;
}) => {
  const career = await getCareerForEdit(uid);
  if (!career)
    return <p className="py-12 text-center text-muted-foreground">この職歴はありません</p>;
  const [organizationNames, { projects, organizations }] = await Promise.all([
    listOrganizationNames(),
    listProjects(NO_PROJECT_FILTER),
  ]);
  const own = projectsOfCareer(
    { organizationId: career.organization.id, period: career.period },
    projects,
  );
  const organizationUid = organizations.find((o) => o.name === career.organization.name)?.uid;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeading
        title={`${career.organization.name}・${career.role}`}
        draftKey={`career:${career.uid}`}
      >
        <DetailFacts
          facts={[
            {
              label: '入る実績',
              value:
                own.length === 0 ? (
                  'なし'
                ) : (
                  <ul className="flex flex-col">
                    {own.map((project) => (
                      <li key={project.uid}>
                        <TextLink
                          href={routes.dash.projects.listBy({
                            kind: null,
                            organizationUid: organizationUid ?? null,
                            selected: project.uid,
                          })}
                        >
                          {project.title}
                        </TextLink>
                      </li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </DetailHeading>
      {flags.saved === '1' && (
        <SavedNotice key={`saved-${career.updatedAt}`} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      {flags.mediaAdded === '1' && (
        <SavedNotice key={`mediaAdded-${career.updatedAt}`} flags={['mediaAdded']}>
          画像を足しました
        </SavedNotice>
      )}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <CareerForm
        key={career.updatedAt}
        action={editCareer}
        initialValues={toCareerFormValues(career)}
        organizationNames={organizationNames}
        career={{ uid: career.uid, updatedAt: career.updatedAt }}
      />
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h3 id="career-media-heading" className="text-caption text-muted-foreground">
          画像
        </h3>
        <MediaUploadForm
          labelledBy="career-media-heading"
          action={addCareerMedia}
          owner={{ field: CAREER_UID_FIELD, uid: career.uid }}
          mediaStorageKeys={career.mediaStorageKeys}
        />
      </section>
      <p className="border-t border-border pt-6 text-small">
        <TextLink href={routes.dash.careers.delete(career.uid)}>この職歴を削除する</TextLink>
      </p>
    </div>
  );
};
