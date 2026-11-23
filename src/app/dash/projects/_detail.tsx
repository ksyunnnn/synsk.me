import { listCareers } from '@/features/career/server/queries';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { ProjectCardImageForm } from '@/features/project/components/project-card-image-form';
import { ProjectForm } from '@/features/project/components/project-form';
import {
  AS_CARD_IMAGE_FIELD,
  PROJECT_UID_FIELD,
  toProjectFormValues,
} from '@/features/project/domain/project';
import {
  addProjectMedia,
  changeProjectCardImage,
  editProject,
} from '@/features/project/server/actions';
import { getProjectForEdit, listSkillOptions } from '@/features/project/server/queries';
import { listResumesCopyingProject } from '@/features/resume/server/queries';
import { DetailFacts } from '@/shared/components/detail-facts';
import { MediaUploadForm } from '@/shared/components/media-upload-form';
import { SavedNotice } from '@/shared/components/saved-notice';
import { DetailHeading } from '@/shared/components/split-view';
import { TextLink } from '@/shared/components/text-link';
import { careersOfProject, formatPeriod } from '@/shared/domain/period';
import { routes } from '@/shared/routes';

/** 詳細のフォームの id。詳細のペインのツールバーの保存のボタンが、`form` 属性で指す */
export const PROJECT_DETAIL_FORM_ID = 'project-detail-form';

/** 同じ画面へ戻ったときの知らせ。URL の値で選ぶ */
const NOTICES = {
  saved: '保存しました',
  mediaAdded: '画像を足しました',
  cardImageChanged: '代表画像を変えました',
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
  const [skillOptions, organizationNames, careers, copiedTo] = await Promise.all([
    listSkillOptions(),
    listOrganizationNames(),
    listCareers(),
    // 実績を写した職務経歴書。写しは元から切り離されているので、写したことだけを示す
    listResumesCopyingProject(project.id),
  ]);
  const ownCareers = careersOfProject(
    { organizationId: project.organization.id, period: project.period },
    careers,
  );
  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
    (key) => flags[key] === '1',
  );

  return (
    <div className="flex flex-col gap-6">
      <DetailHeading compact title={project.title} draftKey={`project:${project.uid}`} />
      {notice && (
        <SavedNotice key={`${notice}-${project.updatedAt}`} flags={[notice]}>
          {NOTICES[notice]}
        </SavedNotice>
      )}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <ProjectForm
        key={project.updatedAt}
        action={editProject}
        initialValues={toProjectFormValues(project)}
        organizationNames={organizationNames}
        skillOptions={skillOptions}
        project={{ uid: project.uid, updatedAt: project.updatedAt, isMasked: project.isMasked }}
        formId={PROJECT_DETAIL_FORM_ID}
      />
      {/* 計算で決まる関係は、入力の後に置く（HIG Layout の「Order content by relative importance」） */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h3 className="text-caption text-muted-foreground">つながり</h3>
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
                copiedTo.length === 0 ? 'なし' : copiedTo.map((resume) => resume.title).join('、'),
            },
          ]}
        />
        <p className="text-small">
          <TextLink href={routes.project(project.slug)}>訪問者に見せるページを開く</TextLink>
        </p>
      </section>
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h3 id="project-media-heading" className="text-caption text-muted-foreground">
          画像
        </h3>
        <MediaUploadForm
          labelledBy="project-media-heading"
          action={addProjectMedia}
          owner={{ field: PROJECT_UID_FIELD, uid: project.uid }}
          mediaStorageKeys={project.mediaStorageKeys}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name={AS_CARD_IMAGE_FIELD}
              value="1"
              className="size-4 accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            代表画像にする
          </label>
        </MediaUploadForm>
        <ProjectCardImageForm
          key={`card-${project.updatedAt}`}
          action={changeProjectCardImage}
          projectUid={project.uid}
          current={project.cardMediaKey}
          mediaStorageKeys={project.mediaStorageKeys}
        />
      </section>
      <p className="border-t border-border pt-6 text-small">
        <TextLink href={routes.dash.projects.delete(project.uid)}>この実績を削除する</TextLink>
      </p>
    </div>
  );
};
