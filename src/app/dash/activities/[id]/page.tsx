import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActivityForm } from '@/features/activity/components/activity-form';
import {
  canDelete,
  editableFieldsOf,
  toActivityFormValues,
} from '@/features/activity/domain/activity';
import { publishedAtToCalendarDate } from '@/features/activity/domain/date';
import { INTAKE_MODE_LABELS, SOURCE_LABELS, intakeModeOf } from '@/features/activity/domain/source';
import { editActivity } from '@/features/activity/server/actions';
import { getActivityForEdit } from '@/features/activity/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
};

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const activity = await getActivityForEdit((await params).id);
  if (!activity) notFound();
  const { saved } = await searchParams;
  const editable = editableFieldsOf(activity.source);
  const mode = intakeModeOf(activity.source);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/activities">外部の activity の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">外部の activity</h1>
      {saved === '1' && <p role="status">保存しました</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">取得元</dt>
        <dd>
          {SOURCE_LABELS[activity.source]}（{INTAKE_MODE_LABELS[mode]}）
        </dd>
        <dt className="text-muted-foreground">題</dt>
        <dd>{activity.title}</dd>
        <dt className="text-muted-foreground">URL</dt>
        <dd className="break-all">
          <a
            href={activity.url}
            rel="noopener noreferrer"
            className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {activity.url}
          </a>
        </dd>
        <dt className="text-muted-foreground">日付</dt>
        <dd>{publishedAtToCalendarDate(activity.publishedAt)}</dd>
      </dl>

      {editable.length === 0 ? (
        <p>
          一覧を取る取得元の activity は、synsk.me
          の側で書き換えも削除もできません。出したくないときは、取得元で非公開にします
        </p>
      ) : (
        // 保存のたびに値が変わる。入力の初めの値を、保存した値で描き直す
        <ActivityForm
          key={`${activity.url}|${activity.title}|${activity.publishedAt}`}
          action={editActivity}
          initialValues={toActivityFormValues(activity)}
          activity={{ uid: activity.uid, editable }}
        />
      )}

      {canDelete(activity.source) && (
        <p>
          <TextLink href={`/dash/activities/${activity.uid}/delete`}>
            この activity を削除する
          </TextLink>
        </p>
      )}
    </main>
  );
};

export default Page;
