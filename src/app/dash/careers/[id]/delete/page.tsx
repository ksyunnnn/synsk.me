import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CAREER_UID_FIELD } from '@/features/career/domain/career';
import { deleteCareer } from '@/features/career/server/actions';
import { getCareerForEdit } from '@/features/career/server/queries';
import { DeleteForm } from '@/shared/components/delete-form';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、職歴を読む前に 403 になる
  const career = await getCareerForEdit((await params).id);
  if (!career) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">職歴を削除する</h1>
      <p>次の職歴を削除します。戻せません。作った職務経歴書の中身は残ります。</p>
      <p>
        {career.organization.name}・{career.role}
      </p>
      <DeleteForm
        action={deleteCareer}
        uidField={CAREER_UID_FIELD}
        uid={career.uid}
        messages={{
          forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
        }}
      />
      <p>
        <TextLink href={`/dash/careers/${career.uid}`}>編集の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
