import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CareerForm } from '@/features/career/components/career-form';
import { CAREER_UID_FIELD, toCareerFormValues } from '@/features/career/domain/career';
import { addCareerImage, editCareer } from '@/features/career/server/actions';
import { ImageUploadSection } from '@/shared/components/image-upload-section';
import { getCareerForEdit, getCareerProjectsForEdit } from '@/features/career/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { listOrganizationNames } from '@/shared/server/organization-names';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、職歴を読む前に 403 になる
  const career = await getCareerForEdit((await params).id);
  if (!career) notFound();
  const [query, organizationNames, related] = await Promise.all([
    searchParams,
    listOrganizationNames(),
    getCareerProjectsForEdit(career),
  ]);
  const saved = first(query.saved);
  const done = first(query.done);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/careers">職歴の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">職歴を編集する</h1>
      {saved === '1' && <p role="status">保存しました</p>}
      {done === 'image-added' && <p role="status">画像を追加しました</p>}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <CareerForm
        key={career.updatedAt}
        action={editCareer}
        initialValues={toCareerFormValues(career)}
        organizationNames={organizationNames}
        career={{ uid: career.uid, updatedAt: career.updatedAt }}
      />
      <ImageUploadSection
        action={addCareerImage}
        hidden={{ [CAREER_UID_FIELD]: career.uid }}
        ownerLabel="職歴"
        images={career.images}
        imageUrl={(file) => `/dash/careers/${career.uid}/images/${file}`}
        addedImage={done === 'image-added' ? first(query.image) : null}
        visibility="本文に貼った画像は、秘匿化しない職歴でだけ訪問者に見えます。職歴は代表画像を持ちません。"
        commonMessages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <section className="flex flex-col gap-2" aria-labelledby="career-projects">
        <h2 id="career-projects" className="text-lg font-bold">
          この職歴の実績とスキル
        </h2>
        <p className="text-sm text-muted-foreground">
          同じ組織で、期間が重なる実績です。保存した職歴の値から求めます
        </p>
        {related.projects.length === 0 ? (
          <p>当てはまる実績はありません</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1">
              {related.projects.map((project, index) => (
                <li key={index}>
                  {project.title}
                  <span className="text-sm text-muted-foreground">
                    （{project.period.startedOn} 〜 {project.period.endedOn ?? ''}）
                  </span>
                </li>
              ))}
            </ul>
            <p>スキル: {related.skills.length === 0 ? 'なし' : related.skills.join('、')}</p>
          </>
        )}
      </section>
      <p>
        <TextLink href={`/dash/careers/${career.uid}/delete`}>この職歴を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
