import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listOrganizationNames } from '@/features/organization/server/queries';
import { CareerForm } from '@/features/career/components/career-form';
import { CAREER_UID_FIELD, toCareerFormValues } from '@/features/career/domain/career';
import { addCareerMedia, editCareer } from '@/features/career/server/actions';
import { getCareerForEdit } from '@/features/career/server/queries';
import { DashPage } from '@/shared/components/dash-page';
import { SavedNotice } from '@/shared/components/saved-notice';
import { TextLink } from '@/shared/components/text-link';
import { MediaUploadForm } from '@/shared/components/media-upload-form';
import { routes } from '@/shared/routes';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '職歴を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[]; mediaAdded?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、職歴を読む前に 403 になる
  const career = await getCareerForEdit((await params).id);
  if (!career) notFound();
  const [{ saved, mediaAdded }, organizationNames] = await Promise.all([
    searchParams,
    listOrganizationNames(),
  ]);

  return (
    <DashPage
      back={{ href: routes.dash.careers.list, label: '職歴の一覧へ戻る' }}
      title="職歴を編集する"
    >
      {mediaAdded === '1' && (
        <SavedNotice key={career.updatedAt} flags={['mediaAdded']} className="text-sm">
          画像を足しました
        </SavedNotice>
      )}
      {saved === '1' && (
        <SavedNotice key={career.updatedAt} flags={['saved']}>
          保存しました
        </SavedNotice>
      )}
      {/* 保存のたびに更新日時が変わる。入力の初めの値を、保存した値で描き直す */}
      <CareerForm
        key={career.updatedAt}
        action={editCareer}
        initialValues={toCareerFormValues(career)}
        organizationNames={organizationNames}
        career={{ uid: career.uid, updatedAt: career.updatedAt }}
      />
      <MediaUploadForm
        action={addCareerMedia}
        owner={{ field: CAREER_UID_FIELD, uid: career.uid }}
        mediaStorageKeys={career.mediaStorageKeys}
      />
      <p>
        <TextLink href={routes.dash.careers.delete(career.uid)}>この職歴を削除する</TextLink>
      </p>
    </DashPage>
  );
};

export default Page;
