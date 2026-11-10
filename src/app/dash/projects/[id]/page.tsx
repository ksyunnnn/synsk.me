import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
import { TextLink } from '@/shared/components/text-link';
import { DraftSavedNotice } from '@/shared/components/draft-retention';
import { MediaUploadForm } from '@/shared/components/media-upload-form';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 同じ画面へ戻ったときの知らせ。URL の値で選ぶ */
const NOTICES = {
  mediaAdded: '画像を足しました',
  cardImageChanged: '代表画像を変えました',
} as const;

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、実績を読む前に 403 になる
  const project = await getProjectForEdit((await params).id);
  if (!project) notFound();
  const [flags, skillOptions, organizationNames] = await Promise.all([
    searchParams,
    listSkillOptions(),
    listOrganizationNames(),
  ]);
  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
    (key) => flags[key] === '1',
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/projects">実績の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績を編集する</h1>
      {notice && (
        <p role="status" className="text-sm">
          {NOTICES[notice]}
        </p>
      )}
      {flags.saved === '1' && (
        <DraftSavedNotice
          storageKeys={['project:new', `project:${project.uid}`]}
          version={project.updatedAt}
        />
      )}
      <p>
        <TextLink href={`/projects/${project.slug}`}>訪問者に見せるページを開く</TextLink>
      </p>
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <ProjectForm
        key={project.updatedAt}
        action={editProject}
        initialValues={toProjectFormValues(project)}
        organizationNames={organizationNames}
        skillOptions={skillOptions}
        project={{ uid: project.uid, updatedAt: project.updatedAt, isMasked: project.isMasked }}
      />
      <MediaUploadForm
        action={addProjectMedia}
        owner={{ field: PROJECT_UID_FIELD, uid: project.uid }}
        mediaStorageKeys={project.mediaStorageKeys}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name={AS_CARD_IMAGE_FIELD}
            value="1"
            className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      <p>
        <TextLink href={`/dash/projects/${project.uid}/delete`}>この実績を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
