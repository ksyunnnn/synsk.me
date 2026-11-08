import type { Metadata } from 'next';
import { listOrganizations } from '@/features/organization/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織 | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const organizations = await listOrganizations();
  const { deleted } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">組織</h1>
      {deleted === '1' && <p role="status">組織を削除しました</p>}
      <p>組織は、職歴と実績の入力の中で組織名を入れると作られます。</p>
      {organizations.length === 0 ? (
        <p>登録した組織はありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {organizations.map((organization) => (
            <li key={organization.id} className="flex flex-col">
              <TextLink href={`/dash/organizations/${organization.uid}`}>
                {organization.name}
              </TextLink>
              <span className="text-sm text-muted-foreground">
                秘匿化した組織名: {organization.nameMasked ?? '（なし）'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Page;
