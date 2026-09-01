import { SourceStatusPanel } from '@/components/timeline/SourceStatusPanel';
import { TimelineLab } from '@/components/timeline/TimelineLab';
import { isTimelineVariant, type TimelineVariant } from '@/components/timeline/variants/types';
import { fetchAllSources, groupByYear, mergeEntries } from '@/lib/timeline/registry';
import { TIMELINE_SOURCES } from '@/lib/timeline/sources';

// 外部 API の応答をその場で確かめるためのページなので、事前生成しない。
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Timeline — lab',
  robots: { index: false, follow: false },
};

const Page = async ({ searchParams }: { searchParams: Promise<{ ui?: string }> }) => {
  const { ui } = await searchParams;
  const initialVariant: TimelineVariant = isTimelineVariant(ui) ? ui : 'catnose';

  const results = await fetchAllSources(TIMELINE_SOURCES);
  const groups = groupByYear(mergeEntries(results));
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const okCount = results.filter((result) => result.status === 'ok').length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="mb-2 text-2xl font-bold">Timeline</h1>
      <p className="mb-12 text-sm text-muted-foreground">
        外部プラットフォームの取得可否を確かめる検証用ページ。{results.length} 件中 {okCount} 件が実
        API から取得でき、{total} 件を時系列に並べる。
      </p>

      <SourceStatusPanel results={results} />

      <TimelineLab groups={groups} now={Date.now()} initialVariant={initialVariant} />
    </main>
  );
};

export default Page;
