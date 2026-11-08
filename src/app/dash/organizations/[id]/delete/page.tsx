import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteOrganizationForm } from '@/features/organization/components/delete-organization-form';
import { deleteOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit } from '@/features/organization/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '組織を削除する | synsk.me' };

type Props = { params: Promise<{ id: string }> };

const Page = async ({ params }: Props) => {
  // オーナーでなければ、組織を読む前に 403 になる
  const found = await getOrganizationForEdit((await params).id);
  if (!found) notFound();
  const { organization } = found;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">組織を削除する</h1>
      <p>次の組織を削除します。職歴か実績が指している組織と、個人の組織は消せません。</p>
      <p>組織名: {organization.name}</p>
      <DeleteOrganizationForm action={deleteOrganization} organizationUid={organization.uid} />
      <p>
        <TextLink href={`/dash/organizations/${organization.uid}`}>編集の画面へ戻る</TextLink>
      </p>
    </main>
  );
};

export default Page;
