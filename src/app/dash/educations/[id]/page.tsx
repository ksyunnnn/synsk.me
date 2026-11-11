import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EducationForm } from '@/features/education/components/education-form';
import { toEducationFormValues } from '@/features/education/domain/education';
import { editEducation } from '@/features/education/server/actions';
import { getEducationForEdit } from '@/features/education/server/queries';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴を編集する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、学歴を読む前に 403 になる
  const education = await getEducationForEdit((await params).id);
  if (!education) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href={routes.dash.educations.list}>学歴の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">学歴を編集する</h1>
      <EducationForm
        action={editEducation}
        initialValues={toEducationFormValues(education)}
        educationUid={education.uid}
      />
      <p>
        <TextLink href={routes.dash.educations.delete(education.uid)}>この学歴を削除する</TextLink>
      </p>
    </main>
  );
};

export default Page;
