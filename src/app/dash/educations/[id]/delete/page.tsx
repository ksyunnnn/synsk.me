import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EDUCATION_UID_FIELD } from '@/features/education/domain/education';
import { deleteEducation } from '@/features/education/server/actions';
import { getEducationForEdit } from '@/features/education/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { DeleteForm } from '@/shared/components/delete-form';
import { FORBIDDEN_MESSAGE } from '@/shared/components/form-alert';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '学歴を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、学歴を読む前に 403 になる
  const education = await getEducationForEdit((await params).id);
  if (!education) notFound();

  return (
    <DashPage title="学歴を削除する">
      <p>次の学歴を削除します。戻せません。作った職務経歴書の中身は残ります。</p>
      <p>{education.school}</p>
      <DeleteForm
        action={deleteEducation}
        uidField={EDUCATION_UID_FIELD}
        uid={education.uid}
        messages={{
          forbidden: FORBIDDEN_MESSAGE,
        }}
      />
      <p>
        <TextLink href={routes.dash.educations.row(education.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
