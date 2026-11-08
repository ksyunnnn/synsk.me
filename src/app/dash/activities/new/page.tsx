import type { Metadata } from 'next';
import { ActivityForm } from '@/features/activity/components/activity-form';
import { toActivityFormValues } from '@/features/activity/domain/activity';
import { registerActivity } from '@/features/activity/server/actions';
import { TextLink } from '@/shared/components/text-link';
import { requireAuthor } from '@/shared/server/author';

// 要求時のデータ（オーナーの確認）を `<Suspense>` の外で読み、描画を終えてから応答を返す
// （https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity を登録する | synsk.me' };

const Page = async () => {
  await requireAuthor();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/activities">外部の activity の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">外部の activity を登録する</h1>
      <p className="text-sm text-muted-foreground">
        一覧を取れない取得元の activity
        を登録します。一覧を取る取得元（Zenn・Qiita・dev.to・Medium・GitHub・Speaker
        Deck・connpass）の activity は、自動で取り込みます
      </p>
      <ActivityForm action={registerActivity} initialValues={toActivityFormValues()} />
    </main>
  );
};

export default Page;
