import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeleteOrganizationForm } from '@/features/organization/components/delete-organization-form';
import { deleteOrganization } from '@/features/organization/server/actions';
import { getOrganizationForEdit } from '@/features/organization/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { TextLink } from '@/shared/components/text-link';
import { routes } from '@/shared/routes';

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
    <DashPage title="組織を削除する">
      <p>次の組織を削除します。職歴か実績が指している組織と、個人の組織は消せません。</p>
      <p>組織名: {organization.name}</p>
      <DeleteOrganizationForm action={deleteOrganization} organizationUid={organization.uid} />
      <p>
        <TextLink href={routes.dash.organizations.row(organization.uid)}>編集の画面へ戻る</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
