import type { Metadata } from 'next';
import { CareerForm } from '@/features/career/components/career-form';
import { toCareerFormValues } from '@/features/career/domain/career';
import { registerCareer } from '@/features/career/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（作り手の確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/careers">職歴の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">職歴を登録する</h1>
      <CareerForm action={registerCareer} initialValues={toCareerFormValues()} />
    </main>
  );
};

export default Page;
