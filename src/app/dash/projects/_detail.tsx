import { listCareers } from '@/features/career/server/queries';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { EditProjectForm } from '@/app/dash/projects/_edit-project-form';
import { ProjectMediaSection } from '@/features/project/components/project-media-section';
import { toProjectFormValues } from '@/features/project/domain/project';
import {
  addProjectMedia,
  attachProjectMedia,
  changeProjectCardImage,
  deleteProjectMedia,
  editProject,
} from '@/features/project/server/actions';
import { getProjectForEdit, listSkillOptions } from '@/features/project/server/queries';
import {
  listResumesCopyingProject,
  listResumesUsingProjectMedia,
} from '@/features/resume/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailBody } from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { readMarkdown } from '@/shared/domain/markdown';
import { careersOfProject, formatPeriod } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

/** 同じ画面へ戻ったときの知らせ。URL の値で選ぶ */
const NOTICES = {
  saved: '保存しました',
  mediaAdded: '画像を足しました',
  cardImageChanged: '代表画像を変えました',
  mediaDeleted: '画像を削除しました',
} as const;

/**
 * 実績のシングル。編集の項目と、計算で決まる関係（入る職歴・写した職務経歴書）を出す。関係は表示
 * だけで、ここでは直さない（#366 の明文化の「2. ビュー」）
 */
export const ProjectDetail = async ({
  uid,
  flags,
}: {
  uid: string;
  flags: Record<string, string | undefined>;
}) => {
  const project = await getProjectForEdit(uid);
  if (!project)
    return <p className="py-12 text-center text-muted-foreground">この実績はありません</p>;
  const [skillOptions, organizationNames, careers, copiedTo, resumesUsingMedia] = await Promise.all(
    [
      listSkillOptions(),
      listOrganizationNames(),
      listCareers(),
      // 実績を写した職務経歴書。写しは元から切り離されているので、写したことだけを示す
      listResumesCopyingProject(project.id),
      listResumesUsingProjectMedia(project.id),
    ],
  );
  const ownCareers = careersOfProject(
    { organizationId: project.organization.id, period: project.period },
    careers,
  );
  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
    (key) => flags[key] === '1',
  );

  return (
    <DetailBody
      title={project.title}
      draftKey={`project:${project.uid}`}
      notice={
        notice && (
          <SavedNotice key={`${notice}-${project.updatedAt}`} flags={[notice]}>
            {NOTICES[notice]}
          </SavedNotice>
        )
      }
      form={
        // 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す
        <EditProjectForm
          key={project.updatedAt}
          action={editProject}
          initialValues={toProjectFormValues(project)}
          organizationNames={organizationNames}
          skillOptions={skillOptions}
          project={{
            uid: project.uid,
            updatedAt: project.updatedAt,
            isMasked: project.isMasked,
            mediaStorageKeys: project.mediaStorageKeys,
          }}
          attachMedia={attachProjectMedia}
        />
      }
      relations={
        <>
          <DetailFacts
            facts={[
              {
                label: '入る職歴',
                value:
                  ownCareers.length === 0
                    ? 'なし'
                    : ownCareers.map((c) => `${c.role}（${formatPeriod(c.period)}）`).join('、'),
              },
              {
                label: '写した職務経歴書',
                value:
                  copiedTo.length === 0
                    ? 'なし'
                    : copiedTo.map((resume) => resume.title).join('、'),
              },
            ]}
          />
          <p className="text-small">
            <TextLink href={routes.project(project.slug)}>訪問者に見せるページを開く</TextLink>
          </p>
        </>
      }
      sections={[
        {
          heading: '画像',
          headingId: 'project-media-heading',
          content: (
            <ProjectMediaSection
              key={`media-${project.updatedAt}-${project.cardMediaKey ?? ''}`}
              projectUid={project.uid}
              mediaStorageKeys={project.mediaStorageKeys}
              cardMediaKey={project.cardMediaKey}
              bodyMediaKeys={readMarkdown(project.description ?? '').mediaKeys}
              mediaUrls={Object.fromEntries(
                project.mediaStorageKeys.map((key) => [
                  key,
                  routes.dash.projects.media(project.uid, key),
                ]),
              )}
              resumesUsingMedia={resumesUsingMedia}
              changeCardImage={changeProjectCardImage}
              addMedia={addProjectMedia}
              deleteMedia={deleteProjectMedia}
            />
          ),
        },
      ]}
      deletion={{ href: routes.dash.projects.delete(project.uid), label: 'この実績を削除する' }}
    />
  );
};
