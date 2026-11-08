import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProjectForm } from '@/features/project/components/project-form';
import { PROJECT_UID_FIELD, toProjectFormValues } from '@/features/project/domain/project';
import {
  addProjectImage,
  chooseProjectCardImage,
  editProject,
} from '@/features/project/server/actions';
import { getProjectForEdit, listSkillOptions } from '@/features/project/server/queries';
import { ImageUploadSection } from '@/shared/components/image-upload-section';
import { OperationForm } from '@/shared/components/operation-form';
import { TextLink } from '@/shared/components/text-link';
import { listOrganizationNames } from '@/shared/server/organization-names';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '実績を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const DONE_MESSAGES: Record<string, string> = {
  'image-added': '画像を追加しました',
  'card-image': '代表画像を選びました',
};

const COMMON_MESSAGES: Record<string, string> = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、実績を読む前に 403 になる
  const project = await getProjectForEdit((await params).id);
  if (!project) notFound();
  const [query, skillOptions, organizationNames] = await Promise.all([
    searchParams,
    listSkillOptions(),
    listOrganizationNames(),
  ]);
  const done = first(query.done);
  const hidden = { [PROJECT_UID_FIELD]: project.uid };
  const imageUrl = (file: string) => `/dash/projects/${project.uid}/images/${file}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/projects">実績の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">実績を編集する</h1>
      {first(query.saved) === '1' && <p role="status">保存しました</p>}
      {done && DONE_MESSAGES[done] && <p role="status">{DONE_MESSAGES[done]}</p>}
      <p>
        <TextLink href={`/projects/${project.slug}`}>訪問者に見せるページを開く</TextLink>
      </p>
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <ProjectForm
        key={project.updatedAt}
        action={editProject}
        initialValues={toProjectFormValues(project)}
        skillOptions={skillOptions}
        organizationNames={organizationNames}
        project={{ uid: project.uid, updatedAt: project.updatedAt, isMasked: project.isMasked }}
      />

      <ImageUploadSection
        action={addProjectImage}
        hidden={hidden}
        ownerLabel="実績"
        images={project.images}
        imageUrl={imageUrl}
        addedImage={done === 'image-added' ? first(query.image) : null}
        visibility="本文に貼った画像と代表画像は、秘匿化しない実績でだけ訪問者に見えます。秘匿化した実績では見えません。"
        commonMessages={COMMON_MESSAGES}
      />

      <section
        className="flex flex-col gap-4 border-t border-border pt-6"
        aria-labelledby="card-image-heading"
      >
        <h2 id="card-image-heading" className="text-xl font-bold">
          代表画像
        </h2>
        <p className="text-sm text-muted-foreground">
          ページの URL
          が他のサービスに貼られたときのカードに出す画像です。この実績の画像から選びます。本文に貼らない画像も、上で追加すれば選べます。
        </p>
        <OperationForm
          action={chooseProjectCardImage}
          hidden={hidden}
          submitLabel="代表画像を選ぶ"
          commonMessages={COMMON_MESSAGES}
          messages={{ 'not-own-image': 'この実績の画像だけを選べます' }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">代表画像</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="cardImage"
                value=""
                defaultChecked={project.cardImageFile === null}
                className="size-4 accent-primary"
              />
              選ばない
            </label>
            {project.images.map((file, index) => (
              <label key={file} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cardImage"
                  value={file}
                  defaultChecked={project.cardImageFile === file}
                  className="size-4 accent-primary"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(file)} alt="" className="size-12 rounded-md object-cover" />
                実績の画像 {index + 1}
              </label>
            ))}
          </fieldset>
        </OperationForm>
      </section>

      <p className="border-t border-border pt-6">
        <TextLink href={`/dash/projects/${project.uid}/delete`}>この実績を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
