import type { Metadata } from 'next';
import { publishedAtToCalendarDate } from '@/features/activity/domain/date';
import {
  INTAKE_MODE_LABELS,
  LIST_SOURCES,
  SOURCE_LABELS,
  intakeModeOf,
} from '@/features/activity/domain/source';
import { listActivities } from '@/features/activity/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: '外部の activity | synsk.me' };

type Props = { searchParams: Promise<{ deleted?: string | string[] }> };

/** 日時を日本時間で出す。管理画面だけで使い、訪問者には出さない */
const formatDateTime = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));

const Page = async ({ searchParams }: Props) => {
  // オーナーでなければ、読む前に 403 になる
  const { activities, fetchResults } = await listActivities();
  const { deleted } = await searchParams;
  const resultBySource = new Map(fetchResults.map((result) => [result.source, result]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 flex flex-col gap-8">
      <p>
        <TextLink href="/dash">管理画面へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold">外部の activity</h1>
      {deleted === '1' && <p role="status">外部の activity を削除しました</p>}
      <p>
        <TextLink href="/dash/activities/new">URL を指名して、または手で入力して登録する</TextLink>
      </p>

      <section aria-labelledby="fetch-results-heading" className="flex flex-col gap-3">
        <h2 id="fetch-results-heading" className="text-xl font-bold">
          取得の結果
        </h2>
        <p className="text-sm text-muted-foreground">
          一覧を取る取得元は、8 時間に 1 回取り直します。失敗した取得元の activity
          は、前回の値のまま残ります
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4">
                  取得元
                </th>
                <th scope="col" className="py-2 pr-4">
                  成否
                </th>
                <th scope="col" className="py-2 pr-4">
                  取り直した日時
                </th>
                <th scope="col" className="py-2 pr-4">
                  最後に成功した日時
                </th>
                <th scope="col" className="py-2">
                  理由
                </th>
              </tr>
            </thead>
            <tbody>
              {LIST_SOURCES.map((source) => {
                const result = resultBySource.get(source);
                return (
                  <tr key={source} className="border-b border-border align-top">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {SOURCE_LABELS[source]}
                    </th>
                    <td className="py-2 pr-4">
                      {result ? (result.isOk ? '成功' : '失敗') : 'まだ取っていない'}
                    </td>
                    <td className="py-2 pr-4">{formatDateTime(result?.fetchedAt ?? null)}</td>
                    <td className="py-2 pr-4">{formatDateTime(result?.lastSucceededAt ?? null)}</td>
                    <td className="py-2">{result?.reason ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="activities-heading" className="flex flex-col gap-3">
        <h2 id="activities-heading" className="text-xl font-bold">
          取り込んだ activity
        </h2>
        {activities.length === 0 ? (
          <p>取り込んだ activity はありません</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activities.map((activity) => (
              <li key={activity.id} className="flex flex-col">
                <TextLink href={`/dash/activities/${activity.uid}`}>{activity.title}</TextLink>
                <span className="text-sm text-muted-foreground">
                  {SOURCE_LABELS[activity.source]}・
                  {publishedAtToCalendarDate(activity.publishedAt)}・
                  {INTAKE_MODE_LABELS[intakeModeOf(activity.source)]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default Page;
